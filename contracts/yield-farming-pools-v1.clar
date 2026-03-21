;; yield-farming-pools-v1.clar
;; Multi-pool yield farming system with auto-compounding and boost mechanics
;; Supports various LP tokens and single-asset staking

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant MAX-POOLS u20)
(define-constant PRECISION u100000000) ;; 8 decimals
(define-constant SECONDS-PER-BLOCK u600) ;; 10 minutes per block

;; Reward multipliers
(define-constant BASE-MULTIPLIER u100)        ;; 1x
(define-constant MAX-BOOST-MULTIPLIER u250)   ;; 2.5x
(define-constant VE_TOKEN_BOOST_FACTOR u40)   ;; 40% boost per veSOVT

;; Pool types
(define-constant POOL-TYPE-SINGLE "SINGLE")   ;; Single asset staking
(define-constant POOL-TYPE-LP "LP")           ;; LP token staking
(define-constant POOL-TYPE-VAULT "VAULT")     ;; Vault strategy staking

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u9000))
(define-constant ERR-POOL-NOT-FOUND (err u9001))
(define-constant ERR-POOL-INACTIVE (err u9002))
(define-constant ERR-INSUFFICIENT-BALANCE (err u9003))
(define-constant ERR-ZERO-AMOUNT (err u9004))
(define-constant ERR-NO-POSITION (err u9005))
(define-constant ERR-REWARDS-NOT-READY (err u9006))
(define-constant ERR-MAX-POOLS-REACHED (err u9007))
(define-constant ERR-POOL-EXISTS (err u9008))
(define-constant ERR-INVALID-MULTIPLIER (err u9009))

;; ============================================
;; Data Variables
;; ============================================
(define-data-var pool-count uint u0)
(define-data-var total-allocated-points uint u0)
(define-data-var sovt-per-block uint u1157407407) ;; ~1 SOVT per block initially
(define-data-var last-reward-block uint u0)

;; Auto-compound settings
(define-data-var auto-compound-enabled bool true)
(define-data-var compound-fee-bps uint u200) ;; 2% compound fee
(define-data-var compound-threshold uint u100000000) ;; Min 1 SOVT to compound

;; ============================================
;; Data Maps
;; ============================================

;; Pool configurations
(define-map pools uint {
  name: (string-ascii 32),
  stake-token: principal,           ;; Token to stake
  reward-token: principal,          ;; Reward token (usually SOVT)
  pool-type: (string-ascii 8),      ;; SINGLE, LP, VAULT
  allocation-points: uint,          ;; Reward allocation
  last-reward-block: uint,
  accumulated-per-share: uint,      ;; Accumulated rewards per share
  total-staked: uint,               ;; Total tokens staked
  total-boosted-shares: uint,       ;; Total boosted shares
  deposit-fee-bps: uint,            ;; Deposit fee (0-1000 = 0-10%)
  withdrawal-fee-bps: uint,         ;; Withdrawal fee
  lock-period: uint,                ;; Minimum lock period
  auto-compound: bool,              ;; Auto-compound rewards
  active: bool,
  created-block: uint
})

;; User positions in pools
(define-map user-positions { pool-id: uint, user: principal } {
  amount: uint,                     ;; Staked amount
  boosted-shares: uint,             ;; Boosted shares (including veToken boost)
  reward-debt: uint,                ;; Reward debt for accurate calculation
  last-deposit: uint,               ;; Last deposit block
  pending-rewards: uint,            ;; Unclaimed rewards
  boost-multiplier: uint,           ;; Current boost multiplier
  auto-compound: bool,              ;; User auto-compound preference
  total-earned: uint                ;; Lifetime earnings
})

;; Pool statistics and performance tracking
(define-map pool-stats uint {
  total-deposits: uint,
  total-withdrawals: uint,
  total-rewards-distributed: uint,
  average-apy: uint,
  peak-tvl: uint,
  unique-stakers: uint,
  compound-events: uint,
  last-updated: uint
})

;; User farming statistics
(define-map user-farm-stats principal {
  total-pools: uint,
  total-staked-value: uint,
  total-rewards-earned: uint,
  total-compounded: uint,
  highest-boost: uint,
  active-pools: (list 20 uint)
})

;; Boost calculations
(define-map boost-info { pool-id: uint, user: principal } {
  ve-token-balance: uint,
  lp-balance: uint,
  boost-multiplier: uint,
  last-boost-update: uint
})

;; Reward emission schedule
(define-map emission-schedule uint {
  start-block: uint,
  end-block: uint,
  rewards-per-block: uint,
  total-rewards: uint,
  distributed: uint
})

;; ============================================
;; Pool Management
;; ============================================

(define-public (create-pool 
  (name (string-ascii 32))
  (stake-token principal)
  (reward-token principal)
  (pool-type (string-ascii 8))
  (allocation-points uint)
  (deposit-fee-bps uint)
  (withdrawal-fee-bps uint)
  (lock-period uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (< (var-get pool-count) MAX-POOLS) ERR-MAX-POOLS-REACHED)
    (asserts! (<= deposit-fee-bps u1000) ERR-INVALID-MULTIPLIER)
    (asserts! (<= withdrawal-fee-bps u1000) ERR-INVALID-MULTIPLIER)
    
    (let ((pool-id (+ (var-get pool-count) u1)))
      ;; Create pool
      (map-set pools pool-id {
        name: name,
        stake-token: stake-token,
        reward-token: reward-token,
        pool-type: pool-type,
        allocation-points: allocation-points,
        last-reward-block: block-height,
        accumulated-per-share: u0,
        total-staked: u0,
        total-boosted-shares: u0,
        deposit-fee-bps: deposit-fee-bps,
        withdrawal-fee-bps: withdrawal-fee-bps,
        lock-period: lock-period,
        auto-compound: (var-get auto-compound-enabled),
        active: true,
        created-block: block-height
      })
      
      ;; Initialize pool stats
      (map-set pool-stats pool-id {
        total-deposits: u0,
        total-withdrawals: u0,
        total-rewards-distributed: u0,
        average-apy: u0,
        peak-tvl: u0,
        unique-stakers: u0,
        compound-events: u0,
        last-updated: block-height
      })
      
      ;; Update global state
      (var-set pool-count pool-id)
      (var-set total-allocated-points (+ (var-get total-allocated-points) allocation-points))
      
      (print {
        event: "pool-created",
        pool-id: pool-id,
        name: name,
        stake-token: stake-token,
        allocation-points: allocation-points
      })
      
      (ok pool-id)
    )
  )
)

(define-public (update-pool-allocation (pool-id uint) (allocation-points uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (old-points (get allocation-points pool))
    )
      ;; Update pool rewards first
      (try! (update-pool-rewards pool-id))
      
      ;; Update allocation
      (map-set pools pool-id (merge pool { allocation-points: allocation-points }))
      (var-set total-allocated-points 
        (+ (- (var-get total-allocated-points) old-points) allocation-points))
      
      (print {
        event: "pool-allocation-updated",
        pool-id: pool-id,
        old-allocation: old-points,
        new-allocation: allocation-points
      })
      
      (ok true)
    )
  )
)

;; ============================================
;; Farming Functions
;; ============================================

(define-public (deposit (pool-id uint) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    
    (let (
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (current-position (default-to {
        amount: u0, boosted-shares: u0, reward-debt: u0, last-deposit: u0,
        pending-rewards: u0, boost-multiplier: BASE-MULTIPLIER, 
        auto-compound: true, total-earned: u0
      } (map-get? user-positions { pool-id: pool-id, user: tx-sender })))
    )
      (asserts! (get active pool) ERR-POOL-INACTIVE)
      
      ;; Update pool rewards
      (try! (update-pool-rewards pool-id))
      
      ;; Calculate deposit fee
      (let (
        (deposit-fee (/ (* amount (get deposit-fee-bps pool)) u10000))
        (net-amount (- amount deposit-fee))
        
        ;; Calculate boost
        (boost-multiplier (calculate-boost-multiplier pool-id tx-sender net-amount))
        (boosted-shares (/ (* net-amount boost-multiplier) BASE-MULTIPLIER))
        
        ;; Claim pending rewards if any
        (pending-rewards (calculate-pending-rewards pool-id tx-sender))
      )
        ;; Transfer stake token
        (try! (contract-call? (get stake-token pool) transfer amount tx-sender (as-contract tx-sender) none))
        
        ;; Update position
        (let (
          (new-amount (+ (get amount current-position) net-amount))
          (new-boosted-shares (+ (get boosted-shares current-position) boosted-shares))
        )
          (map-set user-positions { pool-id: pool-id, user: tx-sender } {
            amount: new-amount,
            boosted-shares: new-boosted-shares,
            reward-debt: (/ (* new-boosted-shares (get accumulated-per-share pool)) PRECISION),
            last-deposit: block-height,
            pending-rewards: (+ (get pending-rewards current-position) pending-rewards),
            boost-multiplier: boost-multiplier,
            auto-compound: (get auto-compound current-position),
            total-earned: (get total-earned current-position)
          })
          
          ;; Update pool
          (map-set pools pool-id (merge pool {
            total-staked: (+ (get total-staked pool) net-amount),
            total-boosted-shares: (+ (get total-boosted-shares pool) boosted-shares)
          }))
          
          ;; Update stats
          (try! (update-pool-stats pool-id amount u0))
          (try! (update-user-stats tx-sender))
          
          (print {
            event: "deposit",
            pool-id: pool-id,
            user: tx-sender,
            amount: amount,
            net-amount: net-amount,
            deposit-fee: deposit-fee,
            boost-multiplier: boost-multiplier,
            boosted-shares: boosted-shares
          })
          
          (ok new-amount)
        )
      )
    )
  )
)

(define-public (withdraw (pool-id uint) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    
    (let (
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (position (unwrap! (map-get? user-positions { pool-id: pool-id, user: tx-sender }) ERR-NO-POSITION))
    )
      (asserts! (>= (get amount position) amount) ERR-INSUFFICIENT-BALANCE)
      (asserts! (>= block-height (+ (get last-deposit position) (get lock-period pool))) ERR-REWARDS-NOT-READY)
      
      ;; Update pool rewards
      (try! (update-pool-rewards pool-id))
      
      ;; Calculate withdrawal fee
      (let (
        (withdrawal-fee (/ (* amount (get withdrawal-fee-bps pool)) u10000))
        (net-amount (- amount withdrawal-fee))
        
        ;; Calculate shares to remove proportionally
        (shares-to-remove (/ (* (get boosted-shares position) amount) (get amount position)))
        (pending-rewards (calculate-pending-rewards pool-id tx-sender))
      )
        ;; Claim rewards first
        (if (> pending-rewards u0)
          (try! (claim-rewards pool-id))
          (ok u0)
        )
        
        ;; Update position
        (let (
          (new-amount (- (get amount position) amount))
          (new-boosted-shares (- (get boosted-shares position) shares-to-remove))
        )
          (if (> new-amount u0)
            (map-set user-positions { pool-id: pool-id, user: tx-sender } (merge position {
              amount: new-amount,
              boosted-shares: new-boosted-shares,
              reward-debt: (/ (* new-boosted-shares (get accumulated-per-share pool)) PRECISION)
            }))
            (map-delete user-positions { pool-id: pool-id, user: tx-sender })
          )
          
          ;; Update pool
          (map-set pools pool-id (merge pool {
            total-staked: (- (get total-staked pool) amount),
            total-boosted-shares: (- (get total-boosted-shares pool) shares-to-remove)
          }))
          
          ;; Transfer tokens back to user
          (try! (as-contract (contract-call? (get stake-token pool) transfer net-amount tx-sender tx-sender none)))
          
          ;; Update stats
          (try! (update-pool-stats pool-id u0 amount))
          (try! (update-user-stats tx-sender))
          
          (print {
            event: "withdraw",
            pool-id: pool-id,
            user: tx-sender,
            amount: amount,
            net-amount: net-amount,
            withdrawal-fee: withdrawal-fee,
            remaining-amount: new-amount
          })
          
          (ok net-amount)
        )
      )
    )
  )
)

(define-public (claim-rewards (pool-id uint))
  (begin
    (let (
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (position (unwrap! (map-get? user-positions { pool-id: pool-id, user: tx-sender }) ERR-NO-POSITION))
    )
      ;; Update pool rewards
      (try! (update-pool-rewards pool-id))
      
      (let (
        (pending-rewards (+ (get pending-rewards position) (calculate-pending-rewards pool-id tx-sender)))
      )
        (asserts! (> pending-rewards u0) ERR-REWARDS-NOT-READY)
        
        ;; Mint reward tokens
        (try! (contract-call? (get reward-token pool) transfer pending-rewards (as-contract tx-sender) tx-sender none))
        
        ;; Update position
        (map-set user-positions { pool-id: pool-id, user: tx-sender } (merge position {
          pending-rewards: u0,
          reward-debt: (/ (* (get boosted-shares position) (get accumulated-per-share pool)) PRECISION),
          total-earned: (+ (get total-earned position) pending-rewards)
        }))
        
        ;; Auto-compound if enabled
        (if (and (get auto-compound position) (>= pending-rewards (var-get compound-threshold)))
          (try! (auto-compound-rewards pool-id tx-sender pending-rewards))
          (ok u0)
        )
        
        (print {
          event: "rewards-claimed",
          pool-id: pool-id,
          user: tx-sender,
          rewards: pending-rewards
        })
        
        (ok pending-rewards)
      )
    )
  )
)

;; ============================================
;; Auto-Compounding
;; ============================================

(define-public (auto-compound-rewards (pool-id uint) (user principal) (reward-amount uint))
  (begin
    (let (
      (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
      (compound-fee (/ (* reward-amount (var-get compound-fee-bps)) u10000))
      (compound-amount (- reward-amount compound-fee))
    )
      ;; Re-stake rewards automatically
      (try! (deposit pool-id compound-amount))
      
      ;; Update stats
      (let (
        (stats (unwrap! (map-get? pool-stats pool-id) ERR-POOL-NOT-FOUND))
      )
        (map-set pool-stats pool-id (merge stats {
          compound-events: (+ (get compound-events stats) u1)
        }))
      )
      
      (print {
        event: "auto-compound",
        pool-id: pool-id,
        user: user,
        reward-amount: reward-amount,
        compound-amount: compound-amount,
        compound-fee: compound-fee
      })
      
      (ok compound-amount)
    )
  )
)

;; ============================================
;; Reward Calculations
;; ============================================

(define-private (update-pool-rewards (pool-id uint))
  (let (
    (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
  )
    (if (and (> (get total-boosted-shares pool) u0) (> (var-get total-allocated-points) u0))
      (let (
        (blocks-passed (- block-height (get last-reward-block pool)))
        (pool-reward (/ (* blocks-passed (var-get sovt-per-block) (get allocation-points pool)) 
                        (var-get total-allocated-points)))
        (reward-per-share (/ (* pool-reward PRECISION) (get total-boosted-shares pool)))
        (new-accumulated (+ (get accumulated-per-share pool) reward-per-share))
      )
        (map-set pools pool-id (merge pool {
          last-reward-block: block-height,
          accumulated-per-share: new-accumulated
        }))
        (ok new-accumulated)
      )
      (begin
        (map-set pools pool-id (merge pool { last-reward-block: block-height }))
        (ok (get accumulated-per-share pool))
      )
    )
  )
)

(define-private (calculate-pending-rewards (pool-id uint) (user principal))
  (match (map-get? user-positions { pool-id: pool-id, user: user })
    position (match (map-get? pools pool-id)
      pool (let (
        (accumulated-per-share (get accumulated-per-share pool))
        (user-reward-debt (get reward-debt position))
        (boosted-shares (get boosted-shares position))
      )
        (if (> accumulated-per-share user-reward-debt)
          (/ (* boosted-shares (- accumulated-per-share user-reward-debt)) PRECISION)
          u0
        )
      )
      u0
    )
    u0
  )
)

(define-private (calculate-boost-multiplier (pool-id uint) (user principal) (amount uint))
  (let (
    ;; Get user's veSOVT balance (simplified - would integrate with governance token)
    (ve-balance u0) ;; Placeholder
    (lp-balance amount)
  )
    ;; Boost formula: min(1 + (veSOVT / (LP * 40)), 2.5)
    (let ((boost-factor (if (> lp-balance u0) (/ ve-balance (* lp-balance VE_TOKEN_BOOST_FACTOR)) u0)))
      (min (+ BASE-MULTIPLIER boost-factor) MAX-BOOST-MULTIPLIER)
    )
  )
)

;; ============================================
;; Statistics Updates
;; ============================================

(define-private (update-pool-stats (pool-id uint) (deposit-amount uint) (withdrawal-amount uint))
  (let (
    (stats (unwrap! (map-get? pool-stats pool-id) ERR-POOL-NOT-FOUND))
    (pool (unwrap! (map-get? pools pool-id) ERR-POOL-NOT-FOUND))
  )
    (map-set pool-stats pool-id {
      total-deposits: (+ (get total-deposits stats) deposit-amount),
      total-withdrawals: (+ (get total-withdrawals stats) withdrawal-amount),
      total-rewards-distributed: (get total-rewards-distributed stats),
      average-apy: (calculate-pool-apy pool-id),
      peak-tvl: (max (get peak-tvl stats) (get total-staked pool)),
      unique-stakers: (get unique-stakers stats), ;; Would need proper tracking
      compound-events: (get compound-events stats),
      last-updated: block-height
    })
    (ok true)
  )
)

(define-private (update-user-stats (user principal))
  ;; Update user farming statistics across all pools
  (let (
    (current-stats (default-to {
      total-pools: u0, total-staked-value: u0, total-rewards-earned: u0,
      total-compounded: u0, highest-boost: u0, active-pools: (list)
    } (map-get? user-farm-stats user)))
  )
    ;; Simplified update - in production would calculate across all pools
    (map-set user-farm-stats user current-stats)
    (ok true)
  )
)

(define-private (calculate-pool-apy (pool-id uint))
  ;; Simplified APY calculation
  ;; In production: (rewards per year) / (total staked) * 100
  (let (
    (pool (unwrap! (map-get? pools pool-id) (err u0)))
    (daily-rewards (* (var-get sovt-per-block) u144)) ;; Blocks per day
    (yearly-rewards (* daily-rewards u365))
  )
    (if (> (get total-staked pool) u0)
      (/ (* yearly-rewards u10000) (get total-staked pool)) ;; Returns basis points
      u0
    )
  )
)

(define-private (max (a uint) (b uint))
  (if (> a b) a b)
)

(define-private (min (a uint) (b uint))
  (if (< a b) a b)
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (get-pool-info (pool-id uint))
  (map-get? pools pool-id)
)

(define-read-only (get-user-position (pool-id uint) (user principal))
  (map-get? user-positions { pool-id: pool-id, user: user })
)

(define-read-only (get-pool-stats (pool-id uint))
  (map-get? pool-stats pool-id)
)

(define-read-only (get-user-farm-stats (user principal))
  (map-get? user-farm-stats user)
)

(define-read-only (get-pending-rewards (pool-id uint) (user principal))
  (+ 
    (default-to u0 (get pending-rewards (map-get? user-positions { pool-id: pool-id, user: user })))
    (calculate-pending-rewards pool-id user)
  )
)

(define-read-only (get-pool-apy (pool-id uint))
  (calculate-pool-apy pool-id)
)

(define-read-only (get-farming-overview)
  {
    total-pools: (var-get pool-count),
    total-allocated-points: (var-get total-allocated-points),
    sovt-per-block: (var-get sovt-per-block),
    auto-compound-enabled: (var-get auto-compound-enabled),
    compound-threshold: (var-get compound-threshold)
  }
)