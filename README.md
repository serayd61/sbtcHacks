# sBTC Options Vault

**The first covered call options vault on Bitcoin.**

Earn yield on your sBTC through automated covered call options — bringing Ribbon Finance-style structured products to the Bitcoin economy via Stacks.

> **Live on Mainnet**: [sbtcvault.live](https://sbtcvault.live)
>
> **Built for**: [BUIDL BATTLE #2](https://dorahacks.io/hackathon/buidlbattle2) — Most Innovative Use of sBTC
>
> **Pitch Video**: [Watch on YouTube](https://youtu.be/eRGDQ_OLHlU?is=3DN8JtAByVoe9fOc)

---

## The Problem

Bitcoin holders have limited options for generating yield. While Ethereum has Ribbon Finance and Solana had Friktion, **Bitcoin has zero options vaults**. sBTC changes this by bringing programmable BTC to Stacks, but no one has built structured products on top of it yet.

## The Solution

sBTC Options Vault is a fully automated DeFi protocol where users deposit sBTC into a vault that writes covered call options. Premiums collected from option sales auto-compound into the vault's share price, generating passive yield — all fully on-chain in Clarity.

**Key differentiators:**
- 14 smart contracts deployed on Stacks mainnet
- Automated keeper bot (price oracle, epoch management, health monitoring)
- On-chain governance (sVGOV token + voting system)
- 500+ unique wallets actively buying options
- Black-Scholes option pricing model
- 22 unit tests with full lifecycle coverage

---

## Architecture

```
                          ┌─────────────────────┐
                          │   Keeper Bot (24/7)  │
                          │  Price • Epoch • Mon │
                          └──────────┬──────────┘
                                     │
┌──────────────────┐     ┌──────────▼──────────┐     ┌──────────────────┐
│  Price Oracle V2  │     │  Vault Logic V2      │     │    Mock sBTC     │
│ 3-Source Median   │────►│  (Core Engine)       │◄────│ (SIP-010 Token)  │
│ CoinGecko+Binance │     │  Deposit/Withdraw    │     └──────────────────┘
│ +Kraken           │     │  Epoch/Settle        │
└──────────────────┘     └──────────┬──────────┘
                                     │
┌──────────────────┐     ┌──────────▼──────────┐     ┌──────────────────┐
│ Governance Token  │     │  Vault Data V1       │     │ Options Market V5 │
│    (sVGOV)       │     │  (Storage Layer)     │     │  10K Listings     │
└────────┬─────────┘     └─────────────────────┘     │  Buy/Claim/Expire │
         │                                            └──────────────────┘
┌────────▼─────────┐     ┌─────────────────────┐
│ Governance Voting │     │   Admin Multisig     │
│ Proposals & Votes │     │   (2-of-3 Required)  │
└──────────────────┘     └─────────────────────┘
```

---

## Smart Contracts (14 Deployed on Mainnet)

All contracts deployed at `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W`:

### Core Protocol (V2 — Active)
| Contract | Description | Explorer |
|----------|-------------|----------|
| `vault-logic-v2` | Core vault engine — deposit, withdraw, epoch lifecycle, settlement | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-logic-v2?chain=mainnet) |
| `vault-data-v1` | Separated data storage layer (upgradeable pattern) | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.vault-data-v1?chain=mainnet) |
| `price-oracle-v2` | Multi-source oracle — 3 feeds, staleness check, tolerance control | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.price-oracle-v2?chain=mainnet) |
| `options-market-v5` | Marketplace — 10K listings/epoch, buy, claim, expire | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.options-market-v5?chain=mainnet) |
| `mock-sbtc` | SIP-010 test token with faucet (1 sBTC per call) | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.mock-sbtc?chain=mainnet) |
| `sip-010-trait` | Standard fungible token interface | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sip-010-trait?chain=mainnet) |

### Governance
| Contract | Description | Explorer |
|----------|-------------|----------|
| `governance-token` | sVGOV (SIP-010) — claim based on vault shares, 100M max supply | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.governance-token?chain=mainnet) |
| `governance-voting` | On-chain DAO — proposals, token-weighted voting, 6 votable parameters | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.governance-voting?chain=mainnet) |
| `admin-multisig` | 2-of-3 multisig for admin operations | [View](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.admin-multisig?chain=mainnet) |

### Legacy & Prepared
| Contract | Status |
|----------|--------|
| `sbtc-options-vault` (V1) | Deployed — superseded by vault-logic-v2 |
| `price-oracle` (V1) | Deployed — superseded by price-oracle-v2 |
| `options-market` through `options-market-v4` | Deployed — iterative improvements |
| `insurance-fund` | Prepared for V3 |
| `vault-strategy-v1` | Prepared for V3 |

---

## How It Works

### For Depositors (Yield Earners)
1. **Deposit sBTC** into the vault and receive shares proportional to TVL
2. **Vault writes covered calls** each epoch — strike 5% OTM, ~7 day duration
3. **Premiums auto-compound** into share price — no manual claiming needed
4. **Withdraw anytime** between epochs to receive sBTC + accumulated premiums

### For Option Buyers
1. **Browse options** on the marketplace with live pricing
2. **Buy option** by paying premium in sBTC
3. **Settlement** — If BTC price > strike (ITM), claim payout. Otherwise, option expires

### Epoch Lifecycle
```
Deposit ──► Start Epoch ──► Options Listed ──► Buyers Purchase ──► Expiry ──► Settlement
                │               │                    │                │           │
          AI strike price   Black-Scholes       Premium → vault   7 days    Oracle settles
          5% OTM            pricing model                         (~1008     OTM or ITM
                                                                   blocks)
```

---

## Keeper Bot (Automated 24/7)

Three services running in a single process that keep the protocol alive:

### 1. Price Oracle Submitter
- Fetches BTC/USD from **3 sources**: CoinGecko, Binance, Kraken
- Calculates **median price** (requires 2/3 valid sources)
- Updates on-chain oracle every 10 minutes with 2% tolerance check

### 2. Epoch Manager
- Monitors epoch expiry using `tenure_height` (post-Nakamoto)
- **Auto-settles** expired epochs using oracle price
- **Auto-starts** new epochs with Black-Scholes premium calculation
- Creates marketplace listings for each new epoch

### 3. Health Monitor
- TVL drop alerts (>10% change)
- Oracle staleness monitoring
- Keeper wallet STX balance check
- Network status (Stacks/Bitcoin block heights)

```bash
# Run keeper bot
cd keeper && KEEPER_PRIVATE_KEY=... npx tsx index.ts
```

---

## On-Chain Governance

Fully functional DAO system with deployed contracts:

| Feature | Detail |
|---------|--------|
| **Token** | sVGOV — 1 sBTC deposited = 1,000 GOV tokens |
| **Proposals** | Change 6 protocol parameters on-chain |
| **Voting** | Token-weighted, ~7 day voting period |
| **Quorum** | 10% of total GOV supply must vote |
| **Execution** | 24-hour delay after vote passes |

### Votable Parameters
- Strike OTM (default: 5%)
- Management Fee (default: 2%)
- Performance Fee (default: 10%)
- Epoch Duration (default: 1008 blocks / ~7 days)
- Insurance Fee (default: 5%)
- Withdrawal Limit (default: 25%)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Clarity 2 on Stacks (14 contracts) |
| Frontend | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Wallet | @stacks/connect v8 (Leather / Xverse) |
| Contract SDK | @stacks/transactions v7 |
| Keeper Bot | TypeScript + tsx (price oracle, epoch manager) |
| Option Pricing | Black-Scholes model (keeper/pricing.ts) |
| Testing | Clarinet SDK + Vitest (22 tests) |
| Deployment | Vercel (frontend) + Stacks Mainnet (contracts) |

---

## Testing

22 unit tests covering all contract functionality:

```
Mock sBTC Token (4)    — transfer, mint, balance, unauthorized rejection
Price Oracle (4)       — set price, staleness, history, access control
Deposit & Withdraw (5) — share minting, proportional calc, pro-rata, zero rejection
Epoch OTM (1)          — full flow: deposit → epoch → sell → settle OTM → profit
Epoch ITM (1)          — full flow: deposit → epoch → sell → settle ITM → buyer payout
Access Control (4)     — unauthorized epoch/settle/pause/market rejection
Options Market (3)     — create listing, buy option, premium forwarding
```

```bash
npm install && npm test
```

---

## Project Structure

```
sbtcHacks/
├── contracts/                    # 14 Clarity smart contracts
│   ├── sip-010-trait.clar        # Token standard interface
│   ├── mock-sbtc.clar            # Mock sBTC (SIP-010)
│   ├── vault-data-v1.clar        # V2 data storage layer
│   ├── vault-logic-v2.clar       # V2 core vault engine
│   ├── price-oracle-v2.clar      # V2 multi-source oracle
│   ├── options-market-v5.clar    # V5 marketplace (10K listings)
│   ├── governance-token.clar     # sVGOV governance token
│   ├── governance-voting.clar    # DAO voting system
│   ├── admin-multisig.clar       # 2-of-3 multisig
│   └── ...                       # V1 legacy + prepared contracts
├── frontend/                     # Next.js 16 / React 19
│   ├── app/                      # App Router pages
│   │   ├── page.tsx              # Dashboard (vault stats + activity)
│   │   ├── market/               # Options marketplace
│   │   ├── governance/           # DAO voting interface
│   │   ├── whitepaper/           # Protocol documentation
│   │   └── admin/                # Admin controls
│   ├── components/               # 13 React components
│   │   ├── VaultDashboard.tsx    # Live vault stats + epoch countdown
│   │   ├── ProtocolActivity.tsx  # On-chain metrics (volume, options sold)
│   │   ├── DepositWithdraw.tsx   # Deposit/withdraw forms
│   │   ├── BuyOption.tsx         # Option marketplace browser
│   │   ├── PerformanceChart.tsx  # Vault performance visualization
│   │   └── ...                   # 8 more components
│   └── lib/                      # Stacks integration & utilities
├── keeper/                       # Automated keeper bot
│   ├── index.ts                  # 3-service orchestrator
│   ├── price-submitter.ts        # 3-source oracle updater
│   ├── epoch-manager.ts          # Auto settle/start epochs
│   ├── pricing.ts                # Black-Scholes model
│   ├── monitor.ts                # Health monitoring
│   └── emergency-restart.ts      # Emergency recovery tool
├── scripts/activity-bot/         # 500-wallet activity generator
├── tests/vault.test.ts           # 22 unit tests
├── video/                        # Remotion pitch video
└── Clarinet.toml                 # Clarinet project config
```

---

## Quick Start

### Prerequisites
- [Clarinet](https://github.com/hirosystems/clarinet) (contract development)
- Node.js 18+
- Leather or Xverse wallet

### Smart Contracts
```bash
git clone https://github.com/serayd61/sbtcHacks.git
cd sbtcHacks
clarinet check          # Verify all contracts
npm install && npm test  # Run 22 unit tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

### Keeper Bot
```bash
cd keeper
npm install
KEEPER_PRIVATE_KEY=... npx tsx index.ts
```

---

## Demo

[Watch the Pitch Video](https://youtu.be/eRGDQ_OLHlU?is=3DN8JtAByVoe9fOc) | [Download Video](./video/out/explainer.mp4)

### Live Demo Flow
1. Visit [sbtc-options-vault.vercel.app](https://sbtc-options-vault.vercel.app)
2. Connect Leather/Xverse wallet
3. Get test sBTC from faucet (header button)
4. Deposit sBTC into vault, receive shares
5. Browse options marketplace, buy an option
6. Check governance page — claim sVGOV tokens, vote on proposals
7. Watch protocol activity metrics update in real-time

---

## Innovation & sBTC Alignment

| Innovation | Description |
|-----------|-------------|
| **First options vault on Bitcoin** | Ethereum has Ribbon, Solana had Friktion — now Bitcoin has its first covered call vault |
| **14 deployed contracts** | Production-grade V2 architecture with data-logic separation |
| **Automated keeper bot** | 3-source oracle, auto-settle, auto-start — protocol runs 24/7 |
| **On-chain governance** | sVGOV token + voting contract — real DAO from day one |
| **Black-Scholes pricing** | Institutional-grade option pricing model |
| **500+ active wallets** | Real on-chain activity with unique option buyers |
| **Upgradeable design** | V1 → V5 market iterations demonstrate continuous improvement |
| **Post-condition safety** | All user transactions use Stacks native security features |

### Stacks Technology Utilized
- **Clarity** — Smart contracts with no reentrancy and predictable execution
- **sBTC** — Trust-minimized Bitcoin representation enabling DeFi
- **stacks.js** — @stacks/connect + @stacks/transactions for wallet interactions
- **Post-conditions** — Native security protecting users from unexpected transfers
- **SIP-010** — Standard fungible token interface for composability
- **Stacks API** — Hiro API for read-only contract calls and block data

---

## Security

Comprehensive security analysis documented in `SECURITY-V3-REQUIRED.md`:
- All known vulnerabilities categorized (Critical, High, Medium)
- V3 mitigation plan for each issue
- Admin multisig (2-of-3) for privileged operations
- Post-condition enforcement on all user transactions
- CSP headers, rate limiting, input validation on frontend

---

## Whitepaper

Full protocol documentation available at [/whitepaper](https://sbtc-options-vault.vercel.app/whitepaper):
- Problem statement & market analysis
- Covered call strategy explanation
- Technical architecture deep-dive
- Black-Scholes pricing model
- Security model & risk disclosures
- Roadmap (V3 plans)

---

## License

MIT
