# @sbtc-options/sdk

TypeScript SDK for the sBTC Options Vault protocol — advanced options trading on Bitcoin via Stacks.

## Installation

```bash
npm install @sbtc-options/sdk
```

## Quick Start

```typescript
import { SBTCOptionsSDK } from '@sbtc-options/sdk';

// Initialize SDK
const sdk = new SBTCOptionsSDK({
  network: 'mainnet',
  deployerAddress: 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W'
});

// Get vault info
const vault = await sdk.getVaultInfo();
console.log(`TVL: ${vault.totalSbtcDeposited} sats`);
console.log(`Share Price: ${vault.sharePrice}`);

// Get user position
const user = await sdk.getUserInfo('SP...');
console.log(`Shares: ${user.shares}`);
console.log(`sBTC Value: ${user.sbtcValue}`);

// Get current epoch
const epoch = await sdk.getEpoch(vault.currentEpochId);
console.log(`Strike: $${epoch.strikePrice / 1_000_000}`);

// Get oracle price
const oracle = await sdk.getOracleInfo();
console.log(`BTC Price: $${oracle.price / 1_000_000}`);
```

## Features

### Core Vault
- `getVaultInfo()` — TVL, shares, epoch state, share price
- `getUserInfo(address)` — User shares and sBTC value
- `getEpoch(epochId)` — Epoch details (strike, premium, settlement)
- `getOracleInfo()` — Oracle price, staleness, round info

### Advanced Options (v7)
- `getStrikeLadder(epochId)` — Multi-strike ladder with Greeks
- `getStrategy(strategyId)` — Iron condors, straddles, collars
- `getListingsByEpoch(epochId)` — All option listings

### Governance (SOVT)
- `getGovernanceTokenInfo()` — Total supply, staking stats
- `getStakeInfo(address)` — veToken balance, lock period
- `getYieldFarmingPool(poolId)` — Pool stats, APY, TVL

### Security
- `getCircuitBreakerStatus()` — Protection level, trigger history
- `getInsuranceFundBalance()` — Fund ratio, reserves

## Protocol Contracts

| Contract | Purpose |
|----------|---------|
| `vault-logic-v2` | Core vault engine |
| `advanced-options-market-v7` | Multi-strike options with Greeks |
| `enhanced-governance-token-v2` | SOVT governance token |
| `circuit-breaker-v1` | Emergency protection |
| `yield-farming-pools-v1` | Yield farming |
| `cross-chain-bridge-v1` | Lightning + L2 bridge |

## Links

- **Live App**: [sbtcvault.live](https://sbtcvault.live)
- **GitHub**: [github.com/serayd61/sbtcHacks](https://github.com/serayd61/sbtcHacks)
- **Contracts**: Deployed at `SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W`

## License

MIT
