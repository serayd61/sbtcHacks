import { STACKS_MAINNET } from "@stacks/network";

export const BOT_CONFIG = {
  network: STACKS_MAINNET,
  apiUrl: "https://api.mainnet.hiro.so",
  deployerAddress: "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W",
  contracts: {
    mockSbtc: "mock-sbtc",
    optionsMarket: "options-market-v5",
    vaultLogic: "vault-logic-v2",
  },
  walletCount: 1000,
  stxPerWallet: 100_000n, // 0.1 STX in microSTX
  batchSize: 25, // TXs per batch
  batchDelayMs: 60_000, // 1 minute between batches
  defaultFee: 2000n, // 0.002 STX gas fee per TX
  walletsFile: "wallets.json",
  progressFile: "progress.json",
};

export const DEPLOYER = BOT_CONFIG.deployerAddress;
export const MOCK_SBTC_CONTRACT = `${DEPLOYER}.${BOT_CONFIG.contracts.mockSbtc}`;
export const OPTIONS_MARKET_CONTRACT = `${DEPLOYER}.${BOT_CONFIG.contracts.optionsMarket}`;
