import txPkg from "@stacks/transactions";
const {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  fetchNonce,
  privateKeyToAddress,
  createStacksPrivateKey,
  getPublicKey,
  publicKeyToAddress,
  AddressVersion,
  TransactionVersion,
} = txPkg;
import netPkg from "@stacks/network";
const { STACKS_MAINNET } = netPkg;
import fs from "fs";
import path from "path";
import { mnemonicToSeedSync } from "@scure/bip39";
import { HDKey } from "@scure/bip32";
import { bytesToHex } from "@noble/hashes/utils.js";

// Derive private key from mnemonic (BIP44 m/44'/5757'/0'/0/0 for Stacks)
function derivePrivateKeyFromMnemonic(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic);
  const master = HDKey.fromMasterSeed(seed);
  const child = master.derive("m/44'/5757'/0'/0/0");
  return bytesToHex(child.privateKey) + "01"; // compressed key suffix
}

// Try env var first, then fall back to mnemonic from settings
let PRIVATE_KEY = process.env.STACKS_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  try {
    const toml = fs.readFileSync("settings/Mainnet.toml", "utf8");
    const match = toml.match(/mnemonic\s*=\s*"([^"]+)"/);
    if (match) {
      console.log("  Deriving key from Mainnet.toml mnemonic...");
      PRIVATE_KEY = derivePrivateKeyFromMnemonic(match[1]);
    }
  } catch {}
}

if (!PRIVATE_KEY) {
  console.error("Set STACKS_PRIVATE_KEY env var or configure mnemonic in settings/Mainnet.toml");
  process.exit(1);
}

// ALL contracts in dependency order
const CONTRACTS = [
  // No dependencies
  "sip-010-trait",
  "price-oracle",
  "vault-data-v1",
  "admin-multisig",
  "price-oracle-v2",
  "vault-strategy-v1",
  // Depends on sip-010-trait
  "mock-sbtc",
  "insurance-fund",
  // Depends on sip-010-trait + mock-sbtc
  "sbtc-options-vault",
  // Depends on sip-010-trait + vault-data-v1
  "governance-token",
  // Depends on sip-010-trait + mock-sbtc + sbtc-options-vault
  "options-market",
  // Depends on sip-010-trait + mock-sbtc + vault-data-v1 + price-oracle-v2
  "vault-logic-v2",
  // Depends on sip-010-trait + mock-sbtc + vault-logic-v2
  "options-market-v2",
  // V3: 10 listings per epoch (replaces options-market-v2)
  "options-market-v3",
  // V4: 100 listings per epoch + batch creation (replaces options-market-v3)
  "options-market-v4",
  // Depends on governance-token
  "governance-voting",
];

// Low fee for mainnet: base 10,000 + 2 microSTX per byte
function calculateLowFee(contractSizeBytes) {
  const baseFee = 10_000;
  const perByteFee = 2;
  return baseFee + contractSizeBytes * perByteFee;
}

async function deploy() {
  const addr = privateKeyToAddress(PRIVATE_KEY, STACKS_MAINNET);
  console.log(`\n  Deployer : ${addr}`);
  console.log(`  Network  : MAINNET`);
  console.log(`  Contracts: ${CONTRACTS.length}\n`);

  // Pre-calculate total cost
  let estimatedTotal = 0;
  for (const name of CONTRACTS) {
    const filePath = path.join("contracts", `${name}.clar`);
    const sizeBytes = fs.statSync(filePath).size;
    estimatedTotal += calculateLowFee(sizeBytes);
  }
  console.log(
    `  Estimated total fee: ${(estimatedTotal / 1_000_000).toFixed(4)} STX`
  );
  console.log(`\n  WARNING: This is MAINNET. Real STX will be spent.`);
  console.log(`  Press Ctrl+C within 5 seconds to cancel...\n`);

  await new Promise((r) => setTimeout(r, 5000));

  let nonce = await fetchNonce({ address: addr, network: STACKS_MAINNET });
  console.log(`  Nonce    : ${nonce}\n`);
  console.log("─".repeat(60));

  let totalFee = 0;
  let deployed = 0;

  for (const name of CONTRACTS) {
    const filePath = path.join("contracts", `${name}.clar`);
    const codeBody = fs.readFileSync(filePath, "utf8");
    const sizeBytes = Buffer.byteLength(codeBody, "utf8");
    const fee = calculateLowFee(sizeBytes);
    totalFee += fee;

    console.log(`\n  [${deployed + 1}/${CONTRACTS.length}] ${name}`);
    console.log(
      `    Size: ${(sizeBytes / 1024).toFixed(1)} KB | Fee: ${(fee / 1_000_000).toFixed(4)} STX`
    );

    const tx = await makeContractDeploy({
      contractName: name,
      codeBody,
      senderKey: PRIVATE_KEY,
      network: STACKS_MAINNET,
      anchorMode: AnchorMode.OnChainOnly,
      fee,
      nonce,
      clarityVersion: 2,
    });

    const result = await broadcastTransaction({
      transaction: tx,
      network: STACKS_MAINNET,
    });

    if (result.error) {
      const reason = result.reason || "";
      if (reason === "ContractAlreadyExists") {
        console.log(`    SKIPPED (already deployed)`);
        continue;
      }
      console.error(`    FAILED: ${result.error} - ${reason}`);
      if (result.reason_data)
        console.error(`    Data:`, JSON.stringify(result.reason_data));
      process.exit(1);
    } else {
      console.log(`    TX: ${result.txid}`);
      console.log(
        `    Explorer: https://explorer.hiro.so/txid/${result.txid}?chain=mainnet`
      );
      deployed++;
    }

    nonce = nonce + 1n;
  }

  console.log("\n" + "─".repeat(60));
  console.log(`\n  Deployed : ${deployed}/${CONTRACTS.length} contracts`);
  console.log(`  Total Fee: ${(totalFee / 1_000_000).toFixed(4)} STX`);
  console.log(`  Address  : ${addr}`);
  console.log(`\n  Wait for anchor block confirmations (~10-30 min)`);
  console.log(`\n  Update frontend/.env.local:`);
  console.log(`  NEXT_PUBLIC_DEPLOYER_ADDRESS=${addr}\n`);
}

deploy().catch((e) => {
  console.error(e);
  process.exit(1);
});
