# Changelog

All notable changes to the sBTC Options Vault protocol are documented here.

## [3.0.0] — 2026-03-27

### Added — Tier 1: Institutional-Grade Security
- **Circuit Breaker v1**: Multi-level emergency protection system (WARNING/PARTIAL/EMERGENCY/SHUTDOWN) with TVL drop detection, price deviation monitoring, and oracle failure triggers
- **Treasury Multisig v2**: 3-of-5 threshold multisig with 48h timelock, 8 action types, proposal/approval/execute lifecycle
- **Upgrade Manager v1**: Time-locked contract upgrade system — normal (48h), emergency (24h), hotfix timelocks with governance approval
- **Insurance Fund v2**: Dynamic risk management with fund ratio controls (20-50%), emergency withdrawal queue, rebalancing history

### Added — Tier 2.1: Advanced Options Strategies
- **Advanced Options Market v7**: Multi-strike ladders (10 per epoch), put/call support, Greeks tracking (delta, gamma, theta, vega), 100K listings/epoch
- **Advanced Vault Strategy v3**: Dynamic strategy allocation for covered calls, cash-secured puts, iron condors, straddles, collars with market regime detection
- **Dynamic Strategy Selector v1**: ML-based 12-feature model for strategy optimization, Kelly criterion allocation, regime classification

### Added — Tier 2.3: Enhanced Tokenomics
- **Enhanced Governance Token v2 (SOVT)**: 1B max supply, veToken staking mechanics, liquidity mining, revenue sharing, lock multipliers
- **Yield Farming Pools v1**: Multi-pool system (20 pools max), auto-compounding, boost mechanics (up to 2.5x), pool types (SINGLE/LP/VAULT)

### Added — Tier 2.5: Cross-Chain Integration
- **Cross-Chain Bridge v1**: Lightning Network + Ethereum L2 support (Arbitrum, Optimism, Polygon, Base), liquidity pools, L2 yield farming

### Added — Platform
- **Mobile App**: React Native Expo app with 5-tab navigation, biometric auth, push notifications, Redux state management
- **SDK**: @sbtc-options/sdk npm package — full TypeScript SDK for protocol interaction
- **Advanced Analytics Dashboard**: P&L charts, volatility surface, Greeks breakdown, portfolio metrics (Sharpe ratio, max drawdown)
- **167 unit tests** across 10 test files (Vitest + Clarinet SDK)
- **CI/CD**: SDK build, security audit, contract metrics jobs

## [2.0.0] — 2026-03-21

### Added
- V2 vault architecture (vault-logic-v2 + vault-data-v1 separation)
- Price Oracle V2 with multi-source (CoinGecko, Binance, Kraken) median
- Options Market iterations (v2 through v6) — scaling from 10 to 10K listings/epoch
- Keeper bot: price oracle submitter, epoch manager, health monitor
- Emergency restart tool for stuck epochs
- Vercel cron endpoint for serverless keeper operation
- Governance token (sVGOV) + voting system
- Admin multisig (2-of-3)

### Fixed
- Epoch 1 stuck forever (Nakamoto upgrade: block-height → tenure_height)
- Vercel cron settle spam (829 failed TXs, ~7+ STX wasted)
- cvToJSON parsing inconsistencies across @stacks/transactions versions

## [1.0.0] — 2026-03-15

### Added
- Initial vault + options market deployment
- SIP-010 mock sBTC token with faucet
- V1 price oracle
- Basic covered call options lifecycle
- Next.js 16 frontend with Stacks wallet integration
- 22 unit tests covering core functionality
