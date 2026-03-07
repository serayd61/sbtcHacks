;; options-market.clar
;; Marketplace for buying covered call options written by the vault

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant PRICE-PRECISION u1000000)
(define-constant SBTC-PRECISION u100000000)

;; Errors
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

;; Data vars
(define-data-var listing-count uint u0)
(define-data-var total-options-sold uint u0)
(define-data-var total-volume uint u0)

;; Listings map
(define-map listings uint {
  epoch-id: uint,
  strike-price: uint,         ;; USD * PRICE-PRECISION
  premium: uint,              ;; sBTC sats
  collateral: uint,           ;; sBTC sats backing the option
  expiry-block: uint,
  sold: bool,
  buyer: (optional principal),
  created-block: uint,
  claimed: bool
})

;; Create a new option listing (admin only)
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

      (var-set listing-count new-id)

      (print {
        event: "listing-created",
        listing-id: new-id,
        epoch-id: epoch-id,
        strike-price: strike-price,
        premium: premium,
        collateral: collateral,
        expiry-block: expiry-block
      })

      (ok new-id)
    )
  )
)

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
      ;; Transfer premium from buyer to vault
      (try! (contract-call? token transfer premium tx-sender (as-contract tx-sender) none))

      ;; Forward premium to vault contract
      (try! (as-contract (contract-call? token transfer premium tx-sender .sbtc-options-vault none)))

      ;; Record sale in vault
      (try! (contract-call? .sbtc-options-vault record-option-sale epoch-id premium))

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

;; Claim payout after ITM settlement (buyer calls this)
(define-public (claim-payout (token <sip-010-token>) (listing-id uint))
  (let (
    (listing (unwrap! (map-get? listings listing-id) ERR-LISTING-NOT-FOUND))
    (buyer (unwrap! (get buyer listing) ERR-NOT-BUYER))
    (epoch-id (get epoch-id listing))
    (epoch (unwrap! (contract-call? .sbtc-options-vault get-epoch epoch-id) ERR-NOT-SETTLED))
  )
    (asserts! (is-eq tx-sender buyer) ERR-NOT-BUYER)
    (asserts! (get settled epoch) ERR-NOT-SETTLED)
    (asserts! (not (get claimed listing)) ERR-ALREADY-CLAIMED)

    (let (
      (payout (get payout epoch))
    )
      (if (> payout u0)
        (begin
          ;; Transfer payout from vault to buyer
          (try! (contract-call? .sbtc-options-vault transfer-payout token payout tx-sender))
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

;; Expire unsold listing (admin)
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

;; Compute a suggested premium
;; Simple model: premium = collateral * max(0, (current-price - strike) / current-price) + base-premium
;; base-premium = 1% of collateral for OTM options
(define-read-only (compute-suggested-premium
  (collateral uint)
  (strike-price uint)
  (current-price uint)
)
  (let (
    (base-premium (/ collateral u100)) ;; 1% of collateral
    (intrinsic (if (> current-price strike-price)
      (/ (* collateral (- current-price strike-price)) current-price)
      u0
    ))
  )
    (ok (+ base-premium intrinsic))
  )
)

;; Read-only functions

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
