import {
  uintCV,
  principalCV,
  contractPrincipalCV,
  boolCV,
  cvToJSON,
  serializeCV,
  deserializeCV,
  Pc,
  PostConditionMode,
  type ClarityValue,
} from "@stacks/transactions";
import { CONTRACTS, DEPLOYER_ADDRESS, HIRO_API_URL, network } from "./stacks-config";
import { cached } from "./cache";
import { withRetry } from "./retry";
import type { VaultInfo, UserInfo, Epoch, OracleInfo, Listing } from "./types";

// Direct read-only call using native fetch with retry (bypasses library encoding issues)
async function readOnly(
  contract: { address: string; name: string },
  functionName: string,
  args: ClarityValue[] = [],
  sender?: string
) {
  return withRetry(async () => {
    const senderAddress = sender || DEPLOYER_ADDRESS;
    const serializedArgs = args.map((arg) => `0x${serializeCV(arg)}`);
    const url = `${HIRO_API_URL}/v2/contracts/call-read/${contract.address}/${contract.name}/${encodeURIComponent(functionName)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: senderAddress, arguments: serializedArgs }),
    });

    if (!response.ok) {
      const msg = await response.text().catch(() => "");
      throw new Error(
        `Read-only call failed (${response.status}): ${contract.name}.${functionName} — ${msg}`
      );
    }

    const json = await response.json();
    if (!json.okay) {
      throw new Error(`Clarity error: ${json.cause || JSON.stringify(json)}`);
    }

    const resultCV = deserializeCV(json.result);
    return cvToJSON(resultCV);
  }, 3, 1000);
}

// ── Vault read-only calls (cached + deduplicated) ───────────────────

export function getVaultInfo(): Promise<VaultInfo> {
  return cached("vault-info", async () => {
    const result = await readOnly(CONTRACTS.VAULT, "get-vault-info");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (result as any).value.value;
    return {
      totalShares: BigInt(v["total-shares"].value),
      totalSbtcDeposited: BigInt(v["total-sbtc-deposited"].value),
      currentEpochId: BigInt(v["current-epoch-id"].value),
      activeEpoch: v["active-epoch"].value,
      vaultPaused: v["vault-paused"].value,
      sharePrice: BigInt(v["share-price"].value),
      totalPremiumsEarned: BigInt(v["total-premiums-earned"].value),
      totalEpochsCompleted: BigInt(v["total-epochs-completed"].value),
      totalFeesCollected: BigInt(v["total-fees-collected"]?.value ?? "0"),
    };
  });
}

export function getUserInfo(userAddress: string): Promise<UserInfo> {
  return cached(`user-info:${userAddress}`, async () => {
    const result = await readOnly(
      CONTRACTS.VAULT,
      "get-user-info",
      [principalCV(userAddress)],
      userAddress
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (result as any).value.value;
    return {
      shares: BigInt(v.shares.value),
      sbtcValue: BigInt(v["sbtc-value"].value),
      sharePrice: BigInt(v["share-price"].value),
    };
  }, 5_000); // 5s TTL — user balance changes more frequently
}

export function getEpoch(epochId: number): Promise<Epoch | null> {
  return cached(`epoch:${epochId}`, async () => {
    const result = await readOnly(CONTRACTS.VAULT, "get-epoch", [
      uintCV(epochId),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    if (r.value === null) return null;
    const v = r.value.value || r.value;
    return {
      strikePrice: BigInt(v["strike-price"].value),
      premium: BigInt(v.premium.value),
      collateral: BigInt(v.collateral.value),
      startBlock: BigInt(v["start-block"].value),
      expiryBlock: BigInt(v["expiry-block"].value),
      settled: v.settled.value,
      settlementPrice: BigInt(v["settlement-price"].value),
      premiumEarned: BigInt(v["premium-earned"].value),
      payout: BigInt(v.payout.value),
      outcome: v.outcome.value,
    };
  });
}

export function getOracleInfo(): Promise<OracleInfo> {
  return cached("oracle-info", async () => {
    const result = await readOnly(CONTRACTS.ORACLE, "get-oracle-info");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (result as any).value.value;
    return {
      price: BigInt(v.price.value),
      lastUpdateBlock: BigInt(v["last-update-block"].value),
      currentRound: BigInt(v["current-round"].value),
      currentBlock: BigInt(v["current-block"].value),
      isStale: v["is-stale"].value,
      submitterCount: BigInt(v["submitter-count"]?.value ?? "0"),
      oraclePaused: v["oracle-paused"]?.value ?? false,
      stalenessLimit: BigInt(v["staleness-limit"]?.value ?? "12"),
      toleranceBps: BigInt(v["tolerance-bps"]?.value ?? "200"),
    };
  });
}

// ── Listing read-only calls ─────────────────────────────────────────

export async function getListingCount(): Promise<number> {
  const result = await readOnly(CONTRACTS.MARKET, "get-listing-count");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Number((result as any).value);
}

export function getListing(id: number): Promise<(Listing & { id: number }) | null> {
  return cached(`listing:${id}`, async () => {
    const result = await readOnly(CONTRACTS.MARKET, "get-listing", [uintCV(id)]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = result as any;
    if (!r.value) return null;
    const v = r.value.value || r.value;
    return {
      id,
      epochId: BigInt(v["epoch-id"].value),
      strikePrice: BigInt(v["strike-price"].value),
      premium: BigInt(v.premium.value),
      collateral: BigInt(v.collateral.value),
      expiryBlock: BigInt(v["expiry-block"].value),
      sold: v.sold.value,
      buyer: v.buyer.value?.value || null,
      createdBlock: BigInt(v["created-block"].value),
      claimed: v.claimed.value,
    };
  });
}

/**
 * Fetch all listings in parallel chunks (fixes N+1 sequential fetch).
 * Chunks of 20 to handle 100 listings efficiently while avoiding rate-limiting.
 */
const PARALLEL_CHUNK_SIZE = 20;

export async function getListingsBatch(): Promise<(Listing & { id: number })[]> {
  const count = await getListingCount();
  if (count === 0) return [];

  const items: (Listing & { id: number })[] = [];

  for (let start = 1; start <= count; start += PARALLEL_CHUNK_SIZE) {
    const end = Math.min(start + PARALLEL_CHUNK_SIZE - 1, count);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const results = await Promise.all(ids.map((id) => getListing(id).catch(() => null)));
    for (const r of results) {
      if (r) items.push(r);
    }
  }

  return items;
}

/**
 * Fetch multiple epochs in parallel (fixes N+1 sequential fetch).
 */
export async function getEpochsBatch(epochIds: number[]): Promise<Map<number, Epoch>> {
  const epochMap = new Map<number, Epoch>();
  if (epochIds.length === 0) return epochMap;

  for (let start = 0; start < epochIds.length; start += PARALLEL_CHUNK_SIZE) {
    const chunk = epochIds.slice(start, start + PARALLEL_CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((id) => getEpoch(id).catch(() => null))
    );
    chunk.forEach((id, i) => {
      if (results[i]) epochMap.set(id, results[i]!);
    });
  }

  return epochMap;
}

// Token asset identifier for post-conditions
const ftId: `${string}.${string}` = `${CONTRACTS.MOCK_SBTC.address}.${CONTRACTS.MOCK_SBTC.name}`;
const ftAsset = CONTRACTS.MOCK_SBTC.assetName;

// Transaction builders
export function buildDepositTx(amount: number, senderAddress: string) {
  return {
    contractAddress: CONTRACTS.VAULT.address,
    contractName: CONTRACTS.VAULT.name,
    functionName: "deposit",
    functionArgs: [
      contractPrincipalCV(CONTRACTS.MOCK_SBTC.address, CONTRACTS.MOCK_SBTC.name),
      uintCV(amount),
    ],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      Pc.principal(senderAddress).willSendEq(amount).ft(ftId, ftAsset),
    ],
    network,
  };
}

export function buildWithdrawTx(shares: number, senderAddress: string) {
  // M-2 FIX: Use Deny mode — vault should only send sBTC to the user
  const vaultContractId: `${string}.${string}` = `${CONTRACTS.VAULT.address}.${CONTRACTS.VAULT.name}`;
  return {
    contractAddress: CONTRACTS.VAULT.address,
    contractName: CONTRACTS.VAULT.name,
    functionName: "withdraw",
    functionArgs: [
      contractPrincipalCV(CONTRACTS.MOCK_SBTC.address, CONTRACTS.MOCK_SBTC.name),
      uintCV(shares),
    ],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      // User burns shares (sends nothing), vault sends sBTC to user
      Pc.principal(vaultContractId).willSendLte(shares * 2).ft(ftId, ftAsset),
    ],
    network,
  };
}

export function buildFaucetTx() {
  return {
    contractAddress: CONTRACTS.MOCK_SBTC.address,
    contractName: CONTRACTS.MOCK_SBTC.name,
    functionName: "faucet",
    functionArgs: [],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

export function buildBuyOptionTx(listingId: number, premium: number, senderAddress: string) {
  const marketContractId: `${string}.${string}` = `${CONTRACTS.MARKET.address}.${CONTRACTS.MARKET.name}`;
  return {
    contractAddress: CONTRACTS.MARKET.address,
    contractName: CONTRACTS.MARKET.name,
    functionName: "buy-option",
    functionArgs: [
      contractPrincipalCV(CONTRACTS.MOCK_SBTC.address, CONTRACTS.MOCK_SBTC.name),
      uintCV(listingId),
    ],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      // Buyer sends premium to market contract
      Pc.principal(senderAddress).willSendEq(premium).ft(ftId, ftAsset),
      // Market contract forwards premium to vault
      Pc.principal(marketContractId).willSendEq(premium).ft(ftId, ftAsset),
    ],
    network,
  };
}

export function buildClaimPayoutTx(listingId: number) {
  // M-3 FIX: Use Deny mode — market contract should only send sBTC payout to buyer
  const vaultContractId: `${string}.${string}` = `${CONTRACTS.VAULT.address}.${CONTRACTS.VAULT.name}`;
  const marketContractId: `${string}.${string}` = `${CONTRACTS.MARKET.address}.${CONTRACTS.MARKET.name}`;
  return {
    contractAddress: CONTRACTS.MARKET.address,
    contractName: CONTRACTS.MARKET.name,
    functionName: "claim-payout",
    functionArgs: [
      contractPrincipalCV(CONTRACTS.MOCK_SBTC.address, CONTRACTS.MOCK_SBTC.name),
      uintCV(listingId),
    ],
    postConditionMode: PostConditionMode.Deny,
    postConditions: [
      // Vault sends payout to market, market forwards to buyer
      Pc.principal(vaultContractId).willSendLte(100_000_000_000).ft(ftId, ftAsset),
      Pc.principal(marketContractId).willSendLte(100_000_000_000).ft(ftId, ftAsset),
    ],
    network,
  };
}

// Admin tx builders
export function buildStartEpochTx(
  strikePrice: number,
  premium: number,
  duration: number
) {
  return {
    contractAddress: CONTRACTS.VAULT.address,
    contractName: CONTRACTS.VAULT.name,
    functionName: "start-epoch",
    functionArgs: [uintCV(strikePrice), uintCV(premium), uintCV(duration)],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

export function buildCreateListingTx(
  epochId: number,
  strikePrice: number,
  premium: number,
  collateral: number,
  expiryBlock: number
) {
  return {
    contractAddress: CONTRACTS.MARKET.address,
    contractName: CONTRACTS.MARKET.name,
    functionName: "create-listing",
    functionArgs: [
      uintCV(epochId),
      uintCV(strikePrice),
      uintCV(premium),
      uintCV(collateral),
      uintCV(expiryBlock),
    ],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

export function buildSettleEpochTx(epochId: number, settlementPrice: number) {
  return {
    contractAddress: CONTRACTS.VAULT.address,
    contractName: CONTRACTS.VAULT.name,
    functionName: "settle-epoch",
    functionArgs: [
      contractPrincipalCV(CONTRACTS.MOCK_SBTC.address, CONTRACTS.MOCK_SBTC.name),
      uintCV(epochId),
      uintCV(settlementPrice),
    ],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

export function buildSetPriceTx(price: number) {
  return {
    contractAddress: CONTRACTS.ORACLE.address,
    contractName: CONTRACTS.ORACLE.name,
    functionName: "set-btc-price",
    functionArgs: [uintCV(price)],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

// V2: Settle epoch using oracle price (no manual price needed)
export function buildSettleEpochWithOracleTx(epochId: number) {
  return {
    contractAddress: CONTRACTS.VAULT.address,
    contractName: CONTRACTS.VAULT.name,
    functionName: "settle-epoch-with-oracle",
    functionArgs: [
      contractPrincipalCV(CONTRACTS.MOCK_SBTC.address, CONTRACTS.MOCK_SBTC.name),
      uintCV(epochId),
    ],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

// V2: Submit price as authorized submitter
export function buildSubmitPriceTx(price: number) {
  return {
    contractAddress: CONTRACTS.ORACLE.address,
    contractName: CONTRACTS.ORACLE.name,
    functionName: "submit-price",
    functionArgs: [uintCV(price)],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

// V2: Add oracle submitter (admin only)
export function buildAddSubmitterTx(submitter: string) {
  return {
    contractAddress: CONTRACTS.ORACLE.address,
    contractName: CONTRACTS.ORACLE.name,
    functionName: "add-submitter",
    functionArgs: [principalCV(submitter)],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

// Setup: Set logic contract on vault-data-v1 (required once after deployment)
export function buildSetLogicContractTx() {
  return {
    contractAddress: CONTRACTS.VAULT_DATA.address,
    contractName: CONTRACTS.VAULT_DATA.name,
    functionName: "set-logic-contract",
    functionArgs: [
      contractPrincipalCV(CONTRACTS.VAULT.address, CONTRACTS.VAULT.name),
    ],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

// Setup: Set market contract on vault-logic-v2 (required once after deployment)
export function buildSetMarketContractTx() {
  return {
    contractAddress: CONTRACTS.VAULT.address,
    contractName: CONTRACTS.VAULT.name,
    functionName: "set-market-contract",
    functionArgs: [
      contractPrincipalCV(CONTRACTS.MARKET.address, CONTRACTS.MARKET.name),
    ],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}

// V2: Set vault paused (admin only)
export function buildSetVaultPausedTx(paused: boolean) {
  return {
    contractAddress: CONTRACTS.VAULT.address,
    contractName: CONTRACTS.VAULT.name,
    functionName: "set-vault-paused",
    // M-6 FIX: Clarity expects bool, not uint — was causing type mismatch on-chain
    functionArgs: [boolCV(paused)],
    postConditionMode: PostConditionMode.Allow,
    postConditions: [],
    network,
  };
}
