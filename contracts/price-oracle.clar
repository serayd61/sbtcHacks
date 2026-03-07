;; price-oracle.clar
;; Admin-controlled BTC/USD price feed
;; Prices stored as USD * 1,000,000 (6 decimal precision)
;; Example: BTC at $85,000 = u85000000000

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u2000))
(define-constant ERR-STALE-PRICE (err u2001))
(define-constant ERR-INVALID-PRICE (err u2002))
(define-constant PRICE-PRECISION u1000000) ;; 6 decimals
(define-constant STALENESS-LIMIT u12) ;; ~2 hours at 10 min/block

;; Data vars
(define-data-var current-price uint u0)
(define-data-var last-update-block uint u0)
(define-data-var current-round uint u0)

;; Price history per round
(define-map price-history uint {
  price: uint,
  block-height: uint,
  timestamp: uint
})

;; Set BTC/USD price (admin only)
(define-public (set-btc-price (price uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> price u0) ERR-INVALID-PRICE)
    (let ((new-round (+ (var-get current-round) u1)))
      (var-set current-price price)
      (var-set last-update-block block-height)
      (var-set current-round new-round)
      (map-set price-history new-round {
        price: price,
        block-height: block-height,
        timestamp: block-height
      })
      (ok price)
    )
  )
)

;; Get current BTC/USD price (fails if stale)
(define-read-only (get-btc-price)
  (let (
    (price (var-get current-price))
    (last-block (var-get last-update-block))
    (blocks-since (- block-height last-block))
  )
    (asserts! (> price u0) ERR-STALE-PRICE)
    (asserts! (<= blocks-since STALENESS-LIMIT) ERR-STALE-PRICE)
    (ok price)
  )
)

;; Get price without staleness check (for UI display)
(define-read-only (get-btc-price-unchecked)
  (var-get current-price)
)

;; Get oracle info
(define-read-only (get-oracle-info)
  (ok {
    price: (var-get current-price),
    last-update-block: (var-get last-update-block),
    current-round: (var-get current-round),
    current-block: block-height,
    is-stale: (> (- block-height (var-get last-update-block)) STALENESS-LIMIT)
  })
)

;; Get price at specific round
(define-read-only (get-price-at-round (round uint))
  (map-get? price-history round)
)

;; Get precision
(define-read-only (get-price-precision)
  (ok PRICE-PRECISION)
)
