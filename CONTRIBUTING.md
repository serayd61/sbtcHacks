# Contributing to sBTC Options Vault

## Development Setup

### Prerequisites
- Node.js 20+
- [Clarinet](https://github.com/hirosystems/clarinet) (Clarity contract tooling)
- npm or yarn

### Install Dependencies
```bash
# Root (tests)
npm install

# Frontend
cd frontend && npm install

# Keeper bot
cd keeper && npm install

# SDK
cd sdk && npm install
```

## Project Structure

```
sbtcHacks/
├── contracts/          # 29 Clarity smart contracts
├── tests/              # 10 Vitest test suites (167 tests)
├── frontend/           # Next.js 16 / React 19 / Tailwind 4
├── keeper/             # TypeScript keeper bot (price, epoch, monitor)
├── sdk/                # @sbtc-options/sdk npm package
├── mobile/             # React Native Expo app
├── scripts/            # Activity bot, wallet tools
├── deployments/        # Simnet/testnet/mainnet deployment plans
└── .github/workflows/  # CI/CD pipeline
```

## Smart Contract Tiers

| Tier | Focus | Contracts |
|------|-------|-----------|
| Core | Vault + Market | vault-logic-v2, vault-data-v1, price-oracle-v2, options-market-v5 |
| Tier 1 | Security | circuit-breaker-v1, treasury-multisig-v2, upgrade-manager-v1, insurance-fund-v2 |
| Tier 2.1 | Advanced Strategies | advanced-options-market-v7, advanced-vault-strategy-v3, dynamic-strategy-selector-v1 |
| Tier 2.3 | Tokenomics | enhanced-governance-token-v2, yield-farming-pools-v1 |
| Tier 2.5 | Cross-Chain | cross-chain-bridge-v1 |

## Running Tests

```bash
# All tests (167)
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:report

# Contract syntax check
clarinet check
```

## Contract Development

1. Write/edit `.clar` file in `contracts/`
2. Add to `Clarinet.toml` with dependencies
3. Write tests in `tests/` following existing patterns (Vitest + simnet)
4. Run `clarinet check` and `npm test`
5. Deploy: `STACKS_PRIVATE_KEY=... node deploy-mainnet.mjs`

## Frontend Development

```bash
cd frontend
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
```

## Commit Convention

```
feat(scope): description     # New feature
fix(scope): description      # Bug fix
test: description            # Tests
docs: description            # Documentation
ci: description              # CI/CD changes
chore: description           # Maintenance
```

## Key Technical Notes

- **block-height = tenure_height** post-Nakamoto (~234K, not ~7M)
- **Price precision**: USD = 6 decimals, sBTC = 8 decimals (satoshi)
- **cvToJSON**: Always use defensive parsing — format varies by version
- **Never commit `.env`** or private keys
- **Oracle function**: `set-btc-price` (admin-only), not `submit-price`

## License

This project is built for the Stacks BUIDL BATTLE #2 hackathon.
