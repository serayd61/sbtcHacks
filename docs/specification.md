# sBTC Options Vault - Technical Specification

**Version**: 2.0
**Date**: March 2026
**Network**: Stacks (Bitcoin L2)
**Contract Language**: Clarity v2 (Epoch 2.5)

---

## 1. Overview

sBTC Options Vault is a decentralized covered call options protocol on Stacks. Users deposit sBTC into a shared vault, which writes covered call options against the pooled collateral. Premiums earned from option sales are auto-compounded into the vault, generating yield for depositors.

### Core Properties

- **Depositors** earn yield from option premiums (auto-compounded)
- **Option buyers** gain exposure to BTC upside with limited downside (premium paid)
- **Vault** manages collateral, epoch lifecycle, and settlement
- **Oracle** provides reliable BTC/USD price feeds from multiple sources
- **Governance** enables token holders to vote on protocol parameters

---

## 2. Architecture

### Contract Hierarchy

```
User/Keeper
    |
    v
vault-logic-v2.clar  (business logic, upgradeable)
    |
    v
vault-data-v1.clar   (state storage, persistent)
    |
    +---> price-oracle-v2.clar    (price feeds)
    +---> options-market-v2.clar  (option listing/buying)
    +---> insurance-fund.clar     (shortfall coverage)
    +---> admin-multisig.clar     (governance admin)
    +---> governance-token.clar   (SIP-010 GOV token)
    +---> governance-voting.clar  (parameter voting)
    +---> vault-strategy-v1.clar  (multi-strategy config)
```

### Upgradeability Pattern

**Data-Logic Separation**: State is stored in `vault-data-v1.clar` (persistent across upgrades). Business logic lives in `vault-logic-v2.clar` (replaceable). The data contract gates writes via an authorized `logic-contract` principal.

Upgrade flow:
1. Deploy new logic contract (e.g., `vault-logic-v3`)
2. Call `vault-data-v1.set-logic-contract(new-logic)` (owner only)
3. Old logic loses write access immediately

---

## 3. Contracts

### 3.1 vault-data-v1.clar (221 lines)

**Purpose**: Persistent data layer for vault state.

**State Variables**:
| Variable | Type | Description |
|----------|------|-------------|
| `total-shares` | uint | Total vault shares outstanding |
| `total-sbtc-deposited` | uint | Total sBTC in vault (TVL) |
| `current-epoch-id` | uint | Current/latest epoch ID |
| `active-epoch` | bool | Whether an epoch is in progress |
| `vault-paused` | bool | Emergency pause flag |
| `market-contract` | principal | Authorized market contract |
| `treasury-address` | principal | Fee recipient |
| `withdrawal-period-start` | uint | Current withdrawal period start block |
| `withdrawals-this-period` | uint | Cumulative withdrawals this period |

**Maps**:
- `user-shares`: principal -> uint
- `epochs`: uint -> EpochData

**Access Control**: Only the authorized `logic-contract` can write. Owner can change the logic contract address.

### 3.2 vault-logic-v2.clar (534 lines)

**Purpose**: Business logic for deposits, withdrawals, epoch management, and settlement.

**Key Functions**:

| Function | Access | Description |
|----------|--------|-------------|
| `deposit(token, amount)` | Public | Deposit sBTC, receive shares |
| `withdraw(token, shares)` | Public | Burn shares, receive sBTC |
| `start-epoch(strike, premium, duration)` | Admin | Start new epoch |
| `settle-epoch(token, epoch-id, price)` | Admin | Settle with manual price |
| `settle-epoch-with-oracle(token, epoch-id)` | Admin | Settle using oracle price |
| `emergency-settle(token, epoch-id, price)` | Admin | Force settle when paused |
| `transfer-payout(token, amount, recipient)` | Admin | Send ITM payout to buyer |

**Share Price Calculation**:
```
share_price = (total_sbtc * PRECISION) / total_shares
```
Where PRECISION = 10^8 (8 decimals, matching sBTC satoshis).

**Withdrawal Queue**:
- Max 25% of TVL per 144-block (~24h) period
- Period resets automatically when elapsed
- Prevents bank-run scenarios

**Fee Structure**:
- Management fee: 2% of collateral per epoch
- Performance fee: 10% of premiums earned per epoch
- Fees sent to treasury address at settlement
- Fees capped at available balance (no overdraft)

**Settlement Logic (ITM)**:
```
payout = (collateral * (settlement_price - strike_price)) / settlement_price
payout = min(payout, vault_balance)  // Cap at vault TVL
payout = min(payout, collateral)     // Cap at epoch collateral
```

### 3.3 options-market-v2.clar (220 lines)

**Purpose**: Marketplace for buying/selling covered call options.

**Key Features**:
- One listing per epoch (duplicate prevention via `epoch-listing-exists` map)
- Buyers pay premium in sBTC, forwarded to vault
- ITM payout claimable after settlement
- Unsold options can be expired

### 3.4 price-oracle-v2.clar

**Purpose**: Multi-submitter price oracle with median calculation.

**Key Features**:
- Multiple authorized submitters (2+ sources)
- Tolerance band: 2% max deviation from existing price
- Staleness check: price considered stale after 12 blocks (~2 hours)
- Last update timestamp tracked

### 3.5 insurance-fund.clar (259 lines)

**Purpose**: Insurance reserve for vault shortfall coverage.

**Key Features**:
- Accumulates 5% of all premiums (INSURANCE-FEE-BPS = 500)
- Covers ITM payouts when vault balance insufficient
- Emergency withdrawal with 144-block timelock
- Admin or vault contract can trigger coverage

### 3.6 admin-multisig.clar

**Purpose**: 2-of-3 multisig for critical operations.

**Key Features**:
- 3 signers, configurable by deployer
- Proposal -> Approve (2 of 3) -> Execute flow
- 144-block timelock between approval and execution
- 1008-block proposal expiry

### 3.7 governance-token.clar

**Purpose**: SIP-010 governance token for protocol voting.

**Token Details**:
- Name: sVault Governance (sVGOV)
- Decimals: 6
- Max Supply: 100,000,000
- Mint ratio: 1 sBTC deposited = 1000 GOV

**Claim Mechanism**:
- Users claim GOV proportional to vault shares
- `entitled = vault_shares * MINT_MULTIPLIER (10)`
- Tracks claimed amount per user, only mints delta

### 3.8 governance-voting.clar

**Purpose**: On-chain parameter voting using GOV tokens.

**Votable Parameters**:
- strike-otm-bps, management-fee-bps, performance-fee-bps
- epoch-duration, insurance-fee-bps, withdrawal-limit-bps

**Voting Rules**:
- Minimum 1000 GOV to create proposal
- Vote period: 1008 blocks (~7 days)
- Quorum: 10% of total supply must vote
- Execution delay: 144 blocks after vote ends
- Proposal expires after 2016 blocks (~14 days)

### 3.9 vault-strategy-v1.clar

**Purpose**: Multi-strategy configuration for epoch management.

**Strategy Parameters**:
- Allocation (% of TVL in basis points)
- Strike OTM percentage
- Duration in blocks
- Minimum collateral threshold

**Constraints**:
- Max 5 strategies
- Total allocation cannot exceed 100%
- Performance tracking per strategy

---

## 4. Epoch Lifecycle

```
1. IDLE
   |-- admin/keeper calls start-epoch(strike, premium, duration)
   v
2. ACTIVE
   |-- option listed on market (create-listing)
   |-- option bought by user (buy-option)
   |-- premium auto-compounded to vault TVL
   |-- deposits blocked, withdrawals blocked
   |-- wait for expiry block
   v
3. EXPIRED
   |-- admin/keeper calls settle-epoch or settle-epoch-with-oracle
   |-- settlement price vs strike price determines outcome:
   |     OTM (price <= strike): vault keeps premium, no payout
   |     ITM (price > strike): payout calculated, sent to buyer
   |-- fees deducted (management + performance)
   |-- insurance premium collected (5%)
   v
4. SETTLED -> back to IDLE
   |-- deposits/withdrawals re-enabled
   |-- cooldown period (6 blocks)
   |-- new epoch can be started
```

---

## 5. Off-Chain Components

### 5.1 Keeper Bot (`keeper/`)

Automated epoch management and oracle price submission.

**Services**:
- **Price Submitter**: Fetches BTC/USD from CoinGecko, Binance, Kraken; submits median on-chain
- **Epoch Manager**: Auto-settles expired epochs, starts new ones with Black-Scholes pricing
- **Monitor**: TVL health, oracle staleness, keeper wallet balance, insurance fund level

### 5.2 Event Indexer (`indexer/`)

Chainhook-based event indexer for historical data.

**Endpoints**:
- `GET /api/events` - All events (paginated)
- `GET /api/epochs` - Epoch history
- `GET /api/stats` - Protocol statistics
- `GET /api/user/:address` - User activity
- `POST /api/chainhook` - Webhook receiver

### 5.3 Frontend (`frontend/`)

Next.js 16 application with Stacks wallet integration.

**Key Features**:
- Deposit/withdraw with share price display
- Epoch status and history
- Option marketplace (buy covered calls)
- Admin panel (epoch management, oracle, settings)
- Performance charts and analytics

---

## 6. Security Model

### Access Control Matrix

| Function | Deployer | Keeper | User | Market | Vault |
|----------|----------|--------|------|--------|-------|
| deposit/withdraw | x | | x | | |
| start/settle epoch | x | | | | |
| submit price | x | x | | | |
| buy option | | | x | | |
| record-option-sale | | | | x | |
| cover shortfall | x | | | | x |
| collect premium | | | | | x |
| set-logic-contract | x | | | | |
| pause vault | x | | | | |

### Invariants

1. `total_shares > 0 => total_sbtc > 0` (no shares without backing)
2. `payout <= vault_balance` (no overdraft)
3. `withdrawal_per_period <= 25% TVL` (bank-run prevention)
4. `oracle_price_age <= 12 blocks` (staleness protection)
5. `settlement_price > 0` (no division by zero)
6. `epoch_duration > 0` (no instant expiry)
7. `one_listing_per_epoch` (no duplicate options)

---

## 7. Token Standards

- **sBTC**: SIP-010 fungible token (8 decimals)
- **sVGOV**: SIP-010 governance token (6 decimals)
- All token interactions use the SIP-010 trait for type safety

---

## 8. Precision & Units

| Value | Precision | Unit |
|-------|-----------|------|
| sBTC amounts | 8 decimals | satoshis |
| USD prices | 6 decimals | micro-USD |
| Share price | 8 decimals | PRECISION constant |
| Basis points | 4 decimals | 1 bps = 0.01% |
| GOV tokens | 6 decimals | micro-GOV |

---

## 9. Deployment

### Contract Deployment Order

1. `sip-010-trait`
2. `admin-multisig`
3. `mock-sbtc` (testnet/simnet only)
4. `vault-data-v1`
5. `price-oracle-v2`
6. `vault-logic-v2`
7. `options-market-v2`
8. `insurance-fund`
9. `governance-token`
10. `governance-voting`
11. `vault-strategy-v1`

### Post-Deployment Setup

1. `vault-data-v1.set-logic-contract(vault-logic-v2)`
2. `vault-logic-v2.set-market-contract(options-market-v2)`
3. `vault-logic-v2.set-treasury(treasury-address)`
4. `insurance-fund.set-vault-contract(vault-logic-v2)`
5. `governance-voting.initialize-params()`
6. `admin-multisig.set-signers(s1, s2, s3)`
