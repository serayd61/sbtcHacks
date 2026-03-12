import txPkg from "@stacks/transactions";
const {
  makeContractDeploy,
  broadcastTransaction,
  AnchorMode,
  fetchNonce,
  privateKeyToAddress,
} = txPkg;
import netPkg from "@stacks/network";
const { STACKS_TESTNET } = netPkg;
import fs from "fs";
import path from "path";

const PRIVATE_KEY = process.env.STACKS_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("Set STACKS_PRIVATE_KEY env variable");
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
  // Depends on governance-token
  "governance-voting",
];

// Low fee calculation: base 5,000 + 1 microSTX per byte of contract code
// Testnet has minimal congestion, so very low fees work
function calculateLowFee(contractSizeBytes) {
  const baseFee = 5_000;
  const perByteFee = 1;
  return baseFee + contractSizeBytes * perByteFee;
}

async function deploy() {
  const addr = privateKeyToAddress(PRIVATE_KEY, STACKS_TESTNET);
  console.log(`\n  Deployer : ${addr}`);
  console.log(`  Network  : TESTNET`);
  console.log(`  Contracts: ${CONTRACTS.length}\n`);

  let nonce = await fetchNonce({ address: addr, network: STACKS_TESTNET });
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
    console.log(`    Size: ${(sizeBytes / 1024).toFixed(1)} KB | Fee: ${(fee / 1_000_000).toFixed(4)} STX`);

    const tx = await makeContractDeploy({
      contractName: name,
      codeBody,
      senderKey: PRIVATE_KEY,
      network: STACKS_TESTNET,
      anchorMode: AnchorMode.OnChainOnly,
      fee,
      nonce,
      clarityVersion: 2,
    });

    const result = await broadcastTransaction({
      transaction: tx,
      network: STACKS_TESTNET,
    });

    if (result.error) {
      const reason = result.reason || "";
      if (reason === "ContractAlreadyExists") {
        console.log(`    SKIPPED (already deployed)`);
        // Don't increment nonce for skipped contracts
        continue;
      }
      console.error(`    FAILED: ${result.error} - ${reason}`);
      if (result.reason_data)
        console.error(`    Data:`, JSON.stringify(result.reason_data));
      process.exit(1);
    } else {
      console.log(`    TX: ${result.txid}`);
      console.log(
        `    Explorer: https://explorer.hiro.so/txid/${result.txid}?chain=testnet`
      );
      deployed++;
    }

    nonce = nonce + 1n;
  }

  console.log("\n" + "─".repeat(60));
  console.log(`\n  Deployed : ${deployed}/${CONTRACTS.length} contracts`);
  console.log(`  Total Fee: ${(totalFee / 1_000_000).toFixed(4)} STX`);
  console.log(`  Address  : ${addr}`);
  console.log(`\n  Wait for confirmations (~5-15 min on testnet)`);
  console.log(`\n  Update frontend/.env.local:`);
  console.log(`  NEXT_PUBLIC_DEPLOYER_ADDRESS=${addr}\n`);
}

deploy().catch((e) => {
  console.error(e);
  process.exit(1);
});
