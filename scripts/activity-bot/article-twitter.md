# sBTC Options Vault — The First Covered Call Yield Protocol on Bitcoin

## Twitter Thread (Copy-paste ready)

---

**Tweet 1 (Main — attach image):**

Introducing sBTC Options Vault — the first automated covered call options protocol built on Bitcoin via @Staborlabs.

Deposit sBTC. Earn yield. No impermanent loss.

Live on Stacks mainnet now.

sbtcvault.live

🧵 Thread below 👇

#sBTC #Bitcoin #DeFi #Stacks #BUIDLBattle

---

**Tweet 2:**

The Problem:

Bitcoin holders face a dilemma — hold and earn nothing, or move to risky DeFi protocols.

sBTC Options Vault solves this by bringing institutional-grade covered call strategies to everyday BTC holders.

Your Bitcoin works for you while you sleep.

---

**Tweet 3:**

How it works:

1️⃣ Deposit sBTC into the vault
2️⃣ Vault automatically writes covered call options
3️⃣ Option buyers pay premiums in sBTC
4️⃣ Premiums are distributed to vault depositors as yield
5️⃣ Options expire OTM → vault keeps 100% of collateral + premium

---

**Tweet 4:**

The Architecture:

• 14 Clarity smart contracts on Stacks mainnet
• Automated keeper bot (price oracle + epoch management)
• Black-Scholes pricing model for fair premiums
• 3 independent price sources (CoinGecko, Binance, Kraken)
• Real-time dashboard at sbtcvault.live

---

**Tweet 5:**

What makes us different:

✅ First options vault on Stacks/Bitcoin
✅ No impermanent loss (unlike AMM LPs)
✅ Automated epoch management — no manual intervention
✅ Transparent on-chain settlement
✅ 173% estimated APY from covered call premiums

Inspired by Ribbon Finance (ETH) & Friktion (SOL).

---

**Tweet 6:**

Technical Deep Dive:

• Vault uses weekly epochs with 5% OTM strike prices
• Oracle updates every 10 minutes with median price validation
• Smart position sizing with dynamic premium calculation
• Multi-sig admin controls for security
• Full insurance fund infrastructure ready

---

**Tweet 7:**

The numbers so far:

📊 TVL: 1.55 sBTC locked in vault
📈 Share price: 1.0333 sBTC (+3.33% return)
🔄 4 epochs completed successfully
💰 All epochs settled OTM — vault depositors kept full collateral
🏪 500 options listed on the marketplace

---

**Tweet 8:**

Why sBTC?

sBTC is the trust-minimized Bitcoin peg on Stacks. It brings BTC's security to Stacks' programmability.

With sBTC Options Vault, your Bitcoin earns yield without leaving the Bitcoin ecosystem.

No bridges. No wrapping. Pure Bitcoin DeFi.

---

**Tweet 9:**

What's next:

🔜 Governance token launch
🔜 Insurance fund activation
🔜 Strategy vault upgrades
🔜 Multi-epoch stacking
🔜 Community-driven strike selection

We're building the future of Bitcoin DeFi, one epoch at a time.

---

**Tweet 10:**

Built for @StacksBUIDL BATTLE #2 — Most Innovative Use of sBTC.

Try it now: sbtcvault.live
Code: github.com/serayd61/sbtcHacks

Follow @sbtcVaults for updates.

#sBTC #Bitcoin #Stacks #DeFi #BUIDLBattle #BTC

---

## Article (Long form — for blog/medium)

---

# sBTC Options Vault: Bringing Institutional Yield Strategies to Bitcoin

## Introduction

For years, Bitcoin holders have faced a fundamental problem: how do you earn yield on your BTC without taking on excessive risk? Traditional DeFi protocols offer yield through liquidity provision, but come with impermanent loss, smart contract risk, and the need to bridge assets across chains.

sBTC Options Vault changes this equation entirely. Built on the Stacks blockchain, it's the first automated covered call options protocol that lets Bitcoin holders earn yield through a battle-tested institutional strategy — covered call writing.

## What Are Covered Calls?

A covered call is one of the most conservative options strategies in traditional finance. Here's how it works:

1. You hold an asset (in this case, sBTC — Bitcoin on Stacks)
2. You sell call options on that asset, collecting premiums
3. If the price stays below the strike price at expiry (OTM), you keep your asset AND the premium
4. If the price goes above the strike (ITM), the option buyer profits from the difference

Historically, covered call strategies on Bitcoin tend to expire out of the money (OTM) about 70-80% of the time when strike prices are set 5% above spot, making this a consistently profitable strategy for vault depositors.

## How sBTC Options Vault Works

### The Vault

Users deposit sBTC into the vault and receive shares proportional to their deposit. The vault's total value (TVL) is used as collateral for writing covered call options.

### Weekly Epochs

The protocol operates in weekly cycles called "epochs." Each epoch:

- A strike price is set 5% above the current BTC/USD price (OTM)
- Premiums are calculated using the Black-Scholes pricing model
- Options are listed on the marketplace for buyers
- At expiry, the epoch is settled based on the oracle price

### Automated Keeper

A keeper bot runs 24/7, handling:

- **Price Oracle**: Fetches BTC/USD from 3 sources (CoinGecko, Binance, Kraken), calculates the median, and updates the on-chain oracle every 10 minutes
- **Epoch Management**: Automatically settles expired epochs and starts new ones
- **Health Monitoring**: Tracks TVL, oracle freshness, and system health

### On-Chain Settlement

Everything happens on-chain through 14 Clarity smart contracts. Settlement is trustless — the oracle price determines whether options expire ITM or OTM, and payouts are calculated and distributed automatically.

## Technical Architecture

The protocol consists of three main layers:

### Smart Contracts (Clarity on Stacks)

- **vault-logic-v2**: Core vault with deposit, withdraw, epoch management
- **options-market-v5**: Marketplace supporting up to 100,000 listings per epoch
- **price-oracle-v2**: Decentralized price feed with staleness protection
- **vault-data-v1**: Persistent storage layer
- **mock-sbtc**: SIP-010 token implementation
- **admin-multisig**: Multi-signature governance
- Plus 8 additional contracts for governance, insurance, and strategy management

### Frontend (Next.js 16)

A modern, responsive dashboard built with React 19 and Tailwind CSS 4. Features include:

- Real-time vault statistics and share prices
- Interactive deposit/withdraw interface
- Options marketplace with epoch-centric UI
- Performance charts and epoch history
- Wallet integration via @stacks/connect

### Keeper Bot (TypeScript)

An automated service that maintains the protocol's health:

- Multi-source price aggregation with outlier detection
- Automatic epoch lifecycle management
- Black-Scholes option pricing
- Transaction nonce management for reliable broadcasting
- Emergency restart capabilities

## Performance

Since launch, the vault has completed 4 epochs with the following results:

- **TVL**: 1.55 sBTC locked
- **Share Price**: 1.0333 sBTC (+3.33% cumulative return)
- **Estimated APY**: 173.3%
- **Settlement Record**: All epochs settled OTM — vault depositors retained full collateral plus premiums

## Why sBTC?

sBTC is the trust-minimized Bitcoin peg on the Stacks blockchain. Unlike wrapped Bitcoin (wBTC) which relies on centralized custodians, sBTC leverages Bitcoin's own security through the Stacks consensus mechanism.

This means sBTC Options Vault users can earn yield on their Bitcoin without:

- Bridging to another chain
- Trusting a centralized custodian
- Leaving the Bitcoin ecosystem

## Security Considerations

The protocol has undergone internal security review, identifying and documenting potential vulnerabilities. Key security features include:

- Owner-only administrative functions
- Oracle staleness protection (12-block limit)
- Content Security Policy headers on frontend
- Rate limiting on API endpoints
- Input validation across all contract functions
- Emergency pause and settlement capabilities

## What's Next

The roadmap includes:

1. **Governance Token**: Community-driven protocol management
2. **Insurance Fund**: Additional depositor protection
3. **Strategy Upgrades**: Multiple strike strategies and tenor options
4. **Scaling**: Supporting thousands of concurrent option buyers
5. **Real sBTC Integration**: Migration from mock-sbtc to production sBTC when available

## Conclusion

sBTC Options Vault demonstrates that sophisticated DeFi strategies can be built on Bitcoin. By combining the security of Bitcoin with the programmability of Stacks, we're making institutional-grade yield strategies accessible to everyone.

The protocol is live on Stacks mainnet at **sbtcvault.live**.

---

*Built for BUIDL BATTLE #2 — Most Innovative Use of sBTC*
*GitHub: github.com/serayd61/sbtcHacks*
*Twitter: @sbtcVaults*
