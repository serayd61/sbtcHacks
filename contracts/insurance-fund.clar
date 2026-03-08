;; insurance-fund.clar
;; Insurance fund for sBTC Options Vault
;;
;; Purpose:
;; - Accumulates a portion of premiums as insurance reserve
;; - Covers vault losses when ITM payout exceeds vault balance
;; - Provides emergency buffer for black swan events
;;
;; Fund sources:
;; - 5% of all premiums earned (configurable)
;; - Direct deposits from admin
;;
;; Fund usage:
;; - Payout shortfall coverage (when ITM payout > vault TVL)
;; - Emergency admin withdrawal (with timelock)

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant INSURANCE-FEE-BPS u500)        ;; 5% of premiums
(define-constant BPS-DENOMINATOR u10000)
(define-constant MIN-FUND-BALANCE u0)            ;; No minimum (can be drained for payouts)
(define-constant EMERGENCY-WITHDRAW-DELAY u144)  ;; ~24 hours in blocks

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u6000))
(define-constant ERR-ZERO-AMOUNT (err u6001))
(define-constant ERR-INSUFFICIENT-BALANCE (err u6002))
(define-constant ERR-TRANSFER-FAILED (err u6003))
(define-constant ERR-NOT-VAULT (err u6004))
(define-constant ERR-WITHDRAW-TOO-EARLY (err u6005))
(define-constant ERR-NO-PENDING-WITHDRAW (err u6006))

;; ============================================
;; State
;; ============================================
(define-data-var total-balance uint u0)
(define-data-var total-premiums-received uint u0)
(define-data-var total-payouts-covered uint u0)
(define-data-var total-deposits uint u0)
(define-data-var vault-contract principal CONTRACT-OWNER)

;; Emergency withdrawal queue
(define-data-var pending-withdraw-amount uint u0)
(define-data-var pending-withdraw-recipient principal CONTRACT-OWNER)
(define-data-var pending-withdraw-block uint u0)

;; ============================================
;; Admin Functions
;; ============================================

;; Set the vault contract address (only vault can trigger coverage)
(define-public (set-vault-contract (vault principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set vault-contract vault)
    (ok true)
  )
)

;; Direct admin deposit into insurance fund
(define-public (admin-deposit (token <sip-010-token>) (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    ;; Transfer tokens to this contract
    (try! (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

    ;; Update balance
    (var-set total-balance (+ (var-get total-balance) amount))
    (var-set total-deposits (+ (var-get total-deposits) amount))

    (print {
      event: "insurance-deposit",
      from: tx-sender,
      amount: amount,
      total-balance: (var-get total-balance)
    })

    (ok true)
  )
)

;; Queue emergency withdrawal (starts timelock)
(define-public (queue-emergency-withdraw (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (<= amount (var-get total-balance)) ERR-INSUFFICIENT-BALANCE)

    (var-set pending-withdraw-amount amount)
    (var-set pending-withdraw-recipient recipient)
    (var-set pending-withdraw-block (+ block-height EMERGENCY-WITHDRAW-DELAY))

    (print {
      event: "insurance-withdraw-queued",
      amount: amount,
      recipient: recipient,
      executable-at-block: (+ block-height EMERGENCY-WITHDRAW-DELAY)
    })

    (ok true)
  )
)

;; Execute queued withdrawal after timelock expires
(define-public (execute-emergency-withdraw (token <sip-010-token>))
  (let (
    (amount (var-get pending-withdraw-amount))
    (recipient (var-get pending-withdraw-recipient))
    (unlock-block (var-get pending-withdraw-block))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-NO-PENDING-WITHDRAW)
    (asserts! (>= block-height unlock-block) ERR-WITHDRAW-TOO-EARLY)
    (asserts! (<= amount (var-get total-balance)) ERR-INSUFFICIENT-BALANCE)

    ;; Transfer from contract to recipient
    (try! (as-contract (contract-call? token transfer amount tx-sender recipient none)))

    ;; Update state
    (var-set total-balance (- (var-get total-balance) amount))
    (var-set pending-withdraw-amount u0)

    (print {
      event: "insurance-withdraw-executed",
      amount: amount,
      recipient: recipient,
      remaining-balance: (var-get total-balance)
    })

    (ok amount)
  )
)

;; Cancel pending withdrawal
(define-public (cancel-emergency-withdraw)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> (var-get pending-withdraw-amount) u0) ERR-NO-PENDING-WITHDRAW)

    (print {
      event: "insurance-withdraw-cancelled",
      amount: (var-get pending-withdraw-amount)
    })

    (var-set pending-withdraw-amount u0)
    (ok true)
  )
)

;; ============================================
;; Vault Integration Functions
;; ============================================

;; Called by vault when premium is earned - takes insurance cut
;; The vault should call this BEFORE adding premium to TVL
(define-public (collect-premium (token <sip-010-token>) (premium-amount uint))
  (let (
    (insurance-cut (/ (* premium-amount INSURANCE-FEE-BPS) BPS-DENOMINATOR))
  )
    ;; Only vault contract can call this
    (asserts! (is-eq contract-caller (var-get vault-contract)) ERR-NOT-VAULT)
    (asserts! (> insurance-cut u0) ERR-ZERO-AMOUNT)

    ;; Transfer insurance portion from vault to this contract
    (try! (contract-call? token transfer insurance-cut tx-sender (as-contract tx-sender) none))

    ;; Update state
    (var-set total-balance (+ (var-get total-balance) insurance-cut))
    (var-set total-premiums-received (+ (var-get total-premiums-received) insurance-cut))

    (print {
      event: "insurance-premium-collected",
      premium-total: premium-amount,
      insurance-cut: insurance-cut,
      fund-balance: (var-get total-balance)
    })

    (ok insurance-cut)
  )
)

;; Cover payout shortfall when vault cannot fully pay ITM option
;; Called by vault/admin when payout > vault balance
(define-public (cover-shortfall (token <sip-010-token>) (amount uint) (recipient principal))
  (begin
    ;; Only vault contract or admin can trigger coverage
    (asserts! (or
      (is-eq contract-caller (var-get vault-contract))
      (is-eq tx-sender CONTRACT-OWNER)
    ) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    ;; Cap at available balance
    (let (
      (available (var-get total-balance))
      (actual-coverage (if (> amount available) available amount))
    )
      (asserts! (> actual-coverage u0) ERR-INSUFFICIENT-BALANCE)

      ;; Transfer from insurance fund to recipient
      (try! (as-contract (contract-call? token transfer actual-coverage tx-sender recipient none)))

      ;; Update state
      (var-set total-balance (- available actual-coverage))
      (var-set total-payouts-covered (+ (var-get total-payouts-covered) actual-coverage))

      (print {
        event: "insurance-shortfall-covered",
        requested: amount,
        covered: actual-coverage,
        recipient: recipient,
        remaining-balance: (var-get total-balance)
      })

      (ok actual-coverage)
    )
  )
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (get-fund-info)
  (ok {
    total-balance: (var-get total-balance),
    total-premiums-received: (var-get total-premiums-received),
    total-payouts-covered: (var-get total-payouts-covered),
    total-deposits: (var-get total-deposits),
    vault-contract: (var-get vault-contract),
    insurance-fee-bps: INSURANCE-FEE-BPS,
    pending-withdraw: {
      amount: (var-get pending-withdraw-amount),
      recipient: (var-get pending-withdraw-recipient),
      unlock-block: (var-get pending-withdraw-block)
    }
  })
)

(define-read-only (get-balance)
  (var-get total-balance)
)

(define-read-only (get-insurance-fee-bps)
  INSURANCE-FEE-BPS
)

(define-read-only (get-coverage-capacity)
  (var-get total-balance)
)
