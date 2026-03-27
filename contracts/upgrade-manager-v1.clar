;; upgrade-manager-v1.clar
;; Time-locked contract upgrade system with 48h delay
;; Institutional-grade upgrade governance

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant UPGRADE-TIMELOCK u288) ;; ~48 hours
(define-constant MAX-UPGRADE-DELAY u4320) ;; ~30 days
(define-constant EMERGENCY-TIMELOCK u144) ;; ~24 hours for critical fixes

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u8000))
(define-constant ERR-UPGRADE-NOT-FOUND (err u8001))
(define-constant ERR-TIMELOCK-NOT-PASSED (err u8002))
(define-constant ERR-UPGRADE-EXPIRED (err u8003))
(define-constant ERR-ALREADY-EXECUTED (err u8004))
(define-constant ERR-INVALID-CONTRACT (err u8005))
(define-constant ERR-UPGRADE-CANCELLED (err u8006))
(define-constant ERR-EMERGENCY-NOT-AUTHORIZED (err u8007))

;; Upgrade types
(define-constant UPGRADE-NORMAL "normal")
(define-constant UPGRADE-EMERGENCY "emergency")
(define-constant UPGRADE-HOTFIX "hotfix")

;; ============================================
;; Data
;; ============================================
(define-data-var upgrade-count uint u0)
(define-data-var governance-contract (optional principal) none)
(define-data-var emergency-council (optional principal) none)

;; Current contract implementations
(define-map current-implementations (string-ascii 32) principal)

;; Upgrade proposals
(define-map upgrades uint {
  proposer: principal,
  contract-name: (string-ascii 32),
  old-implementation: principal,
  new-implementation: principal,
  upgrade-type: (string-ascii 16),
  description: (string-ascii 256),
  scheduled-block: uint,
  expiry-block: uint,
  executed: bool,
  cancelled: bool,
  governance-approved: bool,
  emergency-approved: bool
})

;; Track implementation history
(define-map implementation-history uint {
  contract-name: (string-ascii 32),
  implementation: principal,
  activated-block: uint,
  deactivated-block: (optional uint),
  upgrade-reason: (string-ascii 256)
})

(define-data-var history-count uint u0)

;; ============================================
;; Setup
;; ============================================
(define-public (set-governance-contract (governance principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set governance-contract (some governance))
    (ok true)
  )
)

(define-public (set-emergency-council (council principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set emergency-council (some council))
    (ok true)
  )
)

(define-public (register-initial-implementation (contract-name (string-ascii 32)) (implementation principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-none (map-get? current-implementations contract-name)) ERR-INVALID-CONTRACT)
    
    (map-set current-implementations contract-name implementation)
    
    ;; Record in history
    (let ((history-id (+ (var-get history-count) u1)))
      (map-set implementation-history history-id {
        contract-name: contract-name,
        implementation: implementation,
        activated-block: block-height,
        deactivated-block: none,
        upgrade-reason: "Initial deployment"
      })
      (var-set history-count history-id)
    )
    
    (ok true)
  )
)

;; ============================================
;; Propose Upgrade
;; ============================================
(define-public (propose-upgrade 
  (contract-name (string-ascii 32))
  (new-implementation principal)
  (upgrade-type (string-ascii 16))
  (description (string-ascii 256))
)
  (begin
    (asserts! (is-authorized-proposer tx-sender) ERR-NOT-AUTHORIZED)
    
    (let (
      (old-impl (unwrap! (map-get? current-implementations contract-name) ERR-INVALID-CONTRACT))
      (upgrade-id (+ (var-get upgrade-count) u1))
      (timelock-duration (if (is-eq upgrade-type UPGRADE-EMERGENCY) EMERGENCY-TIMELOCK UPGRADE-TIMELOCK))
      (scheduled-block (+ block-height timelock-duration))
      (expiry-block (+ scheduled-block MAX-UPGRADE-DELAY))
    )
      (map-set upgrades upgrade-id {
        proposer: tx-sender,
        contract-name: contract-name,
        old-implementation: old-impl,
        new-implementation: new-implementation,
        upgrade-type: upgrade-type,
        description: description,
        scheduled-block: scheduled-block,
        expiry-block: expiry-block,
        executed: false,
        cancelled: false,
        governance-approved: (is-eq upgrade-type UPGRADE-HOTFIX), ;; Hotfixes auto-approved
        emergency-approved: false
      })
      
      (var-set upgrade-count upgrade-id)
      
      (print {
        event: "upgrade-proposed",
        upgrade-id: upgrade-id,
        contract-name: contract-name,
        new-implementation: new-implementation,
        upgrade-type: upgrade-type,
        scheduled-block: scheduled-block,
        proposer: tx-sender
      })
      
      (ok upgrade-id)
    )
  )
)

;; ============================================
;; Governance Approval
;; ============================================
(define-public (approve-upgrade (upgrade-id uint))
  (let (
    (upgrade (unwrap! (map-get? upgrades upgrade-id) ERR-UPGRADE-NOT-FOUND))
  )
    (asserts! (is-governance-authorized tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (get executed upgrade)) ERR-ALREADY-EXECUTED)
    (asserts! (not (get cancelled upgrade)) ERR-UPGRADE-CANCELLED)
    
    (map-set upgrades upgrade-id (merge upgrade { governance-approved: true }))
    
    (print {
      event: "upgrade-approved",
      upgrade-id: upgrade-id,
      approver: tx-sender,
      governance: true
    })
    
    (ok true)
  )
)

(define-public (emergency-approve (upgrade-id uint))
  (let (
    (upgrade (unwrap! (map-get? upgrades upgrade-id) ERR-UPGRADE-NOT-FOUND))
  )
    (asserts! (is-emergency-authorized tx-sender) ERR-EMERGENCY-NOT-AUTHORIZED)
    (asserts! (not (get executed upgrade)) ERR-ALREADY-EXECUTED)
    (asserts! (not (get cancelled upgrade)) ERR-UPGRADE-CANCELLED)
    (asserts! (is-eq (get upgrade-type upgrade) UPGRADE-EMERGENCY) ERR-NOT-AUTHORIZED)
    
    (map-set upgrades upgrade-id (merge upgrade { emergency-approved: true }))
    
    (print {
      event: "upgrade-emergency-approved",
      upgrade-id: upgrade-id,
      approver: tx-sender,
      emergency: true
    })
    
    (ok true)
  )
)

;; ============================================
;; Execute Upgrade
;; ============================================
(define-public (execute-upgrade (upgrade-id uint))
  (let (
    (upgrade (unwrap! (map-get? upgrades upgrade-id) ERR-UPGRADE-NOT-FOUND))
  )
    (asserts! (is-authorized-executor tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (get executed upgrade)) ERR-ALREADY-EXECUTED)
    (asserts! (not (get cancelled upgrade)) ERR-UPGRADE-CANCELLED)
    (asserts! (>= block-height (get scheduled-block upgrade)) ERR-TIMELOCK-NOT-PASSED)
    (asserts! (< block-height (get expiry-block upgrade)) ERR-UPGRADE-EXPIRED)
    (asserts! (is-upgrade-ready upgrade) ERR-NOT-AUTHORIZED)
    
    ;; Deactivate old implementation in history
    (unwrap-panic (deactivate-old-implementation (get contract-name upgrade) (get old-implementation upgrade)))
    
    ;; Activate new implementation
    (map-set current-implementations (get contract-name upgrade) (get new-implementation upgrade))
    
    ;; Record in history
    (let ((history-id (+ (var-get history-count) u1)))
      (map-set implementation-history history-id {
        contract-name: (get contract-name upgrade),
        implementation: (get new-implementation upgrade),
        activated-block: block-height,
        deactivated-block: none,
        upgrade-reason: (get description upgrade)
      })
      (var-set history-count history-id)
    )
    
    ;; Mark upgrade as executed
    (map-set upgrades upgrade-id (merge upgrade { executed: true }))
    
    (print {
      event: "upgrade-executed",
      upgrade-id: upgrade-id,
      contract-name: (get contract-name upgrade),
      old-implementation: (get old-implementation upgrade),
      new-implementation: (get new-implementation upgrade),
      executor: tx-sender
    })
    
    (ok true)
  )
)

;; ============================================
;; Cancel Upgrade
;; ============================================
(define-public (cancel-upgrade (upgrade-id uint))
  (let (
    (upgrade (unwrap! (map-get? upgrades upgrade-id) ERR-UPGRADE-NOT-FOUND))
  )
    (asserts! (or 
      (is-eq tx-sender (get proposer upgrade))
      (is-governance-authorized tx-sender)
      (is-emergency-authorized tx-sender)
    ) ERR-NOT-AUTHORIZED)
    (asserts! (not (get executed upgrade)) ERR-ALREADY-EXECUTED)
    (asserts! (not (get cancelled upgrade)) ERR-UPGRADE-CANCELLED)
    
    (map-set upgrades upgrade-id (merge upgrade { cancelled: true }))
    
    (print {
      event: "upgrade-cancelled",
      upgrade-id: upgrade-id,
      canceller: tx-sender
    })
    
    (ok true)
  )
)

;; ============================================
;; Helper Functions
;; ============================================
(define-private (is-authorized-proposer (proposer principal))
  (or 
    (is-eq proposer CONTRACT-OWNER)
    (is-governance-authorized proposer)
    (is-emergency-authorized proposer)
  )
)

(define-private (is-authorized-executor (executor principal))
  (or 
    (is-eq executor CONTRACT-OWNER)
    (is-governance-authorized executor)
  )
)

(define-private (is-governance-authorized (caller principal))
  (match (var-get governance-contract)
    governance (is-eq caller governance)
    false
  )
)

(define-private (is-emergency-authorized (caller principal))
  (match (var-get emergency-council)
    council (is-eq caller council)
    false
  )
)

(define-private (is-upgrade-ready (upgrade { proposer: principal, contract-name: (string-ascii 32), old-implementation: principal, new-implementation: principal, upgrade-type: (string-ascii 16), description: (string-ascii 256), scheduled-block: uint, expiry-block: uint, executed: bool, cancelled: bool, governance-approved: bool, emergency-approved: bool }))
  (if (is-eq (get upgrade-type upgrade) UPGRADE-EMERGENCY)
    (get emergency-approved upgrade)
    (get governance-approved upgrade)
  )
)

(define-private (deactivate-old-implementation (contract-name (string-ascii 32)) (old-impl principal))
  (let (
    (history-entries (filter check-active-implementation (list 
      u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20
      u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31 u32 u33 u34 u35 u36 u37 u38 u39 u40
    )))
  )
    (match (get-last-active-entry contract-name old-impl)
      entry-id (begin
        (match (map-get? implementation-history entry-id)
          history (begin
            (map-set implementation-history entry-id (merge history { 
              deactivated-block: (some block-height) 
            }))
            (ok true)
          )
          (ok true)
        )
      )
      (ok true)
    )
  )
)

(define-private (check-active-implementation (history-id uint))
  (match (map-get? implementation-history history-id)
    history (and 
      (is-none (get deactivated-block history))
      true
    )
    false
  )
)

(define-private (get-last-active-entry (contract-name (string-ascii 32)) (implementation principal))
  (get result (fold find-matching-implementation (list 
    u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20
    u21 u22 u23 u24 u25 u26 u27 u28 u29 u30 u31 u32 u33 u34 u35 u36 u37 u38 u39 u40
  ) { name: contract-name, impl: implementation, result: none }))
)

(define-private (find-matching-implementation (history-id uint) (search { name: (string-ascii 32), impl: principal, result: (optional uint) }))
  (if (is-some (get result search))
    search
    (match (map-get? implementation-history history-id)
      history (if (and
        (is-eq (get contract-name history) (get name search))
        (is-eq (get implementation history) (get impl search))
        (is-none (get deactivated-block history))
      )
        (merge search { result: (some history-id) })
        search
      )
      search
    )
  )
)

;; ============================================
;; Read-only Functions
;; ============================================
(define-read-only (get-current-implementation (contract-name (string-ascii 32)))
  (map-get? current-implementations contract-name)
)

(define-read-only (get-upgrade (upgrade-id uint))
  (map-get? upgrades upgrade-id)
)

(define-read-only (get-upgrade-status (upgrade-id uint))
  (match (map-get? upgrades upgrade-id)
    upgrade (some {
      upgrade-id: upgrade-id,
      contract-name: (get contract-name upgrade),
      upgrade-type: (get upgrade-type upgrade),
      timelock-passed: (>= block-height (get scheduled-block upgrade)),
      expired: (>= block-height (get expiry-block upgrade)),
      governance-approved: (get governance-approved upgrade),
      emergency-approved: (get emergency-approved upgrade),
      ready-to-execute: (and
        (>= block-height (get scheduled-block upgrade))
        (< block-height (get expiry-block upgrade))
        (not (get executed upgrade))
        (not (get cancelled upgrade))
        (is-upgrade-ready upgrade)
      ),
      executed: (get executed upgrade),
      cancelled: (get cancelled upgrade),
      blocks-until-execution: (if (< block-height (get scheduled-block upgrade))
        (some (- (get scheduled-block upgrade) block-height))
        none
      )
    })
    none
  )
)

(define-read-only (get-implementation-history (history-id uint))
  (map-get? implementation-history history-id)
)

(define-read-only (get-upgrade-count)
  (var-get upgrade-count)
)

(define-read-only (get-history-count)
  (var-get history-count)
)

(define-read-only (get-governance-info)
  {
    governance-contract: (var-get governance-contract),
    emergency-council: (var-get emergency-council),
    upgrade-timelock: UPGRADE-TIMELOCK,
    emergency-timelock: EMERGENCY-TIMELOCK,
    max-upgrade-delay: MAX-UPGRADE-DELAY
  }
)