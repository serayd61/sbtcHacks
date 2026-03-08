;; vault-data-v1.clar
;; Data layer for sBTC Options Vault v2
;; Stores all state (maps, data-vars). Write access gated by authorized logic contract.
;; This contract persists across logic upgrades.

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u5000))
(define-constant ERR-NOT-LOGIC-CONTRACT (err u5001))

;; ============================================
;; Authorized Logic Contract
;; ============================================
(define-data-var logic-contract principal CONTRACT-OWNER)

;; Only owner can update the logic contract address
(define-public (set-logic-contract (new-logic principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set logic-contract new-logic)
    (ok true)
  )
)

(define-read-only (get-logic-contract)
  (var-get logic-contract)
)

;; Internal: check if caller is the authorized logic contract
(define-private (is-logic-caller)
  (is-eq contract-caller (var-get logic-contract))
)

;; ============================================
;; Vault State Variables
;; ============================================
(define-data-var vault-paused bool false)
(define-data-var total-shares uint u0)
(define-data-var total-sbtc-deposited uint u0)
(define-data-var current-epoch-id uint u0)
(define-data-var active-epoch bool false)
(define-data-var market-contract principal CONTRACT-OWNER)
(define-data-var total-premiums-earned uint u0)
(define-data-var total-epochs-completed uint u0)
(define-data-var total-fees-collected uint u0)
(define-data-var treasury-address principal CONTRACT-OWNER)

;; Withdrawal queue state
(define-data-var withdrawal-period-start uint u0)
(define-data-var withdrawals-this-period uint u0)

;; ============================================
;; Maps
;; ============================================
(define-map user-shares principal uint)

(define-map epochs uint {
  strike-price: uint,
  premium: uint,
  collateral: uint,
  start-block: uint,
  expiry-block: uint,
  settled: bool,
  settlement-price: uint,
  premium-earned: uint,
  payout: uint,
  outcome: (string-ascii 3)
})

;; ============================================
;; Getters (read-only, anyone can read)
;; ============================================
(define-read-only (get-vault-paused) (var-get vault-paused))
(define-read-only (get-total-shares) (var-get total-shares))
(define-read-only (get-total-sbtc-deposited) (var-get total-sbtc-deposited))
(define-read-only (get-current-epoch-id) (var-get current-epoch-id))
(define-read-only (get-active-epoch) (var-get active-epoch))
(define-read-only (get-market-contract) (var-get market-contract))
(define-read-only (get-total-premiums-earned) (var-get total-premiums-earned))
(define-read-only (get-total-epochs-completed) (var-get total-epochs-completed))
(define-read-only (get-total-fees-collected) (var-get total-fees-collected))
(define-read-only (get-treasury-address) (var-get treasury-address))
(define-read-only (get-withdrawal-period-start) (var-get withdrawal-period-start))
(define-read-only (get-withdrawals-this-period) (var-get withdrawals-this-period))

(define-read-only (get-user-shares (user principal))
  (default-to u0 (map-get? user-shares user))
)

(define-read-only (get-epoch (epoch-id uint))
  (map-get? epochs epoch-id)
)

;; ============================================
;; Setters (only logic contract can write)
;; ============================================
(define-public (set-vault-paused (paused bool))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set vault-paused paused)
    (ok true)
  )
)

(define-public (set-total-shares (val uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set total-shares val)
    (ok true)
  )
)

(define-public (set-total-sbtc-deposited (val uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set total-sbtc-deposited val)
    (ok true)
  )
)

(define-public (set-current-epoch-id (val uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set current-epoch-id val)
    (ok true)
  )
)

(define-public (set-active-epoch (val bool))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set active-epoch val)
    (ok true)
  )
)

(define-public (set-market-contract-addr (market principal))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set market-contract market)
    (ok true)
  )
)

(define-public (set-total-premiums-earned (val uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set total-premiums-earned val)
    (ok true)
  )
)

(define-public (set-total-epochs-completed (val uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set total-epochs-completed val)
    (ok true)
  )
)

(define-public (set-total-fees-collected (val uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set total-fees-collected val)
    (ok true)
  )
)

(define-public (set-treasury-address (addr principal))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set treasury-address addr)
    (ok true)
  )
)

(define-public (set-withdrawal-period-start (val uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set withdrawal-period-start val)
    (ok true)
  )
)

(define-public (set-withdrawals-this-period (val uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (var-set withdrawals-this-period val)
    (ok true)
  )
)

(define-public (set-user-shares (user principal) (shares uint))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (map-set user-shares user shares)
    (ok true)
  )
)

(define-public (set-epoch (epoch-id uint) (data {
  strike-price: uint,
  premium: uint,
  collateral: uint,
  start-block: uint,
  expiry-block: uint,
  settled: bool,
  settlement-price: uint,
  premium-earned: uint,
  payout: uint,
  outcome: (string-ascii 3)
}))
  (begin
    (asserts! (is-logic-caller) ERR-NOT-LOGIC-CONTRACT)
    (map-set epochs epoch-id data)
    (ok true)
  )
)
