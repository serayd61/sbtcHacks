;; dynamic-strategy-selector-v1.clar
;; AI-driven dynamic strategy selection based on market conditions
;; Uses machine learning indicators to optimize strategy allocation

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant BPS-DENOMINATOR u10000)

;; Strategy confidence thresholds
(define-constant HIGH-CONFIDENCE-THRESHOLD u8000)    ;; 80%
(define-constant MEDIUM-CONFIDENCE-THRESHOLD u6000)  ;; 60%
(define-constant LOW-CONFIDENCE-THRESHOLD u4000)     ;; 40%

;; Market regime indicators
(define-constant TREND-LOOKBACK-BLOCKS u1008)        ;; 7 days
(define-constant VOLATILITY-LOOKBACK-BLOCKS u4320)   ;; 30 days
(define-constant MOMENTUM-LOOKBACK-BLOCKS u144)      ;; 1 day

;; ML model parameters (simplified)
(define-constant FEATURE-COUNT u12)
(define-constant MIN-HISTORICAL-SAMPLES u50)

;; Strategy optimization parameters
(define-constant KELLY-CRITERION-ENABLED true)
(define-constant MAX-KELLY-ALLOCATION u2500)         ;; 25% max Kelly allocation
(define-constant VOLATILITY-TARGET u1500)           ;; 15% target volatility

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u7000))
(define-constant ERR-INSUFFICIENT-DATA (err u7001))
(define-constant ERR-INVALID-CONFIDENCE (err u7002))
(define-constant ERR-MODEL-NOT-READY (err u7003))
(define-constant ERR-INVALID-FEATURES (err u7004))
(define-constant ERR-ALLOCATION-ERROR (err u7005))

;; ============================================
;; Data Variables
;; ============================================
(define-data-var model-version uint u1)
(define-data-var model-last-trained uint u0)
(define-data-var prediction-confidence uint u0)
(define-data-var samples-count uint u0)

;; Feature weights for ML model (simplified linear model)
(define-data-var feature-weights (list 12 int) (list 100 50 75 -25 80 60 -30 90 40 -20 70 55))

;; Current market features
(define-data-var current-features (list 12 int) (list 0 0 0 0 0 0 0 0 0 0 0 0))

;; ============================================
;; Data Maps
;; ============================================

;; Historical market data for ML training
(define-map market-samples uint {
  block-height: uint,
  btc-price: uint,
  price-change-1h: int,              ;; Feature 1: 1h price change
  price-change-4h: int,              ;; Feature 2: 4h price change  
  price-change-24h: int,             ;; Feature 3: 24h price change
  realized-volatility-7d: uint,      ;; Feature 4: 7-day realized vol
  realized-volatility-30d: uint,     ;; Feature 5: 30-day realized vol
  implied-volatility: uint,          ;; Feature 6: Current implied vol
  iv-rv-ratio: int,                  ;; Feature 7: IV/RV ratio (premium)
  rsi-14: uint,                      ;; Feature 8: 14-period RSI
  bollinger-position: int,           ;; Feature 9: Position within Bollinger Bands
  volume-ratio: uint,                ;; Feature 10: Volume vs 30-day average
  fear-greed-index: uint,            ;; Feature 11: Market sentiment
  funding-rate: int,                 ;; Feature 12: Futures funding rate
  optimal-strategy: (string-ascii 16), ;; Target variable for training
  strategy-performance: int          ;; Actual performance (for reinforcement learning)
})

;; Strategy predictions with confidence scores
(define-map strategy-predictions uint {
  epoch-id: uint,
  predicted-strategy: (string-ascii 16),
  confidence-score: uint,             ;; 0-10000 (0-100%)
  predicted-allocation: uint,         ;; Recommended allocation in bps
  risk-score: uint,                   ;; Expected risk (0-10000)
  expected-return: int,               ;; Expected return in bps
  features-hash: (buff 32),           ;; Hash of input features
  prediction-time: uint,
  actual-performance: (optional int)  ;; Filled after epoch completion
})

;; Strategy performance tracking for model improvement
(define-map strategy-outcomes uint {
  prediction-id: uint,
  strategy-used: (string-ascii 16),
  allocation-used: uint,
  actual-return: int,
  max-drawdown: uint,
  sharpe-ratio: int,
  prediction-accuracy: uint,          ;; How accurate was the prediction
  model-version-used: uint
})

;; Market regime classification
(define-map regime-classifications uint {
  block-height: uint,
  trend-regime: (string-ascii 16),    ;; UPTREND, DOWNTREND, SIDEWAYS
  volatility-regime: (string-ascii 16), ;; HIGH_VOL, LOW_VOL, NORMAL_VOL
  momentum-regime: (string-ascii 16), ;; STRONG, WEAK, NEUTRAL
  mean-reversion-signal: int,         ;; -100 to +100
  breakout-probability: uint,         ;; 0-10000
  regime-confidence: uint             ;; Model confidence in classification
})

;; Feature importance tracking (for model explainability)
(define-map feature-importance uint {
  feature-name: (string-ascii 32),
  importance-score: uint,             ;; 0-10000
  positive-correlation: bool,
  last-updated: uint,
  sample-count: uint
})

;; ============================================
;; Market Data Collection
;; ============================================

(define-public (update-market-features 
  (btc-price uint)
  (price-change-1h int)
  (price-change-4h int)
  (price-change-24h int)
  (rv-7d uint)
  (rv-30d uint)
  (implied-vol uint)
  (rsi uint)
  (volume-ratio uint)
  (fear-greed uint)
  (funding-rate int)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (iv-rv-ratio (if (> rv-30d u0) (/ (* implied-vol u10000) rv-30d) u10000))
      (bollinger-pos (calculate-bollinger-position btc-price))
      
      ;; Create feature vector
      (features (list 
        price-change-1h price-change-4h price-change-24h 
        (to-int rv-7d) (to-int rv-30d) (to-int implied-vol)
        (to-int iv-rv-ratio) (to-int rsi) bollinger-pos
        (to-int volume-ratio) (to-int fear-greed) funding-rate
      ))
      
      (sample-id (+ (var-get samples-count) u1))
    )
      ;; Update current features
      (var-set current-features features)
      
      ;; Store market sample for training
      (map-set market-samples sample-id {
        block-height: block-height,
        btc-price: btc-price,
        price-change-1h: price-change-1h,
        price-change-4h: price-change-4h,
        price-change-24h: price-change-24h,
        realized-volatility-7d: rv-7d,
        realized-volatility-30d: rv-30d,
        implied-volatility: implied-vol,
        iv-rv-ratio: (to-int iv-rv-ratio),
        rsi-14: rsi,
        bollinger-position: bollinger-pos,
        volume-ratio: volume-ratio,
        fear-greed-index: fear-greed,
        funding-rate: funding-rate,
        optimal-strategy: "UNKNOWN         ", ;; To be labeled later (padded to 16 chars)
        strategy-performance: 0
      })
      
      (var-set samples-count sample-id)
      
      ;; Update regime classifications
      (unwrap-panic (classify-market-regime features))
      
      (print {
        event: "market-features-updated",
        sample-id: sample-id,
        btc-price: btc-price,
        features: features,
        iv-rv-ratio: iv-rv-ratio
      })
      
      (ok sample-id)
    )
  )
)

;; ============================================
;; ML Model Functions
;; ============================================

;; Make strategy prediction using current model
(define-public (predict-optimal-strategy (epoch-id uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (>= (var-get samples-count) MIN-HISTORICAL-SAMPLES) ERR-INSUFFICIENT-DATA)
    
    (let (
      (features (var-get current-features))
      (weights (var-get feature-weights))
      
      ;; Simple linear prediction (in production would use more sophisticated ML)
      (raw-prediction (calculate-linear-prediction features weights))
      (strategy-recommendation (interpret-prediction raw-prediction))
      (confidence (calculate-prediction-confidence features))
      (risk-score (calculate-risk-score features))
      (expected-return (calculate-expected-return raw-prediction))
      
      (prediction-id (+ epoch-id u1000000)) ;; Offset to avoid conflicts
    )
      ;; Validate confidence threshold
      (asserts! (>= confidence LOW-CONFIDENCE-THRESHOLD) ERR-MODEL-NOT-READY)
      
      ;; Calculate optimal allocation using Kelly Criterion if enabled
      (let (
        (optimal-allocation (if KELLY-CRITERION-ENABLED
          (calculate-kelly-allocation expected-return risk-score)
          u2000 ;; Default 20%
        ))
      )
        ;; Store prediction
        (map-set strategy-predictions prediction-id {
          epoch-id: epoch-id,
          predicted-strategy: (get strategy strategy-recommendation),
          confidence-score: confidence,
          predicted-allocation: optimal-allocation,
          risk-score: risk-score,
          expected-return: expected-return,
          features-hash: (hash-features (concat-features features)),
          prediction-time: block-height,
          actual-performance: none
        })
        
        (var-set prediction-confidence confidence)
        
        (print {
          event: "strategy-prediction-made",
          prediction-id: prediction-id,
          epoch-id: epoch-id,
          predicted-strategy: (get strategy strategy-recommendation),
          confidence: confidence,
          allocation: optimal-allocation,
          expected-return: expected-return,
          risk-score: risk-score
        })
        
        (ok prediction-id)
      )
    )
  )
)

;; Update model with actual performance (reinforcement learning)
(define-public (update-model-with-performance 
  (prediction-id uint)
  (actual-strategy (string-ascii 16))
  (actual-return int)
  (max-drawdown uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (prediction (unwrap! (map-get? strategy-predictions prediction-id) ERR-INVALID-FEATURES))
    )
      ;; Update prediction with actual performance
      (map-set strategy-predictions prediction-id (merge prediction {
        actual-performance: (some actual-return)
      }))
      
      ;; Calculate prediction accuracy
      (let (
        (predicted-return (get expected-return prediction))
        (accuracy (calculate-prediction-accuracy predicted-return actual-return))
        (sharpe-ratio (if (> max-drawdown u0) (/ actual-return (to-int max-drawdown)) 0))
      )
        ;; Store outcome for model improvement
        (map-set strategy-outcomes prediction-id {
          prediction-id: prediction-id,
          strategy-used: actual-strategy,
          allocation-used: (get predicted-allocation prediction),
          actual-return: actual-return,
          max-drawdown: max-drawdown,
          sharpe-ratio: sharpe-ratio,
          prediction-accuracy: accuracy,
          model-version-used: (var-get model-version)
        })
        
        ;; Trigger model retraining if enough new samples
        (if (>= accuracy u8000) ;; Good prediction
          (try! (update-feature-weights prediction-id true))
          (try! (update-feature-weights prediction-id false))
        )
        
        (print {
          event: "model-updated-with-performance",
          prediction-id: prediction-id,
          actual-return: actual-return,
          predicted-return: predicted-return,
          accuracy: accuracy,
          sharpe-ratio: sharpe-ratio
        })
        
        (ok accuracy)
      )
    )
  )
)

;; Retrain model weights (simplified online learning)
(define-private (update-feature-weights (prediction-id uint) (was-successful bool))
  (let (
    (prediction (unwrap! (map-get? strategy-predictions prediction-id) ERR-INVALID-FEATURES))
    (current-weights (var-get feature-weights))
    (learning-rate (if was-successful 1 -1)) ;; Simple +1/-1 adjustment
  )
    ;; Update weights based on success/failure (simplified)
    (let ((updated-weights (map-with-index current-weights)))
      (var-set feature-weights updated-weights)
      (var-set model-last-trained block-height)
      (var-set model-version (+ (var-get model-version) u1))
      
      (print {
        event: "model-weights-updated",
        prediction-id: prediction-id,
        was-successful: was-successful,
        new-model-version: (var-get model-version)
      })
      
      (ok true)
    )
  )
)

;; ============================================
;; Calculation Functions
;; ============================================

(define-private (calculate-linear-prediction (features (list 12 int)) (weights (list 12 int)))
  ;; Dot product of features and weights
  (fold sum-products (zip-features-weights features weights) 0)
)

(define-private (sum-products (feature-weight { feature: int, weight: int }) (acc int))
  (+ acc (* (get feature feature-weight) (get weight feature-weight)))
)

(define-private (zip-features-weights (features (list 12 int)) (weights (list 12 int)))
  ;; Simplified zip function (in production would be more robust)
  (list 
    { feature: (unwrap-panic (element-at features u0)), weight: (unwrap-panic (element-at weights u0)) }
    { feature: (unwrap-panic (element-at features u1)), weight: (unwrap-panic (element-at weights u1)) }
    { feature: (unwrap-panic (element-at features u2)), weight: (unwrap-panic (element-at weights u2)) }
    { feature: (unwrap-panic (element-at features u3)), weight: (unwrap-panic (element-at weights u3)) }
    { feature: (unwrap-panic (element-at features u4)), weight: (unwrap-panic (element-at weights u4)) }
    { feature: (unwrap-panic (element-at features u5)), weight: (unwrap-panic (element-at weights u5)) }
    { feature: (unwrap-panic (element-at features u6)), weight: (unwrap-panic (element-at weights u6)) }
    { feature: (unwrap-panic (element-at features u7)), weight: (unwrap-panic (element-at weights u7)) }
    { feature: (unwrap-panic (element-at features u8)), weight: (unwrap-panic (element-at weights u8)) }
    { feature: (unwrap-panic (element-at features u9)), weight: (unwrap-panic (element-at weights u9)) }
    { feature: (unwrap-panic (element-at features u10)), weight: (unwrap-panic (element-at weights u10)) }
    { feature: (unwrap-panic (element-at features u11)), weight: (unwrap-panic (element-at weights u11)) }
  )
)

(define-private (interpret-prediction (raw-score int))
  (if (> raw-score 500)
    { strategy: "COVERED_CALLS", reason: "Bullish prediction" }
    (if (< raw-score -500)
      { strategy: "CASH_SECURED_PUT", reason: "Bearish prediction" }
      (if (> (abs raw-score) 200)
        { strategy: "STRADDLES", reason: "High volatility prediction" }
        { strategy: "IRON_CONDORS", reason: "Low volatility prediction" }
      )
    )
  )
)

(define-private (calculate-prediction-confidence (features (list 12 int)))
  ;; Simplified confidence based on feature variance and historical accuracy
  (let (
    (feature-variance (calculate-feature-variance features))
    (base-confidence u6000) ;; 60% base
  )
    (min (+ base-confidence (/ feature-variance u10)) u9500) ;; Max 95%
  )
)

(define-private (calculate-feature-variance (features (list 12 int)))
  ;; Simplified variance calculation
  (let ((sum-squares (fold sum-feature-squares features u0)))
    (/ sum-squares u12)
  )
)

(define-private (sum-feature-squares (feature int) (acc uint))
  (+ acc (to-uint (* feature feature)))
)

(define-private (calculate-risk-score (features (list 12 int)))
  ;; Risk based on volatility features and market stress indicators
  (let (
    (vol-feature (unwrap-panic (element-at features u4))) ;; 30d realized vol
    (iv-feature (unwrap-panic (element-at features u5)))  ;; Implied vol
    (fear-greed (unwrap-panic (element-at features u10))) ;; Fear/greed index
  )
    (min (+ (to-uint vol-feature) (to-uint iv-feature) (to-uint fear-greed)) u9000)
  )
)

(define-private (calculate-expected-return (prediction-score int))
  ;; Convert prediction score to expected return
  (/ prediction-score 10) ;; Scale down
)

(define-private (calculate-kelly-allocation (expected-return int) (risk-score uint))
  ;; Simplified Kelly Criterion: f = (bp - q) / b
  ;; Where p = win probability, q = loss probability, b = win/loss ratio
  (let (
    (win-prob (if (> expected-return 0) u6000 u4000)) ;; 60% or 40%
    (loss-prob (- u10000 win-prob))
    (win-loss-ratio (if (> risk-score u5000) u8000 u12000)) ;; Risk-adjusted
  )
    (let (
      (kelly-fraction (/ (* win-prob win-loss-ratio) u10000))
      (capped-allocation (min kelly-fraction MAX-KELLY-ALLOCATION))
    )
      (max capped-allocation u500) ;; Minimum 5%
    )
  )
)

(define-private (calculate-bollinger-position (price uint))
  ;; Simplified Bollinger Band position (-100 to +100)
  ;; Would use actual historical prices in production
  0 ;; Placeholder
)

(define-private (calculate-prediction-accuracy (predicted int) (actual int))
  ;; Calculate accuracy as inverse of percentage error
  (let (
    (error (abs (- predicted actual)))
    (error-percentage (if (> (to-uint (abs predicted)) u0) (to-uint (/ (* error 10000) (abs predicted))) u10000))
  )
    (if (> error-percentage u10000) u0 (- u10000 error-percentage))
  )
)

(define-private (classify-market-regime (features (list 12 int)))
  (let (
    (price-change-24h (unwrap-panic (element-at features u2)))
    (volatility (unwrap-panic (element-at features u4)))
    (regime-id block-height)
  )
    (let (
      (trend-regime (if (> price-change-24h 300) "UPTREND" 
                      (if (< price-change-24h -300) "DOWNTREND" "SIDEWAYS")))
      (vol-regime (if (> volatility 8000) "HIGH_VOL" 
                    (if (< volatility 3000) "LOW_VOL" "NORMAL_VOL")))
    )
      (map-set regime-classifications regime-id {
        block-height: block-height,
        trend-regime: trend-regime,
        volatility-regime: vol-regime,
        momentum-regime: "NEUTRAL",
        mean-reversion-signal: 0,
        breakout-probability: u5000,
        regime-confidence: u7500
      })
      
      (ok true)
    )
  )
)

(define-private (adjust-weight-by-index (weight int) (index uint))
  ;; Adjust weight based on performance (simplified)
  (if (< weight 0) (+ weight 1) (- weight 1))
)

(define-private (map-with-index (lst (list 12 int)))
  ;; Map function with index (simplified implementation)
  lst ;; Return unchanged for now
)

(define-private (hash-features (data (buff 100)))
  ;; Placeholder hash function for feature hashing
  0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
)

(define-private (concat-features (features (list 12 int)))
  ;; Convert features to buffer for hashing
  0x0000 ;; Placeholder
)

(define-private (abs (x int))
  (if (< x 0) (- 0 x) x)
)

(define-private (min (a uint) (b uint))
  (if (< a b) a b)
)

(define-private (max (a uint) (b uint))
  (if (> a b) a b)
)

;; ============================================
;; Read-only Functions  
;; ============================================

(define-read-only (get-current-prediction)
  (let ((confidence (var-get prediction-confidence)))
    {
      model-version: (var-get model-version),
      last-trained: (var-get model-last-trained),
      confidence: confidence,
      samples-count: (var-get samples-count),
      current-features: (var-get current-features),
      feature-weights: (var-get feature-weights)
    }
  )
)

(define-read-only (get-strategy-prediction (prediction-id uint))
  (map-get? strategy-predictions prediction-id)
)

(define-read-only (get-market-regime (block-height-ref uint))
  (map-get? regime-classifications block-height-ref)
)

(define-read-only (get-model-performance)
  {
    total-predictions: (var-get samples-count),
    model-version: (var-get model-version),
    last-trained: (var-get model-last-trained),
    confidence-threshold: LOW-CONFIDENCE-THRESHOLD
  }
)

(define-read-only (get-feature-importance (feature-index uint))
  (map-get? feature-importance feature-index)
)