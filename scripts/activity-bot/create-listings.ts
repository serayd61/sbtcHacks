/**
 * Create 500 listings on options-market-v5 for the current active epoch.
 * Must be run by the deployer (contract owner).
 *
 * Usage:
 *   MASTER_PRIVATE_KEY=<deployer-hex-key> npx tsx create-listings.ts
 */

import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  uintCV,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";

const DEPLOYER = "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W";
const MARKET_CONTRACT = "options-market-v5";
const VAULT_CONTRACT = "vault-logic-v2";
const API_URL = "https://api.mainnet.hiro.so";

const TOTAL_LISTINGS = 500;
const BATCH_SIZE = 100; // max per TX (ITER-100 fold limit)
const NUM_BATCHES = Math.ceil(TOTAL_LISTINGS / BATCH_SIZE); // 5 batches

async function main() {
  const privateKey = process.env.MASTER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set MASTER_PRIVATE_KEY env var");
    process.exit(1);
  }

  // Get current epoch info
  console.log("Fetching epoch info...");
  const epochIdResult = await fetchCallReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName: VAULT_CONTRACT,
    functionName: "get-current-epoch-id",
    functionArgs: [],
    senderAddress: DEPLOYER,
    network: STACKS_MAINNET,
  });
  const epochId = Number(cvToJSON(epochIdResult).value);
  console.log(`  Active epoch: #${epochId}`);

  // Get epoch details
  const epochResult = await fetchCallReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName: VAULT_CONTRACT,
    functionName: "get-epoch",
    functionArgs: [uintCV(epochId)],
    senderAddress: DEPLOYER,
    network: STACKS_MAINNET,
  });
  const epochJson = cvToJSON(epochResult);
  const epochData = epochJson.value?.value || epochJson.value;

  const strikePrice = BigInt(epochData["strike-price"]?.value ?? epochData.strike_price?.value ?? 0);
  const collateral = BigInt(epochData.collateral?.value ?? 0);
  const expiryBlock = BigInt(epochData["expiry-block"]?.value ?? epochData.expiry_block?.value ?? 0);
  const premium = BigInt(epochData.premium?.value ?? 0);
  const settled = epochData.settled?.value ?? false;

  if (settled) {
    console.error("  Epoch is already settled! Cannot create listings.");
    process.exit(1);
  }

  // Per-listing values
  const perCollateral = collateral / BigInt(TOTAL_LISTINGS);
  const perPremium = premium / BigInt(TOTAL_LISTINGS);

  console.log(`  Strike: $${Number(strikePrice) / 1_000_000}`);
  console.log(`  Expiry block: ${expiryBlock}`);
  console.log(`  Total premium: ${Number(premium) / 100_000_000} sBTC`);
  console.log(`  Per listing premium: ${Number(perPremium) / 100_000_000} sBTC`);
  console.log(`  Per listing collateral: ${Number(perCollateral) / 100_000_000} sBTC`);
  console.log(`  Creating ${TOTAL_LISTINGS} listings in ${NUM_BATCHES} batches of ${BATCH_SIZE}`);

  // Fetch nonce
  const nonceRes = await fetch(`${API_URL}/extended/v1/address/${DEPLOYER}/nonces`);
  const nonceData = await nonceRes.json() as { possible_next_nonce: number };
  let nonce = BigInt(nonceData.possible_next_nonce);
  console.log(`  Starting nonce: ${nonce}`);

  // Create batches
  for (let batch = 0; batch < NUM_BATCHES; batch++) {
    const listingsInBatch = Math.min(BATCH_SIZE, TOTAL_LISTINGS - batch * BATCH_SIZE);
    console.log(`\n  Batch ${batch + 1}/${NUM_BATCHES}: creating ${listingsInBatch} listings (nonce ${nonce})`);

    const tx = await makeContractCall({
      contractAddress: DEPLOYER,
      contractName: MARKET_CONTRACT,
      functionName: "batch-create-listings",
      functionArgs: [
        uintCV(epochId),
        uintCV(strikePrice),
        uintCV(perPremium),
        uintCV(perCollateral),
        uintCV(expiryBlock),
        uintCV(listingsInBatch),
      ],
      senderKey: privateKey,
      network: STACKS_MAINNET,
      anchorMode: AnchorMode.Any,
      fee: 50000n, // 0.05 STX (higher for contract call)
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
        console.log("    Nonce conflict, trying next nonce...");
        nonce++;
        batch--; // Retry this batch
        continue;
      }
      process.exit(1);
    } else {
      const txid = r.txid || r;
      console.log(`    TX: ${txid}`);
      console.log(`    Explorer: https://explorer.hiro.so/txid/${txid}?chain=mainnet`);
    }

    nonce++;

    // Wait between batches
    if (batch < NUM_BATCHES - 1) {
      console.log("    Waiting 10s...");
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log(`\n  Done! Created ${TOTAL_LISTINGS} listings on ${MARKET_CONTRACT}`);
  console.log("  Wait for TX confirmations (~10-30 min), then run:");
  console.log("  MASTER_PRIVATE_KEY=<key> npx tsx index.ts --step faucet");
  console.log("  MASTER_PRIVATE_KEY=<key> npx tsx index.ts --step buy");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
