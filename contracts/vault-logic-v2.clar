;; vault-logic-v2.clar
;; Business logic for sBTC Options Vault v2
;; All bug fixes applied: settlement div-by-zero, epoch duration validation,
;; fee deduction, withdrawal queue, emergency settle, payout cap
;; Reads/writes state via vault-data-v1

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant PRECISION u100000000)          ;; 8 decimals (satoshi)
(define-constant PRICE-PRECISION u1000000)      ;; 6 decimals for USD
(define-constant MANAGEMENT-FEE-BPS u200)       ;; 2%
(define-constant PERFORMANCE-FEE-BPS u1000)     ;; 10%
(define-constant BPS-DENOMINATOR u10000)
(define-constant MAX-WITHDRAWAL-PER-PERIOD-BPS u2500) ;; 25% of vault per period
(define-constant WITHDRAWAL-PERIOD-BLOCKS u144) ;; ~24 hours

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u3000))
(define-constant ERR-VAULT-PAUSED (err u3001))
(define-constant ERR-ZERO-AMOUNT (err u3002))
(define-constant ERR-INSUFFICIENT-SHARES (err u3003))
(define-constant ERR-EPOCH-ACTIVE (err u3004))
(define-constant ERR-NO-ACTIVE-EPOCH (err u3005))
(define-constant ERR-EPOCH-NOT-EXPIRED (err u3006))
(define-constant ERR-ALREADY-SETTLED (err u3007))
(define-constant ERR-TRANSFER-FAILED (err u3008))
(define-constant ERR-INVALID-EPOCH (err u3009))
(define-constant ERR-EPOCH-EXISTS (err u3010))
(define-constant ERR-NOT-MARKET (err u3011))
(define-constant ERR-INVALID-DURATION (err u3012))
(define-constant ERR-INVALID-SETTLEMENT-PRICE (err u3013))
(define-constant ERR-WITHDRAWAL-LIMIT (err u3014))
(define-constant ERR-NOT-PAUSED (err u3015))

;; ============================================
;; Admin Functions
;; ============================================

;; Set market contract address
(define-public (set-market-contract (market principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (try! (contract-call? .vault-data-v1 set-market-contract-addr market))
    (ok true)
  )
)

;; Set treasury address for fee collection
(define-public (set-treasury (addr principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (try! (contract-call? .vault-data-v1 set-treasury-address addr))
    (ok true)
  )
)

;; Pause/unpause vault
(define-public (set-vault-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (try! (contract-call? .vault-data-v1 set-vault-paused paused))
    (ok true)
  )
)

;; ============================================
;; User Functions
;; ============================================

;; Deposit sBTC into vault, receive shares
(define-public (deposit (token <sip-010-token>) (amount uint))
  (begin
    (asserts! (not (contract-call? .vault-data-v1 get-vault-paused)) ERR-VAULT-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (not (contract-call? .vault-data-v1 get-active-epoch)) ERR-EPOCH-ACTIVE)

    ;; Transfer sBTC from user to this contract
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

    (let (
      (current-total-shares (contract-call? .vault-data-v1 get-total-shares))
      (current-total-sbtc (contract-call? .vault-data-v1 get-total-sbtc-deposited))
      (new-shares (if (is-eq current-total-shares u0)
        amount
        (/ (* amount current-total-shares) current-total-sbtc)
      ))
    )
      ;; Update state via data contract
      (try! (contract-call? .vault-data-v1 set-total-shares (+ current-total-shares new-shares)))
      (try! (contract-call? .vault-data-v1 set-total-sbtc-deposited (+ current-total-sbtc amount)))
      (try! (contract-call? .vault-data-v1 set-user-shares tx-sender
        (+ (contract-call? .vault-data-v1 get-user-shares tx-sender) new-shares)
      ))

      (print {
        event: "deposit",
        user: tx-sender,
        amount: amount,
        shares-minted: new-shares,
        total-shares: (contract-call? .vault-data-v1 get-total-shares),
        total-sbtc: (contract-call? .vault-data-v1 get-total-sbtc-deposited)
      })

      (ok new-shares)
    )
  )
)

;; Withdraw sBTC by burning shares (with withdrawal queue)
(define-public (withdraw (token <sip-010-token>) (shares uint))
  (let (
    (user tx-sender)
  )
    (asserts! (> shares u0) ERR-ZERO-AMOUNT)
    (asserts! (not (contract-call? .vault-data-v1 get-active-epoch)) ERR-EPOCH-ACTIVE)

    (let (
      (user-share-balance (contract-call? .vault-data-v1 get-user-shares user))
      (current-total-shares (contract-call? .vault-data-v1 get-total-shares))
      (current-total-sbtc (contract-call? .vault-data-v1 get-total-sbtc-deposited))
    )
      (asserts! (>= user-share-balance shares) ERR-INSUFFICIENT-SHARES)

      (let (
        (sbtc-amount (/ (* shares current-total-sbtc) current-total-shares))
        (period-start (contract-call? .vault-data-v1 get-withdrawal-period-start))
        (withdrawals-so-far (contract-call? .vault-data-v1 get-withdrawals-this-period))
        (max-withdrawable (/ (* current-total-sbtc MAX-WITHDRAWAL-PER-PERIOD-BPS) BPS-DENOMINATOR))
      )
        ;; Reset withdrawal period if 24h passed
        (if (>= (- block-height period-start) WITHDRAWAL-PERIOD-BLOCKS)
          (begin
            (try! (contract-call? .vault-data-v1 set-withdrawal-period-start block-height))
            (try! (contract-call? .vault-data-v1 set-withdrawals-this-period u0))
            ;; Check limit with fresh period
            (asserts! (<= sbtc-amount max-withdrawable) ERR-WITHDRAWAL-LIMIT)
            (try! (contract-call? .vault-data-v1 set-withdrawals-this-period sbtc-amount))
          )
          (begin
            ;; Same period - check cumulative
            (asserts! (<= (+ withdrawals-so-far sbtc-amount) max-withdrawable) ERR-WITHDRAWAL-LIMIT)
            (try! (contract-call? .vault-data-v1 set-withdrawals-this-period (+ withdrawals-so-far sbtc-amount)))
          )
        )

        ;; Transfer sBTC from vault to user
        (try! (as-contract (contract-call? token transfer sbtc-amount tx-sender user none)))

        ;; Update state
        (try! (contract-call? .vault-data-v1 set-total-shares (- current-total-shares shares)))
        (try! (contract-call? .vault-data-v1 set-total-sbtc-deposited (- current-total-sbtc sbtc-amount)))
        (try! (contract-call? .vault-data-v1 set-user-shares user (- user-share-balance shares)))

        (print {
          event: "withdraw",
          user: tx-sender,
          shares-burned: shares,
          sbtc-returned: sbtc-amount,
          total-shares: (contract-call? .vault-data-v1 get-total-shares),
          total-sbtc: (contract-call? .vault-data-v1 get-total-sbtc-deposited)
        })

        (ok sbtc-amount)
      )
    )
  )
)

;; ============================================
;; Epoch Management (Admin)
;; ============================================

;; Start a new epoch
(define-public (start-epoch (strike-price uint) (premium uint) (duration uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (contract-call? .vault-data-v1 get-active-epoch)) ERR-EPOCH-ACTIVE)
    (asserts! (> (contract-call? .vault-data-v1 get-total-sbtc-deposited) u0) ERR-ZERO-AMOUNT)
    ;; BUG FIX: Validate duration > 0
    (asserts! (> duration u0) ERR-INVALID-DURATION)

    (let (
      (new-epoch-id (+ (contract-call? .vault-data-v1 get-current-epoch-id) u1))
      (collateral (contract-call? .vault-data-v1 get-total-sbtc-deposited))
      (expiry (+ block-height duration))
    )
      (try! (contract-call? .vault-data-v1 set-epoch new-epoch-id {
        strike-price: strike-price,
        premium: premium,
        collateral: collateral,
        start-block: block-height,
        expiry-block: expiry,
        settled: false,
        settlement-price: u0,
        premium-earned: u0,
        payout: u0,
        outcome: "N/A"
      }))

      (try! (contract-call? .vault-data-v1 set-current-epoch-id new-epoch-id))
      (try! (contract-call? .vault-data-v1 set-active-epoch true))

      (print {
        event: "epoch-started",
        epoch-id: new-epoch-id,
        strike-price: strike-price,
        premium: premium,
        collateral: collateral,
        expiry-block: expiry
      })

      (ok new-epoch-id)
    )
  )
)

;; Called by market contract when option is sold
(define-public (record-option-sale (epoch-id uint) (premium uint))
  (begin
    (asserts! (is-eq contract-caller (contract-call? .vault-data-v1 get-market-contract)) ERR-NOT-MARKET)
    (let (
      (epoch (unwrap! (contract-call? .vault-data-v1 get-epoch epoch-id) ERR-INVALID-EPOCH))
      (current-sbtc (contract-call? .vault-data-v1 get-total-sbtc-deposited))
      (current-premiums (contract-call? .vault-data-v1 get-total-premiums-earned))
    )
      ;; Add premium to vault TVL (auto-compound)
      (try! (contract-call? .vault-data-v1 set-total-sbtc-deposited (+ current-sbtc premium)))
      (try! (contract-call? .vault-data-v1 set-total-premiums-earned (+ current-premiums premium)))

      ;; Update epoch
      (try! (contract-call? .vault-data-v1 set-epoch epoch-id (merge epoch {
        premium-earned: (+ (get premium-earned epoch) premium)
      })))

      (print {
        event: "option-sold",
        epoch-id: epoch-id,
        premium: premium
      })

      (ok true)
    )
  )
)

;; Settle epoch with fee deduction
(define-public (settle-epoch (token <sip-010-token>) (epoch-id uint) (settlement-price uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (contract-call? .vault-data-v1 get-active-epoch) ERR-NO-ACTIVE-EPOCH)
    ;; BUG FIX: Validate settlement price > 0
    (asserts! (> settlement-price u0) ERR-INVALID-SETTLEMENT-PRICE)

    (let (
      (epoch (unwrap! (contract-call? .vault-data-v1 get-epoch epoch-id) ERR-INVALID-EPOCH))
    )
      (asserts! (not (get settled epoch)) ERR-ALREADY-SETTLED)
      (asserts! (>= block-height (get expiry-block epoch)) ERR-EPOCH-NOT-EXPIRED)

      (let (
        (strike (get strike-price epoch))
        (collateral (get collateral epoch))
        (premium-earned (get premium-earned epoch))
        (current-sbtc (contract-call? .vault-data-v1 get-total-sbtc-deposited))
        (is-itm (> settlement-price strike))
        (payout (if is-itm
          (let (
            (diff (- settlement-price strike))
            (raw-payout (/ (* collateral diff) settlement-price))
          )
            ;; BUG FIX: Cap payout at vault balance
            (if (> raw-payout current-sbtc) current-sbtc
              (if (> raw-payout collateral) collateral raw-payout)
            )
          )
          u0
        ))
        (outcome (if is-itm "ITM" "OTM"))
      )
        ;; FEE IMPLEMENTATION: Deduct management + performance fees
        (let (
          (management-fee (/ (* collateral MANAGEMENT-FEE-BPS) BPS-DENOMINATOR))
          (performance-fee (if (> premium-earned u0)
            (/ (* premium-earned PERFORMANCE-FEE-BPS) BPS-DENOMINATOR)
            u0
          ))
          (total-fees (+ management-fee performance-fee))
          (sbtc-after-payout (if is-itm (- current-sbtc payout) current-sbtc))
          ;; Don't take more fees than available
          (safe-fees (if (> total-fees sbtc-after-payout) sbtc-after-payout total-fees))
        )
          ;; Transfer fees to treasury
          (if (> safe-fees u0)
            (begin
              (try! (as-contract (contract-call? token transfer safe-fees tx-sender (contract-call? .vault-data-v1 get-treasury-address) none)))
              (try! (contract-call? .vault-data-v1 set-total-fees-collected
                (+ (contract-call? .vault-data-v1 get-total-fees-collected) safe-fees)
              ))
            )
            true
          )

          ;; Update TVL: deduct payout + fees
          (try! (contract-call? .vault-data-v1 set-total-sbtc-deposited (- sbtc-after-payout safe-fees)))

          ;; Update epoch
          (try! (contract-call? .vault-data-v1 set-epoch epoch-id (merge epoch {
            settled: true,
            settlement-price: settlement-price,
            payout: payout,
            outcome: outcome
          })))

          (try! (contract-call? .vault-data-v1 set-active-epoch false))
          (try! (contract-call? .vault-data-v1 set-total-epochs-completed
            (+ (contract-call? .vault-data-v1 get-total-epochs-completed) u1)
          ))

          (print {
            event: "epoch-settled",
            epoch-id: epoch-id,
            settlement-price: settlement-price,
            outcome: outcome,
            payout: payout,
            fees-collected: safe-fees
          })

          (ok { outcome: outcome, payout: payout, fees: safe-fees })
        )
      )
    )
  )
)

;; Emergency settle: settle at current price without waiting for expiry (only when paused)
(define-public (emergency-settle (token <sip-010-token>) (epoch-id uint) (settlement-price uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (contract-call? .vault-data-v1 get-vault-paused) ERR-NOT-PAUSED)
    (asserts! (contract-call? .vault-data-v1 get-active-epoch) ERR-NO-ACTIVE-EPOCH)
    (asserts! (> settlement-price u0) ERR-INVALID-SETTLEMENT-PRICE)

    (let (
      (epoch (unwrap! (contract-call? .vault-data-v1 get-epoch epoch-id) ERR-INVALID-EPOCH))
    )
      (asserts! (not (get settled epoch)) ERR-ALREADY-SETTLED)

      ;; Emergency: settle with zero payout (vault keeps everything, no ITM)
      (try! (contract-call? .vault-data-v1 set-epoch epoch-id (merge epoch {
        settled: true,
        settlement-price: settlement-price,
        payout: u0,
        outcome: "OTM"
      })))

      (try! (contract-call? .vault-data-v1 set-active-epoch false))
      (try! (contract-call? .vault-data-v1 set-total-epochs-completed
        (+ (contract-call? .vault-data-v1 get-total-epochs-completed) u1)
      ))

      (print {
        event: "emergency-settled",
        epoch-id: epoch-id,
        settlement-price: settlement-price
      })

      (ok { outcome: "OTM", payout: u0, fees: u0 })
    )
  )
)

;; Transfer payout to option buyer
(define-public (transfer-payout (token <sip-010-token>) (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (as-contract (contract-call? token transfer amount tx-sender recipient none))
  )
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (get-vault-info)
  (ok {
    total-shares: (contract-call? .vault-data-v1 get-total-shares),
    total-sbtc-deposited: (contract-call? .vault-data-v1 get-total-sbtc-deposited),
    current-epoch-id: (contract-call? .vault-data-v1 get-current-epoch-id),
    active-epoch: (contract-call? .vault-data-v1 get-active-epoch),
    vault-paused: (contract-call? .vault-data-v1 get-vault-paused),
    share-price: (get-share-price),
    total-premiums-earned: (contract-call? .vault-data-v1 get-total-premiums-earned),
    total-epochs-completed: (contract-call? .vault-data-v1 get-total-epochs-completed),
    total-fees-collected: (contract-call? .vault-data-v1 get-total-fees-collected)
  })
)

(define-read-only (get-user-info (user principal))
  (let (
    (shares (contract-call? .vault-data-v1 get-user-shares user))
    (total-s (contract-call? .vault-data-v1 get-total-shares))
    (total-sbtc (contract-call? .vault-data-v1 get-total-sbtc-deposited))
    (sbtc-value (if (> total-s u0)
      (/ (* shares total-sbtc) total-s)
      u0
    ))
  )
    (ok {
      shares: shares,
      sbtc-value: sbtc-value,
      share-price: (get-share-price)
    })
  )
)

(define-read-only (get-epoch (epoch-id uint))
  (contract-call? .vault-data-v1 get-epoch epoch-id)
)

(define-read-only (get-share-price)
  (let (
    (total-s (contract-call? .vault-data-v1 get-total-shares))
    (total-sbtc (contract-call? .vault-data-v1 get-total-sbtc-deposited))
  )
    (if (> total-s u0)
      (/ (* total-sbtc PRECISION) total-s)
      PRECISION
    )
  )
)

(define-read-only (get-current-epoch-id)
  (contract-call? .vault-data-v1 get-current-epoch-id)
)

(define-read-only (is-epoch-active)
  (contract-call? .vault-data-v1 get-active-epoch)
)
