# sBTC Options Vault

**The first covered call options vault on Bitcoin.**

Earn yield on your sBTC through automated covered call options — bringing Ribbon Finance-style structured products to the Bitcoin economy via Stacks.

> **Live on Mainnet**: [sbtc-options-vault.vercel.app](https://sbtc-options-vault.vercel.app)
>
> **Built for**: [BUIDL BATTLE #2](https://dorahacks.io/hackathon/buidlbattle2) — Most Innovative Use of sBTC

---

## The Problem

Bitcoin holders have limited options for generating yield. While Ethereum has Ribbon Finance and Solana had Friktion, **Bitcoin has zero options vaults**. sBTC changes this by bringing programmable BTC to Stacks, but no one has built structured products on top of it yet.

## The Solution

sBTC Options Vault is a DeFi protocol that lets users deposit sBTC into a vault that automatically writes covered call options. Premiums collected from option sales are auto-compounded into the vault's share price, generating passive yield for depositors — all fully on-chain in Clarity.

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Price Oracle    │     │  Options Market   │     │    Mock sBTC     │
│  (BTC/USD Feed)   │     │ (Buy/Sell/Claim)  │     │ (SIP-010 Token)  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                         │
         ▼                        ▼                         ▼
┌────────┴────────────────────────┴─────────────────────────┴────────┐
│                      sBTC Options Vault                            │
│                                                                    │
│  Deposit sBTC ──► Receive Shares (proportional to TVL)             │
│  Start Epoch  ──► Write Covered Call (strike + expiry)             │
│  Sell Option  ──► Premium auto-compounds into share price          │
│  Settlement   ──► OTM: vault keeps all | ITM: buyer gets payout   │
│  Withdraw     ──► Burn shares, get sBTC + accumulated premiums     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Mainnet Deployment

All 5 contracts are deployed and verified on **Stacks Mainnet**:

| Contract | Address | Explorer |
|----------|---------|----------|
| `sip-010-trait` | `SP387HJN...74C5W.sip-010-trait` | [View on Explorer](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sip-010-trait?chain=mainnet) |
| `mock-sbtc` | `SP387HJN...74C5W.mock-sbtc` | [View on Explorer](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.mock-sbtc?chain=mainnet) |
| `price-oracle` | `SP387HJN...74C5W.price-oracle` | [View on Explorer](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.price-oracle?chain=mainnet) |
| `sbtc-options-vault` | `SP387HJN...74C5W.sbtc-options-vault` | [View on Explorer](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sbtc-options-vault?chain=mainnet) |
| `options-market` | `SP387HJN...74C5W.options-market` | [View on Explorer](https://explorer.hiro.so/txid/SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.options-market?chain=mainnet) |

**Deployer**: `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W`

---

## How It Works

### For Depositors (Yield Earners)
1. **Deposit sBTC** → Receive vault shares proportional to TVL
2. **Sit back** → Vault writes covered calls each epoch, collects premiums
3. **Withdraw anytime** → Burn shares, receive sBTC + accumulated premiums

### For Option Buyers (Speculators)
1. **Browse listings** → See available covered call options with strike prices
2. **Buy option** → Pay premium in sBTC
3. **Settlement** → If BTC price > strike (ITM), claim payout. If not, option expires worthless

### Epoch Lifecycle
```
Deposit Phase ──► Epoch Start ──► Option Sale ──► Expiry ──► Settlement
     │                │               │              │            │
  Users add       Admin writes     Buyer pays    Block height   Oracle price
  sBTC to vault   covered call     premium       reached        determines
                  (strike+expiry)  (→ vault)                    OTM or ITM
```

**OTM** (price < strike): Vault keeps all collateral + premium. Depositors profit.

**ITM** (price ≥ strike): Buyer receives `collateral × (settlement - strike) / settlement`. Vault keeps remaining + premium.

---

## Smart Contracts

### `sbtc-options-vault.clar` — Core Vault (~350 lines)
- Share-based accounting (similar to Yearn v2 vaults)
- Epoch lifecycle management with full on-chain settlement
- Auto-compounding: premiums increase share price, no manual claiming
- Management fee (2%) + Performance fee (10%) on premiums
- Pause/unpause functionality for emergency stops
- Market contract authorization system

### `options-market.clar` — Marketplace (~220 lines)
- Create/buy/claim option listings
- `compute-suggested-premium()` — on-chain premium pricing helper
- Automatic premium forwarding to vault on purchase
- Settlement tracking and payout claims

### `price-oracle.clar` — Price Feed (~80 lines)
- Admin-controlled BTC/USD price feed (6 decimal precision)
- Price staleness check (max 12 blocks / ~2 hours)
- Historical price tracking per round

### `mock-sbtc.clar` — Test Token (~60 lines)
- SIP-010 compliant fungible token
- Faucet function for testing (`mint-for-test`)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Clarity 2 (Epoch 2.5) on Stacks |
| Frontend | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Wallet Integration | @stacks/connect (Leather / Xverse) |
| Contract Interactions | @stacks/transactions v7 |
| Testing | Clarinet SDK + Vitest (22 tests) |
| Deployment | Vercel (frontend) + Stacks Mainnet (contracts) |

---

## Testing

22 unit tests covering all contract functionality:

```
✓ Mock sBTC Token (4 tests)
  - Transfer, mint, balance checks, unauthorized mint rejection

✓ Price Oracle (4 tests)
  - Set price, staleness check, history tracking, access control

✓ Deposit & Withdrawals (5 tests)
  - Deposit minting shares, proportional share calc, withdraw, zero-amount rejection

✓ Full OTM Epoch Lifecycle (1 test)
  - Complete flow: deposit → epoch → sell → settle OTM → withdraw with profit

✓ Full ITM Epoch Lifecycle (1 test)
  - Complete flow: deposit → epoch → sell → settle ITM → buyer payout

✓ Access Control (4 tests)
  - Unauthorized epoch start, settle, pause, market authorization

✓ Options Market (3 tests)
  - Create listing, buy option, premium forwarding to vault
```

Run tests:
```bash
npm install && npm test
```

---

## Quick Start

### Prerequisites
- [Clarinet](https://github.com/hirosystems/clarinet) (for contract development)
- Node.js 18+
- Leather or Xverse wallet (browser extension)

### Smart Contracts
```bash
git clone https://github.com/serayd61/sbtcHacks.git
cd sbtcHacks
clarinet check          # Verify all contracts compile
npm install && npm test  # Run 22 unit tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

---

## Demo

[Watch the Pitch Video](./sbtc-pitch-video.mp4)

### Demo Flow
1. Connect Leather/Xverse wallet
2. Click "Get 1 sBTC" from faucet
3. Deposit 0.5 sBTC into the vault → receive shares
4. Admin: Set BTC price via oracle, start a new epoch
5. Admin: Create option listing on marketplace
6. Buy the option with a second wallet
7. Admin: Settle the epoch (OTM or ITM)
8. Withdraw — see your sBTC balance increased from premiums!

---

## Innovation & sBTC Alignment

This project demonstrates what becomes possible when Bitcoin gets programmability through sBTC on Stacks:

| Innovation | Description |
|-----------|-------------|
| **First options vault on Bitcoin** | Ethereum has Ribbon, Solana had Friktion — now Bitcoin has its first covered call vault |
| **Share-price auto-compounding** | Premiums automatically increase share price — no manual claim transactions needed |
| **Epoch-based lifecycle** | Clean separation of vault rounds with full on-chain settlement logic in Clarity |
| **On-chain premium pricing** | `compute-suggested-premium()` calculates fair option prices directly in Clarity |
| **Post-condition safety** | All user-facing transactions leverage Stacks post-conditions for maximum security |
| **SIP-010 compatible** | Designed to work with any SIP-010 token — ready for real sBTC integration |

### Stacks Technology Utilized
- **Clarity** — Smart contract language with no reentrancy and predictable execution
- **sBTC** — Trust-minimized Bitcoin representation enabling DeFi on Stacks
- **stacks.js** — @stacks/connect + @stacks/transactions for wallet and contract interactions
- **Post-conditions** — Native Stacks security feature protecting users from unexpected token transfers
- **SIP-010 Trait** — Standard fungible token interface for composability

---

## Project Structure

```
sbtcHacks/
├── contracts/
│   ├── sip-010-trait.clar          # Token standard
│   ├── mock-sbtc.clar              # Mock sBTC (SIP-010)
│   ├── price-oracle.clar           # BTC/USD price feed
│   ├── sbtc-options-vault.clar     # Core vault logic
│   └── options-market.clar         # Options marketplace
├── frontend/
│   ├── app/                        # Next.js pages
│   ├── components/                 # React components
│   │   ├── App.tsx                 # Main app layout
│   │   ├── VaultDashboard.tsx      # Vault stats display
│   │   ├── DepositWithdraw.tsx     # Deposit/withdraw UI
│   │   ├── BuyOption.tsx           # Option marketplace UI
│   │   ├── AdminPanel.tsx          # Admin controls
│   │   ├── WalletConnect.tsx       # Wallet integration
│   │   ├── FaucetButton.tsx        # Test token faucet
│   │   └── Toast.tsx               # Notifications
│   └── lib/                        # Config & utilities
├── tests/
│   └── vault.test.ts               # 22 unit tests
├── deploy-mainnet.mjs              # Mainnet deployment script
├── deploy-testnet.mjs              # Testnet deployment script
├── Clarinet.toml                   # Clarinet config
└── vitest.config.ts                # Test config
```

---

## License

MIT
