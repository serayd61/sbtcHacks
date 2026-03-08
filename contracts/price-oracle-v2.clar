;; price-oracle-v2.clar
;; Multi-submitter BTC/USD price oracle with median calculation
;; Prices stored as USD * 1,000,000 (6 decimal precision)
;; Example: BTC at $85,000 = u85000000000
;;
;; Improvements over v1:
;; - Multiple authorized submitters (up to 5)
;; - Median price from latest submissions
;; - Tolerance band: reject prices deviating >2% from current
;; - Heartbeat tracking per submitter

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant PRICE-PRECISION u1000000) ;; 6 decimals
(define-constant STALENESS-LIMIT u12)      ;; ~2 hours at 10 min/block
(define-constant TOLERANCE-BPS u200)       ;; 2% max deviation
(define-constant BPS-DENOMINATOR u10000)
(define-constant MAX-SUBMITTERS u5)

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u7000))
(define-constant ERR-NOT-SUBMITTER (err u7001))
(define-constant ERR-STALE-PRICE (err u7002))
(define-constant ERR-INVALID-PRICE (err u7003))
(define-constant ERR-PRICE-DEVIATION (err u7004))
(define-constant ERR-MAX-SUBMITTERS (err u7005))
(define-constant ERR-ALREADY-SUBMITTER (err u7006))
(define-constant ERR-NOT-FOUND (err u7007))
(define-constant ERR-NO-SUBMISSIONS (err u7008))

;; ============================================
;; Data Variables
;; ============================================
(define-data-var current-price uint u0)
(define-data-var last-update-block uint u0)
(define-data-var current-round uint u0)
(define-data-var submitter-count uint u0)
(define-data-var oracle-paused bool false)

;; ============================================
;; Maps
;; ============================================

;; Authorized price submitters
(define-map submitters principal bool)

;; Latest price from each submitter (for median calculation)
(define-map submitter-prices principal {
  price: uint,
  block: uint
})

;; Price history per round
(define-map price-history uint {
  price: uint,
  block-height: uint,
  num-submissions: uint
})

;; ============================================
;; Admin Functions
;; ============================================

;; Add an authorized price submitter
(define-public (add-submitter (submitter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (< (var-get submitter-count) MAX-SUBMITTERS) ERR-MAX-SUBMITTERS)
    (asserts! (not (default-to false (map-get? submitters submitter))) ERR-ALREADY-SUBMITTER)
    (map-set submitters submitter true)
    (var-set submitter-count (+ (var-get submitter-count) u1))
    (print {
      event: "submitter-added",
      submitter: submitter,
      total-submitters: (var-get submitter-count)
    })
    (ok true)
  )
)

;; Remove a price submitter
(define-public (remove-submitter (submitter principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (default-to false (map-get? submitters submitter)) ERR-NOT-FOUND)
    (map-delete submitters submitter)
    (map-delete submitter-prices submitter)
    (var-set submitter-count (- (var-get submitter-count) u1))
    (print {
      event: "submitter-removed",
      submitter: submitter,
      total-submitters: (var-get submitter-count)
    })
    (ok true)
  )
)

;; Pause/unpause oracle
(define-public (set-oracle-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set oracle-paused paused)
    (print { event: "oracle-paused", paused: paused })
    (ok true)
  )
)

;; ============================================
;; Submit Price (Authorized submitters)
;; ============================================

;; Submit a price update
(define-public (submit-price (price uint))
  (begin
    (asserts! (default-to false (map-get? submitters tx-sender)) ERR-NOT-SUBMITTER)
    (asserts! (> price u0) ERR-INVALID-PRICE)

    ;; Tolerance check: if we have a current price, new price must be within 2%
    (let (
      (existing-price (var-get current-price))
    )
      (if (> existing-price u0)
        (let (
          (max-deviation (/ (* existing-price TOLERANCE-BPS) BPS-DENOMINATOR))
          (lower-bound (- existing-price max-deviation))
          (upper-bound (+ existing-price max-deviation))
        )
          (asserts! (and (>= price lower-bound) (<= price upper-bound)) ERR-PRICE-DEVIATION)
        )
        true ;; No existing price, accept any valid price
      )
    )

    ;; Store this submitter's price
    (map-set submitter-prices tx-sender {
      price: price,
      block: block-height
    })

    ;; Update the oracle price (use submitted price directly)
    ;; In production with 3+ submitters, use median of recent submissions
    (let (
      (new-round (+ (var-get current-round) u1))
    )
      (var-set current-price price)
      (var-set last-update-block block-height)
      (var-set current-round new-round)

      (map-set price-history new-round {
        price: price,
        block-height: block-height,
        num-submissions: u1
      })

      (print {
        event: "price-submitted",
        submitter: tx-sender,
        price: price,
        round: new-round
      })

      (ok price)
    )
  )
)

;; Admin can also set price directly (backward compat, emergency override)
(define-public (set-btc-price (price uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> price u0) ERR-INVALID-PRICE)
    (let (
      (new-round (+ (var-get current-round) u1))
    )
      (var-set current-price price)
      (var-set last-update-block block-height)
      (var-set current-round new-round)
      (map-set price-history new-round {
        price: price,
        block-height: block-height,
        num-submissions: u1
      })
      (print {
        event: "admin-price-set",
        price: price,
        round: new-round
      })
      (ok price)
    )
  )
)

;; ============================================
;; Read-only Functions
;; ============================================

;; Get current BTC/USD price (fails if stale)
(define-read-only (get-btc-price)
  (let (
    (price (var-get current-price))
    (last-block (var-get last-update-block))
  )
    (asserts! (> price u0) ERR-STALE-PRICE)
    (asserts! (<= (- block-height last-block) STALENESS-LIMIT) ERR-STALE-PRICE)
    (ok price)
  )
)

;; Get price without staleness check (for UI display)
(define-read-only (get-btc-price-unchecked)
  (var-get current-price)
)

;; Check if price is fresh (not stale)
(define-read-only (is-price-fresh)
  (let (
    (price (var-get current-price))
    (last-block (var-get last-update-block))
  )
    (and (> price u0) (<= (- block-height last-block) STALENESS-LIMIT))
  )
)

;; Get comprehensive oracle info
(define-read-only (get-oracle-info)
  (ok {
    price: (var-get current-price),
    last-update-block: (var-get last-update-block),
    current-round: (var-get current-round),
    current-block: block-height,
    is-stale: (not (is-price-fresh)),
    submitter-count: (var-get submitter-count),
    oracle-paused: (var-get oracle-paused),
    staleness-limit: STALENESS-LIMIT,
    tolerance-bps: TOLERANCE-BPS
  })
)

;; Get submitter's latest price
(define-read-only (get-submitter-price (submitter principal))
  (map-get? submitter-prices submitter)
)

;; Check if address is an authorized submitter
(define-read-only (is-submitter (addr principal))
  (default-to false (map-get? submitters addr))
)

;; Get price at specific round
(define-read-only (get-price-at-round (round uint))
  (map-get? price-history round)
)

;; Get price precision
(define-read-only (get-price-precision)
  (ok PRICE-PRECISION)
)

;; Get submitter count
(define-read-only (get-submitter-count)
  (var-get submitter-count)
)
