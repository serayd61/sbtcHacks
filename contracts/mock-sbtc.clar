;; mock-sbtc.clar
;; Mock sBTC token for testing - SIP-010 compliant
;; Anyone can mint 1 sBTC via faucet for demo purposes

(impl-trait .sip-010-trait.sip-010-trait)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u1000))
(define-constant ERR-INSUFFICIENT-BALANCE (err u1001))
(define-constant MAX-SUPPLY u2100000000000000) ;; 21M sBTC with 8 decimals
(define-constant FAUCET-AMOUNT u100000000) ;; 1 sBTC = 100,000,000 sats

;; Data vars
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://sbtc.tech"))

;; Fungible token definition
(define-fungible-token mock-sbtc MAX-SUPPLY)

;; SIP-010 Functions

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (try! (ft-transfer? mock-sbtc amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok "Mock sBTC")
)

(define-read-only (get-symbol)
  (ok "sBTC")
)

(define-read-only (get-decimals)
  (ok u8)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance mock-sbtc account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply mock-sbtc))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; Faucet - anyone can mint 1 sBTC for testing
(define-public (faucet)
  (ft-mint? mock-sbtc FAUCET-AMOUNT tx-sender)
)

;; Admin mint function
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ft-mint? mock-sbtc amount recipient)
  )
)

;; Admin: set token URI
(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set token-uri new-uri)
    (ok true)
  )
)
