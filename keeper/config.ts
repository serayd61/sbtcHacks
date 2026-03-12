// keeper/config.ts
// Configuration for the keeper bot services

export const KEEPER_CONFIG = {
  // Stacks network
  network: "mainnet" as "mainnet" | "testnet",
  stacksApiUrl: "https://api.mainnet.hiro.so",

  // Contract addresses
  deployerAddress: "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W",
  contracts: {
    priceOracleV2: "price-oracle-v2",
    vaultLogicV2: "vault-logic-v2",
    vaultDataV1: "vault-data-v1",
    optionsMarketV4: "options-market-v4",
    mockSbtc: "mock-sbtc",
  },

  // Oracle settings
  oracle: {
    updateIntervalMs: 10 * 60 * 1000, // 10 minutes
    priceSources: ["coingecko", "binance", "kraken"] as const,
    toleranceBps: 200, // 2% max deviation
    staleAfterBlocks: 12, // ~2 hours
  },

  // Epoch management
  epoch: {
    strikeOtmPercent: 5, // 5% out-of-the-money
    defaultDurationBlocks: 1008, // ~7 days
    cooldownBlocks: 6, // ~1 hour between epochs
    autoSettle: true,
    autoStartNew: true,
  },

  // Pricing
  pricing: {
    defaultIV: 0.8, // 80% implied volatility (BTC historical)
    riskFreeRate: 0.05, // 5% annual risk-free rate
  },

  // Monitoring
  monitoring: {
    tvlDropAlertPercent: 10, // Alert if TVL drops >10% in one epoch
    oracleStaleAlertBlocks: 8, // Alert before staleness limit
    webhookUrl: process.env.KEEPER_WEBHOOK_URL || "", // Discord/Telegram webhook
    keeperWalletMinStx: 10_000_000, // 10 STX minimum balance for gas
  },
};

// Price source API endpoints
export const PRICE_ENDPOINTS = {
  coingecko: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
  binance: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
  kraken: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
};

export type PriceSource = (typeof KEEPER_CONFIG.oracle.priceSources)[number];
