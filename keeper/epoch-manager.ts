// keeper/epoch-manager.ts
// Automated epoch lifecycle management
//
// Responsibilities:
// 1. Monitor active epoch expiry
// 2. Auto-settle expired epochs using oracle price
// 3. Start new epoch with calculated strike price (spot * 1.05)
// 4. Create listing on options market for each new epoch
//
// Usage:
//   KEEPER_PRIVATE_KEY=<hex-key> npx tsx keeper/epoch-manager.ts

import { KEEPER_CONFIG } from "./config";
import { fetchAllPrices, calculateMedianPrice, priceToOnChain } from "./price-submitter";
import { calculateCallPremium, formatPricingInfo } from "./pricing";
import { parseVaultInfo, parseEpochInfo, type ParsedVaultInfo, type ParsedEpochInfo } from "./clarity-parser";
import { broadcastTx, requirePrivateKey, DEPLOYER } from "./tx-sender";

// ============================================
// Types
// ============================================

interface VaultState {
  currentEpochId: bigint;
  activeEpoch: boolean;
  totalSbtcDeposited: bigint;
  vaultPaused: boolean;
  currentBlock: bigint;
  sharePrice: bigint;
}

// ============================================
// Stacks API Helpers
// ============================================

const API_BASE = KEEPER_CONFIG.stacksApiUrl;

async function callReadOnly(contract: string, fn: string, args: string[] = []): Promise<Record<string, unknown>> {
  const url = `${API_BASE}/v2/contracts/call-read/${DEPLOYER}/${contract}/${fn}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: DEPLOYER,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getCurrentBlock(): Promise<bigint> {
  // IMPORTANT: Clarity's `block-height` = tenure_height post-Nakamoto
  // The vault contract checks expiry against tenure_height, not stacks_tip_height
  const response = await fetch(`${API_BASE}/v2/info`);
  const data = await response.json();
  return BigInt(data.tenure_height);
}

// ============================================
// Vault State Reading (with Clarity parsing)
// ============================================

async function getVaultState(): Promise<VaultState> {
  const currentBlock = await getCurrentBlock();

  const result = await callReadOnly(KEEPER_CONFIG.contracts.vaultLogicV2, "get-vault-info");

  if (!result.okay || !result.result) {
    throw new Error("Failed to read vault info from chain");
  }

  const vaultInfo = parseVaultInfo(result.result);

  return {
    currentEpochId: vaultInfo.currentEpochId,
    activeEpoch: vaultInfo.activeEpoch,
    totalSbtcDeposited: vaultInfo.totalSbtcDeposited,
    vaultPaused: vaultInfo.vaultPaused,
    currentBlock,
    sharePrice: vaultInfo.sharePrice,
  };
}

async function getEpochDetails(epochId: bigint): Promise<ParsedEpochInfo | null> {
  // Encode epoch-id as Clarity uint argument (0x01 + 16 bytes big-endian)
  const hexId = epochId.toString(16).padStart(32, "0");
  const arg = `0x01${hexId}`;

  const result = await callReadOnly(KEEPER_CONFIG.contracts.vaultLogicV2, "get-epoch", [arg]);

  if (!result.okay || !result.result) {
    return null;
  }

  return parseEpochInfo(result.result);
}

// ============================================
// Epoch Management Logic
// ============================================

/**
 * Calculate strike price for new epoch
 * Strike = current BTC price * (1 + OTM%)
 * e.g., BTC at $85,000 with 5% OTM -> strike = $89,250
 */
function calculateStrikePrice(currentPriceUsd: number): bigint {
  const otmMultiplier = 1 + KEEPER_CONFIG.epoch.strikeOtmPercent / 100;
  const strikeUsd = currentPriceUsd * otmMultiplier;
  return priceToOnChain(strikeUsd);
}

// ============================================
// Epoch Lifecycle Actions
// ============================================

async function settleExpiredEpoch(epochId: bigint): Promise<void> {
  console.log(`\n  Settling epoch #${epochId} with oracle price...`);

  const { uintCV, contractPrincipalCV, AnchorMode } = await import("@stacks/transactions");

  const privateKey = await requirePrivateKey().catch(() => null);
  if (!privateKey) {
    console.log("  [DRY RUN] Would settle epoch with oracle price");
    return;
  }

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "settle-epoch-with-oracle",
    functionArgs: [
      contractPrincipalCV(DEPLOYER, KEEPER_CONFIG.contracts.mockSbtc),
      uintCV(epochId),
    ],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 10000n,
  });

  console.log(`  Settle TX broadcasted: ${txId}`);
}

async function startNewEpoch(
  strikePrice: bigint,
  premium: bigint,
  duration: number
): Promise<void> {
  console.log(`\n  Starting new epoch...`);
  console.log(`    Strike: $${(Number(strikePrice) / 1_000_000).toLocaleString()}`);
  console.log(`    Premium: ${Number(premium) / 100_000_000} sBTC`);
  console.log(`    Duration: ${duration} blocks (~${((duration * 10) / 60 / 24).toFixed(1)} days)`);

  const { uintCV, AnchorMode } = await import("@stacks/transactions");

  const privateKey = await requirePrivateKey().catch(() => null);
  if (!privateKey) {
    console.log("  [DRY RUN] Would start new epoch");
    return;
  }

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "start-epoch",
    functionArgs: [uintCV(strikePrice), uintCV(premium), uintCV(duration)],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 10000n,
  });

  console.log(`  Start epoch TX: ${txId}`);
}

async function createBatchListings(
  epochId: bigint,
  strikePrice: bigint,
  premium: bigint,
  collateral: bigint,
  expiryBlock: bigint,
  numListings: bigint
): Promise<void> {
  console.log(`\n  Creating ${numListings} listings via batch for epoch #${epochId}...`);
  console.log(`    Strike: $${(Number(strikePrice) / 1_000_000).toLocaleString()}`);
  console.log(`    Premium per listing: ${Number(premium) / 100_000_000} sBTC`);
  console.log(`    Collateral per listing: ${Number(collateral) / 100_000_000} sBTC`);
  console.log(`    Expiry block: #${expiryBlock}`);

  const { uintCV, AnchorMode } = await import("@stacks/transactions");

  const privateKey = await requirePrivateKey().catch(() => null);
  if (!privateKey) {
    console.log("  [DRY RUN] Would batch-create listings on options-market-v5");
    return;
  }

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.optionsMarketV5,
    functionName: "batch-create-listings",
    functionArgs: [
      uintCV(epochId),
      uintCV(strikePrice),
      uintCV(premium),
      uintCV(collateral),
      uintCV(expiryBlock),
      uintCV(numListings),
    ],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 50000n,
  });

  console.log(`  Batch create listings TX: ${txId}`);
}

// ============================================
// Main Monitor Loop
// ============================================

async function checkAndManageEpoch(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] Checking epoch status...`);

  try {
    const state = await getVaultState();
    console.log(`  Block: #${state.currentBlock}`);
    console.log(`  Active epoch: ${state.activeEpoch}`);
    console.log(`  Epoch ID: #${state.currentEpochId}`);
    console.log(`  TVL: ${Number(state.totalSbtcDeposited) / 100_000_000} sBTC`);
    console.log(`  Share price: ${Number(state.sharePrice) / 100_000_000}`);
    console.log(`  Paused: ${state.vaultPaused}`);

    if (state.vaultPaused) {
      console.log("  Vault is paused - skipping epoch management");
      return;
    }

    if (state.activeEpoch) {
      // Fetch epoch details to check expiry
      const epoch = await getEpochDetails(state.currentEpochId);

      if (!epoch) {
        console.log("  Could not fetch epoch details");
        return;
      }

      if (epoch.settled) {
        console.log("  Epoch already settled");
        return;
      }

      const blocksRemaining = epoch.expiryBlock - state.currentBlock;
      const hoursRemaining = Number(blocksRemaining) * 10 / 60;

      if (state.currentBlock >= epoch.expiryBlock) {
        // Epoch expired — auto-settle!
        console.log(`  Epoch #${state.currentEpochId} EXPIRED! Auto-settling...`);
        console.log(`    Strike: $${(Number(epoch.strikePrice) / 1_000_000).toLocaleString()}`);
        console.log(`    Collateral: ${Number(epoch.collateral) / 100_000_000} sBTC`);
        console.log(`    Premium earned: ${Number(epoch.premiumEarned) / 100_000_000} sBTC`);

        if (KEEPER_CONFIG.epoch.autoSettle) {
          await settleExpiredEpoch(state.currentEpochId);
        } else {
          console.log("  Auto-settle disabled — manual intervention required");
        }
      } else {
        console.log(`  Epoch active — ${Number(blocksRemaining)} blocks remaining (~${hoursRemaining.toFixed(1)}h)`);
        console.log(`    Strike: $${(Number(epoch.strikePrice) / 1_000_000).toLocaleString()}`);
        console.log(`    Expiry block: #${epoch.expiryBlock}`);
      }
    } else {
      // No active epoch
      if (state.totalSbtcDeposited > 0n && KEEPER_CONFIG.epoch.autoStartNew) {
        console.log("  No active epoch — preparing new epoch...");

        // Get current BTC price from multiple sources
        const priceResults = await fetchAllPrices();
        const medianPrice = calculateMedianPrice(priceResults);

        if (medianPrice) {
          const strike = calculateStrikePrice(medianPrice);
          const duration = KEEPER_CONFIG.epoch.defaultDurationBlocks;

          // Use Black-Scholes for fair premium calculation
          const strikePriceUsd = Number(strike) / 1_000_000;
          const totalPremium = calculateCallPremium(
            medianPrice,
            strikePriceUsd,
            duration,
            state.totalSbtcDeposited
          );

          console.log(formatPricingInfo(
            medianPrice,
            strikePriceUsd,
            duration,
            state.totalSbtcDeposited,
            totalPremium
          ));

          // Step 1: Start new epoch (with total premium)
          await startNewEpoch(strike, totalPremium, duration);

          // Step 2: Create 100 listings via batch-create-listings (single TX)
          const numListings = 100;
          const newEpochId = state.currentEpochId + 1n;
          const expiryBlock = state.currentBlock + BigInt(duration);
          const perListingCollateral = state.totalSbtcDeposited / BigInt(numListings);
          const perListingPremium = totalPremium / BigInt(numListings);

          console.log(`  Creating ${numListings} listings via batch (each: ${Number(perListingCollateral) / 1e8} sBTC collateral, ${Number(perListingPremium) / 1e8} sBTC premium)`);

          await createBatchListings(
            newEpochId,
            strike,
            perListingPremium,
            perListingCollateral,
            expiryBlock,
            BigInt(numListings)
          );
        } else {
          console.log("  Could not get reliable price — skipping epoch start");
        }
      } else if (state.totalSbtcDeposited === 0n) {
        console.log("  No deposits in vault — waiting...");
      } else {
        console.log("  Auto-start disabled — waiting for manual start");
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  Error: ${msg}`);
  }
}

async function main(): Promise<void> {
  console.log("========================================");
  console.log("sBTC Vault - Epoch Manager");
  console.log("========================================");
  console.log(`Network:       ${KEEPER_CONFIG.network}`);
  console.log(`Strike OTM:    ${KEEPER_CONFIG.epoch.strikeOtmPercent}%`);
  console.log(`Duration:      ${KEEPER_CONFIG.epoch.defaultDurationBlocks} blocks (~${((KEEPER_CONFIG.epoch.defaultDurationBlocks * 10) / 60 / 24).toFixed(1)} days)`);
  console.log(`Auto-settle:   ${KEEPER_CONFIG.epoch.autoSettle}`);
  console.log(`Auto-start:    ${KEEPER_CONFIG.epoch.autoStartNew}`);
  console.log(`IV:            ${KEEPER_CONFIG.pricing.defaultIV * 100}%`);
  console.log("========================================\n");

  // Initial check
  await checkAndManageEpoch();

  // Check every 5 minutes (~0.5 blocks)
  setInterval(checkAndManageEpoch, 5 * 60 * 1000);

  console.log("\nEpoch manager running. Press Ctrl+C to stop.");
}

// Run if called directly
const isMain = process.argv[1]?.includes("epoch-manager");
if (isMain) {
  main().catch((err) => {
    console.error("Epoch manager fatal error:", err);
    process.exit(1);
  });
}

export { calculateStrikePrice, getVaultState, getEpochDetails, checkAndManageEpoch };
