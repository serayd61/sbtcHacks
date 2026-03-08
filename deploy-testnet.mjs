import txPkg from "@stacks/transactions";
const { makeContractDeploy, broadcastTransaction, AnchorMode, fetchNonce, privateKeyToAddress } = txPkg;
import netPkg from "@stacks/network";
const { STACKS_TESTNET } = netPkg;
import fs from "fs";
import path from "path";

const PRIVATE_KEY = process.env.STACKS_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("Set STACKS_PRIVATE_KEY env variable");
  process.exit(1);
}

// Contracts in dependency order
const CONTRACTS = [
  "sip-010-trait",
  "mock-sbtc",
  "price-oracle",
  "sbtc-options-vault",
  "options-market",
];

const FEE = 200_000; // 0.2 STX per contract

async function deploy() {
  // Get initial nonce
  const addr = privateKeyToAddress(PRIVATE_KEY, STACKS_TESTNET);
  console.log(`Deployer: ${addr}`);

  let nonce = await fetchNonce({ address: addr, network: STACKS_TESTNET });
  console.log(`Starting nonce: ${nonce}\n`);

  for (const name of CONTRACTS) {
    const codeBody = fs.readFileSync(
      path.join("contracts", `${name}.clar`),
      "utf8"
    );

    console.log(`Deploying ${name}...`);
    const tx = await makeContractDeploy({
      contractName: name,
      codeBody,
      senderKey: PRIVATE_KEY,
      network: STACKS_TESTNET,
      anchorMode: AnchorMode.OnChainOnly,
      fee: FEE,
      nonce,
      clarityVersion: 2,
    });

    const result = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });

    if (result.error) {
      console.error(`  FAILED: ${result.error} - ${result.reason}`);
      if (result.reason_data) console.error(`  Data:`, JSON.stringify(result.reason_data));
      process.exit(1);
    } else {
      console.log(`  TX: ${result.txid}`);
      console.log(`  Explorer: https://explorer.hiro.so/txid/${result.txid}?chain=testnet`);
    }

    nonce = nonce + 1n;
  }

  console.log("\nAll contracts submitted! Wait for confirmations.");
  console.log(`Contract address: ${addr}`);
}

deploy().catch((e) => {
  console.error(e);
  process.exit(1);
});
