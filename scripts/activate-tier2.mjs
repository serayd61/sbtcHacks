#!/usr/bin/env node
/**
 * Tier 2 Contract Activation Script
 *
 * Initializes all tier 1 and tier 2 contracts after deployment.
 * Each call generates an on-chain TX (contributes to activity metrics).
 *
 * Usage:
 *   DRY RUN:  node scripts/activate-tier2.mjs
 *   LIVE:     STACKS_PRIVATE_KEY=... node scripts/activate-tier2.mjs --execute
 */

import txPkg from "@stacks/transactions";
const {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  fetchNonce,
  PostConditionMode,
  Cl,
} = txPkg;
import netPkg from "@stacks/network";
const { STACKS_MAINNET } = netPkg;

const DEPLOYER = "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W";
const EXECUTE = process.argv.includes("--execute");
const PRIVATE_KEY = process.env.STACKS_PRIVATE_KEY;

if (EXECUTE && !PRIVATE_KEY) {
  console.error("STACKS_PRIVATE_KEY required for --execute mode");
  process.exit(1);
}

const network = STACKS_MAINNET;
let currentNonce = null;

async function getNextNonce() {
  if (currentNonce === null && PRIVATE_KEY) {
    const nonce = await fetchNonce(DEPLOYER, network);
    currentNonce = Number(nonce);
  }
  return currentNonce++;
}

async function sendTx(contractName, functionName, functionArgs, description) {
  console.log(`\n[${description}]`);
  console.log(`  → ${DEPLOYER}.${contractName}::${functionName}`);

  if (!EXECUTE) {
    console.log("  ⏭ DRY RUN — skipping broadcast");
    return;
  }

  try {
    const nonce = await getNextNonce();
    const txOptions = {
      contractAddress: DEPLOYER,
      contractName,
      functionName,
      functionArgs,
      senderKey: PRIVATE_KEY,
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
      nonce,
      fee: 10000n,
    };

    const tx = await makeContractCall(txOptions);
    const result = await broadcastTransaction(tx, network);

    if (result.error) {
      console.log(`  ❌ Error: ${result.reason}`);
    } else {
      console.log(`  ✅ TX: ${result.txid}`);
    }

    // Small delay between TXs
    await new Promise(r => setTimeout(r, 1000));
  } catch (err) {
    console.log(`  ❌ Failed: ${err.message}`);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("  Tier 2 Contract Activation Script");
  console.log(`  Mode: ${EXECUTE ? "🔴 LIVE" : "🟡 DRY RUN"}`);
  console.log(`  Deployer: ${DEPLOYER}`);
  console.log("=".repeat(60));

  // ──────────────────────────────────
  // TIER 1: Security Infrastructure
  // ──────────────────────────────────

  // 1. Circuit Breaker — Set governance and authorize triggers
  await sendTx("circuit-breaker-v1", "set-governance",
    [Cl.principal(`${DEPLOYER}.governance-voting`)],
    "Circuit Breaker: Set governance contract"
  );

  await sendTx("circuit-breaker-v1", "set-multisig",
    [Cl.principal(`${DEPLOYER}.treasury-multisig-v2`)],
    "Circuit Breaker: Set multisig contract"
  );

  await sendTx("circuit-breaker-v1", "set-emergency-admin",
    [Cl.principal(DEPLOYER)],
    "Circuit Breaker: Set emergency admin"
  );

  await sendTx("circuit-breaker-v1", "add-protected-contract",
    [Cl.principal(`${DEPLOYER}.vault-logic-v2`)],
    "Circuit Breaker: Protect vault-logic-v2"
  );

  await sendTx("circuit-breaker-v1", "add-protected-contract",
    [Cl.principal(`${DEPLOYER}.advanced-options-market-v7`)],
    "Circuit Breaker: Protect advanced-options-market-v7"
  );

  // 2. Treasury Multisig — Initialize signers
  await sendTx("treasury-multisig-v2", "initialize-signers",
    [Cl.list([
      Cl.principal(DEPLOYER),
      Cl.principal("SP147BWQNN0HEJYV4XWSD95C43T804Y7G3X9N86PX"),
      Cl.principal("SP2C2YFP12AJZB1AQHSS8YGZXV4N53NKZMXF8G9KT"),
    ])],
    "Treasury Multisig: Initialize 3 signers"
  );

  // 3. Upgrade Manager — Register implementations
  await sendTx("upgrade-manager-v1", "register-initial-implementation",
    [Cl.stringAscii("vault-logic"), Cl.principal(`${DEPLOYER}.vault-logic-v2`)],
    "Upgrade Manager: Register vault-logic"
  );

  await sendTx("upgrade-manager-v1", "register-initial-implementation",
    [Cl.stringAscii("price-oracle"), Cl.principal(`${DEPLOYER}.price-oracle-v2`)],
    "Upgrade Manager: Register price-oracle"
  );

  await sendTx("upgrade-manager-v1", "register-initial-implementation",
    [Cl.stringAscii("options-market"), Cl.principal(`${DEPLOYER}.advanced-options-market-v7`)],
    "Upgrade Manager: Register options-market"
  );

  await sendTx("upgrade-manager-v1", "set-governance-contract",
    [Cl.principal(`${DEPLOYER}.governance-voting`)],
    "Upgrade Manager: Set governance contract"
  );

  // ──────────────────────────────────
  // TIER 2.3: Tokenomics
  // ──────────────────────────────────

  // 4. Enhanced Governance Token — Initial mint
  await sendTx("enhanced-governance-token-v2", "mint",
    [Cl.principal(DEPLOYER), Cl.uint(100_000_000_00000000n)], // 100M tokens
    "Governance Token: Mint initial 100M SOVT supply"
  );

  // 5. Yield Farming — Create first pool
  await sendTx("yield-farming-pools-v1", "create-pool",
    [
      Cl.stringAscii("sBTC-SOVT-Main"),
      Cl.principal(`${DEPLOYER}.mock-sbtc`),
      Cl.principal(`${DEPLOYER}.mock-sbtc`),
      Cl.stringAscii("SINGLE"),
      Cl.uint(10000),   // allocation-points
      Cl.uint(50),      // deposit-fee: 0.5%
      Cl.uint(50),      // withdrawal-fee: 0.5%
      Cl.uint(1008)     // lock-period: 7 days
    ],
    "Yield Farming: Create sBTC-SOVT-Main pool"
  );

  await sendTx("yield-farming-pools-v1", "create-pool",
    [
      Cl.stringAscii("sBTC-LP-Boost"),
      Cl.principal(`${DEPLOYER}.mock-sbtc`),
      Cl.principal(`${DEPLOYER}.mock-sbtc`),
      Cl.stringAscii("LP"),
      Cl.uint(5000),
      Cl.uint(100),
      Cl.uint(100),
      Cl.uint(2016)     // 14 days
    ],
    "Yield Farming: Create sBTC-LP-Boost pool"
  );

  // ──────────────────────────────────
  // TIER 2.1: Strategy Configuration
  // ──────────────────────────────────

  // 6. Vault Strategy — Set default allocation
  await sendTx("advanced-vault-strategy-v3", "set-strategy-allocation",
    [
      Cl.uint(4000),   // covered-calls: 40%
      Cl.uint(2000),   // cash-secured-puts: 20%
      Cl.uint(1000),   // iron-condors: 10%
      Cl.uint(500),    // straddles: 5%
      Cl.uint(500),    // collars: 5%
      Cl.uint(2000)    // cash-reserve: 20%
    ],
    "Vault Strategy: Set default allocation (40/20/10/5/5/20)"
  );

  // 7. Dynamic Strategy Selector — Initial market features
  await sendTx("dynamic-strategy-selector-v1", "update-market-features",
    [
      Cl.uint(87000_000000),  // btc-price
      Cl.int(150),            // price-change-1h
      Cl.int(300),            // price-change-4h
      Cl.int(-200),           // price-change-24h
      Cl.uint(5000),          // rv-7d
      Cl.uint(4500),          // rv-30d
      Cl.uint(8000),          // implied-vol (80%)
      Cl.uint(55),            // rsi
      Cl.uint(120),           // volume-ratio
      Cl.uint(45),            // fear-greed
      Cl.int(50)              // funding-rate
    ],
    "Strategy Selector: Submit initial market features"
  );

  // ──────────────────────────────────
  // Summary
  // ──────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  Activation Complete!");
  console.log(`  Total TXs: 14`);
  console.log(`  Mode: ${EXECUTE ? "🔴 LIVE — check explorer" : "🟡 DRY RUN — use --execute for live"}`);
  console.log("=".repeat(60));
}

main().catch(console.error);
