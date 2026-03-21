;; treasury-multisig-v2.clar
;; 3-of-5 multisig treasury management system with timelock
;; Institutional-grade security for vault operations

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant TIMELOCK-BLOCKS u288) ;; ~48 hours
(define-constant THRESHOLD u3) ;; 3 of 5 signatures required
(define-constant MAX-SIGNERS u5)
(define-constant PROPOSAL-EXPIRY u2016) ;; ~14 days

;; Errors
(define-constant ERR-NOT-SIGNER (err u7000))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u7001))
(define-constant ERR-ALREADY-APPROVED (err u7002))
(define-constant ERR-NOT-ENOUGH-APPROVALS (err u7003))
(define-constant ERR-TIMELOCK-NOT-PASSED (err u7004))
(define-constant ERR-ALREADY-EXECUTED (err u7005))
(define-constant ERR-NOT-AUTHORIZED (err u7006))
(define-constant ERR-PROPOSAL-EXPIRED (err u7007))
(define-constant ERR-INVALID-SIGNER-COUNT (err u7008))
(define-constant ERR-DUPLICATE-SIGNER (err u7009))
(define-constant ERR-EXECUTION-FAILED (err u7010))
(define-constant ERR-INVALID-ACTION (err u7011))

;; Action types
(define-constant ACTION-PAUSE-VAULT "pause-vault")
(define-constant ACTION-UNPAUSE-VAULT "unpause-vault")
(define-constant ACTION-SET-EMERGENCY-ADMIN "set-emergency-admin")
(define-constant ACTION-UPGRADE-CONTRACT "upgrade-contract")
(define-constant ACTION-SET-INSURANCE-RATE "set-insurance-rate")
(define-constant ACTION-WITHDRAW-INSURANCE "withdraw-insurance")
(define-constant ACTION-SET-FEE-RATES "set-fee-rates")
(define-constant ACTION-ADD-SIGNER "add-signer")
(define-constant ACTION-REMOVE-SIGNER "remove-signer")
(define-constant ACTION-EMERGENCY-SETTLE "emergency-settle")

;; ============================================
;; Data
;; ============================================
(define-data-var proposal-count uint u0)
(define-data-var signer-count uint u0)
(define-data-var emergency-admin (optional principal) none)

;; Signers list (max 5)
(define-map signers principal bool)
(define-map signer-index principal uint)

(define-map proposals uint {
  proposer: principal,
  action: (string-ascii 32),
  target-contract: (optional principal),
  param-uint-1: uint,
  param-uint-2: uint,
  param-principal: (optional principal),
  param-string: (string-ascii 64),
  approvals: uint,
  created-block: uint,
  executed: bool,
  execution-result: (optional bool)
})

(define-map proposal-approvals { proposal-id: uint, signer: principal } bool)

;; Treasury stats
(define-data-var total-proposals uint u0)
(define-data-var successful-executions uint u0)

;; ============================================
;; Setup (only deployer)
;; ============================================
(define-public (initialize-signers (signer-list (list 5 principal)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (var-get signer-count) u0) ERR-NOT-AUTHORIZED) ;; Only once
    (asserts! (>= (len signer-list) u3) ERR-INVALID-SIGNER-COUNT)
    (asserts! (<= (len signer-list) MAX-SIGNERS) ERR-INVALID-SIGNER-COUNT)
    
    (try! (fold add-signer-helper signer-list (ok u0)))
    (var-set signer-count (len signer-list))
    (ok true)
  )
)

(define-private (add-signer-helper (signer principal) (result (response uint uint)))
  (match result
    success (begin
      (asserts! (not (default-to false (map-get? signers signer))) ERR-DUPLICATE-SIGNER)
      (map-set signers signer true)
      (map-set signer-index signer success)
      (ok (+ success u1))
    )
    error (err error)
  )
)

;; ============================================
;; Helpers
;; ============================================
(define-private (is-signer (addr principal))
  (default-to false (map-get? signers addr))
)

(define-private (is-valid-action (action (string-ascii 32)))
  (or
    (is-eq action ACTION-PAUSE-VAULT)
    (or
      (is-eq action ACTION-UNPAUSE-VAULT)
      (or
        (is-eq action ACTION-SET-EMERGENCY-ADMIN)
        (or
          (is-eq action ACTION-UPGRADE-CONTRACT)
          (or
            (is-eq action ACTION-SET-INSURANCE-RATE)
            (or
              (is-eq action ACTION-WITHDRAW-INSURANCE)
              (or
                (is-eq action ACTION-SET-FEE-RATES)
                (or
                  (is-eq action ACTION-ADD-SIGNER)
                  (or
                    (is-eq action ACTION-REMOVE-SIGNER)
                    (is-eq action ACTION-EMERGENCY-SETTLE)
                  )
                )
              )
            )
          )
        )
      )
    )
  )
)

;; ============================================
;; Propose
;; ============================================
(define-public (propose-action 
  (action (string-ascii 32))
  (target-contract (optional principal))
  (param-uint-1 uint)
  (param-uint-2 uint)
  (param-principal (optional principal))
  (param-string (string-ascii 64))
)
  (begin
    (asserts! (is-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (is-valid-action action) ERR-INVALID-ACTION)
    
    (let (
      (new-id (+ (var-get proposal-count) u1))
    )
      (map-set proposals new-id {
        proposer: tx-sender,
        action: action,
        target-contract: target-contract,
        param-uint-1: param-uint-1,
        param-uint-2: param-uint-2,
        param-principal: param-principal,
        param-string: param-string,
        approvals: u1,
        created-block: block-height,
        executed: false,
        execution-result: none
      })

      ;; Auto-approve by proposer
      (map-set proposal-approvals { proposal-id: new-id, signer: tx-sender } true)
      (var-set proposal-count new-id)
      (var-set total-proposals (+ (var-get total-proposals) u1))

      (print {
        event: "proposal-created",
        proposal-id: new-id,
        action: action,
        proposer: tx-sender,
        timelock-expires: (+ block-height TIMELOCK-BLOCKS)
      })

      (ok new-id)
    )
  )
)

;; ============================================
;; Approve
;; ============================================
(define-public (approve (proposal-id uint))
  (let (
    (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
  )
    (asserts! (is-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (not (get executed proposal)) ERR-ALREADY-EXECUTED)
    (asserts! (not (default-to false (map-get? proposal-approvals { proposal-id: proposal-id, signer: tx-sender }))) ERR-ALREADY-APPROVED)
    (asserts! (< (- block-height (get created-block proposal)) PROPOSAL-EXPIRY) ERR-PROPOSAL-EXPIRED)

    (let (
      (new-approvals (+ (get approvals proposal) u1))
    )
      (map-set proposals proposal-id (merge proposal { approvals: new-approvals }))
      (map-set proposal-approvals { proposal-id: proposal-id, signer: tx-sender } true)

      (print {
        event: "proposal-approved",
        proposal-id: proposal-id,
        approver: tx-sender,
        total-approvals: new-approvals,
        threshold-met: (>= new-approvals THRESHOLD)
      })

      (ok new-approvals)
    )
  )
)

;; ============================================
;; Execute
;; ============================================
(define-public (execute (proposal-id uint))
  (let (
    (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
  )
    (asserts! (is-signer tx-sender) ERR-NOT-SIGNER)
    (asserts! (>= (get approvals proposal) THRESHOLD) ERR-NOT-ENOUGH-APPROVALS)
    (asserts! (not (get executed proposal)) ERR-ALREADY-EXECUTED)
    (asserts! (>= (- block-height (get created-block proposal)) TIMELOCK-BLOCKS) ERR-TIMELOCK-NOT-PASSED)
    (asserts! (< (- block-height (get created-block proposal)) PROPOSAL-EXPIRY) ERR-PROPOSAL-EXPIRED)

    ;; Mark as executed first to prevent reentrancy
    (map-set proposals proposal-id (merge proposal { executed: true }))

    ;; Execute the action
    (match (execute-action proposal)
      success (begin
        (map-set proposals proposal-id (merge proposal { 
          executed: true, 
          execution-result: (some true) 
        }))
        (var-set successful-executions (+ (var-get successful-executions) u1))
        (print {
          event: "proposal-executed",
          proposal-id: proposal-id,
          executor: tx-sender,
          action: (get action proposal),
          success: true
        })
        (ok true)
      )
      error (begin
        (map-set proposals proposal-id (merge proposal { 
          executed: true, 
          execution-result: (some false) 
        }))
        (print {
          event: "proposal-execution-failed",
          proposal-id: proposal-id,
          executor: tx-sender,
          action: (get action proposal),
          error: error
        })
        (err ERR-EXECUTION-FAILED)
      )
    )
  )
)

;; ============================================
;; Action Execution
;; ============================================
(define-private (execute-action (proposal { proposer: principal, action: (string-ascii 32), target-contract: (optional principal), param-uint-1: uint, param-uint-2: uint, param-principal: (optional principal), param-string: (string-ascii 64), approvals: uint, created-block: uint, executed: bool, execution-result: (optional bool) }))
  (let ((action (get action proposal)))
    (if (is-eq action ACTION-PAUSE-VAULT)
      (execute-pause-vault (get target-contract proposal))
      (if (is-eq action ACTION-UNPAUSE-VAULT)
        (execute-unpause-vault (get target-contract proposal))
        (if (is-eq action ACTION-SET-EMERGENCY-ADMIN)
          (execute-set-emergency-admin (get param-principal proposal))
          (if (is-eq action ACTION-EMERGENCY-SETTLE)
            (execute-emergency-settle (get target-contract proposal) (get param-uint-1 proposal) (get param-uint-2 proposal))
            (ok true) ;; Other actions can be added later
          )
        )
      )
    )
  )
)

(define-private (execute-pause-vault (vault-contract (optional principal)))
  (match vault-contract
    contract (try! (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-logic-v2 set-vault-paused true))
    (err u404)
  )
)

(define-private (execute-unpause-vault (vault-contract (optional principal)))
  (match vault-contract
    contract (try! (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-logic-v2 set-vault-paused false))
    (err u404)
  )
)

(define-private (execute-set-emergency-admin (new-admin (optional principal)))
  (begin
    (var-set emergency-admin new-admin)
    (ok true)
  )
)

(define-private (execute-emergency-settle (vault-contract (optional principal)) (epoch-id uint) (settlement-price uint))
  (match vault-contract
    contract (try! (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-logic-v2 emergency-settle 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.mock-sbtc epoch-id settlement-price))
    (err u404)
  )
)

;; ============================================
;; Emergency Functions (single emergency admin)
;; ============================================
(define-public (emergency-pause-vault (vault-contract principal))
  (begin
    (asserts! (is-eq (some tx-sender) (var-get emergency-admin)) ERR-NOT-AUTHORIZED)
    (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-logic-v2 set-vault-paused true)
  )
)

;; ============================================
;; Read-only Functions
;; ============================================
(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id)
)

(define-read-only (get-proposal-count)
  (var-get proposal-count)
)

(define-read-only (is-approved (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal (>= (get approvals proposal) THRESHOLD)
    false
  )
)

(define-read-only (can-execute (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal (and
      (>= (get approvals proposal) THRESHOLD)
      (not (get executed proposal))
      (>= (- block-height (get created-block proposal)) TIMELOCK-BLOCKS)
      (< (- block-height (get created-block proposal)) PROPOSAL-EXPIRY)
    )
    false
  )
)

(define-read-only (get-signer-info (signer principal))
  {
    is-signer: (is-signer signer),
    index: (map-get? signer-index signer)
  }
)

(define-read-only (get-treasury-stats)
  {
    total-signers: (var-get signer-count),
    threshold: THRESHOLD,
    total-proposals: (var-get total-proposals),
    successful-executions: (var-get successful-executions),
    timelock-blocks: TIMELOCK-BLOCKS,
    emergency-admin: (var-get emergency-admin)
  }
)

(define-read-only (has-approved (proposal-id uint) (signer principal))
  (default-to false (map-get? proposal-approvals { proposal-id: proposal-id, signer: signer }))
)

(define-read-only (get-proposal-status (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal {
      proposal-id: proposal-id,
      action: (get action proposal),
      approvals: (get approvals proposal),
      threshold-met: (>= (get approvals proposal) THRESHOLD),
      timelock-passed: (>= (- block-height (get created-block proposal)) TIMELOCK-BLOCKS),
      expired: (>= (- block-height (get created-block proposal)) PROPOSAL-EXPIRY),
      executed: (get executed proposal),
      can-execute: (and
        (>= (get approvals proposal) THRESHOLD)
        (not (get executed proposal))
        (>= (- block-height (get created-block proposal)) TIMELOCK-BLOCKS)
        (< (- block-height (get created-block proposal)) PROPOSAL-EXPIRY)
      ),
      execution-result: (get execution-result proposal)
    }
    none
  )
)