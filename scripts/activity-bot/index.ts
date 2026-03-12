import { getAddressFromPrivateKey } from "@stacks/transactions";
import { BOT_CONFIG } from "./config.js";
import { generateWallets, loadWallets, saveWallets } from "./wallet-generator.js";
import { distributeSTX } from "./stx-distributor.js";
import { callFaucets } from "./faucet-caller.js";
import { buyOptions, findAvailableListings } from "./option-buyer.js";
import { sleep, clearProgress } from "./utils.js";

// ============================================
// CLI Argument Parsing
// ============================================

function parseArgs(): { step: string; mnemonic?: string } {
  const args = process.argv.slice(2);
  let step = "all";
  let mnemonic: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--step" && args[i + 1]) {
      step = args[i + 1];
      i++;
    }
    if (args[i] === "--mnemonic" && args[i + 1]) {
      mnemonic = args[i + 1];
      i++;
    }
  }

  return { step, mnemonic };
}

// ============================================
// Steps
// ============================================

async function stepGenerate(mnemonic?: string) {
  console.log("\n========================================");
  console.log("  STEP 1: Generate Wallets");
  console.log("========================================");

  const existing = loadWallets();
  if (existing) {
    console.log(`  ${existing.count} wallets already exist. Skipping generation.`);
    console.log(`  Delete ${BOT_CONFIG.walletsFile} to regenerate.`);
    return existing;
  }

  const data = await generateWallets(BOT_CONFIG.walletCount, mnemonic);
  saveWallets(data);

  console.log(`\n  First 5 addresses:`);
  for (let i = 0; i < Math.min(5, data.wallets.length); i++) {
    console.log(`    ${i}: ${data.wallets[i].address}`);
  }

  return data;
}

async function stepDistribute(masterKey: string) {
  console.log("\n========================================");
  console.log("  STEP 2: Distribute STX");
  console.log("========================================");

  const walletsData = loadWallets();
  if (!walletsData) {
    console.error("  No wallets found! Run --step generate first.");
    process.exit(1);
  }

  const result = await distributeSTX(masterKey, walletsData.wallets);

  console.log(`\n  Summary:`);
  console.log(`    Successful: ${result.successful}/${walletsData.wallets.length}`);
  console.log(`    Failed: ${result.failed}`);
  console.log(`    TX IDs: ${result.txIds.length}`);

  return result;
}

async function stepFaucet() {
  console.log("\n========================================");
  console.log("  STEP 3: Call Faucets");
  console.log("========================================");

  const walletsData = loadWallets();
  if (!walletsData) {
    console.error("  No wallets found! Run --step generate first.");
    process.exit(1);
  }

  const result = await callFaucets(walletsData.wallets);

  console.log(`\n  Summary:`);
  console.log(`    Successful: ${result.successful}/${walletsData.wallets.length}`);
  console.log(`    Failed: ${result.failed}`);

  return result;
}

async function stepBuy() {
  console.log("\n========================================");
  console.log("  STEP 4: Buy Options");
  console.log("========================================");

  const walletsData = loadWallets();
  if (!walletsData) {
    console.error("  No wallets found! Run --step generate first.");
    process.exit(1);
  }

  // Find available listings
  const listingIds = await findAvailableListings(1, walletsData.wallets.length);

  if (listingIds.length < walletsData.wallets.length) {
    console.error(
      `  Not enough available listings! Found ${listingIds.length}, need ${walletsData.wallets.length}`
    );
    console.error(`  Make sure epoch has enough listings created.`);
    process.exit(1);
  }

  const result = await buyOptions(walletsData.wallets, listingIds);

  console.log(`\n  Summary:`);
  console.log(`    Successful: ${result.successful}/${walletsData.wallets.length}`);
  console.log(`    Failed: ${result.failed}`);

  return result;
}

// ============================================
// Main
// ============================================

async function main() {
  const { step, mnemonic } = parseArgs();
  const masterKey = process.env.MASTER_PRIVATE_KEY;
  const dryRun = !masterKey;

  console.log("╔════════════════════════════════════════╗");
  console.log("║     sBTC Options Activity Bot          ║");
  console.log("╚════════════════════════════════════════╝");
  console.log(`  Mode: ${dryRun ? "DRY RUN (no MASTER_PRIVATE_KEY)" : "LIVE"}`);
  console.log(`  Step: ${step}`);
  console.log(`  Network: ${BOT_CONFIG.apiUrl}`);
  console.log(`  Deployer: ${BOT_CONFIG.deployerAddress}`);
  console.log(`  Market: ${BOT_CONFIG.contracts.optionsMarket}`);
  console.log(`  Wallets: ${BOT_CONFIG.walletCount}`);
  console.log(`  STX/wallet: ${Number(BOT_CONFIG.stxPerWallet) / 1_000_000} STX`);

  if (dryRun && step !== "generate") {
    console.error(
      "\n  Set MASTER_PRIVATE_KEY env var to run in live mode."
    );
    console.error("  Example: MASTER_PRIVATE_KEY=<hex> npx tsx index.ts --step all");

    if (step === "generate") {
      // Generate doesn't need master key
    } else {
      process.exit(1);
    }
  }

  if (masterKey && !dryRun) {
    const masterAddress = getAddressFromPrivateKey(
      masterKey,
      BOT_CONFIG.network
    );
    console.log(`  Master: ${masterAddress}`);
  }

  const validSteps = ["generate", "distribute", "faucet", "buy", "all"];
  if (!validSteps.includes(step)) {
    console.error(`\n  Invalid step: ${step}`);
    console.error(`  Valid steps: ${validSteps.join(", ")}`);
    process.exit(1);
  }

  try {
    if (step === "generate" || step === "all") {
      await stepGenerate(mnemonic);
    }

    if (step === "distribute" || step === "all") {
      if (!masterKey) {
        console.error("  MASTER_PRIVATE_KEY required for distribution.");
        process.exit(1);
      }
      await stepDistribute(masterKey);

      if (step === "all") {
        console.log("\n  Waiting 5 minutes for STX transfer confirmations...");
        await sleep(5 * 60 * 1000);
      }
    }

    if (step === "faucet" || step === "all") {
      await stepFaucet();

      if (step === "all") {
        console.log("\n  Waiting 5 minutes for faucet confirmations...");
        await sleep(5 * 60 * 1000);
      }
    }

    if (step === "buy" || step === "all") {
      await stepBuy();
    }

    console.log("\n========================================");
    console.log("  ALL DONE!");
    console.log("========================================\n");
  } catch (error) {
    console.error("\n  Fatal error:", error);
    process.exit(1);
  }
}

main();
