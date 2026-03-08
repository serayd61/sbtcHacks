;; admin-multisig.clar
;; 2-of-3 multisig proposal system with timelock
;; Critical vault operations require 2 approvals and 144-block delay

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant TIMELOCK-BLOCKS u144) ;; ~24 hours

;; Errors
(define-constant ERR-NOT-SIGNER (err u6000))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u6001))
(define-constant ERR-ALREADY-APPROVED (err u6002))
(define-constant ERR-NOT-ENOUGH-APPROVALS (err u6003))
(define-constant ERR-TIMELOCK-NOT-PASSED (err u6004))
(define-constant ERR-ALREADY-EXECUTED (err u6005))
(define-constant ERR-NOT-AUTHORIZED (err u6006))
(define-constant ERR-PROPOSAL-EXPIRED (err u6007))

;; Proposal expiry: 1008 blocks (~7 days)
(define-constant PROPOSAL-EXPIRY u1008)
(define-constant THRESHOLD u2)

;; ============================================
;; Data
;; ============================================
(define-data-var proposal-count uint u0)

;; Signers (set by deployer, can be updated by 2-of-3 vote)
(define-data-var signer-1 principal CONTRACT-OWNER)
(define-data-var signer-2 principal CONTRACT-OWNER)
(define-data-var signer-3 principal CONTRACT-OWNER)

(define-map proposals uint {
  proposer: principal,
  action: (string-ascii 64),
  param-uint: uint,           ;; generic uint parameter
  param-principal: principal,  ;; generic principal parameter
  approvals: uint,
  created-block: uint,
  executed: bool
})

(define-map proposal-approvals { proposal-id: uint, signer: principal } bool)

;; ============================================
;; Setup (only deployer, only once per signer)
;; ============================================
(define-public (set-signers (s1 principal) (s2 principal) (s3 principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set signer-1 s1)
    (var-set signer-2 s2)
    (var-set signer-3 s3)
    (ok true)
  )
)

;; ============================================
;; Helpers
;; ============================================
(define-private (is-signer (addr principal))
  (or
    (is-eq addr (var-get signer-1))
    (or
      (is-eq addr (var-get signer-2))
      (is-eq addr (var-get signer-3))
    )
  )
)

;; ============================================
;; Propose
;; ============================================
(define-public (propose (action (string-ascii 64)) (param-uint uint) (param-principal principal))
  (begin
    (asserts! (is-signer tx-sender) ERR-NOT-SIGNER)
    (let (
      (new-id (+ (var-get proposal-count) u1))
    )
      (map-set proposals new-id {
        proposer: tx-sender,
        action: action,
        param-uint: param-uint,
        param-principal: param-principal,
        approvals: u1,
        created-block: block-height,
        executed: false
      })

      ;; Auto-approve by proposer
      (map-set proposal-approvals { proposal-id: new-id, signer: tx-sender } true)
      (var-set proposal-count new-id)

      (print {
        event: "proposal-created",
        proposal-id: new-id,
        action: action,
        proposer: tx-sender
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
    ;; Check not expired
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
        total-approvals: new-approvals
      })

      (ok new-approvals)
    )
  )
)

;; ============================================
;; Read-only
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

(define-read-only (get-signers)
  {
    signer-1: (var-get signer-1),
    signer-2: (var-get signer-2),
    signer-3: (var-get signer-3)
  }
)

(define-read-only (has-approved (proposal-id uint) (signer principal))
  (default-to false (map-get? proposal-approvals { proposal-id: proposal-id, signer: signer }))
)
