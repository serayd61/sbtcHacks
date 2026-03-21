# sBTC Options Vault: Bringing Institutional Yield Strategies to Bitcoin

*The first automated covered call options protocol built on Stacks/Bitcoin*

---

For years, Bitcoin holders have faced a fundamental problem: how do you earn yield on your BTC without taking on excessive risk? Traditional DeFi protocols offer yield through liquidity provision, but come with impermanent loss, smart contract risk, and the need to bridge assets across chains.

**sBTC Options Vault changes this equation entirely.** Built on the Stacks blockchain, it's the first automated covered call options protocol that lets Bitcoin holders earn yield through a battle-tested institutional strategy — covered call writing. Inspired by Ethereum's Ribbon Finance and Solana's Friktion, we've brought this proven model to Bitcoin.

---

## What Are Covered Calls?

A covered call is one of the most conservative options strategies in traditional finance. The concept is simple:

1. You hold an asset (in this case, sBTC — Bitcoin on Stacks)
2. You sell call options on that asset, collecting premiums upfront
3. If the price stays below the strike price at expiry (Out of The Money), you keep your asset AND the premium — pure profit
4. If the price goes above the strike (In The Money), the option buyer profits from the difference

Historically, covered call strategies on Bitcoin tend to expire out of the money about 70–80% of the time when strike prices are set 5% above the spot price. This makes it a consistently profitable strategy for vault depositors who are willing to cap their upside in exchange for steady premium income.

---

## How It Works

### Step 1: Deposit

Users deposit sBTC into the vault and receive shares proportional to their deposit. Think of it like a savings account — your shares represent your ownership of the vault's total assets.

### Step 2: Automated Option Writing

The vault automatically writes covered call options using the deposited sBTC as collateral. Strike prices are set 5% above the current Bitcoin price, and premiums are calculated using the Black-Scholes pricing model — the same model used by institutional traders worldwide.

### Step 3: Weekly Epochs

The protocol operates in weekly cycles called "epochs." Each epoch follows a clear lifecycle:

- **Start**: A new epoch begins with a strike price 5% above spot
- **Active**: Options are listed on the marketplace for buyers to purchase
- **Expiry**: After ~7 days, the epoch expires
- **Settlement**: The oracle determines the final price and settles the epoch
- **Distribution**: Premiums are distributed to vault depositors as yield

### Step 4: Collect Yield

When an epoch settles OTM (which is the majority of the time), vault depositors keep 100% of their collateral plus all the premiums collected. This yield compounds over time as new epochs begin automatically.

---

## The Architecture

Building a reliable options protocol on Bitcoin requires robust infrastructure. Here's what powers sBTC Options Vault:

### 14 Smart Contracts on Stacks Mainnet

The protocol is built on a modular architecture of 14 Clarity smart contracts, each handling a specific responsibility:

- **vault-logic-v2** — Core vault with deposit, withdraw, and epoch management
- **options-market-v5** — Marketplace supporting up to 100,000 listings per epoch with batch creation
- **price-oracle-v2** — Decentralized price feed with staleness protection and multi-source validation
- **vault-data-v1** — Persistent storage layer for vault state
- **admin-multisig** — Multi-signature governance for critical operations
- Plus governance, insurance fund, and strategy contracts ready for future activation

### Automated Keeper Bot

A keeper bot runs continuously, handling three critical services:

**Price Oracle Submitter** — Fetches BTC/USD prices from three independent sources (CoinGecko, Binance, and Kraken), calculates the median to eliminate outliers, and submits the price on-chain every 10 minutes. A 2% tolerance filter prevents manipulation from a single compromised source.

**Epoch Manager** — Monitors epoch expiry, automatically settles completed epochs using oracle prices, starts new epochs with dynamically calculated parameters, and creates option listings on the marketplace.

**Health Monitor** — Tracks vault TVL, oracle freshness, keeper wallet balance, and system health. Alerts are sent via webhook when anomalies are detected.

### Black-Scholes Pricing

Option premiums are not set arbitrarily. We use the Black-Scholes model — the gold standard for option pricing in traditional finance — adapted for Bitcoin's volatility profile. The model takes into account:

- Current spot price
- Strike price
- Time to expiry
- Implied volatility (calibrated to Bitcoin's historical 80% annual volatility)
- Risk-free rate

This ensures premiums are fair for both option buyers and vault depositors.

### Modern Frontend

The dashboard at **sbtcvault.live** is built with Next.js 16, React 19, and Tailwind CSS 4. It features:

- Real-time vault statistics and share price tracking
- Interactive deposit/withdraw interface
- Options marketplace with epoch-centric design
- Performance charts showing return per epoch
- Full epoch history with settlement details
- Wallet integration via Stacks Connect

---

## Performance So Far

Since launch, the vault has completed 4 epochs with strong results:

| Metric | Value |
|--------|-------|
| Total Value Locked | 1.55 sBTC |
| Share Price | 1.0333 sBTC |
| Cumulative Return | +3.33% |
| Estimated APY | 173.3% |
| Epochs Completed | 4 |
| Settlement Record | All OTM |
| Options Listed | 500+ |

Every epoch has settled Out of The Money, meaning vault depositors have retained their full collateral plus earned premiums on top. The share price has grown from 1.0000 to 1.0333, reflecting the accumulated yield.

---

## Why sBTC?

sBTC is the trust-minimized Bitcoin peg on the Stacks blockchain. Unlike wrapped Bitcoin (wBTC) which relies on centralized custodians like BitGo, sBTC leverages Bitcoin's own security through the Stacks consensus mechanism.

This matters because sBTC Options Vault users can earn yield on their Bitcoin without:

- **Bridging to another chain** — No cross-chain risk
- **Trusting a centralized custodian** — No counterparty risk from wrapping
- **Leaving the Bitcoin ecosystem** — Your BTC security guarantees remain intact

sBTC brings Bitcoin's unmatched security to Stacks' programmability. It's the best of both worlds — and exactly what Bitcoin DeFi needs.

---

## Security

Security is paramount when handling user funds. The protocol incorporates multiple layers of protection:

- **Owner-only admin functions** — Critical operations like epoch management and emergency settlement require deployer authorization
- **Oracle staleness protection** — Price data older than 12 blocks (~2 hours) is automatically rejected
- **Multi-source price validation** — Requires at least 2 out of 3 price sources to agree within 2% tolerance
- **Emergency controls** — Vault can be paused instantly, with emergency settlement capability
- **Content Security Policy** — Frontend headers prevent XSS and injection attacks
- **Rate limiting** — API endpoints are protected against abuse
- **Comprehensive testing** — 22 unit tests covering token operations, oracle, deposits, withdrawals, epoch lifecycle, access control, and marketplace

A detailed security audit has been conducted internally, with findings documented for the V3 upgrade path.

---

## What's Next

The roadmap is ambitious but focused:

**Governance Token** — A community governance token will enable decentralized protocol management, allowing token holders to vote on parameters like strike prices, epoch duration, and fee structures.

**Insurance Fund** — An additional protection layer for depositors, funded by a portion of protocol fees. The smart contract infrastructure is already deployed and ready for activation.

**Strategy Upgrades** — Multiple strike strategies, different tenor options (daily, weekly, monthly), and dynamic volatility-based pricing to maximize yield across market conditions.

**Scaling** — The options-market-v5 contract already supports up to 100,000 listings per epoch, preparing the protocol for significant growth in user adoption.

**Real sBTC Integration** — When sBTC is fully live on Stacks mainnet, the protocol will migrate from the test token to production sBTC, connecting directly to real Bitcoin.

---

## Try It Now

sBTC Options Vault is live on Stacks mainnet. You can interact with it today:

**Website**: [sbtcvault.live](http://sbtcvault.live)

**GitHub**: [github.com/serayd61/sbtcHacks](https://github.com/serayd61/sbtcHacks)

**Twitter**: [@sbtcVaults](https://twitter.com/sbtcVaults)

Connect your Stacks wallet, mint test sBTC from the faucet, deposit into the vault, and start earning yield. The entire flow takes less than 5 minutes.

---

*sBTC Options Vault is built for BUIDL BATTLE #2 — Most Innovative Use of sBTC. We believe Bitcoin DeFi deserves the same sophisticated financial tools that exist on Ethereum and Solana. With sBTC and Stacks, that future is already here.*

---

**Tags**: Bitcoin, DeFi, sBTC, Stacks, Options Trading, Covered Calls, Yield, Blockchain, Web3, Crypto
