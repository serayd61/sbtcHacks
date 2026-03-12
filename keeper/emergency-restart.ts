// keeper/emergency-restart.ts
// Emergency script: Settle stuck Epoch 1 and start a fresh epoch
//
// Problem: Epoch 1 was started pre-Nakamoto when block-height = stacks_tip_height (~939K).
// Post-Nakamoto, block-height = tenure_height (~234K), so epoch never expires.
//
// Solution: emergency-settle (bypasses expiry check) → unpause → start new epoch → create listing
//
// Usage:
//   KEEPER_PRIVATE_KEY=<deployer-hex-key> npx tsx keeper/emergency-restart.ts
//
// Safety: Runs in DRY RUN mode unless --execute flag is passed
//   KEEPER_PRIVATE_KEY=<key> npx tsx keeper/emergency-restart.ts --execute

import { KEEPER_CONFIG } from "./config";
import { broadcastTx, requirePrivateKey, resetNonceTracker, DEPLOYER } from "./tx-sender";
import { fetchAllPrices, calculateMedianPrice, priceToOnChain } from "./price-submitter";
import { calculateCallPremium, formatPricingInfo } from "./pricing";
import { parseVaultInfo, parseEpochInfo } from "./clarity-parser";

const API_BASE = KEEPER_CONFIG.stacksApiUrl;
const DRY_RUN = !process.argv.includes("--execute");

// ============================================
// Helpers
// ============================================

async function callReadOnly(
  contract: string,
  fn: string,
  args: string[] = []
): Promise<Record<string, unknown>> {
  const url = `${API_BASE}/v2/contracts/call-read/${DEPLOYER}/${contract}/${fn}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: DEPLOYER, arguments: args }),
  });
  if (!response.ok) throw new Error(`API ${response.status}: ${contract}.${fn}`);
  return response.json();
}

async function getCurrentTenureHeight(): Promise<bigint> {
  const response = await fetch(`${API_BASE}/v2/info`);
  const data = await response.json();
  return BigInt(data.tenure_height);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Step 1: Pause vault
// ============================================

async function pauseVault(privateKey: string): Promise<string> {
  const { boolCV, AnchorMode } = await import("@stacks/transactions");

  console.log("\n[STEP 1] Pausing vault...");

  if (DRY_RUN) {
    console.log("  [DRY RUN] Would call: vault-logic-v2.set-vault-paused(true)");
    return "dry-run-pause-tx";
  }

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "set-vault-paused",
    functionArgs: [boolCV(true)],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 10000n,
  });

  console.log(`  TX: ${txId}`);
  return txId;
}

// ============================================
// Step 2: Emergency settle epoch 1
// ============================================

async function emergencySettle(
  privateKey: string,
  epochId: bigint,
  settlementPrice: bigint
): Promise<string> {
  const { uintCV, contractPrincipalCV, AnchorMode } = await import("@stacks/transactions");

  console.log(`\n[STEP 2] Emergency settling epoch #${epochId}...`);
  console.log(`  Settlement price: ${settlementPrice} ($${(Number(settlementPrice) / 1_000_000).toLocaleString()})`);
  console.log("  Outcome: OTM (forced), Payout: 0, Fees: 0");

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would call: vault-logic-v2.emergency-settle(mock-sbtc, u${epochId}, u${settlementPrice})`);
    return "dry-run-settle-tx";
  }

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "emergency-settle",
    functionArgs: [
      contractPrincipalCV(DEPLOYER, KEEPER_CONFIG.contracts.mockSbtc),
      uintCV(epochId),
      uintCV(settlementPrice),
    ],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 15000n,
  });

  console.log(`  TX: ${txId}`);
  return txId;
}

// ============================================
// Step 3: Unpause vault
// ============================================

async function unpauseVault(privateKey: string): Promise<string> {
  const { boolCV, AnchorMode } = await import("@stacks/transactions");

  console.log("\n[STEP 3] Unpausing vault...");

  if (DRY_RUN) {
    console.log("  [DRY RUN] Would call: vault-logic-v2.set-vault-paused(false)");
    return "dry-run-unpause-tx";
  }

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "set-vault-paused",
    functionArgs: [boolCV(false)],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 10000n,
  });

  console.log(`  TX: ${txId}`);
  return txId;
}

// ============================================
// Step 4: Start new epoch
// ============================================

async function startNewEpoch(
  privateKey: string,
  strikePrice: bigint,
  premium: bigint,
  duration: bigint
): Promise<string> {
  const { uintCV, AnchorMode } = await import("@stacks/transactions");

  console.log("\n[STEP 4] Starting new epoch...");
  console.log(`  Strike: ${strikePrice} ($${(Number(strikePrice) / 1_000_000).toLocaleString()})`);
  console.log(`  Premium: ${premium} sats (${(Number(premium) / 100_000_000).toFixed(8)} BTC)`);
  console.log(`  Duration: ${duration} blocks (~${(Number(duration) * 10 / 60 / 24).toFixed(1)} days)`);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would call: vault-logic-v2.start-epoch(u${strikePrice}, u${premium}, u${duration})`);
    return "dry-run-start-tx";
  }

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "start-epoch",
    functionArgs: [uintCV(strikePrice), uintCV(premium), uintCV(duration)],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 15000n,
  });

  console.log(`  TX: ${txId}`);
  return txId;
}

// ============================================
// Step 5: Create market listing
// ============================================

async function createBatchListings(
  privateKey: string,
  epochId: bigint,
  strikePrice: bigint,
  premium: bigint,
  collateral: bigint,
  expiryBlock: bigint,
  numListings: bigint
): Promise<string> {
  const { uintCV, AnchorMode } = await import("@stacks/transactions");

  console.log("\n[STEP 5] Creating batch market listings...");
  console.log(`  Epoch: #${epochId}`);
  console.log(`  Listings: ${numListings}`);
  const perCollateral = collateral / numListings;
  const perPremium = premium / numListings;
  console.log(`  Per listing collateral: ${perCollateral} sats (${(Number(perCollateral) / 100_000_000).toFixed(8)} BTC)`);
  console.log(`  Per listing premium: ${perPremium} sats (${(Number(perPremium) / 100_000_000).toFixed(8)} BTC)`);
  console.log(`  Expiry block: ${expiryBlock}`);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would call: options-market-v5.batch-create-listings(u${epochId}, u${strikePrice}, u${perPremium}, u${perCollateral}, u${expiryBlock}, u${numListings})`);
    return "dry-run-listing-tx";
  }

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.optionsMarketV5,
    functionName: "batch-create-listings",
    functionArgs: [
      uintCV(epochId),
      uintCV(strikePrice),
      uintCV(perPremium),
      uintCV(perCollateral),
      uintCV(expiryBlock),
      uintCV(numListings),
    ],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 50000n,
  });

  console.log(`  TX: ${txId}`);
  return txId;
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  sBTC Vault — Emergency Restart Script");
  console.log("=".repeat(60));
  console.log(`  Mode:    ${DRY_RUN ? "DRY RUN (add --execute to broadcast)" : "LIVE — BROADCASTING TXs"}`);
  console.log(`  Network: ${KEEPER_CONFIG.network}`);
  console.log(`  API:     ${KEEPER_CONFIG.stacksApiUrl}`);
  console.log("=".repeat(60));

  // --- Pre-flight checks ---

  console.log("\n[PRE-FLIGHT] Gathering state...");

  // Get private key
  const privateKey = await requirePrivateKey();
  console.log("  Private key: OK");

  // Get current tenure height
  const tenureHeight = await getCurrentTenureHeight();
  console.log(`  Tenure height: ${tenureHeight} (this is what contracts see as block-height)`);

  // Get vault info
  const vaultResult = await callReadOnly(KEEPER_CONFIG.contracts.vaultLogicV2, "get-vault-info");
  if (!vaultResult.okay || !vaultResult.result) throw new Error("Failed to read vault info");
  const vault = parseVaultInfo(vaultResult.result as string);

  console.log(`  Active epoch: ${vault.activeEpoch}`);
  console.log(`  Current epoch ID: ${vault.currentEpochId}`);
  console.log(`  TVL: ${(Number(vault.totalSbtcDeposited) / 100_000_000).toFixed(8)} sBTC`);
  console.log(`  Vault paused: ${vault.vaultPaused}`);

  // Get epoch details
  let epoch: ReturnType<typeof parseEpochInfo> extends infer T ? T : never = null;
  if (vault.activeEpoch) {
    const { uintCV } = await import("@stacks/transactions");
    const epochHex = Buffer.from(uintCV(vault.currentEpochId).value.toString(16).padStart(32, "0"), "hex")
      .toString("hex");
    const epochResult = await callReadOnly(
      KEEPER_CONFIG.contracts.vaultDataV1,
      "get-epoch",
      ["0x01" + epochHex]
    );
    if (epochResult.okay && epochResult.result) {
      epoch = parseEpochInfo(epochResult.result as string);
      if (epoch) {
        console.log(`  Epoch #${vault.currentEpochId} expiry: block #${epoch.expiryBlock}`);
        console.log(`  Epoch settled: ${epoch.settled}`);
        console.log(`  Gap: expiry ${epoch.expiryBlock} - current ${tenureHeight} = ${Number(epoch.expiryBlock) - Number(tenureHeight)} blocks`);
      }
    }
  }

  // Fetch current BTC price
  console.log("\n[PRE-FLIGHT] Fetching BTC prices...");
  const prices = await fetchAllPrices();
  const medianPrice = calculateMedianPrice(prices);
  if (!medianPrice) throw new Error("Could not get BTC price from any source!");
  console.log(`  Median BTC price: $${medianPrice.toLocaleString()}`);

  const onChainPrice = priceToOnChain(medianPrice);

  // Calculate new epoch parameters
  const otmMultiplier = 1 + KEEPER_CONFIG.epoch.strikeOtmPercent / 100;
  const strikePriceUsd = Math.round(medianPrice * otmMultiplier);
  const strikeOnChain = priceToOnChain(strikePriceUsd);
  const duration = BigInt(KEEPER_CONFIG.epoch.defaultDurationBlocks);
  const collateral = vault.totalSbtcDeposited;
  const premium = calculateCallPremium(
    medianPrice,
    strikePriceUsd,
    Number(duration),
    collateral
  );
  const newEpochId = vault.currentEpochId + 1n;
  const newExpiryBlock = tenureHeight + duration;

  console.log("\n" + formatPricingInfo(medianPrice, strikePriceUsd, Number(duration), collateral, premium));

  console.log(`  New epoch ID: #${newEpochId}`);
  console.log(`  New expiry: block #${newExpiryBlock} (tenure ${tenureHeight} + ${duration})`);
  console.log(`  Expected expiry: ~${(Number(duration) * 10 / 60 / 24).toFixed(1)} days from now`);

  // --- Safety confirmation ---

  if (!DRY_RUN) {
    console.log("\n" + "!".repeat(60));
    console.log("  WARNING: LIVE MODE — Transactions will be broadcast!");
    console.log("  The following 5 TXs will be sent with sequential nonces:");
    console.log("    1. set-vault-paused(true)");
    console.log(`    2. emergency-settle(mock-sbtc, u${vault.currentEpochId}, u${onChainPrice})`);
    console.log("    3. set-vault-paused(false)");
    console.log(`    4. start-epoch(u${strikeOnChain}, u${premium}, u${duration})`);
    console.log(`    5. batch-create-listings(u${newEpochId}, ..., u100)`);
    console.log("!".repeat(60));

    // 5-second countdown
    for (let i = 5; i > 0; i--) {
      process.stdout.write(`\r  Starting in ${i}...`);
      await sleep(1000);
    }
    console.log("\r  Starting NOW!       ");
  }

  // --- Execute ---

  resetNonceTracker(); // Fresh nonce from API

  const txIds: string[] = [];

  // Step 1: Pause
  const pauseTx = await pauseVault(privateKey);
  txIds.push(pauseTx);

  // Step 2: Emergency settle
  const settleTx = await emergencySettle(privateKey, vault.currentEpochId, onChainPrice);
  txIds.push(settleTx);

  // Step 3: Unpause
  const unpauseTx = await unpauseVault(privateKey);
  txIds.push(unpauseTx);

  // Step 4: Start new epoch
  const startTx = await startNewEpoch(privateKey, strikeOnChain, premium, duration);
  txIds.push(startTx);

  // Step 5: Batch create 100 listings
  const numListings = 100n;
  const perListingCollateral = collateral / numListings;
  const perListingPremium = premium / numListings;
  const listingTx = await createBatchListings(
    privateKey,
    newEpochId,
    strikeOnChain,
    perListingPremium,
    perListingCollateral,
    newExpiryBlock,
    numListings
  );
  txIds.push(listingTx);

  // --- Summary ---

  console.log("\n" + "=".repeat(60));
  console.log("  SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`  Transactions: ${txIds.length}`);
  txIds.forEach((tx, i) => {
    const labels = ["Pause vault", "Emergency settle", "Unpause vault", "Start epoch", "Batch create 100 listings"];
    console.log(`    ${i + 1}. ${labels[i]}: ${tx}`);
  });

  if (!DRY_RUN) {
    console.log("\n  Track on Stacks Explorer:");
    txIds.forEach((tx) => {
      if (!tx.startsWith("dry-run")) {
        console.log(`    https://explorer.hiro.so/txid/${tx}?chain=mainnet`);
      }
    });
    console.log("\n  All 5 TXs use sequential nonces — they will execute in order.");
    console.log("  Wait ~10-20 minutes for all to confirm.");
  } else {
    console.log("\n  To execute for real:");
    console.log("    KEEPER_PRIVATE_KEY=<key> npx tsx keeper/emergency-restart.ts --execute");
  }

  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
