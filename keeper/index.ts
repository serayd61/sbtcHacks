// keeper/index.ts
// Main entry point — runs all keeper services in a single process
//
// Services:
//   1. Price Oracle Submitter — fetches BTC/USD from multiple APIs, submits median on-chain
//   2. Epoch Manager — monitors epoch expiry, auto-settles, starts new epochs
//   3. Health Monitor — checks TVL, oracle staleness, wallet balance, sends alerts
//
// Usage:
//   KEEPER_PRIVATE_KEY=<hex-key> npx tsx keeper/index.ts
//
// Environment Variables:
//   KEEPER_PRIVATE_KEY  — Stacks wallet private key (hex). Without it, runs in dry-run mode.
//   KEEPER_ADDRESS      — Keeper wallet address (for balance monitoring)
//   KEEPER_WEBHOOK_URL  — Discord/Telegram webhook URL for alerts

import { KEEPER_CONFIG } from "./config";
import { runPriceUpdate } from "./price-submitter";
import { checkAndManageEpoch } from "./epoch-manager";
import { runHealthCheck } from "./monitor";

// ============================================
// Scheduling
// ============================================

const INTERVALS = {
  priceUpdate: KEEPER_CONFIG.oracle.updateIntervalMs,      // 10 min
  epochCheck: 5 * 60 * 1000,                                // 5 min
  healthCheck: 5 * 60 * 1000,                               // 5 min
};

// Stagger start times to avoid simultaneous API calls
const STAGGER_MS = 30_000; // 30 seconds between service starts

// ============================================
// Graceful Shutdown
// ============================================

const intervals: NodeJS.Timeout[] = [];

function shutdown(signal: string): void {
  console.log(`\n[${new Date().toISOString()}] Received ${signal} — shutting down...`);
  intervals.forEach(clearInterval);
  console.log("All services stopped. Goodbye.");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const dryRun = !process.env.KEEPER_PRIVATE_KEY;

  console.log("╔══════════════════════════════════════╗");
  console.log("║    sBTC Vault — Keeper Bot           ║");
  console.log("╚══════════════════════════════════════╝");
  console.log();
  console.log(`  Network:     ${KEEPER_CONFIG.network}`);
  console.log(`  API:         ${KEEPER_CONFIG.stacksApiUrl}`);
  console.log(`  Mode:        ${dryRun ? "DRY RUN (no private key)" : "LIVE"}`);
  console.log(`  Webhook:     ${KEEPER_CONFIG.monitoring.webhookUrl ? "configured" : "not set"}`);
  console.log();
  console.log("  Services:");
  console.log(`    Price Oracle  — every ${INTERVALS.priceUpdate / 60000} min`);
  console.log(`    Epoch Manager — every ${INTERVALS.epochCheck / 60000} min`);
  console.log(`    Health Monitor — every ${INTERVALS.healthCheck / 60000} min`);
  console.log();

  if (dryRun) {
    console.log("  ⚠ No KEEPER_PRIVATE_KEY set — running in observation mode.");
    console.log("    On-chain transactions will be simulated but not broadcast.");
    console.log();
  }

  // ---- Initial runs (sequential to avoid rate limits) ----
  console.log("═══ Initial Health Check ═══");
  await runHealthCheck();

  console.log("\n═══ Initial Price Update ═══");
  await runPriceUpdate();

  console.log("\n═══ Initial Epoch Check ═══");
  await checkAndManageEpoch();

  // ---- Schedule recurring runs ----
  console.log("\n═══ Scheduling Services ═══");

  setTimeout(() => {
    const priceInterval = setInterval(runPriceUpdate, INTERVALS.priceUpdate);
    intervals.push(priceInterval);
    console.log(`  [price-submitter] Scheduled every ${INTERVALS.priceUpdate / 60000} min`);
  }, 0);

  setTimeout(() => {
    const epochInterval = setInterval(checkAndManageEpoch, INTERVALS.epochCheck);
    intervals.push(epochInterval);
    console.log(`  [epoch-manager] Scheduled every ${INTERVALS.epochCheck / 60000} min`);
  }, STAGGER_MS);

  setTimeout(() => {
    const healthInterval = setInterval(runHealthCheck, INTERVALS.healthCheck);
    intervals.push(healthInterval);
    console.log(`  [monitor] Scheduled every ${INTERVALS.healthCheck / 60000} min`);
  }, STAGGER_MS * 2);

  console.log("\nKeeper bot running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Keeper fatal error:", err);
  process.exit(1);
});
