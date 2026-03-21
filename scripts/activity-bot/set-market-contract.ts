/**
 * Set the market contract on vault-logic-v2
 *
 * Usage:
 *   MASTER_PRIVATE_KEY=<deployer-hex-key> npx tsx set-market-contract.ts
 */

import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  contractPrincipalCV,
  fetchCallReadOnlyFunction,
  cvToJSON,
  getAddressFromPrivateKey,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";

const DEPLOYER = "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W";
const API_URL = "https://api.mainnet.hiro.so";
const TARGET_MARKET = "options-market-v5"; // Change to v6 if deploying v6

async function main() {
  const privateKey = process.env.MASTER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set MASTER_PRIVATE_KEY env var");
    process.exit(1);
  }

  const sender = getAddressFromPrivateKey(privateKey, STACKS_MAINNET);
  console.log(`\n  Sender: ${sender}`);
  console.log(`  Target market: ${DEPLOYER}.${TARGET_MARKET}`);

  // Check current market contract
  const currentResult = await fetchCallReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName: "vault-data-v1",
    functionName: "get-market-contract",
    functionArgs: [],
    senderAddress: DEPLOYER,
    network: STACKS_MAINNET,
  });

  const hex = cvToJSON(currentResult).value;
  console.log(`  Current market (hex): ${hex}`);

  // Fetch nonce
  const nonceRes = await fetch(`${API_URL}/extended/v1/address/${DEPLOYER}/nonces`);
  const nonceData = (await nonceRes.json()) as { possible_next_nonce: number };
  const nonce = BigInt(nonceData.possible_next_nonce);
  console.log(`  Nonce: ${nonce}`);

  // Call set-market-contract
  console.log(`\n  Calling vault-logic-v2.set-market-contract(${TARGET_MARKET})...`);

  const tx = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName: "vault-logic-v2",
    functionName: "set-market-contract",
    functionArgs: [
      contractPrincipalCV(DEPLOYER, TARGET_MARKET),
    ],
    senderKey: privateKey,
    network: STACKS_MAINNET,
    anchorMode: AnchorMode.Any,
    fee: 10000n, // 0.01 STX
    nonce,
  });

  const result = await broadcastTransaction({
    transaction: tx,
    network: STACKS_MAINNET,
  });

  const r = result as any;
  if (r.error) {
    console.error(`  FAILED: ${r.error} - ${r.reason}`);
    process.exit(1);
  }

  const txid = typeof r === "string" ? r : r.txid || String(r);
  console.log(`  TX: ${txid}`);
  console.log(`  Explorer: https://explorer.hiro.so/txid/${txid}?chain=mainnet`);
  console.log(`\n  Wait ~10-30 min for confirmation, then run daily-runner.ts`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
