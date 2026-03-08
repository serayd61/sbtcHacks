// keeper/epoch-manager.ts
// Automated epoch lifecycle management
//
// Responsibilities:
// 1. Monitor active epoch expiry
// 2. Auto-settle expired epochs using oracle price
// 3. Wait cooldown period
// 4. Start new epoch with calculated strike price (spot * 1.05)
//
// Usage:
//   KEEPER_PRIVATE_KEY=<hex-key> npx ts-node keeper/epoch-manager.ts

import { KEEPER_CONFIG } from "./config";
import { fetchAllPrices, calculateMedianPrice, priceToOnChain } from "./price-submitter";

// ============================================
// Types
// ============================================

interface EpochInfo {
  strikePrice: bigint;
  premium: bigint;
  collateral: bigint;
  startBlock: bigint;
  expiryBlock: bigint;
  settled: boolean;
  settlementPrice: bigint;
  premiumEarned: bigint;
  payout: bigint;
  outcome: string;
}

interface VaultState {
  currentEpochId: bigint;
  activeEpoch: boolean;
  totalSbtcDeposited: bigint;
  vaultPaused: boolean;
  currentBlock: bigint;
}

// ============================================
// Stacks API Helpers
// ============================================

const API_BASE = KEEPER_CONFIG.stacksApiUrl;
const DEPLOYER = KEEPER_CONFIG.deployerAddress;

async function callReadOnly(contract: string, fn: string, args: string[] = []): Promise<any> {
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
  const response = await fetch(`${API_BASE}/v2/info`);
  const data = await response.json();
  return BigInt(data.stacks_tip_height);
}

// ============================================
// Vault State Reading
// ============================================

async function getVaultState(): Promise<VaultState> {
  const currentBlock = await getCurrentBlock();

  // Call vault-logic-v2.get-vault-info
  const result = await callReadOnly(KEEPER_CONFIG.contracts.vaultLogicV2, "get-vault-info");

  // Parse Clarity response (simplified - actual parsing depends on response format)
  console.log("  Vault info raw:", JSON.stringify(result).slice(0, 200));

  return {
    currentEpochId: 0n, // Parse from result
    activeEpoch: false, // Parse from result
    totalSbtcDeposited: 0n, // Parse from result
    vaultPaused: false, // Parse from result
    currentBlock,
  };
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

/**
 * Calculate suggested premium based on simple model
 * Premium = 1% of collateral (base) + intrinsic value
 * For production: use Black-Scholes from pricing.ts
 */
function calculatePremium(collateralSats: bigint, strikePriceOnChain: bigint, currentPriceOnChain: bigint): bigint {
  // Base premium: 1% of collateral
  const basePremium = collateralSats / 100n;

  // Intrinsic value (if ITM, which shouldn't happen for new OTM epoch)
  const intrinsic = currentPriceOnChain > strikePriceOnChain
    ? (collateralSats * (currentPriceOnChain - strikePriceOnChain)) / currentPriceOnChain
    : 0n;

  return basePremium + intrinsic;
}

// ============================================
// Epoch Lifecycle Actions
// ============================================

async function settleExpiredEpoch(epochId: bigint): Promise<void> {
  console.log(`\n  Settling epoch #${epochId} with oracle price...`);

  const { makeContractCall, broadcastTransaction, uintCV, contractPrincipalCV, AnchorMode } =
    await import("@stacks/transactions");
  const { StacksMainnet, StacksTestnet } = await import("@stacks/network");

  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) {
    console.log("  [DRY RUN] Would settle epoch with oracle price");
    return;
  }

  const network =
    KEEPER_CONFIG.network === "mainnet" ? new StacksMainnet() : new StacksTestnet();

  const txOptions = {
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "settle-epoch-with-oracle",
    functionArgs: [
      contractPrincipalCV(DEPLOYER, KEEPER_CONFIG.contracts.mockSbtc),
      uintCV(epochId),
    ],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    fee: 10000n,
  };

  const tx = await makeContractCall(txOptions);
  const result = await broadcastTransaction({ transaction: tx, network });
  console.log(`  Settle TX broadcasted: ${typeof result === "string" ? result : result.txid}`);
}

async function startNewEpoch(strikePrice: bigint, premium: bigint, duration: number): Promise<void> {
  console.log(`\n  Starting new epoch...`);
  console.log(`    Strike: ${strikePrice} (${Number(strikePrice) / 1_000_000} USD)`);
  console.log(`    Premium: ${premium} sats`);
  console.log(`    Duration: ${duration} blocks (~${Math.round(duration / 6)} hours)`);

  const { makeContractCall, broadcastTransaction, uintCV, AnchorMode } = await import(
    "@stacks/transactions"
  );
  const { StacksMainnet, StacksTestnet } = await import("@stacks/network");

  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) {
    console.log("  [DRY RUN] Would start new epoch");
    return;
  }

  const network =
    KEEPER_CONFIG.network === "mainnet" ? new StacksMainnet() : new StacksTestnet();

  const txOptions = {
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "start-epoch",
    functionArgs: [uintCV(strikePrice), uintCV(premium), uintCV(duration)],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    fee: 10000n,
  };

  const tx = await makeContractCall(txOptions);
  const result = await broadcastTransaction({ transaction: tx, network });
  console.log(`  Start epoch TX broadcasted: ${typeof result === "string" ? result : result.txid}`);
}

// ============================================
// Main Monitor Loop
// ============================================

async function checkAndManageEpoch(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] Checking epoch status...`);

  try {
    const state = await getVaultState();
    console.log(`  Block: ${state.currentBlock}`);
    console.log(`  Active epoch: ${state.activeEpoch}`);
    console.log(`  Epoch ID: ${state.currentEpochId}`);
    console.log(`  TVL: ${state.totalSbtcDeposited} sats`);
    console.log(`  Paused: ${state.vaultPaused}`);

    if (state.vaultPaused) {
      console.log("  Vault is paused - skipping epoch management");
      return;
    }

    if (state.activeEpoch) {
      // Check if epoch has expired
      // TODO: Fetch epoch details and check expiry-block vs current block
      console.log("  Epoch is active - monitoring for expiry...");
      // If expired -> settleExpiredEpoch(state.currentEpochId)
    } else {
      // No active epoch - check if we should start a new one
      if (state.totalSbtcDeposited > 0n && KEEPER_CONFIG.epoch.autoStartNew) {
        console.log("  No active epoch with deposits available - preparing new epoch...");

        // Get current BTC price
        const priceResults = await fetchAllPrices();
        const medianPrice = calculateMedianPrice(priceResults);

        if (medianPrice) {
          const strike = calculateStrikePrice(medianPrice);
          const premium = calculatePremium(
            state.totalSbtcDeposited,
            strike,
            priceToOnChain(medianPrice)
          );
          const duration = KEEPER_CONFIG.epoch.defaultDurationBlocks;

          console.log(`  Current BTC price: $${medianPrice.toLocaleString()}`);
          console.log(`  Calculated strike: $${(Number(strike) / 1_000_000).toLocaleString()} (${KEEPER_CONFIG.epoch.strikeOtmPercent}% OTM)`);

          await startNewEpoch(strike, premium, duration);
        }
      } else {
        console.log("  No deposits or auto-start disabled - waiting...");
      }
    }
  } catch (error: any) {
    console.error(`  Error: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log("========================================");
  console.log("sBTC Vault - Epoch Manager");
  console.log("========================================");
  console.log(`Network: ${KEEPER_CONFIG.network}`);
  console.log(`Strike OTM: ${KEEPER_CONFIG.epoch.strikeOtmPercent}%`);
  console.log(`Epoch duration: ${KEEPER_CONFIG.epoch.defaultDurationBlocks} blocks`);
  console.log(`Auto-settle: ${KEEPER_CONFIG.epoch.autoSettle}`);
  console.log(`Auto-start: ${KEEPER_CONFIG.epoch.autoStartNew}`);
  console.log("========================================\n");

  // Initial check
  await checkAndManageEpoch();

  // Check every 5 minutes (every ~0.5 blocks)
  setInterval(checkAndManageEpoch, 5 * 60 * 1000);

  console.log("\nEpoch manager running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Epoch manager fatal error:", err);
  process.exit(1);
});

export { calculateStrikePrice, calculatePremium, checkAndManageEpoch };
