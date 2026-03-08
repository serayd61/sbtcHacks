import { STACKS_TESTNET, STACKS_MAINNET } from "@stacks/network";

export const IS_MAINNET = false;

export const network = IS_MAINNET ? STACKS_MAINNET : STACKS_TESTNET;

export const DEPLOYER_ADDRESS =
  process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS ||
  "ST387HJN7F2HR9KQ4250YGFCA4815T1F9X54ZJDDN";

export const CONTRACTS = {
  MOCK_SBTC: {
    address: DEPLOYER_ADDRESS,
    name: "mock-sbtc",
    assetName: "mock-sbtc",
  },
  VAULT: {
    address: DEPLOYER_ADDRESS,
    name: "sbtc-options-vault",
  },
  MARKET: {
    address: DEPLOYER_ADDRESS,
    name: "options-market",
  },
  ORACLE: {
    address: DEPLOYER_ADDRESS,
    name: "price-oracle",
  },
} as const;

export const SBTC_DECIMALS = 8;
export const PRICE_DECIMALS = 6;
export const ONE_SBTC = 100_000_000;

export function formatSBTC(sats: number | bigint): string {
  const val = Number(sats) / ONE_SBTC;
  return val.toFixed(8);
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
