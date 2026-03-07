;; sbtc-options-vault.clar
;; Core covered call options vault
;; Users deposit sBTC, vault writes call options, premiums = yield

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant PRECISION u100000000) ;; 8 decimals (satoshi precision)
(define-constant PRICE-PRECISION u1000000) ;; 6 decimals for USD prices
(define-constant MANAGEMENT-FEE-BPS u200) ;; 2%
(define-constant PERFORMANCE-FEE-BPS u1000) ;; 10%
(define-constant BPS-DENOMINATOR u10000)

;; Errors
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

;; Data vars
(define-data-var vault-paused bool false)
(define-data-var total-shares uint u0)
(define-data-var total-sbtc-deposited uint u0)
(define-data-var current-epoch-id uint u0)
(define-data-var active-epoch bool false)
(define-data-var market-contract principal CONTRACT-OWNER)
(define-data-var total-premiums-earned uint u0)
(define-data-var total-epochs-completed uint u0)

;; Maps
(define-map user-shares principal uint)

(define-map epochs uint {
  strike-price: uint,        ;; USD price * PRICE-PRECISION
  premium: uint,             ;; expected premium in sats
  collateral: uint,          ;; locked sBTC in sats
  start-block: uint,
  expiry-block: uint,
  settled: bool,
  settlement-price: uint,    ;; actual price at settlement
  premium-earned: uint,      ;; actual premium received
  payout: uint,              ;; payout to option buyer (if ITM)
  outcome: (string-ascii 3)  ;; "OTM" or "ITM" or "N/A"
})

;; Admin: set market contract
(define-public (set-market-contract (market principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set market-contract market)
    (ok true)
  )
)

;; Admin: pause/unpause vault
(define-public (set-vault-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set vault-paused paused)
    (ok true)
  )
)

;; Deposit sBTC into vault, receive shares
(define-public (deposit (token <sip-010-token>) (amount uint))
  (begin
    (asserts! (not (var-get vault-paused)) ERR-VAULT-PAUSED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (not (var-get active-epoch)) ERR-EPOCH-ACTIVE)

    ;; Transfer sBTC from user to vault
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

    ;; Calculate shares
    (let (
      (current-total-shares (var-get total-shares))
      (current-total-sbtc (var-get total-sbtc-deposited))
      (new-shares (if (is-eq current-total-shares u0)
        amount  ;; First depositor: 1:1 shares
        (/ (* amount current-total-shares) current-total-sbtc)
      ))
    )
      ;; Update state
      (var-set total-shares (+ current-total-shares new-shares))
      (var-set total-sbtc-deposited (+ current-total-sbtc amount))
      (map-set user-shares tx-sender
        (+ (default-to u0 (map-get? user-shares tx-sender)) new-shares)
      )

      (print {
        event: "deposit",
        user: tx-sender,
        amount: amount,
        shares-minted: new-shares,
        total-shares: (var-get total-shares),
        total-sbtc: (var-get total-sbtc-deposited)
      })

      (ok new-shares)
    )
  )
)

;; Withdraw sBTC by burning shares
(define-public (withdraw (token <sip-010-token>) (shares uint))
  (let (
    (user tx-sender)
  )
    (asserts! (> shares u0) ERR-ZERO-AMOUNT)
    (asserts! (not (var-get active-epoch)) ERR-EPOCH-ACTIVE)

    (let (
      (user-share-balance (default-to u0 (map-get? user-shares user)))
      (current-total-shares (var-get total-shares))
      (current-total-sbtc (var-get total-sbtc-deposited))
    )
      (asserts! (>= user-share-balance shares) ERR-INSUFFICIENT-SHARES)

      ;; Calculate sBTC to return (pro-rata)
      (let (
        (sbtc-amount (/ (* shares current-total-sbtc) current-total-shares))
      )
        ;; Transfer sBTC from vault to user
        (try! (as-contract (contract-call? token transfer sbtc-amount tx-sender user none)))

        ;; Update state
        (var-set total-shares (- current-total-shares shares))
        (var-set total-sbtc-deposited (- current-total-sbtc sbtc-amount))
        (map-set user-shares user (- user-share-balance shares))

        (print {
          event: "withdraw",
          user: tx-sender,
          shares-burned: shares,
          sbtc-returned: sbtc-amount,
          total-shares: (var-get total-shares),
          total-sbtc: (var-get total-sbtc-deposited)
        })

        (ok sbtc-amount)
      )
    )
  )
)

;; Admin: start a new epoch (write a covered call)
(define-public (start-epoch (strike-price uint) (premium uint) (duration uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (not (var-get active-epoch)) ERR-EPOCH-ACTIVE)
    (asserts! (> (var-get total-sbtc-deposited) u0) ERR-ZERO-AMOUNT)

    (let (
      (new-epoch-id (+ (var-get current-epoch-id) u1))
      (collateral (var-get total-sbtc-deposited))
      (expiry (+ block-height duration))
    )
      (map-set epochs new-epoch-id {
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
      })

      (var-set current-epoch-id new-epoch-id)
      (var-set active-epoch true)

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
    (asserts! (is-eq contract-caller (var-get market-contract)) ERR-NOT-MARKET)
    (let (
      (epoch (unwrap! (map-get? epochs epoch-id) ERR-INVALID-EPOCH))
    )
      ;; Add premium to vault TVL
      (var-set total-sbtc-deposited (+ (var-get total-sbtc-deposited) premium))
      (var-set total-premiums-earned (+ (var-get total-premiums-earned) premium))

      ;; Update epoch with earned premium
      (map-set epochs epoch-id (merge epoch {
        premium-earned: (+ (get premium-earned epoch) premium)
      }))

      (print {
        event: "option-sold",
        epoch-id: epoch-id,
        premium: premium
      })

      (ok true)
    )
  )
)

;; Admin: settle epoch
(define-public (settle-epoch (token <sip-010-token>) (epoch-id uint) (settlement-price uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (var-get active-epoch) ERR-NO-ACTIVE-EPOCH)

    (let (
      (epoch (unwrap! (map-get? epochs epoch-id) ERR-INVALID-EPOCH))
    )
      (asserts! (not (get settled epoch)) ERR-ALREADY-SETTLED)
      (asserts! (>= block-height (get expiry-block epoch)) ERR-EPOCH-NOT-EXPIRED)

      (let (
        (strike (get strike-price epoch))
        (collateral (get collateral epoch))
        (is-itm (> settlement-price strike))
        (payout (if is-itm
          ;; ITM: payout = collateral * (settlement - strike) / settlement
          ;; Capped at collateral
          (let (
            (diff (- settlement-price strike))
            (raw-payout (/ (* collateral diff) settlement-price))
          )
            (if (> raw-payout collateral) collateral raw-payout)
          )
          u0
        ))
        (outcome (if is-itm "ITM" "OTM"))
      )
        ;; If ITM, deduct payout from vault TVL
        ;; (buyer claims via market contract)
        (if is-itm
          (var-set total-sbtc-deposited (- (var-get total-sbtc-deposited) payout))
          true
        )

        ;; Update epoch
        (map-set epochs epoch-id (merge epoch {
          settled: true,
          settlement-price: settlement-price,
          payout: payout,
          outcome: outcome
        }))

        (var-set active-epoch false)
        (var-set total-epochs-completed (+ (var-get total-epochs-completed) u1))

        (print {
          event: "epoch-settled",
          epoch-id: epoch-id,
          settlement-price: settlement-price,
          outcome: outcome,
          payout: payout
        })

        (ok { outcome: outcome, payout: payout })
      )
    )
  )
)

;; Transfer payout to option buyer (called by settle or by market)
(define-public (transfer-payout (token <sip-010-token>) (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (as-contract (contract-call? token transfer amount tx-sender recipient none))
  )
)

;; Read-only functions

(define-read-only (get-vault-info)
  (ok {
    total-shares: (var-get total-shares),
    total-sbtc-deposited: (var-get total-sbtc-deposited),
    current-epoch-id: (var-get current-epoch-id),
    active-epoch: (var-get active-epoch),
    vault-paused: (var-get vault-paused),
    share-price: (get-share-price),
    total-premiums-earned: (var-get total-premiums-earned),
    total-epochs-completed: (var-get total-epochs-completed)
  })
)

(define-read-only (get-user-info (user principal))
  (let (
    (shares (default-to u0 (map-get? user-shares user)))
    (total-s (var-get total-shares))
    (total-sbtc (var-get total-sbtc-deposited))
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
  (map-get? epochs epoch-id)
)

(define-read-only (get-share-price)
  (let (
    (total-s (var-get total-shares))
    (total-sbtc (var-get total-sbtc-deposited))
  )
    (if (> total-s u0)
      (/ (* total-sbtc PRECISION) total-s)
      PRECISION  ;; 1:1 when empty
    )
  )
)

(define-read-only (get-current-epoch-id)
  (var-get current-epoch-id)
)

(define-read-only (is-epoch-active)
  (var-get active-epoch)
)
