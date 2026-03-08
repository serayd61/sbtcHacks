;; governance-token.clar
;; SIP-010 Governance Token for sBTC Options Vault Protocol
;;
;; Distribution:
;; - Depositors claim tokens proportional to vault shares
;; - 1 sBTC deposited = 1000 GOV tokens (via MINT-MULTIPLIER)
;; - Max supply: 100,000,000 GOV (6 decimals)
;;
;; Usage:
;; - Vote on protocol parameters via governance-voting contract
;; - Voting weight = token balance at time of vote

(impl-trait .sip-010-trait.sip-010-trait)

;; ============================================
;; Constants
;; ============================================
(define-constant CONTRACT-OWNER tx-sender)
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u100000000000000) ;; 100M with 6 decimals
;; 1 vault share (8 dec) * 10 = GOV tokens (6 dec)
;; 1 sBTC deposit at 1:1 = 100000000 shares -> 1000000000 GOV raw = 1000 GOV
(define-constant MINT-MULTIPLIER u10)

;; Errors
(define-constant ERR-NOT-AUTHORIZED (err u7000))
(define-constant ERR-MAX-SUPPLY-REACHED (err u7001))
(define-constant ERR-INSUFFICIENT-BALANCE (err u7002))
(define-constant ERR-ZERO-AMOUNT (err u7003))
(define-constant ERR-NOTHING-TO-CLAIM (err u7004))
(define-constant ERR-SENDER-NOT-TX (err u7005))

;; ============================================
;; State
;; ============================================
(define-fungible-token svgov MAX-SUPPLY)

(define-data-var token-uri (optional (string-utf8 256)) (some u"https://sbtcoptions.xyz/gov"))
(define-data-var mint-enabled bool true)
(define-data-var voting-contract principal CONTRACT-OWNER)

;; Track how many GOV tokens each user has already claimed
(define-map claimed-gov principal uint)

;; ============================================
;; SIP-010 Implementation
;; ============================================

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-SENDER-NOT-TX)
    (try! (ft-transfer? svgov amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok "sVault Governance")
)

(define-read-only (get-symbol)
  (ok "sVGOV")
)

(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance svgov account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply svgov))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; ============================================
;; Governance Token Claim
;; ============================================

;; Users claim GOV tokens based on their vault shares
;; entitled = vault_shares * MINT-MULTIPLIER
;; mintable = entitled - already_claimed
(define-public (claim-governance-tokens)
  (let (
    (user tx-sender)
    (vault-shares (contract-call? .vault-data-v1 get-user-shares user))
    (entitled (* vault-shares MINT-MULTIPLIER))
    (already-claimed (default-to u0 (map-get? claimed-gov user)))
  )
    (asserts! (var-get mint-enabled) ERR-NOT-AUTHORIZED)
    (asserts! (> entitled already-claimed) ERR-NOTHING-TO-CLAIM)

    (let (
      (mintable (- entitled already-claimed))
      (current-supply (ft-get-supply svgov))
    )
      ;; Cap at max supply
      (asserts! (< current-supply MAX-SUPPLY) ERR-MAX-SUPPLY-REACHED)

      (let (
        (safe-mint (if (> (+ current-supply mintable) MAX-SUPPLY)
          (- MAX-SUPPLY current-supply)
          mintable
        ))
      )
        (try! (ft-mint? svgov safe-mint user))
        (map-set claimed-gov user (+ already-claimed safe-mint))

        (print {
          event: "gov-tokens-claimed",
          user: user,
          amount: safe-mint,
          total-entitled: entitled,
          total-claimed: (+ already-claimed safe-mint)
        })

        (ok safe-mint)
      )
    )
  )
)

;; ============================================
;; Admin Functions
;; ============================================

;; Admin mint (for initial distribution, airdrops, etc.)
(define-public (admin-mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (<= (+ (ft-get-supply svgov) amount) MAX-SUPPLY) ERR-MAX-SUPPLY-REACHED)
    (ft-mint? svgov amount recipient)
  )
)

;; Toggle minting
(define-public (set-mint-enabled (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set mint-enabled enabled)
    (ok true)
  )
)

;; Set voting contract (authorized to read balances for quorum)
(define-public (set-voting-contract (addr principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set voting-contract addr)
    (ok true)
  )
)

;; Update token URI
(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set token-uri new-uri)
    (ok true)
  )
)

;; ============================================
;; Read-only Functions
;; ============================================

(define-read-only (get-entitled-gov (user principal))
  (let (
    (vault-shares (contract-call? .vault-data-v1 get-user-shares user))
    (entitled (* vault-shares MINT-MULTIPLIER))
    (already-claimed (default-to u0 (map-get? claimed-gov user)))
  )
    {
      entitled: entitled,
      claimed: already-claimed,
      claimable: (if (> entitled already-claimed) (- entitled already-claimed) u0)
    }
  )
)

(define-read-only (get-claimed (user principal))
  (default-to u0 (map-get? claimed-gov user))
)

(define-read-only (get-mint-enabled)
  (var-get mint-enabled)
)

(define-read-only (get-voting-contract)
  (var-get voting-contract)
)

(define-read-only (get-token-info)
  (ok {
    name: "sVault Governance",
    symbol: "sVGOV",
    decimals: TOKEN-DECIMALS,
    total-supply: (ft-get-supply svgov),
    max-supply: MAX-SUPPLY,
    mint-enabled: (var-get mint-enabled)
  })
)
