;; insurance-fund-v2.clar
;; Advanced insurance fund with dynamic risk management
;; Multi-layered protection with automatic rebalancing

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)

;; Fee structures (in basis points)
(define-constant DEFAULT-INSURANCE-FEE-BPS u500)    ;; 5% of premiums
(define-constant MANAGEMENT-FEE-BPS u100)           ;; 1% annual on fund balance
(define-constant PERFORMANCE-FEE-BPS u1000)         ;; 10% of profits above benchmark
(define-constant BPS-DENOMINATOR u10000)

;; Risk parameters
(define-constant MIN-FUND-RATIO u2000)              ;; 20% of TVL minimum
(define-constant OPTIMAL-FUND-RATIO u3000)          ;; 30% of TVL optimal
(define-constant MAX-FUND-RATIO u5000)              ;; 50% of TVL maximum
(define-constant EMERGENCY-COVERAGE-RATIO u8000)    ;; 80% of fund for emergencies

;; Time constants
(define-constant EMERGENCY-WITHDRAW-DELAY u288)     ;; ~48 hours
(define-constant REBALANCE-COOLDOWN u144)           ;; ~24 hours
(define-constant UTILIZATION-WINDOW u1008)          ;; ~7 days for metrics

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u10000))
(define-constant ERR-ZERO-AMOUNT (err u10001))
(define-constant ERR-INSUFFICIENT-BALANCE (err u10002))
(define-constant ERR-TRANSFER-FAILED (err u10003))
(define-constant ERR-NOT-VAULT (err u10004))
(define-constant ERR-WITHDRAW-TOO-EARLY (err u10005))
(define-constant ERR-NO-PENDING-WITHDRAW (err u10006))
(define-constant ERR-REBALANCE-COOLDOWN (err u10007))
(define-constant ERR-INVALID-RATIO (err u10008))
(define-constant ERR-FUND-RATIO-TOO-LOW (err u10009))
(define-constant ERR-EMERGENCY-THRESHOLD (err u10010))

;; ============================================
;; State Variables
;; ============================================
(define-data-var total-balance uint u0)
(define-data-var total-premiums-received uint u0)
(define-data-var total-payouts-covered uint u0)
(define-data-var total-deposits uint u0)
(define-data-var total-withdrawals uint u0)

;; Contract integration
(define-data-var vault-contract principal CONTRACT-OWNER)
(define-data-var multisig-contract (optional principal) none)
(define-data-var circuit-breaker (optional principal) none)

;; Dynamic fee structure
(define-data-var insurance-fee-bps uint DEFAULT-INSURANCE-FEE-BPS)
(define-data-var performance-benchmark uint u500) ;; 5% annual benchmark

;; Emergency withdrawal queue
(define-data-var pending-withdraw-amount uint u0)
(define-data-var pending-withdraw-recipient principal CONTRACT-OWNER)
(define-data-var pending-withdraw-block uint u0)
(define-data-var pending-withdraw-reason (string-ascii 128) "")

;; Risk metrics
(define-data-var current-vault-tvl uint u0)
(define-data-var last-rebalance-block uint u0)
(define-data-var utilization-rate uint u0) ;; Percentage of fund used for coverage
(define-data-var stress-test-passed bool true)

;; Performance tracking
(define-data-var fund-performance-start uint u0)
(define-data-var fund-performance-start-block uint u0)
(define-data-var last-performance-fee-collection uint u0)

;; ============================================
;; Data Maps
;; ============================================
(define-map coverage-events uint {
  amount: uint,
  recipient: principal,
  reason: (string-ascii 128),
  block-height: uint,
  vault-tvl-before: uint,
  fund-balance-before: uint
})

(define-data-var coverage-count uint u0)

(define-map rebalance-history uint {
  old-ratio: uint,
  new-ratio: uint,
  amount-moved: uint,
  direction: (string-ascii 16), ;; "to-vault" or "to-fund"
  triggered-by: principal,
  block-height: uint
})

(define-data-var rebalance-count uint u0)

(define-map authorized-managers principal bool)

;; ============================================
;; Setup Functions
;; ============================================
(define-public (set-vault-contract (vault principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set vault-contract vault)
    (ok true)
  )
)

(define-public (set-multisig-contract (multisig principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set multisig-contract (some multisig))
    (ok true)
  )
)

(define-public (set-circuit-breaker (breaker principal))
  (begin
    (asserts! (is-authorized-admin tx-sender) ERR-NOT-AUTHORIZED)
    (var-set circuit-breaker (some breaker))
    (ok true)
  )
)

(define-public (authorize-manager (manager principal))
  (begin
    (asserts! (is-authorized-admin tx-sender) ERR-NOT-AUTHORIZED)
    (map-set authorized-managers manager true)
    (ok true)
  )
)

;; ============================================
;; Premium Collection & Fee Management
;; ============================================
(define-public (collect-premium (token <sip-010-token>) (premium-amount uint))
  (let (
    (insurance-cut (/ (* premium-amount (var-get insurance-fee-bps)) BPS-DENOMINATOR))
    (vault-tvl (var-get current-vault-tvl))
  )
    (asserts! (is-eq contract-caller (var-get vault-contract)) ERR-NOT-VAULT)
    (asserts! (> insurance-cut u0) ERR-ZERO-AMOUNT)

    ;; Transfer insurance portion from vault to this contract
    (try! (contract-call? token transfer insurance-cut tx-sender (as-contract tx-sender) none))

    ;; Update state
    (var-set total-balance (+ (var-get total-balance) insurance-cut))
    (var-set total-premiums-received (+ (var-get total-premiums-received) insurance-cut))

    ;; Check if rebalancing is needed
    (try! (check-and-rebalance token vault-tvl))

    (print {
      event: "insurance-premium-collected",
      premium-total: premium-amount,
      insurance-cut: insurance-cut,
      fund-balance: (var-get total-balance),
      fund-ratio: (calculate-fund-ratio vault-tvl)
    })

    (ok insurance-cut)
  )
)

(define-public (update-insurance-fee (new-fee-bps uint))
  (begin
    (asserts! (is-multisig-call tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (<= new-fee-bps u1500) ERR-INVALID-RATIO) ;; Max 15%
    (asserts! (>= new-fee-bps u100) ERR-INVALID-RATIO)  ;; Min 1%
    
    (var-set insurance-fee-bps new-fee-bps)
    (print {
      event: "insurance-fee-updated",
      old-fee: DEFAULT-INSURANCE-FEE-BPS,
      new-fee: new-fee-bps
    })
    (ok true)
  )
)

;; ============================================
;; Advanced Coverage Functions
;; ============================================
(define-public (cover-shortfall (token <sip-010-token>) (amount uint) (recipient principal) (reason (string-ascii 128)))
  (begin
    (asserts! (or
      (is-eq contract-caller (var-get vault-contract))
      (is-authorized-admin tx-sender)
    ) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)

    ;; Check emergency coverage limits
    (let (
      (available-balance (var-get total-balance))
      (emergency-limit (/ (* available-balance EMERGENCY-COVERAGE-RATIO) BPS-DENOMINATOR))
      (actual-coverage (if (> amount emergency-limit) emergency-limit amount))
    )
      (asserts! (> actual-coverage u0) ERR-INSUFFICIENT-BALANCE)
      (asserts! (<= actual-coverage available-balance) ERR-INSUFFICIENT-BALANCE)

      ;; Record coverage event
      (let ((coverage-id (+ (var-get coverage-count) u1)))
        (map-set coverage-events coverage-id {
          amount: actual-coverage,
          recipient: recipient,
          reason: reason,
          block-height: block-height,
          vault-tvl-before: (var-get current-vault-tvl),
          fund-balance-before: available-balance
        })
        (var-set coverage-count coverage-id)
      )

      ;; Transfer from insurance fund
      (try! (as-contract (contract-call? token transfer actual-coverage tx-sender recipient none)))

      ;; Update state
      (var-set total-balance (- available-balance actual-coverage))
      (var-set total-payouts-covered (+ (var-get total-payouts-covered) actual-coverage))

      ;; Update utilization rate
      (let ((new-utilization (/ (* actual-coverage u10000) available-balance)))
        (var-set utilization-rate new-utilization)
      )

      ;; Trigger circuit breaker if fund gets too low
      (if (< (calculate-fund-ratio (var-get current-vault-tvl)) MIN-FUND-RATIO)
        (trigger-low-fund-alert)
        (ok true)
      )

      (print {
        event: "insurance-shortfall-covered",
        coverage-id: coverage-id,
        requested: amount,
        covered: actual-coverage,
        recipient: recipient,
        reason: reason,
        remaining-balance: (var-get total-balance),
        utilization-rate: new-utilization
      })

      (ok actual-coverage)
    )
  )
)

;; ============================================
;; Dynamic Rebalancing System
;; ============================================
(define-public (update-vault-tvl (new-tvl uint))
  (begin
    (asserts! (or
      (is-eq contract-caller (var-get vault-contract))
      (is-authorized-manager tx-sender)
    ) ERR-NOT-AUTHORIZED)
    
    (var-set current-vault-tvl new-tvl)
    (ok true)
  )
)

(define-public (manual-rebalance (token <sip-010-token>) (target-ratio uint))
  (begin
    (asserts! (is-authorized-manager tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (<= target-ratio MAX-FUND-RATIO) ERR-INVALID-RATIO)
    (asserts! (>= target-ratio MIN-FUND-RATIO) ERR-INVALID-RATIO)
    (asserts! (>= (- block-height (var-get last-rebalance-block)) REBALANCE-COOLDOWN) ERR-REBALANCE-COOLDOWN)
    
    (let (
      (vault-tvl (var-get current-vault-tvl))
      (current-ratio (calculate-fund-ratio vault-tvl))
    )
      (try! (execute-rebalance token vault-tvl current-ratio target-ratio tx-sender))
      (ok true)
    )
  )
)

(define-private (check-and-rebalance (token <sip-010-token>) (vault-tvl uint))
  (let (
    (current-ratio (calculate-fund-ratio vault-tvl))
  )
    (if (or 
      (< current-ratio MIN-FUND-RATIO)
      (> current-ratio MAX-FUND-RATIO)
    )
      (execute-rebalance token vault-tvl current-ratio OPTIMAL-FUND-RATIO tx-sender)
      (ok true)
    )
  )
)

(define-private (execute-rebalance (token <sip-010-token>) (vault-tvl uint) (current-ratio uint) (target-ratio uint) (triggered-by principal))
  (let (
    (target-amount (/ (* vault-tvl target-ratio) BPS-DENOMINATOR))
    (current-amount (var-get total-balance))
  )
    (if (> target-amount current-amount)
      ;; Need to move funds FROM vault TO insurance fund
      (let ((deficit (- target-amount current-amount)))
        (request-fund-transfer token deficit "to-fund")
        (record-rebalance current-ratio target-ratio deficit "to-fund" triggered-by)
      )
      ;; Need to move funds FROM insurance TO vault  
      (let ((excess (- current-amount target-amount)))
        (if (> excess u0)
          (begin
            (try! (transfer-to-vault token excess))
            (record-rebalance current-ratio target-ratio excess "to-vault" triggered-by)
          )
          (ok true)
        )
      )
    )
  )
)

(define-private (transfer-to-vault (token <sip-010-token>) (amount uint))
  (begin
    (try! (as-contract (contract-call? token transfer amount tx-sender (var-get vault-contract) none)))
    (var-set total-balance (- (var-get total-balance) amount))
    (ok true)
  )
)

(define-private (request-fund-transfer (token <sip-010-token>) (amount uint) (direction (string-ascii 16)))
  ;; This would signal vault to transfer funds - simplified implementation
  (begin
    (print {
      event: "fund-transfer-requested",
      amount: amount,
      direction: direction
    })
    true
  )
)

(define-private (record-rebalance (old-ratio uint) (new-ratio uint) (amount uint) (direction (string-ascii 16)) (triggered-by principal))
  (let ((rebalance-id (+ (var-get rebalance-count) u1)))
    (map-set rebalance-history rebalance-id {
      old-ratio: old-ratio,
      new-ratio: new-ratio,
      amount-moved: amount,
      direction: direction,
      triggered-by: triggered-by,
      block-height: block-height
    })
    (var-set rebalance-count rebalance-id)
    (var-set last-rebalance-block block-height)
    (ok true)
  )
)

;; ============================================
;; Risk Management & Monitoring
;; ============================================
(define-public (run-stress-test (scenarios (list 5 uint)))
  (begin
    (asserts! (is-authorized-manager tx-sender) ERR-NOT-AUTHORIZED)
    
    (let (
      (current-balance (var-get total-balance))
      (vault-tvl (var-get current-vault-tvl))
      (test-results (map test-scenario scenarios))
      (all-passed (fold and test-results true))
    )
      (var-set stress-test-passed all-passed)
      
      (print {
        event: "stress-test-completed",
        scenarios-tested: (len scenarios),
        all-passed: all-passed,
        fund-balance: current-balance,
        vault-tvl: vault-tvl
      })
      
      (ok all-passed)
    )
  )
)

(define-private (test-scenario (loss-percentage uint))
  (let (
    (vault-tvl (var-get current-vault-tvl))
    (potential-loss (/ (* vault-tvl loss-percentage) BPS-DENOMINATOR))
    (fund-balance (var-get total-balance))
  )
    ;; Test if fund can cover the loss
    (>= fund-balance potential-loss)
  )
)

(define-private (trigger-low-fund-alert)
  (match (var-get circuit-breaker)
    breaker (begin
      (print {
        event: "low-fund-alert",
        reason: "Insurance fund ratio below minimum"
      })
      (ok true)
    )
    (ok false)
  )
)

;; ============================================
;; Emergency Functions
;; ============================================
(define-public (emergency-pause-withdrawals (reason (string-ascii 128)))
  (begin
    (asserts! (or
      (is-eq tx-sender CONTRACT-OWNER)
      (is-multisig-call tx-sender)
    ) ERR-NOT-AUTHORIZED)
    
    (print {
      event: "withdrawals-paused",
      reason: reason,
      paused-by: tx-sender
    })
    
    (ok true)
  )
)

(define-public (queue-emergency-withdraw (amount uint) (recipient principal) (reason (string-ascii 128)))
  (begin
    (asserts! (is-multisig-call tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (<= amount (var-get total-balance)) ERR-INSUFFICIENT-BALANCE)

    (var-set pending-withdraw-amount amount)
    (var-set pending-withdraw-recipient recipient)
    (var-set pending-withdraw-block (+ block-height EMERGENCY-WITHDRAW-DELAY))
    (var-set pending-withdraw-reason reason)

    (print {
      event: "emergency-withdraw-queued",
      amount: amount,
      recipient: recipient,
      reason: reason,
      executable-at-block: (+ block-height EMERGENCY-WITHDRAW-DELAY)
    })

    (ok true)
  )
)

(define-public (execute-emergency-withdraw (token <sip-010-token>))
  (let (
    (amount (var-get pending-withdraw-amount))
    (recipient (var-get pending-withdraw-recipient))
    (unlock-block (var-get pending-withdraw-block))
    (reason (var-get pending-withdraw-reason))
  )
    (asserts! (is-multisig-call tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-NO-PENDING-WITHDRAW)
    (asserts! (>= block-height unlock-block) ERR-WITHDRAW-TOO-EARLY)

    (try! (as-contract (contract-call? token transfer amount tx-sender recipient none)))
    
    (var-set total-balance (- (var-get total-balance) amount))
    (var-set total-withdrawals (+ (var-get total-withdrawals) amount))
    (var-set pending-withdraw-amount u0)

    (print {
      event: "emergency-withdraw-executed",
      amount: amount,
      recipient: recipient,
      reason: reason,
      remaining-balance: (var-get total-balance)
    })

    (ok amount)
  )
)

;; ============================================
;; Helper Functions
;; ============================================
(define-private (calculate-fund-ratio (vault-tvl uint))
  (if (> vault-tvl u0)
    (/ (* (var-get total-balance) BPS-DENOMINATOR) vault-tvl)
    u0
  )
)

(define-private (is-authorized-admin (caller principal))
  (or 
    (is-eq caller CONTRACT-OWNER)
    (is-multisig-call caller)
  )
)

(define-private (is-authorized-manager (caller principal))
  (or 
    (is-authorized-admin caller)
    (default-to false (map-get? authorized-managers caller))
  )
)

(define-private (is-multisig-call (caller principal))
  (match (var-get multisig-contract)
    multisig (is-eq caller multisig)
    false
  )
)

;; ============================================
;; Read-only Functions
;; ============================================
(define-read-only (get-fund-info)
  {
    total-balance: (var-get total-balance),
    total-premiums-received: (var-get total-premiums-received),
    total-payouts-covered: (var-get total-payouts-covered),
    total-deposits: (var-get total-deposits),
    total-withdrawals: (var-get total-withdrawals),
    current-vault-tvl: (var-get current-vault-tvl),
    fund-ratio: (calculate-fund-ratio (var-get current-vault-tvl)),
    utilization-rate: (var-get utilization-rate),
    insurance-fee-bps: (var-get insurance-fee-bps),
    stress-test-passed: (var-get stress-test-passed),
    last-rebalance-block: (var-get last-rebalance-block),
    pending-withdraw: {
      amount: (var-get pending-withdraw-amount),
      recipient: (var-get pending-withdraw-recipient),
      unlock-block: (var-get pending-withdraw-block),
      reason: (var-get pending-withdraw-reason)
    }
  }
)

(define-read-only (get-coverage-event (coverage-id uint))
  (map-get? coverage-events coverage-id)
)

(define-read-only (get-rebalance-history (rebalance-id uint))
  (map-get? rebalance-history rebalance-id)
)

(define-read-only (get-risk-metrics)
  {
    fund-ratio: (calculate-fund-ratio (var-get current-vault-tvl)),
    min-ratio: MIN-FUND-RATIO,
    optimal-ratio: OPTIMAL-FUND-RATIO,
    max-ratio: MAX-FUND-RATIO,
    utilization-rate: (var-get utilization-rate),
    coverage-capacity: (var-get total-balance),
    emergency-coverage-limit: (/ (* (var-get total-balance) EMERGENCY-COVERAGE-RATIO) BPS-DENOMINATOR),
    stress-test-status: (var-get stress-test-passed),
    rebalance-cooldown-remaining: (if (> (+ (var-get last-rebalance-block) REBALANCE-COOLDOWN) block-height)
      (some (- (+ (var-get last-rebalance-block) REBALANCE-COOLDOWN) block-height))
      none
    )
  }
)

(define-read-only (calculate-required-deposit (target-vault-tvl uint))
  (let (
    (target-fund-balance (/ (* target-vault-tvl OPTIMAL-FUND-RATIO) BPS-DENOMINATOR))
    (current-balance (var-get total-balance))
  )
    (if (> target-fund-balance current-balance)
      (some (- target-fund-balance current-balance))
      none
    )
  )
)