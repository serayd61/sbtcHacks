# sBTC Options Vault — Whitepaper v1.0

**Bitcoin Yield Through Automated Covered Call Options on Stacks**

> *Testnet Phase — Use faucet sBTC to explore the protocol risk-free*

---

## Abstract

sBTC Options Vault, Bitcoin sahiplerinin varliklarini akilli kontratlar araciligiyla covered call opsiyon stratejilerine yatirarak pasif gelir elde etmelerini saglayan, Stacks blockchain uzerinde calisan merkezi olmayan bir DeFi protokoludur. Protokol, Ethereum'daki Ribbon Finance ve Solana'daki Friktion'dan ilham alinarak, bu proven yield stratejisini ilk kez Bitcoin ekosistemine tasimaktadir.

Kullanicilar sBTC yatirarak vault share'leri alir; her 7 gunluk epoch boyunca otomatik olarak olusturulan covered call opsiyonlari, alicilardan toplanan primlerle vault depositorlerine yield saglar. Tum surec on-chain Clarity smart contract'lari tarafindan yonetilir.

**Durum:** Protokol su anda Stacks mainnet uzerinde test asamasindadir. Mock sBTC token (faucet ile ucretsiz mint) kullanilarak gercek risk olmadan deneyimlenebilir.

---

## 1. Problem

Bitcoin, $1.7 trilyon piyasa degeriyle dunyanin en buyuk kripto varligidir. Ancak BTC sahiplerinin buyuk cogunlugu varliklarini sadece "hodl" eder — yield firsatlari sinirlidir:

- **CeFi platformlari** (Celsius, BlockFi) iflas riskleri tasiyor
- **DeFi yield** cogunlukla Ethereum/Solana ekosisteminde, BTC icin sinirli
- **Wrapped BTC** (wBTC) guvensizlik endisleri ve bridge riskleri yaratir
- **Staking** Bitcoin'in PoW yapisinda mumkun degil

Bitcoin sahipleri, varliklarini trustless bir sekilde calistirabilecekleri, seffaf ve on-chain yield mekanizmalarina ihtiyac duymaktadir.

---

## 2. Cozum: sBTC Options Vault

### 2.1 sBTC Nedir?

sBTC, Bitcoin'i Stacks blockchain'ine 1:1 oraninda peg'leyen, tamamen merkeziyetsiz bir tokendir. Bitcoin'in guvenlik garantilerini korurken, Stacks uzerindeki smart contract'larla etkilesime olanak tanir. sBTC, kullanicilarin BTC'lerini bridge etmeden DeFi'ye katilmasini saglar.

### 2.2 Covered Call Stratejisi

Covered call, geleneksel finans duzeniasinda en yaygin ve en guvenli opsiyon stratejilerinden biridir:

```
Senaryo: BTC simdi $84,000

1. Vault depositorleri sBTC yatirir
2. Protokol, $88,200 strike fiyatli (%5 OTM) covered call opsiyonlari olusturur
3. Alicilar opsiyon icin premium (ornegin 0.01 sBTC) oder
4. 7 gun sonra:
   - BTC < $88,200 (OTM): Opsiyon degerini yitirir, vault premium'u kazanir
   - BTC > $88,200 (ITM): Alici fark kadar payout alir, vault yine premium'u kazanir
```

**Neden %5 OTM?** Istatistiksel olarak, BTC'nin 7 gun icinde %5'ten fazla yukariselmesi dusuk olasiliklidir. Bu, vault depositorlerinin cogu epoch'ta premium geliri elde etmesini saglar.

### 2.3 Epoch Dongusu

Protokol 7 gunluk "epoch" donguleriyle calisir:

```
Epoch #N Baslangic (Blok X)
│
├── Strike fiyat hesaplama: Spot * 1.05 (5% OTM)
├── Premium hesaplama: Black-Scholes modeli (IV: %80)
├── 100 adet opsiyon listing'i olusturma (batch TX)
│
├── [7 gun boyunca]
│   ├── Alicilar opsiyonlari satin alir (premium → vault'a)
│   └── Oracle her 10 dk BTC fiyat gunceller
│
├── Epoch Sonu (Blok X + 1008)
│   ├── Oracle fiyatiyla otomatik settlement
│   ├── OTM: Vault tum collateral'i tutar + primler
│   └── ITM: Fark alicilara odenir, vault primleri tutar
│
└── Epoch #N+1 otomatik baslar
```

---

## 3. Teknik Mimari

### 3.1 Smart Contract'lar (Clarity — Stacks)

Protokol 5 ana Clarity smart contract'tan olusur:

| Contract | Gorevi |
|----------|--------|
| **vault-logic-v2** | Ana is mantigi: deposit, withdraw, epoch yonetimi, settlement, fee hesaplama |
| **vault-data-v1** | Veri katmani: share'ler, epoch'lar, TVL — upgrade edilebilir mimari |
| **options-market-v5** | Opsiyon pazari: listing olusturma, satin alma, payout claim, batch islemler |
| **price-oracle-v2** | Coklu kaynakli BTC/USD oracle: staleness kontrolu, tolerans bandi |
| **mock-sbtc** | Test token (SIP-010): faucet ile 1 sBTC mint (test asamasi icin) |

### 3.2 Contract Adresleri (Stacks Mainnet)

```
Deployer: SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W

vault-logic-v2        → Is mantigi
vault-data-v1         → Veri depolama
options-market-v5     → Opsiyon pazari (10K listing/epoch)
price-oracle-v2       → Fiyat oracle'i
mock-sbtc             → Test sBTC token
admin-multisig        → Coklu imza yonetimi
```

### 3.3 Vault Mekanizmasi

```
Deposit:
  Kullanici sBTC yatirir → Share alinir (pro-rata)
  share_amount = (deposit * total_shares) / total_sbtc

Withdraw:
  Share yakılir → sBTC pro-rata iade edilir
  sbtc_amount = (shares * total_sbtc) / total_shares

  Guvenlik: 24 saatlik periyotta maks %25 cekim (flash-drain koruması)

Share Fiyati:
  share_price = total_sbtc / total_shares
  Premium geliri ile share fiyati zamanla yukselir (auto-compound)
```

### 3.4 Options Market v5

Options-market-v5, yuksek hacimli opsiyon ticareti icin optimize edilmis en guncel pazar kontrat'idir:

**Ozellikler:**
- Epoch basina **10,000 listing** kapasitesi
- **Batch listing olusturma:** Tek TX'te 100 listing (fold mekanizmasi)
- **Otomatik premium yonlendirme:** Alici premium'u direkt vault'a iletilir
- **ITM payout claim:** Settlement sonrasi alicilar kazanclarini talep eder
- **Expire-unsold:** Satilmamis listing'ler suresi dolunca temizlenir

**Opsiyon Satin Alma Akisi:**
```
1. Kullanici market sayfasinda mevcut listing'leri goruntuler
2. Uygun bir opsiyon secer (strike, premium, vade)
3. "Buy Option" → Premium (sBTC) wallet'tan odenir
4. Premium otomatik olarak vault'a iletilir (yield olarak)
5. Vade sonunda:
   - ITM: "Claim Payout" ile kazancini alir
   - OTM: Opsiyon degerini yitirir
```

### 3.5 Price Oracle

Coklu kaynakli, manipulasyona direncli fiyat oracle sistemi:

```
Kaynaklar:
├── CoinGecko   ─┐
├── Binance      ├── Median hesaplama (min 2/3 gecerli)
└── Kraken      ─┘

Guvenlik:
├── Tolerans bandi: ±%2 (ani manipulasyon onleme)
├── Staleness limiti: 12 blok (~2 saat)
├── 5 submitter kapasitesi (merkeziyetsizlestirme)
└── $1,000 - $1,000,000 gecerli aralik
```

**Fiyat Formati:** 6 decimal USD (1 USD = 1,000,000 raw unit)
Ornek: $84,500.50 → 84,500,500,000

### 3.6 Data-Logic Ayirimi

Protokol, upgrade edilebilir bir mimari kullanir:

```
vault-data-v1 (Kalici Veri)          vault-logic-v2 (Is Mantigi)
┌────────────────────────┐          ┌────────────────────────┐
│ Maps:                  │◄────────►│ deposit()              │
│  - user-shares         │  read/   │ withdraw()             │
│  - epochs              │  write   │ start-epoch()          │
│                        │          │ settle-epoch()         │
│ Vars:                  │          │ record-option-sale()   │
│  - total-shares        │          │ transfer-payout()      │
│  - total-sbtc          │          │ emergency-settle()     │
│  - current-epoch-id    │          └────────────────────────┘
│  - vault-paused        │
│  - market-contract     │          vault-logic-v3 (Gelecek)
│  - treasury-address    │          ┌────────────────────────┐
│  - withdrawal-queue    │◄────────►│ Yeni ozellikler...     │
└────────────────────────┘          └────────────────────────┘

Avantaj: Logic kontrati degistirildiginde
kullanici bakiyeleri ve epoch gecmisi korunur
```

---

## 4. Fiyatlama Modeli

### 4.1 Black-Scholes

Opsiyon primleri, finans endustrisinin standart fiyatlama modeli olan Black-Scholes formulu ile hesaplanir:

```
C = S * N(d1) - K * e^(-rT) * N(d2)

Burada:
  S = Spot fiyat (BTC/USD)
  K = Strike fiyat (S * 1.05)
  T = Vade suresi (blok → yil donusumu, 10 dk/blok)
  r = Risksiz faiz orani (%5 yillik)
  σ = Implied Volatility (%80 varsayilan)
  N() = Kumulatif normal dagilim (Abramowitz-Stegun yaklasimi)
```

### 4.2 Ornek Hesaplama

```
BTC Spot:    $84,000
Strike:      $88,200 (5% OTM)
Vade:        1008 blok (~7 gun)
IV:          %80
Risksiz:     %5

→ Premium:   ~%1 collateral = ~0.01 sBTC / opsiyon
→ Yillik APY (tum opsiyonlar satilirsa): ~%52 (52 hafta * %1)
```

**Not:** Gercek APY, opsiyon satis oranina ve ITM/OTM sonuclarina baglidir.

---

## 5. Fee Yapisi

| Fee Turu | Oran | Aciklama |
|----------|------|----------|
| Management Fee | %2 | Her epoch sonunda collateral uzerinden |
| Performance Fee | %10 | Kazanilan primler uzerinden |

```
Ornek:
  Collateral:     1.55 sBTC
  Premium kazanc: 0.03 sBTC

  Management fee: 1.55 * 0.02 = 0.031 sBTC
  Performance fee: 0.03 * 0.10 = 0.003 sBTC
  Toplam fee:     0.034 sBTC → Treasury'ye
```

Fee'ler epoch settlement sirasinda otomatik olarak treasury adresine transfer edilir.

---

## 6. Guvenlik

### 6.1 Smart Contract Guvenlikleri

- **Withdrawal rate limiting:** 24 saatte maks %25 cekim (flash loan / drain koruması)
- **Vault pause mekanizmasi:** Acil durumlarda tum islemler durdurulabilir
- **Emergency settlement:** Takilan epoch'lar icin expiry kontrolsuz kapatma (owner-only, vault paused olmali)
- **Oracle staleness kontrolu:** 12 bloktan eski fiyat reddedilir
- **Payout cap:** Payout asla vault bakiyesini asamaz (underflow koruması)
- **Admin multisig:** Coklu imza yonetim kontrati (hazir)
- **Zero-amount validation:** Sifir deposit/withdraw/premium reddedilir
- **Division-by-zero koruması:** Settlement hesaplamalarinda guvenlik kontrolleri

### 6.2 Oracle Guvenligi

- 3 bagimsiz fiyat kaynagi (CoinGecko, Binance, Kraken)
- Median hesaplama (tek kaynak manipulasyonu etkisiz)
- ±%2 tolerans bandi (ani fiyat atlama koruması)
- 5 submitter kapasitesi (daha fazla merkeziyetsizlestirme)

### 6.3 Otomasyon Guvenligi

- Keeper bot dry-run modu (private key olmadan gozlem)
- TX nonce takibi (islem sirasi garantisi)
- Rate limiting (API bombardimani onleme)
- Health monitoring (TVL dusus, oracle staleness, bakiye uyarilari)

---

## 7. Kullanici Rehberi (Test Asamasi)

### 7.1 Baslangic

Protokol su anda **test asamasindadir**. Mock sBTC token kullanilarak gercek risk olmadan tum ozellikleri deneyebilirsiniz.

**Canli URL:** https://sbtc-options-vault.vercel.app

### 7.2 Faucet ile sBTC Alma

1. Stacks wallet'inizi baglayin (Leather veya Xverse)
2. Ana sayfada "Faucet" butonuna tiklayin
3. 1 sBTC (mock) wallet'iniza mint edilir — **tamamen ucretsiz**
4. Birden fazla kez kullanabilirsiniz

### 7.3 Vault'a Deposit

1. Ana sayfada "Deposit" sekmesine gecin
2. Yatirmak istediginiz sBTC miktarini girin
3. "Deposit" butonuyla islemi onaylayin
4. Karsiliginda vault share'leri alin
5. Primler kazanildikca share degeriniz artar

### 7.4 Opsiyon Satin Alma

1. "Options Market" sayfasina gidin
2. Mevcut listing'leri inceleyin:
   - **Strike Price:** Hedef BTC fiyati
   - **Premium:** Opsiyon maliyeti (sBTC)
   - **Collateral:** Kilitli teminat
   - **Expiry:** Vade sonu blogu
3. "Buy Option" ile satin alin
4. Vade sonrasinda:
   - **ITM (BTC > Strike):** "Claim Payout" ile kazancinizi alin
   - **OTM (BTC < Strike):** Opsiyon sona erer, premium vault'a kalir

### 7.5 Withdraw

1. Ana sayfada "Withdraw" sekmesine gecin
2. Cekmek istediginiz share miktarini girin
3. Pro-rata sBTC iade edilir
4. Not: Aktif epoch sirasinda cekim yapilamaz

---

## 8. Keeper Bot & Otomasyon

Protokol, 3 otomatik servisle 7/24 calisir:

### 8.1 Price Oracle Submitter
- Her 10 dakikada 3 kaynaktan BTC/USD fiyat ceker
- Median hesaplar, %2'den fazla degisim varsa on-chain gunceller
- Stale fiyat olusumunu onler

### 8.2 Epoch Manager
- Expired epoch'lari tespit eder ve otomatik settle eder
- Yeni epoch baslatir (strike: spot * 1.05, sure: 7 gun)
- Batch listing olusturur (100 opsiyon / TX)

### 8.3 Health Monitor
- TVL degisimini izler (%10+ dusus uyarisi)
- Oracle sagligini kontrol eder
- Keeper wallet bakiyesini izler (min 10 STX)

### 8.4 Vercel Cron Entegrasyonu
- Her 10 dakikada stateless keeper endpoint cagirilir
- Fiyat guncelleme + epoch yonetimi + listing olusturma
- Bearer token ile korunur

---

## 9. Teknik Sabitler

| Parametre | Deger | Aciklama |
|-----------|-------|----------|
| PRECISION | 10^8 (8 decimal) | sBTC satoshi hassasiyeti |
| PRICE-PRECISION | 10^6 (6 decimal) | USD fiyat hassasiyeti |
| Strike OTM | %5 | Spot fiyatin %5 ustunde |
| Epoch suresi | 1008 blok | ~7 gun (10 dk/blok) |
| Management fee | %2 (200 BPS) | Collateral uzerinden |
| Performance fee | %10 (1000 BPS) | Premium uzerinden |
| Max withdrawal | %25 / 24 saat | Flash-drain koruması |
| Staleness limiti | 12 blok | ~2 saat |
| Oracle toleransi | %2 (200 BPS) | Fiyat sapma limiti |
| Faucet miktari | 1 sBTC | 100,000,000 sats |
| Max listings/epoch | 10,000 | v5 kontrat limiti |
| Batch size | 100 listing/TX | fold iterasyonu |
| Default IV | %80 | Implied volatility |
| Risk-free rate | %5 | Yillik |

---

## 10. Yol Haritasi

### Faz 1 — Tamamlandi
- [x] Core vault kontrati (deposit, withdraw, epoch yonetimi)
- [x] Price oracle (3 kaynakli, staleness kontrollu)
- [x] Options marketplace (batch listing, buy, claim)
- [x] Frontend (Next.js 16, Tailwind 4, wallet entegrasyonu)
- [x] Keeper bot (fiyat, epoch, monitoring)
- [x] Vercel cron entegrasyonu
- [x] 22 birim testi
- [x] Stacks mainnet deployment (mock sBTC ile)

### Faz 2 — Tamamlandi
- [x] Data-logic ayirimi (upgrade edilebilir mimari)
- [x] Withdrawal rate limiting
- [x] Emergency settlement mekanizmasi
- [x] Coklu submitter oracle
- [x] Batch listing (100/TX)
- [x] Guvenlik sertlestirme (CSP, rate limit, input validation)
- [x] SEO optimizasyonu (OG image, Twitter card, sitemap)

### Faz 3 — Devam Ediyor
- [ ] Gercek sBTC entegrasyonu (mock yerine)
- [ ] Governance token (DAO yonetimi)
- [ ] Insurance fund (kullanici koruması)
- [ ] Multi-asset vault (sBTC + diger Stacks tokenleri)
- [ ] Otomatik IV hesaplama (gercek piyasa verisiyle)
- [ ] Mobile-first UI iyilestirmeleri

### Faz 4 — Vizyon
- [ ] Cross-chain opsiyon kopruleri
- [ ] Exotic opsiyonlar (put, spread, straddle)
- [ ] DAO tarafindan yonetilen strateji parametreleri
- [ ] Institutional-grade API
- [ ] Sigorta fonu aktivasyonu
- [ ] Audit (CertiK / Trail of Bits)

---

## 11. Karsilastirma

| Ozellik | sBTC Options Vault | Ribbon Finance | Friktion |
|---------|-------------------|----------------|----------|
| Blockchain | Stacks (Bitcoin L2) | Ethereum | Solana |
| Varlik | sBTC (Bitcoin) | ETH, wBTC | SOL, BTC |
| Strateji | Covered Call | Covered Call + Put | Covered Call + Crab |
| Settlement | On-chain Oracle | Opyn (Ethereum) | Pyth (Solana) |
| Epoch | 7 gun | 7 gun | 7 gun |
| Durum | Testnet (Mock sBTC) | Canli → Aeon | Kapali |
| Fee | %2 + %10 perf | %2 + %10 perf | %2 + %10 perf |
| Yenilik | Bitcoin-native yield | EVM pionir | Solana DeFi |

**Avantajimiz:** Bitcoin'in kendi ekosisteminde (Stacks), sBTC ile native yield. Bridge riski yok, wrapping yok, Bitcoin finality'si.

---

## 12. Risk Uyarilari

- **Smart contract riski:** Kontratlar henuz bagimsiz audit'ten gecmemistir
- **Oracle riski:** Fiyat kaynakari manipule edilebilir (3 kaynak + tolerans azaltir)
- **ITM riski:** BTC yukselisi vault depositorlerinin collateral'ından payout kesilmesine yol acar
- **Test asamasi:** Su anda mock sBTC kullanilmakta, gercek BTC riski yoktur
- **Stacks agi riskleri:** Ag kesintileri, yuksek islem ucretleri
- **Likidite riski:** Dusuk katilimda opsiyonlar satilmayabilir

**ONEMLI:** Bu protokol deneysel bir DeFi urunudur. Sadece kaybetmeyi goz alabileceginiz miktarlari kullanin. Yatirim tavsiyesi degildir.

---

## 13. Sonuc

sBTC Options Vault, Bitcoin ekosisteminde buyuk bir boslugu doldurmaktadir: BTC sahipleri icin trustless, on-chain, automated yield. Covered call stratejisi — geleneksel finansin en guvenli opsiyon stratejilerinden biri — artik Stacks uzerinde herkesin erisebilecegi bir sekilde sunulmaktadir.

Mock sBTC ile test asamasindayken, protokolun tum teknik altyapisi (vault, market, oracle, keeper, frontend) tamamlanmis ve calismaktadir. Gercek sBTC entegrasyonu ile birlikte, Bitcoin DeFi'nin en onemli yield protokollerinden biri olmaya adaydir.

**Simdi deneyin:** https://sbtc-options-vault.vercel.app

---

## Iletisim & Linkler

- **Canli Uygulama:** https://sbtc-options-vault.vercel.app
- **GitHub:** https://github.com/serayd61/sbtcHacks
- **Ag:** Stacks Mainnet
- **Yarisma:** BUIDL BATTLE #2 — Most Innovative Use of sBTC

---

*sBTC Options Vault — Bitcoin yield, trustless and on-chain.*

*Whitepaper v1.0 — Mart 2026*
