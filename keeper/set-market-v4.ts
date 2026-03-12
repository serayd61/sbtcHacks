// keeper/set-market-v4.ts
// One-shot script: Authorize options-market-v4 as the vault's market contract
//
// Usage:
//   DRY RUN:  KEEPER_PRIVATE_KEY=<key> npx tsx keeper/set-market-v4.ts
//   LIVE:     KEEPER_PRIVATE_KEY=<key> npx tsx keeper/set-market-v4.ts --execute

import { KEEPER_CONFIG } from "./config";
import { broadcastTx, requirePrivateKey, DEPLOYER } from "./tx-sender";

const API_BASE = KEEPER_CONFIG.stacksApiUrl;
const DRY_RUN = !process.argv.includes("--execute");

async function main() {
  console.log("=".repeat(50));
  console.log("  Set Market Contract → options-market-v4");
  console.log("=".repeat(50));
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  const privateKey = await requirePrivateKey();
  console.log("  Private key: OK");

  // Verify current market contract
  const res = await fetch(`${API_BASE}/v2/contracts/call-read/${DEPLOYER}/vault-data-v1/get-market-contract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: DEPLOYER, arguments: [] }),
  });
  const data = await res.json();
  console.log(`  Current market contract (raw): ${data.okay ? "readable" : "error"}`);

  const newMarket = `${DEPLOYER}.options-market-v4`;
  console.log(`  New market contract: ${newMarket}`);

  if (DRY_RUN) {
    console.log(`\n  [DRY RUN] Would call: vault-logic-v2.set-market-contract(${newMarket})`);
    console.log(`\n  To execute: KEEPER_PRIVATE_KEY=<key> npx tsx keeper/set-market-v4.ts --execute`);
    return;
  }

  const { contractPrincipalCV, AnchorMode } = await import("@stacks/transactions");

  const txId = await broadcastTx({
    contractAddress: DEPLOYER,
    contractName: KEEPER_CONFIG.contracts.vaultLogicV2,
    functionName: "set-market-contract",
    functionArgs: [
      contractPrincipalCV(DEPLOYER, "options-market-v4"),
    ],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 10000n,
  });

  console.log(`\n  TX: ${txId}`);
  console.log(`  Explorer: https://explorer.hiro.so/txid/${txId}?chain=mainnet`);
  console.log(`\n  Wait ~10 min for confirmation.`);
}

main().catch((err) => {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
