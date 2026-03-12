# CLAUDE.md — sBTC Options Vault

## Proje Ozeti

sBTC Options Vault, Bitcoin sahiplerinin otomatik covered call opsiyonlari araciligiyla yield elde etmesini saglayan, Stacks mainnet uzerinde canlida calisan bir DeFi protokoludur. Ethereum'daki Ribbon Finance ve Solana'daki Friktion'dan ilham alinmistir. BUIDL BATTLE #2 (Most Innovative Use of sBTC) icin gelistirilmistir.

**Canli URL:** https://sbtc-options-vault.vercel.app
**Deployer:** `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W`
**User Address:** `SP147BWQNN0HEJYV4XWSD95C43T804Y7G3X9N86PX`

## Kullanici Tercihleri

- Kullanici Turkce konusur, tum yanıtlar Turkce olmali
- Otomatik commit YAPILMAMALI — kullanici commitleri kendisi yapar
- Deployer key asla paylasilmamali

## Kritik Teknik Bilgi — Stacks Nakamoto

**ONEMLI:** Stacks Nakamoto upgrade sonrasi Clarity'deki `block-height` artik `tenure_height` (~234K) dondurur, eski `stacks_tip_height` (~7M) degil. Bu nedenle:
- Epoch 1'in expiry blogu (#939,950) tenure_height ile ASLA ulasilamaz
- Tum yeni epochlar `tenure_height` bazinda hesaplanmali
- `v2/info` API'den `tenure_height` alanini kullan
- Contractlar `block-height` kontrolu yapar = `tenure_height`

## Proje Yapisi

```
sbtcHacks/
├── contracts/              # 14 Clarity smart contract
├── frontend/               # Next.js 16 / React 19 / Tailwind 4
│   ├── app/                # App Router sayfalari
│   │   ├── page.tsx        # Ana dashboard
│   │   ├── market/         # Options market
│   │   ├── governance/     # Yonetisim
│   │   ├── admin/          # Admin paneli
│   │   ├── api/cron/keeper/# Vercel cron endpoint
│   │   ├── opengraph-image.tsx
│   │   ├── twitter-image.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   ├── components/         # React bileşenleri (12 adet)
│   ├── lib/                # Yardimci moduller
│   └── public/             # Statik dosyalar
├── keeper/                 # Keeper bot (TypeScript)
│   ├── index.ts            # Ana giris noktasi (3 servis)
│   ├── config.ts           # Bot konfigurasyonu
│   ├── tx-sender.ts        # TX broadcaster + nonce tracking
│   ├── price-submitter.ts  # Oracle fiyat gonderici
│   ├── epoch-manager.ts    # Epoch yasam dongusu
│   ├── monitor.ts          # Saglik izleme
│   ├── pricing.ts          # Black-Scholes fiyatlama
│   ├── clarity-parser.ts   # Clarity hex parser
│   ├── key-utils.ts        # Private key cozumleme
│   └── emergency-restart.ts # Acil kurtarma araci
├── tests/                  # 22 birim testi (Vitest)
├── video/                  # Remotion pitch videosu
├── vercel.json             # Cron zamanlama
└── Clarinet.toml           # Clarinet proje config
```

## Smart Contractlar (14 Adet)

Tumu `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W` adresinde deploy edilmis.

### V1 Contractlar
| Contract | Dosya | Aciklama |
|----------|-------|----------|
| `sip-010-trait` | sip-010-trait.clar | Token standart arayuzu |
| `mock-sbtc` | mock-sbtc.clar | Mock sBTC token (SIP-010), faucet 1 sBTC |
| `price-oracle` | price-oracle.clar | V1 Oracle, 6 decimal USD, 12 blok staleness |
| `sbtc-options-vault` | sbtc-options-vault.clar | V1 Core vault (350 satir) |
| `options-market` | options-market.clar | V1 Marketplace (220+ satir) |

### V2 Contractlar (Aktif)
| Contract | Dosya | Aciklama |
|----------|-------|----------|
| `vault-data-v1` | vault-data-v1.clar | V2 Data storage layer |
| `price-oracle-v2` | price-oracle-v2.clar | V2 Oracle (gelistirilmis) |
| `vault-logic-v2` | vault-logic-v2.clar | V2 Core vault (refactored) |
| `options-market-v2` | options-market-v2.clar | V2 Marketplace |

### Governance & Gelecek
| Contract | Dosya | Durum |
|----------|-------|-------|
| `admin-multisig` | admin-multisig.clar | Deploy edildi |
| `insurance-fund` | insurance-fund.clar | Hazirlandi |
| `governance-token` | governance-token.clar | Hazirlandi |
| `governance-voting` | governance-voting.clar | Hazirlandi |
| `vault-strategy-v1` | vault-strategy-v1.clar | Hazirlandi |

### Onemli Contract Fonksiyonlari

```clarity
;; vault-logic-v2
(set-vault-paused (paused bool))              ;; owner-only, vault duraklat
(emergency-settle (token <sip-010>, epoch-id uint, settlement-price uint))  ;; owner-only, expiry kontrolu YOK
(start-epoch (strike-price uint, premium uint, duration uint))              ;; owner-only, yeni epoch
(settle-epoch-with-oracle (token <sip-010>, epoch-id uint))                 ;; oracle fiyatiyla settle
(deposit (token <sip-010>, amount uint))      ;; kullanici deposit
(withdraw (token <sip-010>, shares uint))     ;; kullanici withdraw

;; options-market-v2
(create-listing (epoch-id uint, strike uint, premium uint, collateral uint, expiry uint))  ;; owner-only
(buy-option (token <sip-010>, listing-id uint))    ;; alici premium oder
(claim-payout (token <sip-010>, listing-id uint))  ;; ITM alici payout alir

;; price-oracle-v2
(set-btc-price (price uint))                  ;; admin-only, 6 decimal USD
(get-btc-price)                                ;; staleness kontrollu
(get-btc-price-unchecked)                      ;; kontrolsuz
(get-oracle-info)                              ;; tam durum

;; mock-sbtc
(faucet)                                       ;; herkes 1 sBTC mint edebilir
(mint (amount uint, recipient principal))      ;; admin-only
```

### Sabitler
- `PRECISION`: 8 decimal (satoshi)
- `PRICE-PRECISION`: 6 decimal (USD * 1,000,000)
- `MANAGEMENT-FEE-BPS`: 200 (2%)
- `PERFORMANCE-FEE-BPS`: 1000 (10%)
- `STALENESS-LIMIT`: 12 blok (~2 saat)
- `FAUCET-AMOUNT`: 100,000,000 sats (1 sBTC)

## Frontend

### Tech Stack
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- @stacks/connect ^8.2.5
- @stacks/transactions ^7.3.1
- @stacks/network ^7.3.1

### Onemli Dosyalar

**`frontend/lib/stacks-config.ts`** — Contract adresleri ve format yardimcilari
```typescript
DEPLOYER_ADDRESS = "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W"
CONTRACTS = {
  MOCK_SBTC: "mock-sbtc",
  VAULT_DATA: "vault-data-v1",
  VAULT: "vault-logic-v2",
  MARKET: "options-market-v2",
  ORACLE: "price-oracle-v2",
  MULTISIG: "admin-multisig",
}
SBTC_DECIMALS = 8, PRICE_DECIMALS = 6, ONE_SBTC = 100_000_000
formatSBTC(sats) → string    // Satoshi → BTC
formatUSD(priceRaw) → string // Raw → $ format
parseSBTC(amount) → number   // BTC string → satoshi
```

**`frontend/lib/types.ts`** — TypeScript arayuzleri
```typescript
VaultInfo { totalShares, totalSbtcDeposited, currentEpochId, activeEpoch, vaultPaused, sharePrice, totalPremiumsEarned, totalEpochsCompleted, totalFeesCollected }
UserInfo { shares, sbtcValue, sharePrice }
Epoch { strikePrice, premium, collateral, startBlock, expiryBlock, settled, settlementPrice, premiumEarned, payout, outcome }
Listing { epochId, strikePrice, premium, collateral, expiryBlock, sold, buyer, createdBlock, claimed }
OracleInfo { price, lastUpdateBlock, currentRound, currentBlock, isStale, submitterCount, oraclePaused, stalenessLimit, toleranceBps }
```

**`frontend/lib/vault-calls.ts`** — Contract etkilesim katmani
- `readOnly(contract, fn, args)` — Hiro API uzerinden read-only cagri
- `getVaultInfo()` — Vault TVL, shares, epoch durumu (cached)
- `getUserInfo(address)` — Kullanici paylar ve sBTC degeri (5s TTL)
- `getEpoch(epochId)` — Epoch detaylari
- Cache ve request deduplication uygulanmis

**`frontend/lib/hiro-api.ts`** — Hiro API yardimcilari
**`frontend/lib/cache.ts`** — Response caching
**`frontend/lib/block-time.ts`** — Blok zamani hesaplamalari
**`frontend/lib/retry.ts`** — Retry mantigi

### Bilesenler (12 adet)
| Bilesen | Dosya | Aciklama |
|---------|-------|----------|
| AdminPanel | AdminPanel.tsx | Admin kontrolleri (epoch, fiyat) |
| VaultDashboard | VaultDashboard.tsx | Ana vault istatistikleri |
| DepositWithdraw | DepositWithdraw.tsx | Deposit/withdraw formlari |
| BuyOption | BuyOption.tsx | Opsiyon alici arayuzu |
| UserOptions | UserOptions.tsx | Kullanicinin opsiyonlari |
| EpochHistory | EpochHistory.tsx | Gecmis epoch sonuclari |
| PerformanceChart | PerformanceChart.tsx | Vault performans grafigi |
| TransactionHistory | TransactionHistory.tsx | Islem gecmisi |
| FaucetButton | FaucetButton.tsx | Test sBTC mint |
| NetworkStatus | NetworkStatus.tsx | Ag durumu |
| Toast | Toast.tsx | Bildirim sistemi |
| RiskDisclaimer | RiskDisclaimer.tsx | Risk uyarilari |

### Layout Bileşenleri (`components/layout/`)
- `ClientLayout.tsx` — Client wrapper
- `Providers.tsx` — Wallet + state providers
- `Header.tsx` — Header + navigasyon
- `Footer.tsx` — Footer

### SEO & Meta
- `app/layout.tsx` — metadataBase, title template, keywords, Twitter cards, JSON-LD
- `app/opengraph-image.tsx` — Dinamik 1200x630 OG gorsel (edge runtime)
- `app/twitter-image.tsx` — Twitter Card gorseli
- `app/robots.ts` — robots.txt (disallow /admin, /api/)
- `app/sitemap.ts` — sitemap.xml (3 sayfa)
- `public/manifest.json` — PWA manifest (theme_color: #f97316)
- `app/market/layout.tsx` — Market sayfa metadatasi
- `app/governance/layout.tsx` — Governance sayfa metadatasi

### Next.js Config (`next.config.ts`)
- `transpilePackages`: @stacks/connect, transactions, network, common
- Guvenlik headerlari: CSP, X-Frame-Options DENY, HSTS, Permissions-Policy
- Webpack fallbacks: crypto, stream, fs, path vb. = false (client)
- Buffer/process polyfills

### Environment Variables (Frontend)
```
NEXT_PUBLIC_NETWORK=testnet       # Testnet icin, yoksa mainnet
NEXT_PUBLIC_DEPLOYER_ADDRESS=...  # Default: SP387HJN...
KEEPER_PRIVATE_KEY=...            # Cron keeper icin
CRON_SECRET=...                   # Vercel cron auth
```

## Keeper Bot

### Genel Bakis
3 servis tek process'te calisan otomasyon botu:
1. **Price Oracle Submitter** — 3 kaynaktan BTC/USD, median hesapla, on-chain gonder
2. **Epoch Manager** — Epoch expiry izle, auto-settle, yeni epoch baslat + listing olustur
3. **Health Monitor** — TVL, oracle staleness, wallet bakiyesi kontrol

### Zamanlamalar
| Servis | Aralik | Aciklama |
|--------|--------|----------|
| Price Update | 10 dk | CoinGecko + Binance + Kraken medyani |
| Epoch Check | 5 dk | Expiry kontrol, settle/start |
| Health Check | 5 dk | TVL, oracle, bakiye izleme |
| Stagger | 30 sn | Servisler arasi bekleme |

### Config (`keeper/config.ts`)
```typescript
network: "mainnet"
stacksApiUrl: "https://api.mainnet.hiro.so"
deployerAddress: "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W"

contracts: {
  priceOracleV2: "price-oracle-v2",
  vaultLogicV2: "vault-logic-v2",
  vaultDataV1: "vault-data-v1",
  optionsMarketV2: "options-market-v2",
  mockSbtc: "mock-sbtc",
}

oracle: {
  updateIntervalMs: 600_000,  // 10 dk
  priceSources: ["coingecko", "binance", "kraken"],
  toleranceBps: 200,          // 2% max sapma
  staleAfterBlocks: 12,       // ~2 saat
}

epoch: {
  strikeOtmPercent: 5,            // 5% OTM
  defaultDurationBlocks: 1008,    // ~7 gun
  cooldownBlocks: 6,              // ~1 saat
  autoSettle: true,
  autoStartNew: true,
}

pricing: {
  defaultIV: 0.8,       // 80% implied volatility
  riskFreeRate: 0.05,    // 5% yillik
}

monitoring: {
  tvlDropAlertPercent: 10,
  oracleStaleAlertBlocks: 8,
  keeperWalletMinStx: 10_000_000,  // 10 STX
}
```

### Fiyat Kaynaklari
```
CoinGecko: https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
Binance:   https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT
Kraken:    https://api.kraken.com/0/public/Ticker?pair=XBTUSD
```

### Price Submitter (`price-submitter.ts`)
- `fetchAllPrices()` — 3 kaynak paralel (Promise.allSettled), 10s timeout
- `calculateMedianPrice()` — En az 2 gecerli kaynak gerekli, median hesapla
- `priceToOnChain(usd)` — USD → 6 decimal bigint ($85,000.50 → 85000500000n)
- `isPriceDeviationSignificant()` — %2 tolerans kontrolu
- `submitPriceOnChain()` → `price-oracle-v2.set-btc-price(price uint)` (admin fonksiyonu)
- Gecerli fiyat araliği: $1,000 - $1,000,000

### Epoch Manager (`epoch-manager.ts`)
- `getVaultState()` — Vault durumu oku (tenure_height kullanir!)
- `getEpochDetails(epochId)` — Epoch detaylarini oku
- `calculateStrikePrice(currentPriceUsd)` — Strike = spot * 1.05
- `settleExpiredEpoch(epochId)` → `vault-logic-v2.settle-epoch-with-oracle(token, epoch-id)`
- `startNewEpoch(strike, premium, duration)` → `vault-logic-v2.start-epoch(...)`
- `createListingOnMarket(...)` → `options-market-v2.create-listing(...)`
- Akis: expire kontrol → settle → start new → create listing

### Pricing (`pricing.ts`) — Black-Scholes Model
- `normalCDF(x)` — Abramowitz-Stegun yaklasimi (hata < 1.5e-7)
- `blackScholesCall(S, K, T, r, sigma)` — Call opsiyon fiyati (USD)
- `calculateCallPremium(spotUsd, strikeUsd, durationBlocks, collateralSats, iv?)` → bigint (satoshi)
  - Blok → yil donusumu: 10 dk/blok
  - Minimum premium: %0.1 collateral
- `formatPricingInfo()` — Log icin fiyatlama ozeti

### TX Sender (`tx-sender.ts`) — Paylasimli TX Yayinci
- `getNextNonce()` — Global nonce takibi (ilk cagri API'den, sonrakiler increment)
- `resetNonceTracker()` — Her cycle basinda sifirla
- `broadcastTx(txOptions)` → txId (nonce otomatik yonetilir)
- `requirePrivateKey()` — Key yoksa hata firla
- Tum keeper servisleri bu modul uzerinden TX yapar

### Key Utils (`key-utils.ts`)
- 64-char hex (raw key), 66-char hex (compressed + 01), 12/24-word mnemonic, 0x prefix destegi
- `resolvePrivateKey()` — KEEPER_PRIVATE_KEY'i cozumle
- Mnemonic icin `generateWallet()` kullanir

### Clarity Parser (`clarity-parser.ts`)
- `parseClarityHex(hex)` — Clarity hex → JS degerleri
- Desteklenen tipler: uint, int, bool, string-ascii, string-utf8, buffer, tuple, list, principal, some/none, ok/err
- C32 address encoding (SP/ST prefix)
- Tipli parserlar: `parseVaultInfo()`, `parseEpochInfo()`, `parseOracleInfo()`

### Monitor (`monitor.ts`)
- `checkOracleHealth()` — Oracle staleness, submitter sayisi, $0 fiyat kontrolu
- `checkVaultHealth()` — TVL degisimi (%10+ dusus uyarisi), pause durumu, share fiyat anomalisi
- `checkKeeperBalance()` — STX bakiyesi (min 10 STX)
- `checkNetworkStatus()` — Stacks/Tenure/BTC yukseklik
- `checkInsuranceFund()` — Sigorta fonu bakiyesi
- Alert dedup: 30 dk icinde ayni alert tekrarlanmaz
- Webhook: Discord/Telegram (KEEPER_WEBHOOK_URL)

### Emergency Restart (`emergency-restart.ts`)
Epoch 1'in takilmasini cozmek icin 5 adimli kurtarma scripti:
1. `set-vault-paused(true)` — Vault duraklat
2. `emergency-settle(mock-sbtc, epoch-id, settlement-price)` — Expiry kontrolsuz settle
3. `set-vault-paused(false)` — Vault devam et
4. `start-epoch(strike, premium, duration)` — Yeni epoch baslat
5. `create-listing(epoch-id, strike, premium, collateral, expiry)` — Market listing

```bash
# DRY RUN (guvenlI):
cd keeper && KEEPER_PRIVATE_KEY="hex-key" npx tsx emergency-restart.ts

# CANLI:
cd keeper && KEEPER_PRIVATE_KEY="hex-key" npx tsx emergency-restart.ts --execute
```

### Environment Variables (Keeper)
```
KEEPER_PRIVATE_KEY   # Hex key veya mnemonic (opsiyonel, yoksa dry-run)
KEEPER_ADDRESS       # Keeper wallet adresi (bakiye izleme)
KEEPER_WEBHOOK_URL   # Discord/Telegram webhook
```

## Vercel Cron Endpoint

**`frontend/app/api/cron/keeper/route.ts`** — Stateless keeper endpoint
- Her 10 dakikada Vercel tarafindan cagirilir (`vercel.json`)
- `CRON_SECRET` ile korunur (Bearer token)
- Rate limit: dakikada maks 6 istek
- Concurrent execution kilidi
- Akis: Fiyat getir → Oracle guncelle → Vault durumu oku → Epoch yonet
- `maxDuration = 60` (Pro plan)
- Hata mesajlari sanitize edilir (private key leak onleme)

## Komutlar

### Frontend
```bash
cd frontend
npm run dev          # Development server
npm run build        # Production build (webpack)
npm run start        # Production server
npm run lint         # ESLint
```

### Keeper Bot
```bash
cd keeper
npm install          # Bagimliliklari kur
KEEPER_PRIVATE_KEY=... npx tsx keeper/index.ts      # Tam bot (root'tan)
npx tsx index.ts                                      # Tam bot (keeper/ icinden)
npx tsx price-submitter.ts                            # Sadece fiyat
npx tsx epoch-manager.ts                              # Sadece epoch
npx tsx monitor.ts                                    # Sadece izleme
npx tsx emergency-restart.ts                          # Acil DRY RUN
npx tsx emergency-restart.ts --execute                # Acil CANLI
```

### Testler
```bash
# Root dizinden:
npm test             # Vitest calistir (22 test)
npm run test:watch   # Dosya degisikliklerini izle
npm run test:report  # Coverage raporu
```

### Contractlar
```bash
clarinet check                    # Syntax kontrolu
node deploy-mainnet.mjs           # Mainnet deploy
node deploy-testnet.mjs           # Testnet deploy
```

## Test Kapsami (22 Test)

| Grup | Test Sayisi | Kapsamlar |
|------|-------------|-----------|
| Mock sBTC Token | 4 | Transfer, mint, bakiye, yetkisiz ret |
| Price Oracle | 4 | Fiyat set, staleness, gecmis, erisim kontrolu |
| Deposit & Withdraw | 5 | Share mint, oranli hesaplama, pro-rata withdraw, sifir ret |
| Epoch Lifecycle | 2 | OTM akis (kar), ITM akis (alici payout) |
| Access Control | 4 | Yetkisiz epoch/settle/pause/market ret |
| Options Market | 3 | Listing olustur, opsiyon al, premium yonlendirme |

**Framework:** Vitest + Clarinet SDK + vitest-environment-clarinet

## Guvenlik Bulgulari (SECURITY-V3-REQUIRED.md)

### Kritik
- **C-1:** Sahte token ile ucretsiz share mint
- **C-2:** Kisitlamasiz transfer-payout (rug pull riski)
- **C-3:** Manuel fiyat kabuluyle epoch manipulasyonu
- **C-6:** Emergency settle zorunlu OTM (ITM alici kaybi)

### Yuksek
- **H-1:** Multisig execute fonksiyonu yok
- **H-3:** Oracle price walking
- **H-4:** Admin tolerans bypass
- **H-5:** Median hesaplama yok
- **H-7:** Division-by-zero riski
- **H-8:** Son withdrawer underflow

**Durum:** V3 deployment icin belirlendi, canlidaki contractlarda henuz duzeltilmedi.

## Gelistirme Gecmisi (5 Ajan Plani)

| Ajan | Gorev | Durum |
|------|-------|-------|
| 1 - Security | Guvenlik sertlestirme (CSP, rate limit, input validation) | Tamamlandi |
| 2 - UI/UX | Kapsamli UI/UX iyilestirmeleri | Tamamlandi |
| 3 - Frontend | Request dedup, paralel batch, race condition onleme | Tamamlandi |
| 4 - Keeper | Keeper bot (fiyat, epoch, monitor, emergency-restart) | Tamamlandi |
| 5 - Marketing | SEO, OG image, Twitter card, robots.txt, sitemap, PWA | Tamamlandi |

## Bilinen Sorunlar & Cozumleri

### COZULDU: Vercel Cron Settle Spam (Mart 2026)
**Sorun:** Vercel cron endpoint (`/api/cron/keeper`) her 10 dakikada `settle-epoch-with-oracle` TX gonderiyordu, epoch henuz expire olmamis olsa bile. 829 TX gonderildi, buyuk cogunlugu `err u3006` (EPOCH-NOT-EXPIRED) ile basarisiz. ~7+ STX bosa harcandi.

**Root Cause:** `cvToJSON` (from `@stacks/transactions`) parsing tutarsizligi — `(some (tuple ...))` donus formati farkli versiyonlarda degisebiliyor:
- Format A: `{ value: { value: { fields... } } }` (ok/some wrapped tuple)
- Format B: `{ value: { fields... } }` (directly unwrapped)
Eski kod sadece bir formati destekliyordu, diger formatta `settled` veya `expiryBlock` yanlis okunuyordu.

**Hata Kodlari:**
- `err u3006` = `ERR-EPOCH-NOT-EXPIRED` — tenure_height < expiry_block (epoch bitmedi)
- `err u3013` = `ERR-INVALID-SETTLEMENT-PRICE` — oracle fiyati 0 veya gecersiz

**Cozum:** (`frontend/app/api/cron/keeper/route.ts`)
1. Defansif epoch parsing — her iki cvToJSON formatini destekler
2. `Number()` ile karsilastirma (BigInt edge case onleme)
3. `expiryBlock > 0n` ek kontrolu
4. Parse hatasinda TX gondermeden skip (hata logla, devam et)
5. Her calisistirmada detayli log: `expiry=#X | tenure=#Y | remaining=Z blocks`
6. Settle TX SADECE `Number(tenureHeight) >= Number(expiryBlock)` ise gonderilir

**Ders:** `cvToJSON` ciktisina guvenmeden once her zaman defansif parsing yap. Contract hata kodlarini (u3006 vb.) izle — tekrarlanan hatalar otomasyon buglarini gosterir.

### COZULDU: Epoch 1 Sonsuza Kadar Takili (Nakamoto Upgrade)
**Sorun:** Epoch 1 baslatildiginda Clarity `block-height` eski `stacks_tip_height` (~938K) donduruyordu. Nakamoto upgrade sonrasi `block-height` = `tenure_height` (~234K) oldu. Epoch 1'in expiry blogu #939,950 — tenure_height ile ASLA ulasilamaz.

**Cozum:** `emergency-settle` fonksiyonu kullanildi (expiry kontrolu yok, owner-only, vault paused olmali). Yeni epochlar tenure_height bazinda hesaplaniyor.

## Onemli Notlar

1. **block-height = tenure_height**: Post-Nakamoto, Clarity contractlari tenure_height (~234K) gorur, stacks_tip_height (~7M) degil
2. **Nonce Siralama**: Birden fazla TX gonderirken sequential nonce kullan (tx-sender modulu bunu otomatik yapar)
3. **Oracle Fonksiyonu**: `set-btc-price` admin fonksiyonudur (deployer key gerekir), `submit-price` degil
4. **DRY RUN**: KEEPER_PRIVATE_KEY olmadan tum servisler observation modunda calisir
5. **Fiyat Donusumleri**: USD fiyatlar 6 decimal (1 USD = 1,000,000), sBTC 8 decimal (1 BTC = 100,000,000 sats)
6. **Minimum Kaynaklar**: Fiyat guncellemesi icin en az 2/3 kaynaktan gecerli fiyat gerekli
7. **cvToJSON Dikkat**: `@stacks/transactions` cvToJSON ciktisi versiyon ve tip (`ok`/`some`/`tuple`) bazinda degisebilir — her zaman defansif parsing kullan, `?.` ile field kontrol et

## Dosya Boyutlari (Referans)

### Frontend Components
- AdminPanel.tsx (13.1 KB), BuyOption.tsx (13.0 KB), DepositWithdraw.tsx (11.9 KB)
- VaultDashboard.tsx (12.8 KB), UserOptions.tsx (12.0 KB), PerformanceChart.tsx (9.2 KB)
- EpochHistory.tsx (8.3 KB), TransactionHistory.tsx (6.6 KB)
- Toast.tsx (4.9 KB), RiskDisclaimer.tsx (4.9 KB), NetworkStatus.tsx (4.0 KB)
- FaucetButton.tsx (2.1 KB)

### Frontend Lib
- vault-calls.ts (15.1 KB), hiro-api.ts (3.6 KB), block-time.ts (2.8 KB)
- stacks-config.ts (2.3 KB), cache.ts (1.8 KB), types.ts (1.2 KB), retry.ts (0.7 KB)

### Keeper Modules
- emergency-restart.ts (13.7 KB), epoch-manager.ts (12.5 KB)
- price-submitter.ts (10.3 KB), monitor.ts (10.3 KB), clarity-parser.ts (9.1 KB)
- index.ts (4.8 KB), pricing.ts (4.2 KB), tx-sender.ts (3.7 KB)
- key-utils.ts (2.4 KB), config.ts (1.8 KB)

## Aktif Plan: V4 Market + 100 Wallet (Mart 2026)

### Sorun
1. Vercel cron her 10dk settle-epoch-with-oracle TX gonderiyor, hepsi `err u3006` ile basarisiz (STX israfi)
2. Epoch 2 aktif: start=234494, expiry=235502, ~900 blok kaldi
3. options-market-v3 sadece 10 listing/epoch destekliyor, 100 wallet gerekiyor

### Mevcut On-Chain Durum
- Epoch #2 aktif, settled=false, TVL=1.55 BTC, strike=$74,527
- Vault paused=false, tenure_height ~234,602
- Aktif market: options-market-v3 (MAX-LISTINGS u10)
- Epoch 2'de alici YOK (v3 TX gecmisi bos)

### Plan Adimlari

**Adim 1: Cron Spam Durdur (ACIL)**
- Vercel'den CRON_SECRET gecici degistir/sil → 401 donecek, TX duracak

**Adim 2: Epoch 2 Kapat (Emergency Settle)**
- `set-vault-paused(true)` → `emergency-settle(mock-sbtc, u2, price)` → `set-vault-paused(false)`
- OTM zorlar (payout=0), alici olmadigindan risk yok

**Adim 3: options-market-v4.clar Olustur**
- v3'u baz al, MAX-LISTINGS-PER-EPOCH u10 → u100
- `batch-create-listings` fonksiyonu ekle (fold ile tek TX'te 100 listing)
- Tekli `create-listing` korunur (geriye uyumluluk)
- buy-option, claim-payout, expire-unsold aynen kopyalanir

**Adim 4: Clarinet.toml + deploy-mainnet.mjs Guncelle**
- Clarinet.toml'a options-market-v4 ekle
- CONTRACTS dizisine "options-market-v4" ekle
- `clarinet check` ile dogrula

**Adim 5: Cron Endpoint Guncelle (route.ts)**
- CONTRACTS.market: "options-market-v3" → "options-market-v4"
- listingsPerEpoch: 10 → 100
- startNewEpochAndListing: 10 tekli TX → 1 batch-create-listings TX
- Toplam: 11 TX → 2 TX (start-epoch + batch-create)

**Adim 6: Frontend + Keeper Guncelle**
- stacks-config.ts: MARKET → "options-market-v4"
- vault-calls.ts: PARALLEL_CHUNK_SIZE 5→20
- keeper/config.ts: optionsMarketV4
- keeper/epoch-manager.ts: batch listing
- keeper/emergency-restart.ts: v4 referansi

**Adim 7: Deploy ve Aktiflesir**
1. `node deploy-mainnet.mjs` → options-market-v4 deploy
2. `vault-logic-v2.set-market-contract(options-market-v4)` TX
3. Emergency settle epoch 2
4. Vercel deploy
5. CRON_SECRET geri koy
6. Yeni epoch otomatik baslar (7 gun, 100 listing)

### Kritik Dosyalar
- `contracts/options-market-v4.clar` (YENI)
- `contracts/options-market-v3.clar` (sablon)
- `frontend/app/api/cron/keeper/route.ts`
- `frontend/lib/stacks-config.ts`
- `deploy-mainnet.mjs`
- `Clarinet.toml`
- `keeper/config.ts`
- `keeper/epoch-manager.ts`

### Riskler
- fold gas limiti: 100 iterasyon takilabilir → 50'ye indir, 2 TX gonder
- v3 claim: set-market-contract(v4) sonrasi v3 unclaimed payoutlar etkilenebilir (epoch 2'de alici yok, risk dusuk)
- listing-count: v4 yeni contrat, 0'dan baslar
