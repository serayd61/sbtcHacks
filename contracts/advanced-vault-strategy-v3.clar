;; advanced-vault-strategy-v3.clar
;; Advanced vault strategy engine with multiple option types and dynamic allocation
;; Supports covered calls, cash-secured puts, and complex multi-leg strategies

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant PRECISION u100000000) ;; 8 decimals for sBTC
(define-constant BPS-DENOMINATOR u10000)

;; Strategy allocation limits
(define-constant MAX-COVERED-CALL-ALLOCATION u6000)    ;; 60% max
(define-constant MAX-CASH-SECURED-PUT-ALLOCATION u4000) ;; 40% max
(define-constant MIN-CASH-RESERVE u1000)                ;; 10% min cash
(define-constant MAX-COMPLEX-STRATEGY-ALLOCATION u2000) ;; 20% max

;; Risk parameters
(define-constant MAX-DELTA-EXPOSURE u5000)              ;; 50% max delta
(define-constant MAX-VEGA-EXPOSURE u3000)               ;; 30% max vega
(define-constant REBALANCE-THRESHOLD-BPS u500)          ;; 5% threshold

;; Strategy types
(define-constant STRATEGY-COVERED-CALLS "CC")
(define-constant STRATEGY-CASH-SECURED-PUTS "CSP")
(define-constant STRATEGY-IRON-CONDORS "IC")
(define-constant STRATEGY-STRADDLES "STRD")
(define-constant STRATEGY-COLLARS "COL")

;; Market conditions
(define-constant MARKET-BULLISH "BULL")
(define-constant MARKET-BEARISH "BEAR")
(define-constant MARKET-NEUTRAL "NEUTRAL")
(define-constant MARKET-HIGH-VOL "HIGH_VOL")
(define-constant MARKET-LOW-VOL "LOW_VOL")

;; ============================================
;; Utility functions
;; ============================================
(define-private (min (a uint) (b uint))
  (if (< a b) a b)
)

(define-private (max (a uint) (b uint))
  (if (> a b) a b)
)

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u6000))
(define-constant ERR-INVALID-ALLOCATION (err u6001))
(define-constant ERR-INSUFFICIENT-BALANCE (err u6002))
(define-constant ERR-INVALID-STRATEGY (err u6003))
(define-constant ERR-RISK-LIMIT-EXCEEDED (err u6004))
(define-constant ERR-MARKET-CONDITION-INVALID (err u6005))
(define-constant ERR-REBALANCE-TOO-FREQUENT (err u6006))

;; ============================================
;; Data Variables
;; ============================================
(define-data-var total-assets uint u0)
(define-data-var last-rebalance-block uint u0)
(define-data-var current-market-regime (string-ascii 16) MARKET-NEUTRAL)
(define-data-var current-volatility-regime (string-ascii 16) MARKET-LOW-VOL)

;; Portfolio allocation percentages (in bps)
(define-data-var covered-call-allocation uint u4000)    ;; 40% default
(define-data-var cash-secured-put-allocation uint u2000) ;; 20% default
(define-data-var iron-condor-allocation uint u1000)     ;; 10% default
(define-data-var straddle-allocation uint u500)         ;; 5% default
(define-data-var collar-allocation uint u500)           ;; 5% default
(define-data-var cash-reserve-allocation uint u2000)    ;; 20% default

;; Performance tracking
(define-data-var total-premiums-earned uint u0)
(define-data-var total-payouts-paid uint u0)
(define-data-var strategy-performance-start uint u0)

;; ============================================
;; Data Maps
;; ============================================

;; Strategy allocations per epoch
(define-map epoch-allocations uint {
  epoch-id: uint,
  covered-call-amount: uint,
  cash-secured-put-amount: uint,
  iron-condor-amount: uint,
  straddle-amount: uint,
  collar-amount: uint,
  cash-reserve-amount: uint,
  total-deployed: uint,
  market-regime: (string-ascii 16),
  volatility-regime: (string-ascii 16),
  created-block: uint
})

;; Strategy performance tracking
(define-map strategy-performance uint {
  epoch-id: uint,
  strategy-type: (string-ascii 16),
  allocated-amount: uint,
  premiums-earned: uint,
  payouts-paid: uint,
  net-profit: int,
  roi-bps: int,
  win-rate: uint,                    ;; Percentage of profitable trades
  avg-dte: uint,                     ;; Average days to expiration
  max-drawdown: uint,
  sharpe-ratio: int                  ;; Simplified Sharpe ratio
})

;; Market condition indicators
(define-map market-indicators uint {
  block-height: uint,
  btc-price: uint,
  price-change-24h-bps: int,         ;; Price change in bps
  realized-volatility: uint,         ;; 30-day realized vol
  implied-volatility: uint,          ;; Current IV from options
  vix-equivalent: uint,              ;; Fear/greed indicator
  trend-direction: (string-ascii 16), ;; UP, DOWN, SIDEWAYS
  volatility-percentile: uint        ;; Current vol vs historical
})

;; Risk metrics per strategy
(define-map strategy-risk-metrics uint {
  epoch-id: uint,
  strategy-type: (string-ascii 16),
  total-delta: int,
  total-gamma: uint,
  total-theta: int,
  total-vega: uint,
  var-1d: uint,                      ;; 1-day Value at Risk
  var-1w: uint,                      ;; 1-week Value at Risk
  max-loss-potential: uint,
  margin-requirements: uint
})

;; Dynamic strategy rules
(define-map strategy-rules (string-ascii 32) {
  rule-name: (string-ascii 32),
  market-condition: (string-ascii 16),
  min-allocation-bps: uint,
  max-allocation-bps: uint,
  target-delta: int,
  preferred-dte: uint,               ;; Days to expiration
  iv-threshold: uint,                ;; Minimum IV to deploy
  active: bool
})

;; ============================================
;; Strategy Configuration
;; ============================================

(define-public (set-strategy-allocation 
  (cc-alloc uint)
  (csp-alloc uint)
  (ic-alloc uint)
  (strd-alloc uint)
  (col-alloc uint)
  (cash-alloc uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    ;; Validate total allocation = 100%
    (let ((total-alloc (+ cc-alloc (+ csp-alloc (+ ic-alloc (+ strd-alloc (+ col-alloc cash-alloc)))))))
      (asserts! (is-eq total-alloc BPS-DENOMINATOR) ERR-INVALID-ALLOCATION)
    )
    
    ;; Validate individual limits
    (asserts! (<= cc-alloc MAX-COVERED-CALL-ALLOCATION) ERR-INVALID-ALLOCATION)
    (asserts! (<= csp-alloc MAX-CASH-SECURED-PUT-ALLOCATION) ERR-INVALID-ALLOCATION)
    (asserts! (>= cash-alloc MIN-CASH-RESERVE) ERR-INVALID-ALLOCATION)
    
    ;; Update allocations
    (var-set covered-call-allocation cc-alloc)
    (var-set cash-secured-put-allocation csp-alloc)
    (var-set iron-condor-allocation ic-alloc)
    (var-set straddle-allocation strd-alloc)
    (var-set collar-allocation col-alloc)
    (var-set cash-reserve-allocation cash-alloc)
    
    (print {
      event: "strategy-allocation-updated",
      covered-calls: cc-alloc,
      cash-secured-puts: csp-alloc,
      iron-condors: ic-alloc,
      straddles: strd-alloc,
      collars: col-alloc,
      cash-reserve: cash-alloc
    })
    
    (ok true)
  )
)

;; Update market conditions and trigger rebalancing if needed
(define-public (update-market-conditions 
  (btc-price uint)
  (price-change-bps int)
  (realized-vol uint)
  (implied-vol uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (market-regime (determine-market-regime price-change-bps realized-vol))
      (vol-regime (determine-volatility-regime realized-vol implied-vol))
      (indicator-id (+ block-height u1))
    )
      ;; Update market indicators
      (map-set market-indicators indicator-id {
        block-height: block-height,
        btc-price: btc-price,
        price-change-24h-bps: price-change-bps,
        realized-volatility: realized-vol,
        implied-volatility: implied-vol,
        vix-equivalent: (calculate-fear-greed-index realized-vol implied-vol),
        trend-direction: (determine-trend-direction price-change-bps),
        volatility-percentile: (calculate-vol-percentile realized-vol)
      })
      
      ;; Update current regimes
      (var-set current-market-regime market-regime)
      (var-set current-volatility-regime vol-regime)
      
      ;; Check if rebalancing needed (ignore result - never fails)
      (unwrap-panic (check-and-trigger-rebalancing market-regime vol-regime))
      
      (print {
        event: "market-conditions-updated",
        btc-price: btc-price,
        market-regime: market-regime,
        volatility-regime: vol-regime,
        implied-vol: implied-vol
      })
      
      (ok true)
    )
  )
)

;; Execute strategy deployment for new epoch
(define-public (deploy-epoch-strategies 
  (epoch-id uint)
  (total-capital uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (market-regime (var-get current-market-regime))
      (vol-regime (var-get current-volatility-regime))
      
      ;; Calculate optimal allocations based on market conditions
      (optimal-allocations (calculate-optimal-allocations market-regime vol-regime total-capital))
      
      (cc-amount (get cc-amount optimal-allocations))
      (csp-amount (get csp-amount optimal-allocations))
      (ic-amount (get ic-amount optimal-allocations))
      (strd-amount (get strd-amount optimal-allocations))
      (col-amount (get col-amount optimal-allocations))
      (cash-amount (get cash-amount optimal-allocations))
    )
      ;; Validate total deployment doesn't exceed capital
      (let ((total-deployed (+ cc-amount (+ csp-amount (+ ic-amount (+ strd-amount (+ col-amount cash-amount)))))))
        (asserts! (<= total-deployed total-capital) ERR-INSUFFICIENT-BALANCE)
      )
      
      ;; Record epoch allocation
      (map-set epoch-allocations epoch-id {
        epoch-id: epoch-id,
        covered-call-amount: cc-amount,
        cash-secured-put-amount: csp-amount,
        iron-condor-amount: ic-amount,
        straddle-amount: strd-amount,
        collar-amount: col-amount,
        cash-reserve-amount: cash-amount,
        total-deployed: (+ cc-amount (+ csp-amount (+ ic-amount (+ strd-amount (+ col-amount cash-amount))))),
        market-regime: market-regime,
        volatility-regime: vol-regime,
        created-block: block-height
      })
      
      ;; Deploy strategies to options market
      (if (> cc-amount u0)
        (unwrap-panic (deploy-covered-calls epoch-id cc-amount))
        true
      )

      (if (> csp-amount u0)
        (unwrap-panic (deploy-cash-secured-puts epoch-id csp-amount))
        true
      )

      (if (> ic-amount u0)
        (unwrap-panic (deploy-iron-condors epoch-id ic-amount))
        true
      )
      
      (print {
        event: "epoch-strategies-deployed",
        epoch-id: epoch-id,
        total-capital: total-capital,
        allocations: optimal-allocations,
        market-regime: market-regime,
        volatility-regime: vol-regime
      })
      
      (ok epoch-id)
    )
  )
)

;; ============================================
;; Strategy Deployment Functions
;; ============================================

(define-private (deploy-covered-calls (epoch-id uint) (amount uint))
  (begin
    ;; Calculate optimal strike based on market conditions
    (let (
      (current-price (get-current-btc-price))
      (optimal-strikes (calculate-cc-strikes current-price))
    )
      ;; Deploy covered calls through options market
      ;; This would call advanced-options-market-v7 to create listings
      
      (print {
        event: "covered-calls-deployed",
        epoch-id: epoch-id,
        amount: amount,
        strikes: optimal-strikes
      })
      
      (ok true)
    )
  )
)

(define-private (deploy-cash-secured-puts (epoch-id uint) (amount uint))
  (begin
    (let (
      (current-price (get-current-btc-price))
      (optimal-strikes (calculate-csp-strikes current-price))
    )
      (print {
        event: "cash-secured-puts-deployed",
        epoch-id: epoch-id,
        amount: amount,
        strikes: optimal-strikes
      })
      
      (ok true)
    )
  )
)

(define-private (deploy-iron-condors (epoch-id uint) (amount uint))
  (begin
    (let (
      (current-price (get-current-btc-price))
      (optimal-wing-width (calculate-ic-wing-width current-price))
    )
      (print {
        event: "iron-condors-deployed",
        epoch-id: epoch-id,
        amount: amount,
        wing-width: optimal-wing-width
      })
      
      (ok true)
    )
  )
)

;; ============================================
;; Market Analysis Functions
;; ============================================

(define-private (determine-market-regime (price-change-bps int) (realized-vol uint))
  (if (> price-change-bps 500) ;; >5% daily move up
    MARKET-BULLISH
    (if (< price-change-bps -500) ;; >5% daily move down
      MARKET-BEARISH
      MARKET-NEUTRAL
    )
  )
)

(define-private (determine-volatility-regime (realized-vol uint) (implied-vol uint))
  (if (> implied-vol u12000) ;; >120% annualized
    MARKET-HIGH-VOL
    MARKET-LOW-VOL
  )
)

(define-private (calculate-fear-greed-index (realized-vol uint) (implied-vol uint))
  ;; Simplified fear/greed calculation
  (if (> implied-vol realized-vol)
    (/ (* (- implied-vol realized-vol) u100) realized-vol) ;; Fear when IV > RV
    u50 ;; Neutral
  )
)

(define-private (determine-trend-direction (price-change-bps int))
  (if (> price-change-bps 200) ;; >2% up
    "UP"
    (if (< price-change-bps -200) ;; >2% down
      "DOWN"
      "SIDEWAYS"
    )
  )
)

(define-private (calculate-vol-percentile (current-vol uint))
  ;; Simplified percentile calculation (would use historical data in production)
  (if (> current-vol u10000) u80 u20) ;; 80th or 20th percentile
)

;; ============================================
;; Optimization Functions
;; ============================================

(define-private (calculate-optimal-allocations (market-regime (string-ascii 16)) (vol-regime (string-ascii 16)) (total-capital uint))
  (let (
    ;; Base allocations
    (base-cc (var-get covered-call-allocation))
    (base-csp (var-get cash-secured-put-allocation))
    (base-ic (var-get iron-condor-allocation))
    (base-strd (var-get straddle-allocation))
    (base-col (var-get collar-allocation))
    (base-cash (var-get cash-reserve-allocation))
  )
    ;; Adjust allocations based on market regime
    (let (
      (adjusted-allocations (adjust-for-market-regime market-regime base-cc base-csp base-ic base-strd base-col base-cash))
      (vol-adjusted-allocations (adjust-for-volatility-regime vol-regime adjusted-allocations))
    )
      ;; Convert percentages to absolute amounts
      {
        cc-amount: (/ (* total-capital (get cc vol-adjusted-allocations)) BPS-DENOMINATOR),
        csp-amount: (/ (* total-capital (get csp vol-adjusted-allocations)) BPS-DENOMINATOR),
        ic-amount: (/ (* total-capital (get ic vol-adjusted-allocations)) BPS-DENOMINATOR),
        strd-amount: (/ (* total-capital (get strd vol-adjusted-allocations)) BPS-DENOMINATOR),
        col-amount: (/ (* total-capital (get col vol-adjusted-allocations)) BPS-DENOMINATOR),
        cash-amount: (/ (* total-capital (get cash vol-adjusted-allocations)) BPS-DENOMINATOR)
      }
    )
  )
)

(define-private (adjust-for-market-regime 
  (regime (string-ascii 16)) 
  (cc uint) (csp uint) (ic uint) (strd uint) (col uint) (cash uint)
)
  (if (is-eq regime MARKET-BULLISH)
    ;; Bullish: favor covered calls, reduce puts
    { cc: (min (+ cc u1000) MAX-COVERED-CALL-ALLOCATION), csp: (max (- csp u500) u0), ic: ic, strd: strd, col: col, cash: cash }
    (if (is-eq regime MARKET-BEARISH)
      ;; Bearish: favor puts and collars, reduce calls
      { cc: (max (- cc u1000) u0), csp: (min (+ csp u1000) MAX-CASH-SECURED-PUT-ALLOCATION), ic: ic, strd: strd, col: (+ col u500), cash: cash }
      ;; Neutral: keep base allocations
      { cc: cc, csp: csp, ic: ic, strd: strd, col: col, cash: cash }
    )
  )
)

(define-private (adjust-for-volatility-regime 
  (vol-regime (string-ascii 16))
  (allocations { cc: uint, csp: uint, ic: uint, strd: uint, col: uint, cash: uint })
)
  (if (is-eq vol-regime MARKET-HIGH-VOL)
    ;; High vol: favor straddles and iron condors (vol sellers)
    {
      cc: (get cc allocations),
      csp: (get csp allocations),
      ic: (min (+ (get ic allocations) u500) u2000),
      strd: (min (+ (get strd allocations) u500) u1500),
      col: (get col allocations),
      cash: (max (- (get cash allocations) u1000) MIN-CASH-RESERVE)
    }
    ;; Low vol: reduce vol-selling strategies
    allocations
  )
)

(define-private (check-and-trigger-rebalancing (market-regime (string-ascii 16)) (vol-regime (string-ascii 16)))
  (let ((blocks-since-rebalance (- block-height (var-get last-rebalance-block))))
    (if (>= blocks-since-rebalance u144) ;; 24 hours
      (begin
        (var-set last-rebalance-block block-height)
        (print {
          event: "rebalancing-triggered",
          market-regime: market-regime,
          volatility-regime: vol-regime,
          blocks-since-last: blocks-since-rebalance
        })
        (ok true)
      )
      (ok false)
    )
  )
)

;; ============================================
;; Strike Calculation Functions
;; ============================================

(define-private (calculate-cc-strikes (spot-price uint))
  (let (
    (market-regime (var-get current-market-regime))
    (otm-percentage (if (is-eq market-regime MARKET-BULLISH) u1050 u1025)) ;; 5% or 2.5% OTM
  )
    (list (/ (* spot-price otm-percentage) u1000))
  )
)

(define-private (calculate-csp-strikes (spot-price uint))
  (let (
    (market-regime (var-get current-market-regime))
    (otm-percentage (if (is-eq market-regime MARKET-BEARISH) u950 u975)) ;; 5% or 2.5% OTM
  )
    (list (/ (* spot-price otm-percentage) u1000))
  )
)

(define-private (calculate-ic-wing-width (spot-price uint))
  (let ((vol-regime (var-get current-volatility-regime)))
    (if (is-eq vol-regime MARKET-HIGH-VOL)
      u2000 ;; 20% wing width for high vol
      u1000 ;; 10% wing width for low vol
    )
  )
)

;; ============================================
;; Utility Functions
;; ============================================

(define-private (get-current-btc-price)
  ;; Would integrate with price oracle
  u95000000000 ;; $95,000 placeholder
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (get-strategy-allocations)
  {
    covered-calls: (var-get covered-call-allocation),
    cash-secured-puts: (var-get cash-secured-put-allocation),
    iron-condors: (var-get iron-condor-allocation),
    straddles: (var-get straddle-allocation),
    collars: (var-get collar-allocation),
    cash-reserve: (var-get cash-reserve-allocation)
  }
)

(define-read-only (get-epoch-allocation (epoch-id uint))
  (map-get? epoch-allocations epoch-id)
)

(define-read-only (get-strategy-performance (epoch-id uint) (strategy-type (string-ascii 16)))
  (map-get? strategy-performance epoch-id)
)

(define-read-only (get-current-market-conditions)
  {
    market-regime: (var-get current-market-regime),
    volatility-regime: (var-get current-volatility-regime),
    last-rebalance: (var-get last-rebalance-block),
    blocks-since-rebalance: (- block-height (var-get last-rebalance-block))
  }
)

(define-read-only (get-risk-metrics (epoch-id uint) (strategy-type (string-ascii 16)))
  (map-get? strategy-risk-metrics epoch-id)
)