;; advanced-options-market-v7.clar
;; Advanced Options Market with Multiple Strikes, Put/Call, and Complex Strategies
;; Supports strike ladders, put options, iron condors, straddles, and collars

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant PRICE-PRECISION u1000000)
(define-constant SBTC-PRECISION u100000000)
(define-constant MAX-LISTINGS-PER-EPOCH u100000) ;; 100K listings
(define-constant MAX-STRIKES-PER-EPOCH u10)      ;; 10 strikes max
(define-constant MAX-STRATEGIES-PER-EPOCH u50)   ;; 50 complex strategies

;; Strike ladder defaults
(define-constant DEFAULT-STRIKES-COUNT u5)
(define-constant STRIKE-STEP-BPS u500)           ;; 5% steps
(define-constant MIN-STRIKE-PERCENT u8000)       ;; 80% of spot (20% ITM puts)
(define-constant MAX-STRIKE-PERCENT u12000)      ;; 120% of spot (20% OTM calls)

;; Option types
(define-constant OPTION-TYPE-CALL "CALL")
(define-constant OPTION-TYPE-PUT "PUT")

;; Strategy types
(define-constant STRATEGY-COVERED-CALL "COVERED_CALL")
(define-constant STRATEGY-CASH-SECURED-PUT "CASH_SECURED_PUT")
(define-constant STRATEGY-IRON-CONDOR "IRON_CONDOR")
(define-constant STRATEGY-STRADDLE "STRADDLE")
(define-constant STRATEGY-STRANGLE "STRANGLE")
(define-constant STRATEGY-COLLAR "COLLAR")
(define-constant STRATEGY-BUTTERFLY "BUTTERFLY")

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u5000))
(define-constant ERR-LISTING-NOT-FOUND (err u5001))
(define-constant ERR-ALREADY-SOLD (err u5002))
(define-constant ERR-EXPIRED (err u5003))
(define-constant ERR-NOT-EXPIRED (err u5004))
(define-constant ERR-ZERO-AMOUNT (err u5005))
(define-constant ERR-TRANSFER-FAILED (err u5006))
(define-constant ERR-NOT-BUYER (err u5007))
(define-constant ERR-NOT-SETTLED (err u5008))
(define-constant ERR-ALREADY-CLAIMED (err u5009))
(define-constant ERR-MAX-LISTINGS-REACHED (err u5010))
(define-constant ERR-INVALID-OPTION-TYPE (err u5011))
(define-constant ERR-INVALID-STRATEGY (err u5012))
(define-constant ERR-INSUFFICIENT-COLLATERAL (err u5013))
(define-constant ERR-STRIKE-OUT-OF-RANGE (err u5014))
(define-constant ERR-INVALID-EXPIRY (err u5015))
(define-constant ERR-MAX-STRIKES-REACHED (err u5016))

;; ============================================
;; Data Variables
;; ============================================
(define-data-var listing-count uint u0)
(define-data-var strategy-count uint u0)
(define-data-var total-volume-calls uint u0)
(define-data-var total-volume-puts uint u0)
(define-data-var total-premium-collected uint u0)

;; Current epoch configuration
(define-data-var current-epoch-id uint u0)
(define-data-var current-spot-price uint u0)
(define-data-var current-volatility uint u8000) ;; 80% implied volatility (8000 bps)

;; ============================================
;; Data Maps
;; ============================================

;; Enhanced option listings with type and strategy support
(define-map listings uint {
  epoch-id: uint,
  option-type: (string-ascii 8),     ;; "CALL" or "PUT"
  strategy-type: (string-ascii 16),   ;; Strategy name
  strike-price: uint,                 ;; Strike in USD (6 decimals)
  premium: uint,                      ;; Premium in satoshis
  collateral: uint,                   ;; Required collateral
  expiry-block: uint,
  spot-price-at-creation: uint,
  moneyness: int,                     ;; ITM/OTM amount in bps
  delta: uint,                        ;; Option delta (4 decimals)
  gamma: uint,                        ;; Option gamma (4 decimals)
  theta: uint,                        ;; Option theta (4 decimals)
  vega: uint,                         ;; Option vega (4 decimals)
  sold: bool,
  buyer: (optional principal),
  created-block: uint,
  claimed: bool
})

;; Strike ladder configuration per epoch
(define-map epoch-strikes uint (list 10 {
  strike-price: uint,
  distance-from-spot-bps: int,        ;; -2000 = 20% ITM, +2000 = 20% OTM
  call-premium: uint,
  put-premium: uint,
  call-listings-count: uint,
  put-listings-count: uint,
  call-volume: uint,
  put-volume: uint
}))

;; Complex strategy definitions
(define-map strategies uint {
  strategy-type: (string-ascii 16),
  epoch-id: uint,
  leg-count: uint,
  leg-1-listing-id: (optional uint),   ;; Long call/put
  leg-2-listing-id: (optional uint),   ;; Short call/put
  leg-3-listing-id: (optional uint),   ;; Additional for iron condors
  leg-4-listing-id: (optional uint),   ;; Additional for iron condors
  total-premium-received: uint,
  total-collateral-required: uint,
  max-profit: uint,
  max-loss: uint,
  breakeven-lower: (optional uint),
  breakeven-upper: (optional uint),
  created-by: principal,
  created-block: uint,
  active: bool
})

;; Epoch statistics and performance
(define-map epoch-statistics uint {
  epoch-id: uint,
  total-call-listings: uint,
  total-put-listings: uint,
  total-strategies: uint,
  avg-iv: uint,                       ;; Average implied volatility
  realized-volatility: uint,          ;; Realized volatility during epoch
  spot-price-start: uint,
  spot-price-end: (optional uint),
  total-premium-calls: uint,
  total-premium-puts: uint,
  settlement-payout-total: uint,
  roi-percentage: int                 ;; ROI in bps (can be negative)
})

;; Greeks tracking for risk management
(define-map portfolio-greeks uint {
  epoch-id: uint,
  total-delta: int,                   ;; Net delta exposure
  total-gamma: uint,                  ;; Net gamma exposure
  total-theta: int,                   ;; Net theta (time decay)
  total-vega: uint,                   ;; Net vega (volatility sensitivity)
  total-rho: int                      ;; Interest rate sensitivity
})

;; ============================================
;; Admin Functions
;; ============================================

;; Create strike ladder for new epoch
(define-public (create-strike-ladder 
  (epoch-id uint) 
  (spot-price uint) 
  (implied-vol uint)
  (strikes-config (list 10 { strike-price: uint, call-premium: uint, put-premium: uint }))
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= (len strikes-config) MAX-STRIKES-PER-EPOCH) ERR-MAX-STRIKES-REACHED)
    
    ;; Update current epoch info
    (var-set current-epoch-id epoch-id)
    (var-set current-spot-price spot-price)
    (var-set current-volatility implied-vol)
    
    ;; Process strikes and calculate distances
    (let ((processed-strikes (map process-strike-config strikes-config)))
      (map-set epoch-strikes epoch-id processed-strikes)
    )
    
    ;; Initialize epoch statistics
    (map-set epoch-statistics epoch-id {
      epoch-id: epoch-id,
      total-call-listings: u0,
      total-put-listings: u0,
      total-strategies: u0,
      avg-iv: implied-vol,
      realized-volatility: u0,
      spot-price-start: spot-price,
      spot-price-end: none,
      total-premium-calls: u0,
      total-premium-puts: u0,
      settlement-payout-total: u0,
      roi-percentage: 0
    })
    
    (print {
      event: "strike-ladder-created",
      epoch-id: epoch-id,
      spot-price: spot-price,
      strikes-count: (len strikes-config),
      implied-volatility: implied-vol
    })
    
    (ok epoch-id)
  )
)

;; Batch create listings for all strikes (both calls and puts)
(define-public (batch-create-all-options 
  (epoch-id uint)
  (collateral-per-listing uint)
  (expiry-block uint)
  (listings-per-strike uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (strikes (default-to (list) (map-get? epoch-strikes epoch-id)))
      (spot-price (var-get current-spot-price))
    )
      ;; Create calls and puts for each strike
      (try! (fold create-options-for-strike strikes (ok u0)))
      
      (print {
        event: "batch-options-created",
        epoch-id: epoch-id,
        strikes-count: (len strikes),
        listings-per-strike: listings-per-strike,
        total-listings: (* (len strikes) listings-per-strike u2) ;; calls + puts
      })
      
      (ok (len strikes))
    )
  )
)

;; ============================================
;; Strategy Creation Functions
;; ============================================

;; Create Iron Condor strategy
(define-public (create-iron-condor 
  (epoch-id uint)
  (call-strike-low uint)    ;; OTM call strike (short)
  (call-strike-high uint)   ;; Further OTM call strike (long)
  (put-strike-low uint)     ;; OTM put strike (short)
  (put-strike-high uint)    ;; Further OTM put strike (long)
  (quantity uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    ;; Validate strike order
    (asserts! (< put-strike-high put-strike-low) ERR-STRIKE-OUT-OF-RANGE)
    (asserts! (< call-strike-low call-strike-high) ERR-STRIKE-OUT-OF-RANGE)
    
    (let (
      (strategy-id (+ (var-get strategy-count) u1))
      (spot-price (var-get current-spot-price))
    )
      ;; Calculate max profit (net credit received)
      ;; Calculate max loss (difference in strikes - net credit)
      
      (map-set strategies strategy-id {
        strategy-type: STRATEGY-IRON-CONDOR,
        epoch-id: epoch-id,
        leg-count: u4,
        leg-1-listing-id: none, ;; Will be populated when listings created
        leg-2-listing-id: none,
        leg-3-listing-id: none,
        leg-4-listing-id: none,
        total-premium-received: u0,
        total-collateral-required: u0,
        max-profit: u0,
        max-loss: u0,
        breakeven-lower: (some put-strike-low),
        breakeven-upper: (some call-strike-low),
        created-by: tx-sender,
        created-block: block-height,
        active: true
      })
      
      (var-set strategy-count strategy-id)
      
      (print {
        event: "iron-condor-created",
        strategy-id: strategy-id,
        epoch-id: epoch-id,
        strikes: {
          put-high: put-strike-high,
          put-low: put-strike-low,
          call-low: call-strike-low,
          call-high: call-strike-high
        },
        quantity: quantity
      })
      
      (ok strategy-id)
    )
  )
)

;; Create Straddle strategy (long call + long put at same strike)
(define-public (create-straddle 
  (epoch-id uint)
  (strike-price uint)
  (quantity uint)
  (is-long bool)            ;; true for long straddle, false for short straddle
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (strategy-id (+ (var-get strategy-count) u1))
      (spot-price (var-get current-spot-price))
    )
      (map-set strategies strategy-id {
        strategy-type: STRATEGY-STRADDLE,
        epoch-id: epoch-id,
        leg-count: u2,
        leg-1-listing-id: none, ;; Call option
        leg-2-listing-id: none, ;; Put option  
        leg-3-listing-id: none,
        leg-4-listing-id: none,
        total-premium-received: u0,
        total-collateral-required: u0,
        max-profit: (if is-long u0 u999999999), ;; Unlimited for long, limited for short
        max-loss: (if is-long u999999999 u0),   ;; Limited for long, unlimited for short
        breakeven-lower: (some strike-price),
        breakeven-upper: (some strike-price),
        created-by: tx-sender,
        created-block: block-height,
        active: true
      })
      
      (var-set strategy-count strategy-id)
      
      (print {
        event: "straddle-created",
        strategy-id: strategy-id,
        epoch-id: epoch-id,
        strike-price: strike-price,
        quantity: quantity,
        is-long: is-long
      })
      
      (ok strategy-id)
    )
  )
)

;; Create Collar strategy (protective put + covered call)
(define-public (create-collar 
  (epoch-id uint)
  (call-strike uint)        ;; OTM call strike
  (put-strike uint)         ;; OTM put strike
  (underlying-amount uint)  ;; Amount of underlying asset
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (strategy-id (+ (var-get strategy-count) u1))
      (spot-price (var-get current-spot-price))
    )
      ;; Collar provides protection below put strike and caps upside at call strike
      (asserts! (< put-strike spot-price) ERR-STRIKE-OUT-OF-RANGE)
      (asserts! (> call-strike spot-price) ERR-STRIKE-OUT-OF-RANGE)
      
      (map-set strategies strategy-id {
        strategy-type: STRATEGY-COLLAR,
        epoch-id: epoch-id,
        leg-count: u2,
        leg-1-listing-id: none, ;; Long protective put
        leg-2-listing-id: none, ;; Short covered call
        leg-3-listing-id: none,
        leg-4-listing-id: none,
        total-premium-received: u0,
        total-collateral-required: underlying-amount,
        max-profit: (if (> call-strike spot-price) (- call-strike spot-price) u0),
        max-loss: (if (> spot-price put-strike) (- spot-price put-strike) u0),
        breakeven-lower: (some put-strike),
        breakeven-upper: (some call-strike),
        created-by: tx-sender,
        created-block: block-height,
        active: true
      })
      
      (var-set strategy-count strategy-id)
      
      (print {
        event: "collar-created",
        strategy-id: strategy-id,
        epoch-id: epoch-id,
        call-strike: call-strike,
        put-strike: put-strike,
        underlying-amount: underlying-amount
      })
      
      (ok strategy-id)
    )
  )
)

;; ============================================
;; Option Trading Functions
;; ============================================

;; Enhanced buy option with Greeks tracking
(define-public (buy-option 
  (token <sip-010-token>) 
  (listing-id uint)
)
  (let (
    (listing (unwrap! (map-get? listings listing-id) ERR-LISTING-NOT-FOUND))
    (premium (get premium listing))
    (option-type (get option-type listing))
    (epoch-id (get epoch-id listing))
  )
    (asserts! (not (get sold listing)) ERR-ALREADY-SOLD)
    (asserts! (< block-height (get expiry-block listing)) ERR-EXPIRED)
    
    ;; Transfer premium from buyer to contract
    (try! (contract-call? token transfer premium tx-sender (as-contract tx-sender) none))
    
    ;; Forward premium to vault
    (try! (as-contract (contract-call? token transfer premium tx-sender 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-logic-v2 none)))
    
    ;; Update listing
    (map-set listings listing-id (merge listing { 
      sold: true, 
      buyer: (some tx-sender) 
    }))
    
    ;; Update volume tracking
    (if (is-eq option-type OPTION-TYPE-CALL)
      (var-set total-volume-calls (+ (var-get total-volume-calls) premium))
      (var-set total-volume-puts (+ (var-get total-volume-puts) premium))
    )
    
    ;; Update portfolio Greeks
    (try! (update-portfolio-greeks epoch-id listing))
    
    ;; Notify vault about the sale
    (try! (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-logic-v2 record-option-sale premium))
    
    (print {
      event: "option-purchased",
      listing-id: listing-id,
      buyer: tx-sender,
      premium: premium,
      option-type: option-type,
      strike: (get strike-price listing),
      delta: (get delta listing)
    })
    
    (ok listing-id)
  )
)

;; Enhanced claim payout with strategy P&L calculation
(define-public (claim-payout 
  (token <sip-010-token>) 
  (listing-id uint)
)
  (let (
    (listing (unwrap! (map-get? listings listing-id) ERR-LISTING-NOT-FOUND))
  )
    (asserts! (is-eq (some tx-sender) (get buyer listing)) ERR-NOT-BUYER)
    (asserts! (>= block-height (get expiry-block listing)) ERR-NOT-EXPIRED)
    (asserts! (not (get claimed listing)) ERR-ALREADY-CLAIMED)
    
    ;; Calculate intrinsic value based on option type
    (let (
      (strike (get strike-price listing))
      (option-type (get option-type listing))
      (current-price (var-get current-spot-price)) ;; Should get from oracle
      (intrinsic-value (calculate-intrinsic-value option-type strike current-price))
    )
      (if (> intrinsic-value u0)
        (begin
          ;; ITM option - execute payout
          (try! (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-logic-v2 transfer-payout token intrinsic-value tx-sender))
          
          (map-set listings listing-id (merge listing { claimed: true }))
          
          (print {
            event: "payout-claimed",
            listing-id: listing-id,
            option-type: option-type,
            strike: strike,
            settlement-price: current-price,
            payout: intrinsic-value,
            buyer: tx-sender
          })
          
          (ok intrinsic-value)
        )
        ;; OTM option - expires worthless
        (begin
          (map-set listings listing-id (merge listing { claimed: true }))
          
          (print {
            event: "option-expired-worthless",
            listing-id: listing-id,
            option-type: option-type,
            strike: strike,
            settlement-price: current-price,
            buyer: tx-sender
          })
          
          (ok u0)
        )
      )
    )
  )
)

;; ============================================
;; Helper Functions
;; ============================================

(define-private (process-strike-config (config { strike-price: uint, call-premium: uint, put-premium: uint }))
  (let (
    (spot-price (var-get current-spot-price))
    (strike (get strike-price config))
    (distance-bps (/ (* (- strike spot-price) 10000) spot-price))
  )
    {
      strike-price: strike,
      distance-from-spot-bps: distance-bps,
      call-premium: (get call-premium config),
      put-premium: (get put-premium config),
      call-listings-count: u0,
      put-listings-count: u0,
      call-volume: u0,
      put-volume: u0
    }
  )
)

(define-private (create-options-for-strike 
  (strike-config { strike-price: uint, distance-from-spot-bps: int, call-premium: uint, put-premium: uint, call-listings-count: uint, put-listings-count: uint, call-volume: uint, put-volume: uint })
  (result (response uint uint))
)
  (match result
    success (begin
      ;; Create call option listing
      (let (
        (call-listing-id (+ (var-get listing-count) u1))
        (put-listing-id (+ (var-get listing-count) u2))
        (strike (get strike-price strike-config))
        (call-premium (get call-premium strike-config))
        (put-premium (get put-premium strike-config))
        (epoch-id (var-get current-epoch-id))
        (spot-price (var-get current-spot-price))
        (expiry-block (+ block-height u1008)) ;; ~7 days
      )
        ;; Create call option
        (map-set listings call-listing-id {
          epoch-id: epoch-id,
          option-type: OPTION-TYPE-CALL,
          strategy-type: STRATEGY-COVERED-CALL,
          strike-price: strike,
          premium: call-premium,
          collateral: u100000000, ;; 1 sBTC
          expiry-block: expiry-block,
          spot-price-at-creation: spot-price,
          moneyness: (get distance-from-spot-bps strike-config),
          delta: (calculate-delta OPTION-TYPE-CALL strike spot-price),
          gamma: (calculate-gamma strike spot-price),
          theta: (calculate-theta OPTION-TYPE-CALL strike spot-price expiry-block),
          vega: (calculate-vega strike spot-price),
          sold: false,
          buyer: none,
          created-block: block-height,
          claimed: false
        })
        
        ;; Create put option
        (map-set listings put-listing-id {
          epoch-id: epoch-id,
          option-type: OPTION-TYPE-PUT,
          strategy-type: STRATEGY-CASH-SECURED-PUT,
          strike-price: strike,
          premium: put-premium,
          collateral: strike, ;; Cash-secured
          expiry-block: expiry-block,
          spot-price-at-creation: spot-price,
          moneyness: (get distance-from-spot-bps strike-config),
          delta: (calculate-delta OPTION-TYPE-PUT strike spot-price),
          gamma: (calculate-gamma strike spot-price),
          theta: (calculate-theta OPTION-TYPE-PUT strike spot-price expiry-block),
          vega: (calculate-vega strike spot-price),
          sold: false,
          buyer: none,
          created-block: block-height,
          claimed: false
        })
        
        (var-set listing-count put-listing-id)
        
        (ok (+ success u2))
      )
    )
    error (err error)
  )
)

(define-private (calculate-intrinsic-value (option-type (string-ascii 8)) (strike uint) (spot uint))
  (if (is-eq option-type OPTION-TYPE-CALL)
    ;; Call intrinsic value: max(S - K, 0)
    (if (> spot strike) (- spot strike) u0)
    ;; Put intrinsic value: max(K - S, 0)
    (if (> strike spot) (- strike spot) u0)
  )
)

;; Simplified Greeks calculations (in production would use proper Black-Scholes)
(define-private (calculate-delta (option-type (string-ascii 8)) (strike uint) (spot uint))
  (if (is-eq option-type OPTION-TYPE-CALL)
    ;; Call delta approximation: 0.5 for ATM, approaches 1 for deep ITM
    (if (> spot strike) u7000 u3000) ;; 70% or 30%
    ;; Put delta approximation: negative of call delta
    (if (> strike spot) u7000 u3000)
  )
)

(define-private (calculate-gamma (strike uint) (spot uint))
  ;; Gamma highest for ATM options
  (let ((moneyness (if (> spot strike) (/ (* (- spot strike) 10000) spot) (/ (* (- strike spot) 10000) spot))))
    (if (< moneyness u500) u1000 u200) ;; Higher gamma for ATM
  )
)

(define-private (calculate-theta (option-type (string-ascii 8)) (strike uint) (spot uint) (expiry uint))
  ;; Theta increases as expiration approaches
  (let ((time-to-expiry (if (> expiry block-height) (- expiry block-height) u1)))
    (/ u1000 time-to-expiry) ;; Simplified time decay
  )
)

(define-private (calculate-vega (strike uint) (spot uint))
  ;; Vega highest for ATM options
  (let ((moneyness (if (> spot strike) (/ (* (- spot strike) 10000) spot) (/ (* (- strike spot) 10000) spot))))
    (if (< moneyness u500) u2000 u500) ;; Higher vega for ATM
  )
)

(define-private (update-portfolio-greeks (epoch-id uint) (listing { epoch-id: uint, option-type: (string-ascii 8), strategy-type: (string-ascii 16), strike-price: uint, premium: uint, collateral: uint, expiry-block: uint, spot-price-at-creation: uint, moneyness: int, delta: uint, gamma: uint, theta: uint, vega: uint, sold: bool, buyer: (optional principal), created-block: uint, claimed: bool }))
  (let (
    (current-greeks (default-to { 
      epoch-id: epoch-id, 
      total-delta: 0, 
      total-gamma: u0, 
      total-theta: 0, 
      total-vega: u0, 
      total-rho: 0 
    } (map-get? portfolio-greeks epoch-id)))
    (delta-contribution (if (is-eq (get option-type listing) OPTION-TYPE-CALL) 
      (to-int (get delta listing))
      (- 0 (to-int (get delta listing)))))
  )
    (map-set portfolio-greeks epoch-id {
      epoch-id: epoch-id,
      total-delta: (+ (get total-delta current-greeks) delta-contribution),
      total-gamma: (+ (get total-gamma current-greeks) (get gamma listing)),
      total-theta: (- (get total-theta current-greeks) (to-int (get theta listing))),
      total-vega: (+ (get total-vega current-greeks) (get vega listing)),
      total-rho: (get total-rho current-greeks)
    })
    (ok true)
  )
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (get-listing (listing-id uint))
  (map-get? listings listing-id)
)

(define-read-only (get-strategy (strategy-id uint))
  (map-get? strategies strategy-id)
)

(define-read-only (get-epoch-strikes (epoch-id uint))
  (map-get? epoch-strikes epoch-id)
)

(define-read-only (get-epoch-statistics (epoch-id uint))
  (map-get? epoch-statistics epoch-id)
)

(define-read-only (get-portfolio-greeks (epoch-id uint))
  (map-get? portfolio-greeks epoch-id)
)

(define-read-only (get-market-summary)
  {
    total-listings: (var-get listing-count),
    total-strategies: (var-get strategy-count),
    call-volume: (var-get total-volume-calls),
    put-volume: (var-get total-volume-puts),
    current-epoch: (var-get current-epoch-id),
    current-spot-price: (var-get current-spot-price),
    current-iv: (var-get current-volatility)
  }
)

(define-read-only (get-option-chain (epoch-id uint))
  (let (
    (strikes (default-to (list) (map-get? epoch-strikes epoch-id)))
    (stats (map-get? epoch-statistics epoch-id))
  )
    {
      epoch-id: epoch-id,
      strikes: strikes,
      statistics: stats,
      greeks: (map-get? portfolio-greeks epoch-id)
    }
  )
)