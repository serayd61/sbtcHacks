;; governance-voting.clar
;; On-chain governance for protocol parameter voting
;;
;; Votable parameters (string-ascii keys):
;; - "strike-otm-bps"      : Strike OTM percentage (default 500 = 5%)
;; - "management-fee-bps"  : Management fee (default 200 = 2%)
;; - "performance-fee-bps" : Performance fee (default 1000 = 10%)
;; - "epoch-duration"      : Default epoch duration in blocks (default 1008)
;; - "insurance-fee-bps"   : Insurance fund fee (default 500 = 5%)
;; - "withdrawal-limit-bps": Max withdrawal per period (default 2500 = 25%)
;;
;; Flow:
;; 1. GOV holder creates proposal (specify parameter + new value)
;; 2. GOV holders vote (for/against) during VOTE-PERIOD
;; 3. If quorum met + majority for: proposal passes
;; 4. After EXECUTION-DELAY: anyone can execute (stores new param value)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant QUORUM-BPS u1000)          ;; 10% of total GOV supply must vote
(define-constant BPS-DENOMINATOR u10000)
(define-constant VOTE-PERIOD-BLOCKS u1008)  ;; ~7 days
(define-constant EXECUTION-DELAY u144)      ;; ~24 hours after vote ends
(define-constant PROPOSAL-EXPIRY u2016)     ;; ~14 days total lifetime
(define-constant MIN-PROPOSAL-TOKENS u1000000000) ;; 1000 GOV (6 dec) to propose

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u8000))
(define-constant ERR-INSUFFICIENT-GOV (err u8001))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u8002))
(define-constant ERR-ALREADY-VOTED (err u8003))
(define-constant ERR-VOTE-ENDED (err u8004))
(define-constant ERR-VOTE-NOT-ENDED (err u8005))
(define-constant ERR-QUORUM-NOT-MET (err u8006))
(define-constant ERR-NOT-PASSED (err u8007))
(define-constant ERR-EXECUTION-TOO-EARLY (err u8008))
(define-constant ERR-ALREADY-EXECUTED (err u8009))
(define-constant ERR-PROPOSAL-EXPIRED (err u8010))
(define-constant ERR-INVALID-PARAM (err u8011))
(define-constant ERR-ZERO-VALUE (err u8012))

;; ============================================
;; State
;; ============================================
(define-data-var proposal-count uint u0)

;; Current protocol parameters (governance-controlled)
(define-map protocol-params (string-ascii 24) uint)

;; Proposals
(define-map proposals uint {
  proposer: principal,
  param-key: (string-ascii 24),
  param-value: uint,
  votes-for: uint,
  votes-against: uint,
  start-block: uint,
  executed: bool
})

;; Track individual votes
(define-map voter-records { proposal-id: uint, voter: principal } {
  vote: bool,
  weight: uint
})

;; ============================================
;; Initialize default parameters
;; ============================================

;; Set initial parameter values (called once by deployer)
(define-public (initialize-params)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set protocol-params "strike-otm-bps" u500)
    (map-set protocol-params "management-fee-bps" u200)
    (map-set protocol-params "performance-fee-bps" u1000)
    (map-set protocol-params "epoch-duration" u1008)
    (map-set protocol-params "insurance-fee-bps" u500)
    (map-set protocol-params "withdrawal-limit-bps" u2500)
    (ok true)
  )
)

;; ============================================
;; Proposal Creation
;; ============================================

(define-public (create-proposal (param-key (string-ascii 24)) (new-value uint))
  (let (
    (proposer-balance (unwrap-panic (contract-call? .governance-token get-balance tx-sender)))
  )
    ;; Must hold minimum GOV tokens to propose
    (asserts! (>= proposer-balance MIN-PROPOSAL-TOKENS) ERR-INSUFFICIENT-GOV)
    ;; Value must be > 0
    (asserts! (> new-value u0) ERR-ZERO-VALUE)
    ;; Parameter must exist
    (asserts! (is-some (map-get? protocol-params param-key)) ERR-INVALID-PARAM)

    (let (
      (new-id (+ (var-get proposal-count) u1))
    )
      (map-set proposals new-id {
        proposer: tx-sender,
        param-key: param-key,
        param-value: new-value,
        votes-for: u0,
        votes-against: u0,
        start-block: block-height,
        executed: false
      })

      (var-set proposal-count new-id)

      (print {
        event: "proposal-created",
        proposal-id: new-id,
        proposer: tx-sender,
        param-key: param-key,
        new-value: new-value,
        vote-ends: (+ block-height VOTE-PERIOD-BLOCKS)
      })

      (ok new-id)
    )
  )
)

;; ============================================
;; Voting
;; ============================================

(define-public (vote (proposal-id uint) (support bool))
  (let (
    (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
    (voter tx-sender)
    (weight (unwrap-panic (contract-call? .governance-token get-balance voter)))
  )
    ;; Must hold GOV tokens
    (asserts! (> weight u0) ERR-INSUFFICIENT-GOV)
    ;; Vote period must be active
    (asserts! (< (- block-height (get start-block proposal)) VOTE-PERIOD-BLOCKS) ERR-VOTE-ENDED)
    ;; Cannot vote twice
    (asserts! (is-none (map-get? voter-records { proposal-id: proposal-id, voter: voter })) ERR-ALREADY-VOTED)

    ;; Record vote
    (map-set voter-records { proposal-id: proposal-id, voter: voter } {
      vote: support,
      weight: weight
    })

    ;; Update tallies
    (if support
      (map-set proposals proposal-id (merge proposal {
        votes-for: (+ (get votes-for proposal) weight)
      }))
      (map-set proposals proposal-id (merge proposal {
        votes-against: (+ (get votes-against proposal) weight)
      }))
    )

    (print {
      event: "vote-cast",
      proposal-id: proposal-id,
      voter: voter,
      support: support,
      weight: weight
    })

    (ok true)
  )
)

;; ============================================
;; Execution
;; ============================================

(define-public (execute-proposal (proposal-id uint))
  (let (
    (proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND))
    (total-votes (+ (get votes-for proposal) (get votes-against proposal)))
    (gov-supply (unwrap-panic (contract-call? .governance-token get-total-supply)))
    (quorum-required (/ (* gov-supply QUORUM-BPS) BPS-DENOMINATOR))
    (vote-end-block (+ (get start-block proposal) VOTE-PERIOD-BLOCKS))
  )
    ;; Not already executed
    (asserts! (not (get executed proposal)) ERR-ALREADY-EXECUTED)
    ;; Vote period must be over
    (asserts! (>= block-height vote-end-block) ERR-VOTE-NOT-ENDED)
    ;; Not expired
    (asserts! (< (- block-height (get start-block proposal)) PROPOSAL-EXPIRY) ERR-PROPOSAL-EXPIRED)
    ;; Execution delay must have passed
    (asserts! (>= block-height (+ vote-end-block EXECUTION-DELAY)) ERR-EXECUTION-TOO-EARLY)
    ;; Quorum met
    (asserts! (>= total-votes quorum-required) ERR-QUORUM-NOT-MET)
    ;; Majority voted for
    (asserts! (> (get votes-for proposal) (get votes-against proposal)) ERR-NOT-PASSED)

    ;; Update parameter
    (map-set protocol-params (get param-key proposal) (get param-value proposal))

    ;; Mark executed
    (map-set proposals proposal-id (merge proposal { executed: true }))

    (print {
      event: "proposal-executed",
      proposal-id: proposal-id,
      param-key: (get param-key proposal),
      new-value: (get param-value proposal)
    })

    (ok true)
  )
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (get-param (key (string-ascii 24)))
  (map-get? protocol-params key)
)

(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id)
)

(define-read-only (get-proposal-count)
  (var-get proposal-count)
)

(define-read-only (get-voter-record (proposal-id uint) (voter principal))
  (map-get? voter-records { proposal-id: proposal-id, voter: voter })
)

(define-read-only (is-proposal-passed (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal (and
      (> (get votes-for proposal) (get votes-against proposal))
      (>= (+ (get votes-for proposal) (get votes-against proposal))
        (/ (* (unwrap-panic (contract-call? .governance-token get-total-supply)) QUORUM-BPS) BPS-DENOMINATOR)
      )
    )
    false
  )
)

(define-read-only (can-execute (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal (and
      (not (get executed proposal))
      (>= block-height (+ (get start-block proposal) VOTE-PERIOD-BLOCKS EXECUTION-DELAY))
      (< (- block-height (get start-block proposal)) PROPOSAL-EXPIRY)
      (> (get votes-for proposal) (get votes-against proposal))
      (>= (+ (get votes-for proposal) (get votes-against proposal))
        (/ (* (unwrap-panic (contract-call? .governance-token get-total-supply)) QUORUM-BPS) BPS-DENOMINATOR)
      )
    )
    false
  )
)

(define-read-only (get-all-params)
  {
    strike-otm-bps: (default-to u0 (map-get? protocol-params "strike-otm-bps")),
    management-fee-bps: (default-to u0 (map-get? protocol-params "management-fee-bps")),
    performance-fee-bps: (default-to u0 (map-get? protocol-params "performance-fee-bps")),
    epoch-duration: (default-to u0 (map-get? protocol-params "epoch-duration")),
    insurance-fee-bps: (default-to u0 (map-get? protocol-params "insurance-fee-bps")),
    withdrawal-limit-bps: (default-to u0 (map-get? protocol-params "withdrawal-limit-bps"))
  }
)
