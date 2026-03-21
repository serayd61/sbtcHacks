;; circuit-breaker-v1.clar
;; Advanced circuit breaker system for emergency protection
;; Multi-level protection with automatic and manual triggers

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u9000))
(define-constant ERR-INVALID-THRESHOLD (err u9001))
(define-constant ERR-ALREADY-TRIGGERED (err u9002))
(define-constant ERR-COOLDOWN-ACTIVE (err u9003))
(define-constant ERR-INVALID-LEVEL (err u9004))
(define-constant ERR-NOT-PAUSED (err u9005))

;; Circuit breaker levels
(define-constant LEVEL-NONE u0)        ;; Normal operation
(define-constant LEVEL-WARNING u1)     ;; Monitoring alerts
(define-constant LEVEL-PARTIAL u2)     ;; Limited operations
(define-constant LEVEL-EMERGENCY u3)   ;; Emergency pause
(define-constant LEVEL-SHUTDOWN u4)    ;; Full shutdown

;; Trigger types
(define-constant TRIGGER-MANUAL "manual")
(define-constant TRIGGER-TVL-DROP "tvl-drop")
(define-constant TRIGGER-PRICE-DEVIATION "price-deviation")
(define-constant TRIGGER-ORACLE-FAILURE "oracle-failure")
(define-constant TRIGGER-SETTLEMENT-FAILURE "settlement-failure")
(define-constant TRIGGER-UNUSUAL-VOLUME "unusual-volume")
(define-constant TRIGGER-SMART-CONTRACT-EXPLOIT "exploit")

;; Time constants
(define-constant WARNING-COOLDOWN u72)     ;; ~12 hours
(define-constant PARTIAL-COOLDOWN u144)    ;; ~24 hours  
(define-constant EMERGENCY-COOLDOWN u288)  ;; ~48 hours
(define-constant SHUTDOWN-COOLDOWN u1008)  ;; ~7 days

;; Default thresholds (can be updated by governance)
(define-constant DEFAULT-TVL-DROP-THRESHOLD u1000)     ;; 10% = 1000 bps
(define-constant DEFAULT-PRICE-DEVIATION-THRESHOLD u500) ;; 5% = 500 bps
(define-constant DEFAULT-VOLUME-SPIKE-THRESHOLD u5000)   ;; 50x normal

;; ============================================
;; Data Variables
;; ============================================
(define-data-var current-level uint LEVEL-NONE)
(define-data-var last-trigger-block uint u0)
(define-data-var trigger-count uint u0)
(define-data-var governance-contract (optional principal) none)

;; Emergency contacts
(define-data-var emergency-admin principal CONTRACT-OWNER)
(define-data-var multisig-contract (optional principal) none)

;; Thresholds
(define-data-var tvl-drop-threshold uint DEFAULT-TVL-DROP-THRESHOLD)
(define-data-var price-deviation-threshold uint DEFAULT-PRICE-DEVIATION-THRESHOLD)
(define-data-var volume-spike-threshold uint DEFAULT-VOLUME-SPIKE-THRESHOLD)

;; Monitoring data
(define-data-var last-tvl uint u0)
(define-data-var last-price uint u0)
(define-data-var baseline-volume uint u0)
(define-data-var oracle-failure-count uint u0)
(define-data-var settlement-failure-count uint u0)

;; ============================================
;; Data Maps
;; ============================================
(define-map circuit-triggers uint {
  trigger-type: (string-ascii 32),
  level: uint,
  triggered-block: uint,
  triggered-by: principal,
  reason: (string-ascii 256),
  auto-resolved: bool,
  manually-resolved: bool,
  resolution-block: (optional uint)
})

(define-map authorized-triggers principal bool)
(define-map protected-contracts principal bool)

;; Track metrics for automatic triggers
(define-map metrics-history uint {
  block-height: uint,
  tvl: uint,
  price: uint,
  volume-24h: uint,
  active-positions: uint,
  oracle-updates: uint
})

(define-data-var metrics-count uint u0)

;; ============================================
;; Setup Functions
;; ============================================
(define-public (set-governance (governance principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set governance-contract (some governance))
    (ok true)
  )
)

(define-public (set-multisig (multisig principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set multisig-contract (some multisig))
    (ok true)
  )
)

(define-public (set-emergency-admin (admin principal))
  (begin
    (asserts! (or 
      (is-eq tx-sender CONTRACT-OWNER)
      (is-governance-call tx-sender)
    ) ERR-NOT-AUTHORIZED)
    (var-set emergency-admin admin)
    (ok true)
  )
)

(define-public (authorize-trigger (trigger-address principal))
  (begin
    (asserts! (or 
      (is-eq tx-sender CONTRACT-OWNER)
      (is-governance-call tx-sender)
    ) ERR-NOT-AUTHORIZED)
    (map-set authorized-triggers trigger-address true)
    (ok true)
  )
)

(define-public (add-protected-contract (contract-address principal))
  (begin
    (asserts! (or 
      (is-eq tx-sender CONTRACT-OWNER)
      (is-governance-call tx-sender)
    ) ERR-NOT-AUTHORIZED)
    (map-set protected-contracts contract-address true)
    (ok true)
  )
)

;; ============================================
;; Manual Circuit Breaker Triggers
;; ============================================
(define-public (emergency-pause (reason (string-ascii 256)))
  (begin
    (asserts! (is-authorized-emergency tx-sender) ERR-NOT-AUTHORIZED)
    (try! (trigger-circuit-breaker TRIGGER-MANUAL LEVEL-EMERGENCY reason tx-sender))
    (pause-all-protected-contracts)
    (ok true)
  )
)

(define-public (partial-pause (reason (string-ascii 256)))
  (begin
    (asserts! (is-authorized-admin tx-sender) ERR-NOT-AUTHORIZED)
    (try! (trigger-circuit-breaker TRIGGER-MANUAL LEVEL-PARTIAL reason tx-sender))
    (ok true)
  )
)

(define-public (trigger-warning (reason (string-ascii 256)))
  (begin
    (asserts! (is-authorized-trigger tx-sender) ERR-NOT-AUTHORIZED)
    (try! (trigger-circuit-breaker TRIGGER-MANUAL LEVEL-WARNING reason tx-sender))
    (ok true)
  )
)

(define-public (shutdown-protocol (reason (string-ascii 256)))
  (begin
    (asserts! (is-multisig-call tx-sender) ERR-NOT-AUTHORIZED)
    (try! (trigger-circuit-breaker TRIGGER-MANUAL LEVEL-SHUTDOWN reason tx-sender))
    (pause-all-protected-contracts)
    (ok true)
  )
)

;; ============================================
;; Automatic Circuit Breaker Triggers
;; ============================================
(define-public (check-tvl-drop (current-tvl uint))
  (let (
    (last-tvl-val (var-get last-tvl))
  )
    (if (and 
      (> last-tvl-val u0)
      (> current-tvl u0)
      (< current-tvl last-tvl-val)
    )
      (let (
        (drop-percentage (/ (* (- last-tvl-val current-tvl) u10000) last-tvl-val))
      )
        (var-set last-tvl current-tvl)
        (if (>= drop-percentage (var-get tvl-drop-threshold))
          (trigger-circuit-breaker 
            TRIGGER-TVL-DROP 
            LEVEL-EMERGENCY 
            (string-concat "TVL dropped " (int-to-ascii (to-int drop-percentage)))
            tx-sender
          )
          (ok false)
        )
      )
      (begin
        (var-set last-tvl current-tvl)
        (ok false)
      )
    )
  )
)

(define-public (check-price-deviation (current-price uint))
  (let (
    (last-price-val (var-get last-price))
  )
    (if (and 
      (> last-price-val u0)
      (> current-price u0)
    )
      (let (
        (price-diff (if (> current-price last-price-val)
          (- current-price last-price-val)
          (- last-price-val current-price)
        ))
        (deviation-percentage (/ (* price-diff u10000) last-price-val))
      )
        (var-set last-price current-price)
        (if (>= deviation-percentage (var-get price-deviation-threshold))
          (trigger-circuit-breaker 
            TRIGGER-PRICE-DEVIATION 
            LEVEL-PARTIAL 
            (string-concat "Price deviated " (int-to-ascii (to-int deviation-percentage)))
            tx-sender
          )
          (ok false)
        )
      )
      (begin
        (var-set last-price current-price)
        (ok false)
      )
    )
  )
)

(define-public (report-oracle-failure)
  (begin
    (asserts! (is-authorized-trigger tx-sender) ERR-NOT-AUTHORIZED)
    (let (
      (failure-count (+ (var-get oracle-failure-count) u1))
    )
      (var-set oracle-failure-count failure-count)
      (if (>= failure-count u3) ;; 3 consecutive failures
        (trigger-circuit-breaker 
          TRIGGER-ORACLE-FAILURE 
          LEVEL-EMERGENCY 
          "Multiple oracle failures detected"
          tx-sender
        )
        (ok false)
      )
    )
  )
)

(define-public (report-settlement-failure)
  (begin
    (asserts! (is-authorized-trigger tx-sender) ERR-NOT-AUTHORIZED)
    (let (
      (failure-count (+ (var-get settlement-failure-count) u1))
    )
      (var-set settlement-failure-count failure-count)
      (if (>= failure-count u2) ;; 2 consecutive failures
        (trigger-circuit-breaker 
          TRIGGER-SETTLEMENT-FAILURE 
          LEVEL-PARTIAL 
          "Settlement failures detected"
          tx-sender
        )
        (ok false)
      )
    )
  )
)

;; ============================================
;; Circuit Breaker Core Logic
;; ============================================
(define-private (trigger-circuit-breaker (trigger-type (string-ascii 32)) (level uint) (reason (string-ascii 256)) (triggered-by principal))
  (begin
    (asserts! (<= level LEVEL-SHUTDOWN) ERR-INVALID-LEVEL)
    
    ;; Only allow escalation or same level
    (asserts! (>= level (var-get current-level)) ERR-INVALID-LEVEL)
    
    ;; Check cooldown for non-emergency triggers
    (if (and (< level LEVEL-EMERGENCY) (> (var-get last-trigger-block) u0))
      (let ((blocks-since-trigger (- block-height (var-get last-trigger-block))))
        (asserts! (>= blocks-since-trigger (get-cooldown-period (var-get current-level))) ERR-COOLDOWN-ACTIVE)
        true
      )
      true
    )
    
    (let (
      (trigger-id (+ (var-get trigger-count) u1))
    )
      ;; Record trigger
      (map-set circuit-triggers trigger-id {
        trigger-type: trigger-type,
        level: level,
        triggered-block: block-height,
        triggered-by: triggered-by,
        reason: reason,
        auto-resolved: false,
        manually-resolved: false,
        resolution-block: none
      })
      
      ;; Update state
      (var-set current-level level)
      (var-set last-trigger-block block-height)
      (var-set trigger-count trigger-id)
      
      (print {
        event: "circuit-breaker-triggered",
        trigger-id: trigger-id,
        trigger-type: trigger-type,
        level: level,
        reason: reason,
        triggered-by: triggered-by,
        block-height: block-height
      })
      
      (ok true)
    )
  )
)

;; ============================================
;; Recovery Functions
;; ============================================
(define-public (resolve-circuit-breaker (trigger-id uint))
  (let (
    (trigger-info (unwrap! (map-get? circuit-triggers trigger-id) ERR-INVALID-LEVEL))
  )
    (asserts! (is-authorized-admin tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (get manually-resolved trigger-info)) ERR-ALREADY-TRIGGERED)
    
    ;; Check if enough time has passed
    (let ((blocks-since-trigger (- block-height (get triggered-block trigger-info))))
      (asserts! (>= blocks-since-trigger (get-cooldown-period (get level trigger-info))) ERR-COOLDOWN-ACTIVE)
    )
    
    ;; Mark as resolved
    (map-set circuit-triggers trigger-id (merge trigger-info { 
      manually-resolved: true,
      resolution-block: (some block-height)
    }))
    
    ;; Reset to normal if this was the current trigger
    (if (is-eq (get level trigger-info) (var-get current-level))
      (begin
        (var-set current-level LEVEL-NONE)
        (unpause-all-protected-contracts)
        (ok true)
      )
      (ok true)
    )
  )
)

(define-public (force-resume (reason (string-ascii 256)))
  (begin
    (asserts! (is-multisig-call tx-sender) ERR-NOT-AUTHORIZED)
    (var-set current-level LEVEL-NONE)
    (var-set oracle-failure-count u0)
    (var-set settlement-failure-count u0)
    (unpause-all-protected-contracts)
    
    (print {
      event: "circuit-breaker-force-resume",
      reason: reason,
      resumed-by: tx-sender,
      block-height: block-height
    })
    
    (ok true)
  )
)

;; ============================================
;; Contract Control Functions
;; ============================================
(define-private (pause-all-protected-contracts)
  (begin
    ;; This would iterate through protected contracts and pause them
    ;; For now, we'll just emit an event that the keeper can respond to
    (print {
      event: "pause-all-contracts",
      level: (var-get current-level),
      block-height: block-height
    })
    true
  )
)

(define-private (unpause-all-protected-contracts)
  (begin
    (print {
      event: "unpause-all-contracts", 
      block-height: block-height
    })
    true
  )
)

;; ============================================
;; Helper Functions
;; ============================================
(define-private (is-authorized-emergency (caller principal))
  (or 
    (is-eq caller (var-get emergency-admin))
    (is-multisig-call caller)
  )
)

(define-private (is-authorized-admin (caller principal))
  (or 
    (is-eq caller CONTRACT-OWNER)
    (is-eq caller (var-get emergency-admin))
    (is-governance-call caller)
    (is-multisig-call caller)
  )
)

(define-private (is-authorized-trigger (caller principal))
  (or 
    (is-authorized-admin caller)
    (default-to false (map-get? authorized-triggers caller))
  )
)

(define-private (is-governance-call (caller principal))
  (match (var-get governance-contract)
    governance (is-eq caller governance)
    false
  )
)

(define-private (is-multisig-call (caller principal))
  (match (var-get multisig-contract)
    multisig (is-eq caller multisig)
    false
  )
)

(define-private (get-cooldown-period (level uint))
  (if (is-eq level LEVEL-WARNING)
    WARNING-COOLDOWN
    (if (is-eq level LEVEL-PARTIAL)
      PARTIAL-COOLDOWN
      (if (is-eq level LEVEL-EMERGENCY)
        EMERGENCY-COOLDOWN
        SHUTDOWN-COOLDOWN
      )
    )
  )
)

(define-private (int-to-ascii (value int))
  ;; Simplified conversion - in production would need proper implementation
  "N/A"
)

(define-private (string-concat (str1 (string-ascii 128)) (str2 (string-ascii 128)))
  ;; Simplified concatenation
  str1
)

;; ============================================
;; Configuration Functions
;; ============================================
(define-public (update-thresholds (tvl-threshold uint) (price-threshold uint) (volume-threshold uint))
  (begin
    (asserts! (is-governance-call tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (<= tvl-threshold u5000) ERR-INVALID-THRESHOLD)   ;; Max 50%
    (asserts! (<= price-threshold u2000) ERR-INVALID-THRESHOLD) ;; Max 20%
    
    (var-set tvl-drop-threshold tvl-threshold)
    (var-set price-deviation-threshold price-threshold)
    (var-set volume-spike-threshold volume-threshold)
    
    (ok true)
  )
)

;; ============================================
;; Read-only Functions
;; ============================================
(define-read-only (get-circuit-status)
  {
    current-level: (var-get current-level),
    last-trigger-block: (var-get last-trigger-block),
    trigger-count: (var-get trigger-count),
    blocks-since-trigger: (if (> (var-get last-trigger-block) u0)
      (some (- block-height (var-get last-trigger-block)))
      none
    ),
    is-paused: (> (var-get current-level) LEVEL-WARNING),
    oracle-failures: (var-get oracle-failure-count),
    settlement-failures: (var-get settlement-failure-count)
  }
)

(define-read-only (get-trigger-info (trigger-id uint))
  (map-get? circuit-triggers trigger-id)
)

(define-read-only (get-thresholds)
  {
    tvl-drop-threshold: (var-get tvl-drop-threshold),
    price-deviation-threshold: (var-get price-deviation-threshold),
    volume-spike-threshold: (var-get volume-spike-threshold)
  }
)

(define-read-only (is-contract-protected (contract-address principal))
  (default-to false (map-get? protected-contracts contract-address))
)

(define-read-only (can-operate (operation-level uint))
  (<= operation-level (var-get current-level))
)