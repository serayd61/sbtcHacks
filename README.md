# sBTC Options Vault

**Covered Call Options Vault for Bitcoin - The first options vault on Stacks/Bitcoin.**

Built for [BUIDL BATTLE #2](https://dorahacks.io/hackathon/buidlbattle2) | Most Innovative Use of sBTC Bounty

## What is it?

A DeFi protocol that brings Ribbon Finance / Friktion-style covered call options vaults to Bitcoin via sBTC on Stacks. Users deposit sBTC, the vault writes weekly covered call options, and premiums earned are automatically compounded as yield.

## Architecture

```
+------------------+     +------------------+     +----------------+
|   Price Oracle   |     |  Options Market  |     |   Mock sBTC    |
|  (BTC/USD Feed)  |     | (Buy/Sell/Claim) |     | (SIP-010 Token)|
+--------+---------+     +--------+---------+     +--------+-------+
         |                         |                        |
         v                         v                        v
+--------+-------------------------+------------------------+-------+
|                    sBTC Options Vault                              |
|  - Deposit/Withdraw (share-based)                                 |
|  - Epoch lifecycle (start -> sell option -> settle)                |
|  - Auto-compounding premium yield                                 |
|  - OTM: vault keeps all + premium                                 |
|  - ITM: buyer gets payout, depositors keep rest + premium         |
+-------------------------------------------------------------------+
```

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `sip-010-trait.clar` | SIP-010 fungible token standard trait |
| `mock-sbtc.clar` | Mock sBTC token with faucet for testing |
| `price-oracle.clar` | Admin-controlled BTC/USD price feed |
| `sbtc-options-vault.clar` | Core vault: deposit, withdraw, epoch lifecycle |
| `options-market.clar` | Options marketplace: create listings, buy, claim |

## How It Works

1. **Deposit**: Users deposit sBTC and receive vault shares proportional to TVL
2. **Epoch Start**: Vault admin starts an epoch by writing a covered call (strike price + expiry)
3. **Option Sale**: A buyer pays premium in sBTC to purchase the covered call
4. **Settlement**:
   - **OTM** (price < strike): Option expires worthless, vault keeps all sBTC + premium
   - **ITM** (price > strike): Buyer receives payout, vault keeps remaining + premium
5. **Withdraw**: Users burn shares to withdraw sBTC + compounded premiums

## Tech Stack

- **Smart Contracts**: Clarity 2 (epoch 2.5) on Stacks
- **Testing**: Clarinet SDK + Vitest (22 tests)
- **Frontend**: Next.js 16, Tailwind CSS, TypeScript
- **Wallet**: @stacks/connect (Leather/Xverse)
- **Transactions**: @stacks/transactions v7

## Quick Start

### Smart Contracts
```bash
cd sbtcHacks
clarinet check          # Verify all contracts
npm install && npm test # Run 22 unit tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

## Demo Flow

1. Connect Leather/Xverse wallet
2. Click "Get 1 sBTC" (faucet)
3. Deposit 0.5 sBTC into vault
4. Admin: Set BTC price, start epoch, create listing
5. Buy option with second wallet
6. Admin: Settle epoch (OTM or ITM)
7. Withdraw - see profit from premiums!

## Testing

```
22 tests passing:
- Mock sBTC Token (4 tests)
- Price Oracle (4 tests)
- Deposit & Withdrawals (5 tests)
- Full OTM Epoch Lifecycle (1 test)
- Full ITM Epoch Lifecycle (1 test)
- Access Control (4 tests)
- Options Market (3 tests)
```

## Innovation

This is the **first covered call options vault on Bitcoin/Stacks**. While Ethereum has Ribbon Finance and Solana had Friktion, Bitcoin has had zero options vaults until now. sBTC makes this possible by bringing programmable BTC to Stacks.

Key innovations:
- **Share-price model**: Premium auto-compounds into share price - no manual claiming
- **Epoch-based lifecycle**: Clean separation of vault rounds with full on-chain settlement
- **Post-condition safety**: All user-facing transactions use Stacks post-conditions
- **SIP-010 compatible**: Works with any SIP-010 token, not just mock sBTC

## License

MIT
