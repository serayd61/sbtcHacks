/**
 * Daily Activity Bot Runner
 *
 * Runs every 24 hours. Each cycle:
 * 1. Pre-flight: check wallet STX/sBTC balances
 * 2. Deployer creates 500 new listings (5 batches x 100)
 * 3. Wait for listing TXs to confirm on-chain
 * 4. Each wallet buys one listing (sequential, rate-limited)
 *
 * Each wallet spends ~0.002 STX per day (gas fee for buy-option).
 * With 0.1 STX initial balance, each wallet can run for ~45 days.
 * sBTC from faucet (1 sBTC) covers premiums for thousands of purchases.
 *
 * Usage:
 *   MASTER_PRIVATE_KEY=<deployer-hex-key> npx tsx daily-runner.ts
 *
 * For cron (every 24h at 08:00):
 *   0 8 * * * cd /path/to/activity-bot && MASTER_PRIVATE_KEY=<key> npx tsx daily-runner.ts >> daily.log 2>&1
 */

import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  contractPrincipalCV,
  fetchCallReadOnlyFunction,
  cvToJSON,
  getAddressFromPrivateKey,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import { BOT_CONFIG, DEPLOYER } from "./config.js";
import { loadWallets } from "./wallet-generator.js";
import { sleep, getSTXBalance } from "./utils.js";
import type { WalletEntry } from "./wallet-generator.js";

const API_URL = BOT_CONFIG.apiUrl;
const MARKET = BOT_CONFIG.contracts.optionsMarket;
const MOCK_SBTC = BOT_CONFIG.contracts.mockSbtc;
const LISTINGS_PER_CYCLE = 500;
const BATCH_SIZE = 100;
const BUY_CONCURRENCY = 5; // Max concurrent buy TXs (was 25, reduced for rate limits)
const BUY_DELAY_BETWEEN = 500; // 500ms delay between individual TXs within a batch
const MIN_STX_BALANCE = 3000n; // 0.003 STX minimum for gas

// ============================================
// Helpers
// ============================================

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      if (res.status === 429) {
        // Rate limited - wait longer
        const wait = 5000 * (attempt + 1);
        console.warn(`    Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (attempt < maxRetries - 1) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      return res;
    } catch (e) {
      if (attempt < maxRetries - 1) {
        await sleep(2000 * (attempt + 1));
      } else {
        throw e;
      }
    }
  }
  throw new Error(`Failed after ${maxRetries} retries: ${url}`);
}

// ============================================
// Step 0: Pre-flight Checks
// ============================================

async function preflightCheck(wallets: WalletEntry[]): Promise<void> {
  console.log(`\n--- Pre-flight: Quick STX balance check ---`);

  // Only check 5 wallets spread across the range to be fast
  const indices = [0, Math.floor(wallets.length / 4), Math.floor(wallets.length / 2), Math.floor(wallets.length * 3 / 4), wallets.length - 1];
  let hasStx = 0;

  for (const i of indices) {
    try {
      const stx = await getSTXBalance(wallets[i].address);
      if (stx >= MIN_STX_BALANCE) hasStx++;
      console.log(`  Wallet #${i}: ${Number(stx) / 1_000_000} STX`);
      await sleep(1000); // Gentle rate limiting
    } catch {
      console.log(`  Wallet #${i}: check failed (skipping)`);
    }
  }

  console.log(`  Result: ${hasStx}/${indices.length} sample wallets have STX`);

  if (hasStx === 0) {
    console.error(`\n  ABORT: No wallets have STX!`);
    console.error(`  Run: MASTER_PRIVATE_KEY=<key> npx tsx index.ts --step distribute`);
    process.exit(1);
  }
}

// ============================================
// Step 1: Get Active Epoch
// ============================================

async function getActiveEpoch(): Promise<{
  epochId: number;
  strikePrice: bigint;
  premium: bigint;
  collateral: bigint;
  expiryBlock: bigint;
  settled: boolean;
}> {
  const epochIdResult = await fetchCallReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName: "vault-logic-v2",
    functionName: "get-current-epoch-id",
    functionArgs: [],
    senderAddress: DEPLOYER,
    network: STACKS_MAINNET,
  });
  const epochId = Number(cvToJSON(epochIdResult).value);

  const epochResult = await fetchCallReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName: "vault-logic-v2",
    functionName: "get-epoch",
    functionArgs: [uintCV(epochId)],
    senderAddress: DEPLOYER,
    network: STACKS_MAINNET,
  });
  const json = cvToJSON(epochResult);
  const data = json.value?.value || json.value;

  return {
    epochId,
    strikePrice: BigInt(data["strike-price"]?.value ?? 0),
    premium: BigInt(data.premium?.value ?? 0),
    collateral: BigInt(data.collateral?.value ?? 0),
    expiryBlock: BigInt(data["expiry-block"]?.value ?? 0),
    settled: data.settled?.value === true,
  };
}

async function getCurrentListingCount(): Promise<number> {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName: MARKET,
    functionName: "get-listing-count",
    functionArgs: [],
    senderAddress: DEPLOYER,
    network: STACKS_MAINNET,
  });
  return Number(cvToJSON(result).value);
}

// ============================================
// Step 2: Create Listings (Deployer)
// ============================================

async function createDailyListings(
  privateKey: string,
  epoch: Awaited<ReturnType<typeof getActiveEpoch>>
): Promise<{ startId: number; endId: number; txIds: string[] }> {
  const beforeCount = await getCurrentListingCount();
  const perPremium = epoch.premium / BigInt(LISTINGS_PER_CYCLE);
  const perCollateral = epoch.collateral / BigInt(LISTINGS_PER_CYCLE);
  const numBatches = Math.ceil(LISTINGS_PER_CYCLE / BATCH_SIZE);

  console.log(`  Creating ${LISTINGS_PER_CYCLE} listings for epoch #${epoch.epochId}`);
  console.log(`  Per listing: premium=${perPremium} sats, collateral=${perCollateral} sats`);
  console.log(`  Current listing count: ${beforeCount}`);

  // Fetch deployer nonce
  const nonceRes = await fetchWithRetry(`${API_URL}/extended/v1/address/${DEPLOYER}/nonces`);
  const nonceData = (await nonceRes.json()) as { possible_next_nonce: number };
  let nonce = BigInt(nonceData.possible_next_nonce);

  const txIds: string[] = [];

  for (let batch = 0; batch < numBatches; batch++) {
    const count = Math.min(BATCH_SIZE, LISTINGS_PER_CYCLE - batch * BATCH_SIZE);
    console.log(`  Batch ${batch + 1}/${numBatches}: ${count} listings (nonce ${nonce})`);

    const tx = await makeContractCall({
      contractAddress: DEPLOYER,
      contractName: MARKET,
      functionName: "batch-create-listings",
      functionArgs: [
        uintCV(epoch.epochId),
        uintCV(epoch.strikePrice),
        uintCV(perPremium),
        uintCV(perCollateral),
        uintCV(epoch.expiryBlock),
        uintCV(count),
      ],
      senderKey: privateKey,
      network: STACKS_MAINNET,
      anchorMode: AnchorMode.Any,
      fee: 50000n,
      nonce,
    });

    const result = await broadcastTransaction({
      transaction: tx,
      network: STACKS_MAINNET,
    });

    const r = result as any;
    if (r.error) {
      console.error(`    FAILED: ${r.error} - ${r.reason}`);
      if (r.reason === "ConflictingNonceInMempool") {
        nonce++;
        batch--;
        continue;
      }
      throw new Error(`Listing creation failed: ${r.reason}`);
    }

    const txid = typeof r === "string" ? r : r.txid || String(r);
    txIds.push(txid);
    console.log(`    TX: ${txid.slice(0, 16)}...`);
    nonce++;

    if (batch < numBatches - 1) {
      await sleep(10000);
    }
  }

  const startId = beforeCount + 1;
  const endId = beforeCount + LISTINGS_PER_CYCLE;
  console.log(`  Listings created: #${startId} to #${endId}`);

  return { startId, endId, txIds };
}

// ============================================
// Step 3: Wait for TX Confirmation
// ============================================

async function waitForTxConfirmation(
  txIds: string[],
  maxWaitMs: number = 15 * 60 * 1000 // 15 minutes max
): Promise<boolean> {
  console.log(`\n--- Waiting for ${txIds.length} listing TXs to confirm ---`);

  const startTime = Date.now();
  const pollInterval = 30000; // 30 seconds
  let confirmed = 0;

  while (Date.now() - startTime < maxWaitMs) {
    confirmed = 0;

    for (const txId of txIds) {
      try {
        const cleanTxId = txId.startsWith("0x") ? txId : `0x${txId}`;
        const res = await fetchWithRetry(`${API_URL}/extended/v1/tx/${cleanTxId}`);
        if (res.ok) {
          const data = (await res.json()) as { tx_status: string };
          if (data.tx_status === "success") {
            confirmed++;
          } else if (data.tx_status === "abort_by_response" || data.tx_status === "abort_by_post_condition") {
            console.error(`    TX ${txId.slice(0, 12)}... ABORTED: ${data.tx_status}`);
            return false;
          }
        }
        await sleep(500); // Rate limit between checks
      } catch {
        // Ignore individual check errors
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  [${elapsed}s] Confirmed: ${confirmed}/${txIds.length}`);

    if (confirmed === txIds.length) {
      console.log(`  All listing TXs confirmed!`);
      return true;
    }

    // Also check listing count as alternative confirmation
    try {
      const count = await getCurrentListingCount();
      console.log(`  Current listing count on-chain: ${count}`);
    } catch {}

    await sleep(pollInterval);
  }

  console.warn(`  Timeout: ${confirmed}/${txIds.length} confirmed after ${maxWaitMs / 1000}s`);

  // Even if not all confirmed, check if listings exist
  if (confirmed > 0) {
    console.log(`  Proceeding with ${confirmed} confirmed batches...`);
    return true;
  }

  return false;
}

// ============================================
// Step 4: Buy Options (Sequential + Rate Limited)
// ============================================

async function buyOptionsDaily(
  wallets: WalletEntry[],
  startListingId: number
): Promise<{ successful: number; failed: number; skipped: number }> {
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let consecutiveFails = 0;

  // Verify listings exist on-chain before buying
  const listingCount = await getCurrentListingCount();
  const maxListingId = Math.min(startListingId + wallets.length - 1, listingCount);
  const walletsToProcess = maxListingId - startListingId + 1;

  console.log(`  Listings on-chain: ${listingCount}, will buy #${startListingId} to #${maxListingId}`);
  console.log(`  Processing ${walletsToProcess} wallets (no balance check - all wallets have STX)`);

  for (let i = 0; i < walletsToProcess; i++) {
    const wallet = wallets[i];
    const listingId = startListingId + i;

    try {
      // Fetch nonce with retry
      const nonceRes = await fetchWithRetry(
        `${API_URL}/extended/v1/address/${wallet.address}/nonces`
      );
      const nonceData = (await nonceRes.json()) as { possible_next_nonce: number };
      const nonce = BigInt(nonceData.possible_next_nonce);

      const tx = await makeContractCall({
        contractAddress: DEPLOYER,
        contractName: MARKET,
        functionName: "buy-option",
        functionArgs: [
          contractPrincipalCV(DEPLOYER, MOCK_SBTC),
          uintCV(listingId),
        ],
        senderKey: wallet.privateKey,
        network: STACKS_MAINNET,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: BOT_CONFIG.defaultFee,
        nonce,
      });

      const result = await broadcastTransaction({
        transaction: tx,
        network: STACKS_MAINNET,
      });

      const r = result as any;
      if (r.error) {
        console.error(`    #${i}: FAILED - ${r.reason || r.error}`);
        failed++;
        consecutiveFails++;
      } else {
        const txid = typeof r === "string" ? r : r.txid || String(r);
        console.log(`    #${i}: listing #${listingId} -> ${txid.slice(0, 12)}...`);
        successful++;
        consecutiveFails = 0;
      }
    } catch (e: any) {
      const msg = e.message || String(e);

      if (msg.includes("unable to parse") || msg.includes("429") || msg.includes("rate")) {
        // Rate limited - wait longer and retry once
        console.warn(`    #${i}: Rate limited, waiting 10s and retrying...`);
        await sleep(10000);
        try {
          const nonceRes = await fetchWithRetry(
            `${API_URL}/extended/v1/address/${wallet.address}/nonces`
          );
          const nonceData = (await nonceRes.json()) as { possible_next_nonce: number };
          const nonce = BigInt(nonceData.possible_next_nonce);

          const tx = await makeContractCall({
            contractAddress: DEPLOYER,
            contractName: MARKET,
            functionName: "buy-option",
            functionArgs: [
              contractPrincipalCV(DEPLOYER, MOCK_SBTC),
              uintCV(listingId),
            ],
            senderKey: wallet.privateKey,
            network: STACKS_MAINNET,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
            fee: BOT_CONFIG.defaultFee,
            nonce,
          });

          const result = await broadcastTransaction({
            transaction: tx,
            network: STACKS_MAINNET,
          });

          const r = result as any;
          if (r.error) {
            console.error(`    #${i}: RETRY FAILED - ${r.reason || r.error}`);
            failed++;
            consecutiveFails++;
          } else {
            const txid = typeof r === "string" ? r : r.txid || String(r);
            console.log(`    #${i}: listing #${listingId} -> ${txid.slice(0, 12)}... (retry)`);
            successful++;
            consecutiveFails = 0;
          }
        } catch (retryErr: any) {
          console.error(`    #${i}: RETRY ERROR - ${retryErr.message}`);
          failed++;
          consecutiveFails++;
        }
      } else {
        console.error(`    #${i}: ERROR - ${msg}`);
        failed++;
        consecutiveFails++;
      }
    }

    // Delay between TXs to avoid rate limits
    await sleep(BUY_DELAY_BETWEEN);

    // If too many consecutive failures, slow down
    if (consecutiveFails >= 10) {
      console.warn(`    10 consecutive failures, waiting 30s...`);
      await sleep(30000);
      consecutiveFails = 0;
    }

    // Progress log every 50 wallets
    if ((i + 1) % 50 === 0) {
      console.log(`  --- Progress: ${i + 1}/${walletsToProcess} | OK: ${successful} | Failed: ${failed} ---`);
    }
  }

  // Mark remaining wallets as skipped
  skipped = wallets.length - walletsToProcess;

  return { successful, failed, skipped };
}

// ============================================
// Main
// ============================================

async function main() {
  const privateKey = process.env.MASTER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set MASTER_PRIVATE_KEY env var");
    process.exit(1);
  }

  const now = new Date().toISOString();
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Daily Activity Bot - ${now}`);
  console.log(`${"=".repeat(50)}`);

  // Load wallets
  const walletsData = loadWallets();
  if (!walletsData) {
    console.error("  No wallets.json found! Run index.ts --step generate first.");
    process.exit(1);
  }
  console.log(`  Loaded ${walletsData.wallets.length} wallets`);

  // Check deployer balance
  const deployerBalance = await getSTXBalance(DEPLOYER);
  console.log(`  Deployer STX balance: ${Number(deployerBalance) / 1_000_000} STX`);

  if (deployerBalance < 500000n) {
    console.error("  Deployer STX too low for listing creation gas!");
    process.exit(1);
  }

  // Get active epoch
  const epoch = await getActiveEpoch();
  console.log(`  Active epoch: #${epoch.epochId}`);
  console.log(`  Settled: ${epoch.settled}`);

  if (epoch.settled) {
    console.error("  Epoch is settled! Need a new epoch first.");
    process.exit(1);
  }

  // Step 1: Create listings
  console.log(`\n--- Step 1: Create Listings ---`);
  const { startId, txIds } = await createDailyListings(privateKey, epoch);

  // Step 2: Wait for listing TXs to confirm
  console.log(`\n--- Step 2: Wait for Listing Confirmation ---`);
  const confirmed = await waitForTxConfirmation(txIds);

  if (!confirmed) {
    console.error("  Listing TXs not confirmed! Aborting buy phase.");
    console.error("  You can retry buying later once TXs confirm:");
    console.error(`    Listing IDs: #${startId} to #${startId + LISTINGS_PER_CYCLE - 1}`);
    process.exit(1);
  }

  // Step 3: Buy options
  console.log(`\n--- Step 3: Buy Options ---`);
  const result = await buyOptionsDaily(walletsData.wallets, startId);

  // Step 4: Governance Activity
  console.log(`\n--- Step 4: Governance Activity ---`);
  try {
    const { runDailyGovernance } = await import("./governance-bot.js");
    await runDailyGovernance(privateKey);
  } catch (e) {
    console.warn(`  Governance step failed (non-fatal): ${e}`);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Daily Run Complete - ${new Date().toISOString()}`);
  console.log(`  Listings created: ${LISTINGS_PER_CYCLE} (#${startId} to #${startId + LISTINGS_PER_CYCLE - 1})`);
  console.log(`  Options bought: ${result.successful}`);
  console.log(`  Skipped (low balance): ${result.skipped}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`${"=".repeat(50)}\n`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
