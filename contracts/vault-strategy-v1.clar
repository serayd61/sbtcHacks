;; vault-strategy-v1.clar
;; Multi-strategy configuration for epoch management
;;
;; Strategies define how TVL is allocated across different epoch types:
;; - Strategy 1: Weekly covered calls (50% allocation)
;; - Strategy 2: Bi-weekly covered calls (30% allocation)
;; - Strategy 3: Reserve / no allocation (20% buffer)
;;
;; The keeper bot reads strategy configs from this contract
;; and manages epoch transitions accordingly.
;;
;; On-chain: stores strategy parameters
;; Off-chain: keeper reads configs, manages epochs per strategy

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant MAX-STRATEGIES u5)
(define-constant BPS-DENOMINATOR u10000)

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u9000))
(define-constant ERR-STRATEGY-NOT-FOUND (err u9001))
(define-constant ERR-INVALID-ALLOCATION (err u9002))
(define-constant ERR-MAX-STRATEGIES (err u9003))
(define-constant ERR-ZERO-VALUE (err u9004))
(define-constant ERR-ALLOCATION-OVERFLOW (err u9005))

;; ============================================
;; State
;; ============================================
(define-data-var strategy-count uint u0)
(define-data-var total-allocation-bps uint u0)
(define-data-var strategy-enabled bool false)

;; Strategy configurations
(define-map strategies uint {
  name: (string-ascii 32),
  allocation-bps: uint,         ;; % of TVL allocated (in basis points)
  strike-otm-bps: uint,         ;; Strike OTM % (e.g., 500 = 5%)
  duration-blocks: uint,        ;; Epoch duration in blocks
  min-collateral: uint,         ;; Minimum collateral to activate
  active: bool,                 ;; Whether strategy is active
  last-epoch-id: uint,          ;; Last epoch started for this strategy
  last-epoch-block: uint        ;; Block when last epoch was started
})

;; Strategy performance tracking
(define-map strategy-performance uint {
  total-premiums: uint,
  total-payouts: uint,
  epochs-completed: uint,
  win-count: uint               ;; OTM outcomes (vault keeps premium)
})

;; ============================================
;; Admin Functions
;; ============================================

;; Add a new strategy
(define-public (add-strategy
  (name (string-ascii 32))
  (allocation-bps uint)
  (strike-otm-bps uint)
  (duration-blocks uint)
  (min-collateral uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (< (var-get strategy-count) MAX-STRATEGIES) ERR-MAX-STRATEGIES)
    (asserts! (> allocation-bps u0) ERR-ZERO-VALUE)
    (asserts! (> strike-otm-bps u0) ERR-ZERO-VALUE)
    (asserts! (> duration-blocks u0) ERR-ZERO-VALUE)
    ;; Check total allocation does not exceed 100%
    (asserts! (<= (+ (var-get total-allocation-bps) allocation-bps) BPS-DENOMINATOR)
      ERR-ALLOCATION-OVERFLOW)

    (let (
      (new-id (+ (var-get strategy-count) u1))
    )
      (map-set strategies new-id {
        name: name,
        allocation-bps: allocation-bps,
        strike-otm-bps: strike-otm-bps,
        duration-blocks: duration-blocks,
        min-collateral: min-collateral,
        active: true,
        last-epoch-id: u0,
        last-epoch-block: u0
      })

      (map-set strategy-performance new-id {
        total-premiums: u0,
        total-payouts: u0,
        epochs-completed: u0,
        win-count: u0
      })

      (var-set strategy-count new-id)
      (var-set total-allocation-bps (+ (var-get total-allocation-bps) allocation-bps))

      (print {
        event: "strategy-added",
        strategy-id: new-id,
        name: name,
        allocation-bps: allocation-bps,
        strike-otm-bps: strike-otm-bps,
        duration-blocks: duration-blocks
      })

      (ok new-id)
    )
  )
)

;; Update strategy parameters
(define-public (update-strategy
  (strategy-id uint)
  (allocation-bps uint)
  (strike-otm-bps uint)
  (duration-blocks uint)
  (min-collateral uint)
)
  (let (
    (strategy (unwrap! (map-get? strategies strategy-id) ERR-STRATEGY-NOT-FOUND))
    (old-allocation (get allocation-bps strategy))
    (new-total (+ (- (var-get total-allocation-bps) old-allocation) allocation-bps))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> allocation-bps u0) ERR-ZERO-VALUE)
    (asserts! (> strike-otm-bps u0) ERR-ZERO-VALUE)
    (asserts! (> duration-blocks u0) ERR-ZERO-VALUE)
    (asserts! (<= new-total BPS-DENOMINATOR) ERR-ALLOCATION-OVERFLOW)

    (map-set strategies strategy-id (merge strategy {
      allocation-bps: allocation-bps,
      strike-otm-bps: strike-otm-bps,
      duration-blocks: duration-blocks,
      min-collateral: min-collateral
    }))

    (var-set total-allocation-bps new-total)

    (print {
      event: "strategy-updated",
      strategy-id: strategy-id,
      allocation-bps: allocation-bps,
      strike-otm-bps: strike-otm-bps,
      duration-blocks: duration-blocks
    })

    (ok true)
  )
)

;; Toggle strategy active/inactive
(define-public (set-strategy-active (strategy-id uint) (active bool))
  (let (
    (strategy (unwrap! (map-get? strategies strategy-id) ERR-STRATEGY-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set strategies strategy-id (merge strategy { active: active }))

    (print {
      event: "strategy-toggled",
      strategy-id: strategy-id,
      active: active
    })

    (ok true)
  )
)

;; Enable/disable multi-strategy mode
(define-public (set-strategy-enabled (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set strategy-enabled enabled)
    (ok true)
  )
)

;; Record epoch result for a strategy (called by keeper/admin)
(define-public (record-epoch-result
  (strategy-id uint)
  (epoch-id uint)
  (premium-earned uint)
  (payout uint)
  (is-otm bool)
)
  (let (
    (strategy (unwrap! (map-get? strategies strategy-id) ERR-STRATEGY-NOT-FOUND))
    (perf (unwrap! (map-get? strategy-performance strategy-id) ERR-STRATEGY-NOT-FOUND))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)

    ;; Update strategy last epoch
    (map-set strategies strategy-id (merge strategy {
      last-epoch-id: epoch-id,
      last-epoch-block: block-height
    }))

    ;; Update performance
    (map-set strategy-performance strategy-id {
      total-premiums: (+ (get total-premiums perf) premium-earned),
      total-payouts: (+ (get total-payouts perf) payout),
      epochs-completed: (+ (get epochs-completed perf) u1),
      win-count: (if is-otm (+ (get win-count perf) u1) (get win-count perf))
    })

    (print {
      event: "strategy-epoch-recorded",
      strategy-id: strategy-id,
      epoch-id: epoch-id,
      premium-earned: premium-earned,
      payout: payout,
      is-otm: is-otm
    })

    (ok true)
  )
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (get-strategy (strategy-id uint))
  (map-get? strategies strategy-id)
)

(define-read-only (get-strategy-performance (strategy-id uint))
  (map-get? strategy-performance strategy-id)
)

(define-read-only (get-strategy-count)
  (var-get strategy-count)
)

(define-read-only (get-total-allocation)
  (var-get total-allocation-bps)
)

(define-read-only (is-strategy-enabled)
  (var-get strategy-enabled)
)

;; Calculate allocation amount for a strategy given total TVL
(define-read-only (get-strategy-allocation (strategy-id uint) (total-tvl uint))
  (match (map-get? strategies strategy-id)
    strategy (ok (/ (* total-tvl (get allocation-bps strategy)) BPS-DENOMINATOR))
    ERR-STRATEGY-NOT-FOUND
  )
)

;; Get all active strategies summary
(define-read-only (get-strategy-summary)
  {
    total-strategies: (var-get strategy-count),
    total-allocation-bps: (var-get total-allocation-bps),
    reserve-bps: (- BPS-DENOMINATOR (var-get total-allocation-bps)),
    enabled: (var-get strategy-enabled)
  }
)
