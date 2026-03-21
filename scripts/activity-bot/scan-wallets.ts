/**
 * Wallet Balance Scanner
 *
 * Scans all 500 wallets for STX and sBTC balances.
 * Respects Hiro API rate limits (1 request per second).
 * Saves results to wallet-balances.json.
 *
 * Usage:
 *   npx tsx scan-wallets.ts
 */

import { BOT_CONFIG, DEPLOYER } from "./config.js";
import { loadWallets } from "./wallet-generator.js";
import { sleep } from "./utils.js";

const API_URL = BOT_CONFIG.apiUrl;
const MOCK_SBTC = BOT_CONFIG.contracts.mockSbtc;
const DELAY_MS = 1200; // 1.2s between requests to stay under rate limit

interface WalletBalance {
  index: number;
  address: string;
  stxBalance: number; // in STX (not microSTX)
  sbtcBalance: number; // in sBTC (not sats)
  txCount: number;
  hasStx: boolean;
  hasSbtc: boolean;
}

async function fetchBalance(address: string): Promise<{
  stx: bigint;
  sbtc: bigint;
  txCount: number;
}> {
  // Single API call - get all balances at once
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_URL}/extended/v1/address/${address}/balances`);

      if (res.status === 429) {
        const wait = 5000 * (attempt + 1);
        console.warn(`  Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) return { stx: 0n, sbtc: 0n, txCount: 0 };

      const data = (await res.json()) as {
        stx: { balance: string };
        fungible_tokens: Record<string, { balance: string }>;
        // tx_count might not exist in this endpoint
      };

      const stx = BigInt(data.stx?.balance ?? "0");
      const sbtcKey = `${DEPLOYER}.${MOCK_SBTC}::mock-sbtc`;
      const sbtc = BigInt(data.fungible_tokens?.[sbtcKey]?.balance ?? "0");

      return { stx, sbtc, txCount: 0 };
    } catch {
      if (attempt < 2) await sleep(3000 * (attempt + 1));
    }
  }

  return { stx: 0n, sbtc: 0n, txCount: 0 };
}

async function main() {
  const walletsData = loadWallets();
  if (!walletsData) {
    console.error("No wallets.json found!");
    process.exit(1);
  }

  const wallets = walletsData.wallets;
  console.log(`\n  Scanning ${wallets.length} wallets...`);
  console.log(`  Estimated time: ~${Math.round((wallets.length * DELAY_MS) / 60000)} minutes\n`);

  const results: WalletBalance[] = [];
  let totalStx = 0;
  let totalSbtc = 0;
  let fundedCount = 0;
  let sbtcCount = 0;

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const { stx, sbtc } = await fetchBalance(wallet.address);

    const stxNum = Number(stx) / 1_000_000;
    const sbtcNum = Number(sbtc) / 100_000_000;
    const hasStx = stx >= 3000n; // 0.003 STX minimum
    const hasSbtc = sbtc > 0n;

    results.push({
      index: i,
      address: wallet.address,
      stxBalance: stxNum,
      sbtcBalance: sbtcNum,
      txCount: 0,
      hasStx,
      hasSbtc,
    });

    totalStx += stxNum;
    totalSbtc += sbtcNum;
    if (hasStx) fundedCount++;
    if (hasSbtc) sbtcCount++;

    // Progress every 25 wallets
    if ((i + 1) % 25 === 0 || i === wallets.length - 1) {
      console.log(`  [${i + 1}/${wallets.length}] STX funded: ${fundedCount} | sBTC: ${sbtcCount}`);
    }

    await sleep(DELAY_MS);
  }

  // Save results
  const fs = await import("fs");
  const output = {
    scannedAt: new Date().toISOString(),
    totalWallets: wallets.length,
    summary: {
      fundedWithStx: fundedCount,
      fundedWithSbtc: sbtcCount,
      totalStx: Math.round(totalStx * 1000) / 1000,
      totalSbtc: Math.round(totalSbtc * 100000000) / 100000000,
      unfundedCount: wallets.length - fundedCount,
    },
    wallets: results,
  };

  fs.writeFileSync("wallet-balances.json", JSON.stringify(output, null, 2));

  // Print summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Scan Complete`);
  console.log(`${"=".repeat(50)}`);
  console.log(`  Total wallets: ${wallets.length}`);
  console.log(`  STX funded (>0.003): ${fundedCount} (${Math.round(fundedCount / wallets.length * 100)}%)`);
  console.log(`  sBTC funded: ${sbtcCount} (${Math.round(sbtcCount / wallets.length * 100)}%)`);
  console.log(`  Total STX in wallets: ${totalStx.toFixed(3)} STX`);
  console.log(`  Total sBTC in wallets: ${totalSbtc.toFixed(8)} sBTC`);
  console.log(`  Unfunded: ${wallets.length - fundedCount}`);
  console.log(`\n  Results saved to wallet-balances.json`);

  // Show unfunded wallet indices
  const unfunded = results.filter((r) => !r.hasStx).map((r) => r.index);
  if (unfunded.length > 0 && unfunded.length <= 50) {
    console.log(`\n  Unfunded wallet indices: ${unfunded.join(", ")}`);
  } else if (unfunded.length > 50) {
    console.log(`\n  First 50 unfunded: ${unfunded.slice(0, 50).join(", ")}...`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
