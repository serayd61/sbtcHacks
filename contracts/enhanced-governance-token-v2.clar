;; enhanced-governance-token-v2.clar
;; Advanced governance token with liquidity mining and yield farming
;; Features: Staking, veToken mechanics, protocol revenue sharing

(use-trait sip-010-token .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant TOKEN-NAME "sBTC Options Vault Token")
(define-constant TOKEN-SYMBOL "SOVT")
(define-constant TOKEN-DECIMALS u8)
(define-constant TOKEN-URI u"https://sbtc-options-vault.vercel.app/token-metadata")

;; Token supply
(define-constant MAX-SUPPLY u100000000000000000) ;; 1B tokens (8 decimals)
(define-constant INITIAL-SUPPLY u10000000000000000) ;; 100M tokens initial

;; Staking and rewards
(define-constant MIN-STAKE-PERIOD u1008)         ;; 7 days minimum
(define-constant MAX-STAKE-PERIOD u52560)        ;; 365 days maximum  
(define-constant BASE-REWARD-RATE u1000)         ;; 10% APR base
(define-constant MAX-LOCK-MULTIPLIER u4)         ;; 4x multiplier for max lock

;; Liquidity mining
(define-constant MINING-DURATION u7257600)       ;; ~4 years in blocks
(define-constant MINING-REWARDS-PER-BLOCK u1157) ;; Decreasing rewards
(define-constant LIQUIDITY-THRESHOLD u100000000000000) ;; 1M tokens minimum

;; Revenue sharing
(define-constant REVENUE-SHARE-BPS u5000)        ;; 50% of protocol revenue
(define-constant CLAIM-COOLDOWN u144)            ;; 24 hours

;; ============================================
;; Errors
;; ============================================
(define-constant ERR-NOT-AUTHORIZED (err u8000))
(define-constant ERR-INSUFFICIENT-BALANCE (err u8001))
(define-constant ERR-INVALID-AMOUNT (err u8002))
(define-constant ERR-TRANSFER-FAILED (err u8003))
(define-constant ERR-STAKE-TOO-SHORT (err u8004))
(define-constant ERR-STAKE-LOCKED (err u8005))
(define-constant ERR-NO-STAKE (err u8006))
(define-constant ERR-CLAIM-COOLDOWN (err u8007))
(define-constant ERR-INSUFFICIENT-REWARDS (err u8008))
(define-constant ERR-MAX-SUPPLY-EXCEEDED (err u8009))

;; ============================================
;; Data Variables
;; ============================================
(define-data-var total-supply uint u0)
(define-data-var total-staked uint u0)
(define-data-var total-ve-tokens uint u0)
(define-data-var mining-start-block uint u0)
(define-data-var total-liquidity-provided uint u0)
(define-data-var revenue-pool uint u0)
(define-data-var last-revenue-distribution uint u0)

;; Reward tracking
(define-data-var global-reward-per-token uint u0)
(define-data-var last-update-block uint u0)
(define-data-var rewards-distributed uint u0)

;; ============================================
;; Data Maps
;; ============================================

;; Basic token balances
(define-map balances principal uint)
(define-map allowances { owner: principal, spender: principal } uint)

;; Staking system
(define-map stakes principal {
  amount: uint,                    ;; Staked amount
  lock-period: uint,              ;; Lock period in blocks
  lock-end: uint,                 ;; When stake unlocks
  ve-tokens: uint,                ;; Voting-escrowed tokens
  last-claim: uint,               ;; Last reward claim
  rewards-earned: uint,           ;; Accumulated rewards
  reward-debt: uint               ;; For reward calculation
})

;; Liquidity mining
(define-map liquidity-positions principal {
  lp-tokens: uint,                ;; LP tokens provided
  mining-start: uint,             ;; When mining started
  rewards-per-token-paid: uint,   ;; Last reward checkpoint
  pending-rewards: uint,          ;; Unclaimed mining rewards
  boost-multiplier: uint          ;; Boost from veTokens
})

;; Revenue sharing
(define-map revenue-claims principal {
  last-claim-block: uint,
  total-claimed: uint,
  pending-revenue: uint
})

;; Governance proposals (enhanced)
(define-map proposals uint {
  proposer: principal,
  title: (string-ascii 128),
  description: (string-ascii 512),
  vote-start: uint,
  vote-end: uint,
  for-votes: uint,
  against-votes: uint,
  abstain-votes: uint,
  min-quorum: uint,
  status: (string-ascii 16),      ;; PENDING, ACTIVE, PASSED, FAILED, EXECUTED
  execution-delay: uint,
  execution-target: (optional principal),
  execution-data: (optional (buff 1024))
})

(define-map votes { proposal-id: uint, voter: principal } {
  vote-type: (string-ascii 16),   ;; FOR, AGAINST, ABSTAIN
  ve-tokens-used: uint,
  vote-block: uint
})

(define-data-var proposal-count uint u0)

;; Liquidity incentive programs
(define-map incentive-programs uint {
  name: (string-ascii 64),
  target-asset: principal,        ;; Target LP token
  reward-rate: uint,              ;; Rewards per block
  start-block: uint,
  end-block: uint,
  total-allocated: uint,
  total-distributed: uint,
  active: bool
})

(define-data-var program-count uint u0)

;; ============================================
;; SIP-010 Implementation
;; ============================================

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq from tx-sender) (is-eq contract-caller tx-sender)) ERR-NOT-AUTHORIZED)
    (asserts! (>= (get-balance from) amount) ERR-INSUFFICIENT-BALANCE)
    
    (try! (ft-transfer? sovt-token amount from to))
    
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok TOKEN-NAME)
)

(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL)
)

(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

(define-read-only (get-balance (who principal))
  (default-to u0 (map-get? balances who))
)

(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

(define-read-only (get-token-uri)
  (ok (some TOKEN-URI))
)

;; ============================================
;; Token Management
;; ============================================

(define-fungible-token sovt-token)

(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (<= (+ (var-get total-supply) amount) MAX-SUPPLY) ERR-MAX-SUPPLY-EXCEEDED)
    
    (try! (ft-mint? sovt-token amount recipient))
    (map-set balances recipient (+ (get-balance recipient) amount))
    (var-set total-supply (+ (var-get total-supply) amount))
    
    (print {
      event: "token-minted",
      recipient: recipient,
      amount: amount,
      total-supply: (var-get total-supply)
    })
    
    (ok amount)
  )
)

;; ============================================
;; Staking System
;; ============================================

(define-public (stake (amount uint) (lock-period uint))
  (begin
    (asserts! (>= amount u100000000) ERR-INVALID-AMOUNT) ;; Min 1 token
    (asserts! (>= lock-period MIN-STAKE-PERIOD) ERR-STAKE-TOO-SHORT)
    (asserts! (<= lock-period MAX-STAKE-PERIOD) ERR-STAKE-TOO-SHORT)
    (asserts! (>= (get-balance tx-sender) amount) ERR-INSUFFICIENT-BALANCE)
    
    (let (
      (current-stake (default-to { 
        amount: u0, lock-period: u0, lock-end: u0, ve-tokens: u0, 
        last-claim: u0, rewards-earned: u0, reward-debt: u0 
      } (map-get? stakes tx-sender)))
      (lock-end (+ block-height lock-period))
      (lock-multiplier (calculate-lock-multiplier lock-period))
      (ve-tokens (/ (* amount lock-multiplier) u1))
    )
      ;; Transfer tokens to contract for staking
      (try! (ft-transfer? sovt-token amount tx-sender (as-contract tx-sender)))
      (map-set balances tx-sender (- (get-balance tx-sender) amount))
      
      ;; Update staking position
      (map-set stakes tx-sender {
        amount: (+ (get amount current-stake) amount),
        lock-period: lock-period,
        lock-end: (max lock-end (get lock-end current-stake)),
        ve-tokens: (+ (get ve-tokens current-stake) ve-tokens),
        last-claim: block-height,
        rewards-earned: (get rewards-earned current-stake),
        reward-debt: (calculate-reward-debt (+ (get ve-tokens current-stake) ve-tokens))
      })
      
      ;; Update global stats
      (var-set total-staked (+ (var-get total-staked) amount))
      (var-set total-ve-tokens (+ (var-get total-ve-tokens) ve-tokens))
      
      (print {
        event: "tokens-staked",
        user: tx-sender,
        amount: amount,
        lock-period: lock-period,
        ve-tokens: ve-tokens,
        lock-end: lock-end
      })
      
      (ok ve-tokens)
    )
  )
)

(define-public (unstake (amount uint))
  (let (
    (current-stake (unwrap! (map-get? stakes tx-sender) ERR-NO-STAKE))
  )
    (asserts! (<= amount (get amount current-stake)) ERR-INSUFFICIENT-BALANCE)
    (asserts! (>= block-height (get lock-end current-stake)) ERR-STAKE-LOCKED)
    
    ;; Claim pending rewards first
    (try! (claim-staking-rewards))
    
    ;; Calculate ve-tokens to remove proportionally
    (let (
      (ve-tokens-to-remove (/ (* (get ve-tokens current-stake) amount) (get amount current-stake)))
      (remaining-amount (- (get amount current-stake) amount))
    )
      ;; Transfer tokens back to user
      (try! (as-contract (ft-transfer? sovt-token amount tx-sender tx-sender)))
      (map-set balances tx-sender (+ (get-balance tx-sender) amount))
      
      ;; Update stake position
      (if (> remaining-amount u0)
        (map-set stakes tx-sender (merge current-stake {
          amount: remaining-amount,
          ve-tokens: (- (get ve-tokens current-stake) ve-tokens-to-remove)
        }))
        (map-delete stakes tx-sender)
      )
      
      ;; Update global stats
      (var-set total-staked (- (var-get total-staked) amount))
      (var-set total-ve-tokens (- (var-get total-ve-tokens) ve-tokens-to-remove))
      
      (print {
        event: "tokens-unstaked",
        user: tx-sender,
        amount: amount,
        ve-tokens-removed: ve-tokens-to-remove
      })
      
      (ok amount)
    )
  )
)

;; ============================================
;; Rewards System
;; ============================================

(define-public (claim-staking-rewards)
  (let (
    (current-stake (unwrap! (map-get? stakes tx-sender) ERR-NO-STAKE))
  )
    (asserts! (>= (- block-height (get last-claim current-stake)) CLAIM-COOLDOWN) ERR-CLAIM-COOLDOWN)
    
    (let (
      (rewards (calculate-pending-rewards tx-sender))
    )
      (asserts! (> rewards u0) ERR-INSUFFICIENT-REWARDS)
      
      ;; Mint rewards to user
      (try! (mint tx-sender rewards))
      
      ;; Update stake info
      (map-set stakes tx-sender (merge current-stake {
        last-claim: block-height,
        rewards-earned: (+ (get rewards-earned current-stake) rewards),
        reward-debt: (calculate-reward-debt (get ve-tokens current-stake))
      }))
      
      (var-set rewards-distributed (+ (var-get rewards-distributed) rewards))
      
      (print {
        event: "staking-rewards-claimed",
        user: tx-sender,
        rewards: rewards,
        total-earned: (+ (get rewards-earned current-stake) rewards)
      })
      
      (ok rewards)
    )
  )
)

;; ============================================
;; Liquidity Mining
;; ============================================

(define-public (provide-liquidity (lp-tokens uint))
  (begin
    (asserts! (> lp-tokens u0) ERR-INVALID-AMOUNT)
    
    (let (
      (current-position (default-to {
        lp-tokens: u0, mining-start: u0, rewards-per-token-paid: u0,
        pending-rewards: u0, boost-multiplier: u1
      } (map-get? liquidity-positions tx-sender)))
      (ve-balance (get-ve-token-balance tx-sender))
      (boost-multiplier (calculate-boost-multiplier ve-balance lp-tokens))
    )
      ;; Update position
      (map-set liquidity-positions tx-sender {
        lp-tokens: (+ (get lp-tokens current-position) lp-tokens),
        mining-start: (if (is-eq (get lp-tokens current-position) u0) block-height (get mining-start current-position)),
        rewards-per-token-paid: (var-get global-reward-per-token),
        pending-rewards: (+ (get pending-rewards current-position) (calculate-mining-rewards tx-sender)),
        boost-multiplier: boost-multiplier
      })
      
      (var-set total-liquidity-provided (+ (var-get total-liquidity-provided) lp-tokens))
      
      (print {
        event: "liquidity-provided",
        user: tx-sender,
        lp-tokens: lp-tokens,
        boost-multiplier: boost-multiplier
      })
      
      (ok true)
    )
  )
)

(define-public (claim-mining-rewards)
  (let (
    (position (unwrap! (map-get? liquidity-positions tx-sender) ERR-NO-STAKE))
    (rewards (+ (get pending-rewards position) (calculate-mining-rewards tx-sender)))
  )
    (asserts! (> rewards u0) ERR-INSUFFICIENT-REWARDS)
    
    ;; Mint rewards
    (try! (mint tx-sender rewards))
    
    ;; Update position
    (map-set liquidity-positions tx-sender (merge position {
      pending-rewards: u0,
      rewards-per-token-paid: (var-get global-reward-per-token)
    }))
    
    (print {
      event: "mining-rewards-claimed",
      user: tx-sender,
      rewards: rewards
    })
    
    (ok rewards)
  )
)

;; ============================================
;; Revenue Sharing
;; ============================================

(define-public (distribute-revenue (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    (let (
      (share-amount (/ (* amount REVENUE-SHARE-BPS) u10000))
    )
      (var-set revenue-pool (+ (var-get revenue-pool) share-amount))
      (var-set last-revenue-distribution block-height)
      
      (print {
        event: "revenue-distributed",
        total-amount: amount,
        share-amount: share-amount,
        revenue-pool: (var-get revenue-pool)
      })
      
      (ok share-amount)
    )
  )
)

(define-public (claim-revenue-share)
  (let (
    (ve-balance (get-ve-token-balance tx-sender))
    (total-ve-supply (var-get total-ve-tokens))
    (claim-info (default-to { last-claim-block: u0, total-claimed: u0, pending-revenue: u0 }
                             (map-get? revenue-claims tx-sender)))
  )
    (asserts! (> ve-balance u0) ERR-NO-STAKE)
    (asserts! (>= (- block-height (get last-claim-block claim-info)) CLAIM-COOLDOWN) ERR-CLAIM-COOLDOWN)

    (let (
      (user-share (if (> total-ve-supply u0) (/ (* (var-get revenue-pool) ve-balance) total-ve-supply) u0))
    )
      (asserts! (> user-share u0) ERR-INSUFFICIENT-REWARDS)
      
      ;; Transfer sBTC revenue share (simplified - would need proper token handling)
      (try! (mint tx-sender user-share)) ;; Simplified: mint SOVT instead of sBTC
      
      ;; Update claim info
      (map-set revenue-claims tx-sender {
        last-claim-block: block-height,
        total-claimed: (+ (get total-claimed claim-info) user-share),
        pending-revenue: u0
      })
      
      (var-set revenue-pool (- (var-get revenue-pool) user-share))
      
      (print {
        event: "revenue-claimed",
        user: tx-sender,
        amount: user-share,
        ve-balance: ve-balance
      })
      
      (ok user-share)
    )
  )
)

;; ============================================
;; Helper Functions
;; ============================================

(define-private (calculate-lock-multiplier (lock-period uint))
  (let (
    (max-period (to-int MAX-STAKE-PERIOD))
    (current-period (to-int lock-period))
    (multiplier (+ u1 (/ (* u3 (to-uint current-period)) (to-uint max-period))))
  )
    (min multiplier MAX-LOCK-MULTIPLIER)
  )
)

(define-private (calculate-pending-rewards (user principal))
  (match (map-get? stakes user)
    stake-info (let (
      (blocks-staked (- block-height (get last-claim stake-info)))
      (ve-tokens (get ve-tokens stake-info))
      (reward-rate (+ BASE-REWARD-RATE (/ ve-tokens u1000))) ;; Bonus for ve-tokens
    )
      (/ (* ve-tokens reward-rate blocks-staked) u365000) ;; Approximate daily rewards
    )
    u0
  )
)

(define-private (calculate-reward-debt (ve-tokens uint))
  (* ve-tokens (var-get global-reward-per-token))
)

(define-private (calculate-boost-multiplier (ve-balance uint) (lp-tokens uint))
  (let (
    (boost-factor (if (> lp-tokens u0) (/ ve-balance lp-tokens) u0))
  )
    (min (+ u1 (/ boost-factor u4)) u250) ;; Max 2.5x boost
  )
)

(define-private (calculate-mining-rewards (user principal))
  (match (map-get? liquidity-positions user)
    position (let (
      (lp-tokens (get lp-tokens position))
      (boost (get boost-multiplier position))
      (reward-per-token-diff (- (var-get global-reward-per-token) (get rewards-per-token-paid position)))
    )
      (/ (* lp-tokens reward-per-token-diff boost) u100)
    )
    u0
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

(define-read-only (get-stake-info (user principal))
  (map-get? stakes user)
)

(define-read-only (get-ve-token-balance (user principal))
  (match (map-get? stakes user)
    stake-info (get ve-tokens stake-info)
    u0
  )
)

(define-read-only (get-liquidity-position (user principal))
  (map-get? liquidity-positions user)
)

(define-read-only (get-revenue-claim-info (user principal))
  (map-get? revenue-claims user)
)

(define-read-only (get-protocol-stats)
  {
    total-supply: (var-get total-supply),
    total-staked: (var-get total-staked),
    total-ve-tokens: (var-get total-ve-tokens),
    total-liquidity: (var-get total-liquidity-provided),
    revenue-pool: (var-get revenue-pool),
    rewards-distributed: (var-get rewards-distributed)
  }
)

(define-read-only (calculate-staking-apy (lock-period uint))
  (let (
    (multiplier (calculate-lock-multiplier lock-period))
    (base-apy BASE-REWARD-RATE)
  )
    (* base-apy multiplier)
  )
)