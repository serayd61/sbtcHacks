import { STACKS_TESTNET, STACKS_MAINNET } from "@stacks/network";

export const IS_MAINNET =
  process.env.NEXT_PUBLIC_NETWORK !== "testnet";

export const network = IS_MAINNET ? STACKS_MAINNET : STACKS_TESTNET;

export const HIRO_API_URL = IS_MAINNET
  ? "https://api.mainnet.hiro.so"
  : "https://api.testnet.hiro.so";

export const DEPLOYER_ADDRESS = (
  process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS ||
  "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W"
).trim();

// Real sBTC on Stacks mainnet (uncomment when ready for production)
// export const SBTC_CONTRACT_ADDRESS = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
// export const SBTC_CONTRACT_NAME = "sbtc-token";
// export const SBTC_ASSET_NAME = "sbtc";

// V1 contracts (deployed on mainnet, kept for backward compatibility)
export const CONTRACTS_V1 = {
  VAULT: { address: DEPLOYER_ADDRESS, name: "sbtc-options-vault" },
  MARKET: { address: DEPLOYER_ADDRESS, name: "options-market" },
  ORACLE: { address: DEPLOYER_ADDRESS, name: "price-oracle" },
} as const;

// V2 contracts (Phase 1 + Phase 2)
export const CONTRACTS = {
  MOCK_SBTC: {
    address: DEPLOYER_ADDRESS,
    name: "mock-sbtc",
    assetName: "mock-sbtc",
  },
  VAULT_DATA: {
    address: DEPLOYER_ADDRESS,
    name: "vault-data-v1",
  },
  VAULT: {
    address: DEPLOYER_ADDRESS,
    name: "vault-logic-v2",
  },
  MARKET: {
    address: DEPLOYER_ADDRESS,
    name: "options-market-v2",
  },
  ORACLE: {
    address: DEPLOYER_ADDRESS,
    name: "price-oracle-v2",
  },
  MULTISIG: {
    address: DEPLOYER_ADDRESS,
    name: "admin-multisig",
  },
} as const;

export const SBTC_DECIMALS = 8;
export const PRICE_DECIMALS = 6;
export const ONE_SBTC = 100_000_000;

export function formatSBTC(sats: number | bigint): string {
  const val = Number(sats) / ONE_SBTC;
  // Show up to 4 significant decimals, strip trailing zeros
  if (val === 0) return "0";
  if (val >= 1) return val.toFixed(4);
  return val.toPrecision(4).replace(/\.?0+$/, "");
}

export function formatUSD(priceRaw: number | bigint): string {
  const val = Number(priceRaw) / 1_000_000;
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

export function parseSBTC(amount: string): number {
  return Math.floor(parseFloat(amount) * ONE_SBTC);
}
