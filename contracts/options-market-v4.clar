;; options-market-v4.clar
;; Marketplace for covered call options - v4 with 100 listings per epoch + batch creation
;; Uses vault-logic-v2 for record-option-sale and transfer-payout

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant PRICE-PRECISION u1000000)
(define-constant SBTC-PRECISION u100000000)

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u4000))
(define-constant ERR-LISTING-NOT-FOUND (err u4001))
(define-constant ERR-ALREADY-SOLD (err u4002))
(define-constant ERR-EXPIRED (err u4003))
(define-constant ERR-NOT-EXPIRED (err u4004))
(define-constant ERR-ZERO-AMOUNT (err u4005))
(define-constant ERR-TRANSFER-FAILED (err u4006))
(define-constant ERR-NOT-BUYER (err u4007))
(define-constant ERR-NOT-SETTLED (err u4008))
(define-constant ERR-ALREADY-CLAIMED (err u4009))
(define-constant ERR-DUPLICATE-LISTING (err u4010))
(define-constant ERR-MAX-LISTINGS-REACHED (err u4011))
(define-constant ERR-INVALID-COUNT (err u4012))
(define-constant MAX-LISTINGS-PER-EPOCH u100)

;; ============================================
;; Data vars
;; ============================================
(define-data-var listing-count uint u0)
(define-data-var total-options-sold uint u0)
(define-data-var total-volume uint u0)

;; ============================================
;; Maps
;; ============================================
(define-map listings uint {
  epoch-id: uint,
  strike-price: uint,
  premium: uint,
  collateral: uint,
  expiry-block: uint,
  sold: bool,
  buyer: (optional principal),
  created-block: uint,
  claimed: bool
})

;; Track listing count per epoch (max 100)
(define-map epoch-listing-count uint uint)

;; ============================================
;; Batch creation helpers
;; ============================================

;; Static 100-element index list for fold iteration
(define-constant ITER-100 (list
  u1 u2 u3 u4 u5 u6 u7 u8 u9 u10
  u11 u12 u13 u14 u15 u16 u17 u18 u19 u20
  u21 u22 u23 u24 u25 u26 u27 u28 u29 u30
  u31 u32 u33 u34 u35 u36 u37 u38 u39 u40
  u41 u42 u43 u44 u45 u46 u47 u48 u49 u50
  u51 u52 u53 u54 u55 u56 u57 u58 u59 u60
  u61 u62 u63 u64 u65 u66 u67 u68 u69 u70
  u71 u72 u73 u74 u75 u76 u77 u78 u79 u80
  u81 u82 u83 u84 u85 u86 u87 u88 u89 u90
  u91 u92 u93 u94 u95 u96 u97 u98 u99 u100
))

;; Private fold function: creates one listing per iteration until count reached
(define-private (create-one-listing-iter
  (idx uint)
  (state {
    epoch-id: uint,
    strike-price: uint,
    premium: uint,
    collateral: uint,
    expiry-block: uint,
    created: uint,
    target: uint
  })
)
  (if (< (get created state) (get target state))
    (let (
      (new-id (+ (var-get listing-count) u1))
      (epoch-id (get epoch-id state))
      (current-epoch-count (default-to u0 (map-get? epoch-listing-count epoch-id)))
    )
      (if (< current-epoch-count MAX-LISTINGS-PER-EPOCH)
        (begin
          (map-set listings new-id {
            epoch-id: epoch-id,
            strike-price: (get strike-price state),
            premium: (get premium state),
            collateral: (get collateral state),
            expiry-block: (get expiry-block state),
            sold: false,
            buyer: none,
            created-block: block-height,
            claimed: false
          })
          (map-set epoch-listing-count epoch-id (+ current-epoch-count u1))
          (var-set listing-count new-id)
          (merge state { created: (+ (get created state) u1) })
        )
        state
      )
    )
    state
  )
)

;; ============================================
;; Admin Functions
;; ============================================

;; Create a single option listing (admin only)
(define-public (create-listing
  (epoch-id uint)
  (strike-price uint)
  (premium uint)
  (collateral uint)
  (expiry-block uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> premium u0) ERR-ZERO-AMOUNT)
    (asserts! (> collateral u0) ERR-ZERO-AMOUNT)
    ;; Allow up to MAX-LISTINGS-PER-EPOCH (100) listings per epoch
    (let (
      (current-count (default-to u0 (map-get? epoch-listing-count epoch-id)))
    )
      (asserts! (< current-count MAX-LISTINGS-PER-EPOCH) ERR-MAX-LISTINGS-REACHED)

      (let ((new-id (+ (var-get listing-count) u1)))
        (map-set listings new-id {
          epoch-id: epoch-id,
          strike-price: strike-price,
          premium: premium,
          collateral: collateral,
          expiry-block: expiry-block,
          sold: false,
          buyer: none,
          created-block: block-height,
          claimed: false
        })

        ;; Increment epoch listing count
        (map-set epoch-listing-count epoch-id (+ current-count u1))
        (var-set listing-count new-id)

        (print {
          event: "listing-created",
          listing-id: new-id,
          epoch-id: epoch-id,
          strike-price: strike-price,
          premium: premium,
          collateral: collateral,
          expiry-block: expiry-block,
          listing-number: (+ current-count u1)
        })

        (ok new-id)
      )
    )
  )
)

;; Batch create multiple identical listings in a single TX (admin only)
;; num-listings: how many listings to create (1-100)
(define-public (batch-create-listings
  (epoch-id uint)
  (strike-price uint)
  (premium uint)
  (collateral uint)
  (expiry-block uint)
  (num-listings uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> premium u0) ERR-ZERO-AMOUNT)
    (asserts! (> collateral u0) ERR-ZERO-AMOUNT)
    (asserts! (> num-listings u0) ERR-INVALID-COUNT)
    (asserts! (<= num-listings MAX-LISTINGS-PER-EPOCH) ERR-INVALID-COUNT)
    (let (
      (current-epoch-count (default-to u0 (map-get? epoch-listing-count epoch-id)))
    )
      (asserts! (<= (+ current-epoch-count num-listings) MAX-LISTINGS-PER-EPOCH) ERR-MAX-LISTINGS-REACHED)
      (let (
        (result (fold create-one-listing-iter ITER-100 {
          epoch-id: epoch-id,
          strike-price: strike-price,
          premium: premium,
          collateral: collateral,
          expiry-block: expiry-block,
          created: u0,
          target: num-listings
        }))
      )
        (print {
          event: "batch-listings-created",
          epoch-id: epoch-id,
          listings-created: (get created result),
          strike-price: strike-price,
          premium: premium,
          collateral: collateral,
          expiry-block: expiry-block
        })
        (ok (get created result))
      )
    )
  )
)

;; ============================================
;; User Functions
;; ============================================

;; Buy an option by paying the premium
(define-public (buy-option (token <sip-010-token>) (listing-id uint))
  (let (
    (listing (unwrap! (map-get? listings listing-id) ERR-LISTING-NOT-FOUND))
  )
    (asserts! (not (get sold listing)) ERR-ALREADY-SOLD)
    (asserts! (< block-height (get expiry-block listing)) ERR-EXPIRED)

    (let (
      (premium (get premium listing))
      (epoch-id (get epoch-id listing))
    )
      ;; Transfer premium from buyer to this contract
      (try! (contract-call? token transfer premium tx-sender (as-contract tx-sender) none))

      ;; Forward premium to vault-logic-v2 contract
      (try! (as-contract (contract-call? token transfer premium tx-sender .vault-logic-v2 none)))

      ;; Record sale in vault
      (try! (contract-call? .vault-logic-v2 record-option-sale epoch-id premium))

      ;; Update listing
      (map-set listings listing-id (merge listing {
        sold: true,
        buyer: (some tx-sender)
      }))

      (var-set total-options-sold (+ (var-get total-options-sold) u1))
      (var-set total-volume (+ (var-get total-volume) premium))

      (print {
        event: "option-bought",
        listing-id: listing-id,
        buyer: tx-sender,
        premium: premium,
        epoch-id: epoch-id
      })

      (ok true)
    )
  )
)

;; Claim payout after ITM settlement
(define-public (claim-payout (token <sip-010-token>) (listing-id uint))
  (let (
    (listing (unwrap! (map-get? listings listing-id) ERR-LISTING-NOT-FOUND))
    (buyer (unwrap! (get buyer listing) ERR-NOT-BUYER))
    (epoch-id (get epoch-id listing))
    (epoch (unwrap! (contract-call? .vault-logic-v2 get-epoch epoch-id) ERR-NOT-SETTLED))
  )
    (asserts! (is-eq tx-sender buyer) ERR-NOT-BUYER)
    (asserts! (get settled epoch) ERR-NOT-SETTLED)
    (asserts! (not (get claimed listing)) ERR-ALREADY-CLAIMED)

    (let (
      (payout (get payout epoch))
    )
      (if (> payout u0)
        (begin
          (try! (contract-call? .vault-logic-v2 transfer-payout token payout tx-sender))
          (map-set listings listing-id (merge listing { claimed: true }))
          (print {
            event: "payout-claimed",
            listing-id: listing-id,
            buyer: tx-sender,
            payout: payout
          })
          (ok payout)
        )
        (begin
          (map-set listings listing-id (merge listing { claimed: true }))
          (ok u0)
        )
      )
    )
  )
)

;; Expire unsold listing
(define-public (expire-unsold (listing-id uint))
  (let (
    (listing (unwrap! (map-get? listings listing-id) ERR-LISTING-NOT-FOUND))
  )
    (asserts! (not (get sold listing)) ERR-ALREADY-SOLD)
    (asserts! (>= block-height (get expiry-block listing)) ERR-NOT-EXPIRED)

    (map-set listings listing-id (merge listing {
      sold: false,
      buyer: none
    }))

    (print {
      event: "listing-expired",
      listing-id: listing-id
    })

    (ok true)
  )
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (compute-suggested-premium
  (collateral uint)
  (strike-price uint)
  (current-price uint)
)
  (let (
    (base-premium (/ collateral u100))
    (intrinsic (if (> current-price strike-price)
      (/ (* collateral (- current-price strike-price)) current-price)
      u0
    ))
  )
    (ok (+ base-premium intrinsic))
  )
)

(define-read-only (get-listing (listing-id uint))
  (map-get? listings listing-id)
)

(define-read-only (get-market-info)
  (ok {
    total-listings: (var-get listing-count),
    total-options-sold: (var-get total-options-sold),
    total-volume: (var-get total-volume)
  })
)

(define-read-only (get-listing-count)
  (var-get listing-count)
)

(define-read-only (has-epoch-listing (epoch-id uint))
  (> (default-to u0 (map-get? epoch-listing-count epoch-id)) u0)
)

(define-read-only (get-epoch-listing-count (epoch-id uint))
  (default-to u0 (map-get? epoch-listing-count epoch-id))
)

(define-read-only (get-max-listings-per-epoch)
  MAX-LISTINGS-PER-EPOCH
)
