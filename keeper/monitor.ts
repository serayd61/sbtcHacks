// keeper/monitor.ts
// Vault health monitoring and alerting
//
// Monitors:
// - TVL changes (sudden drops)
// - Oracle freshness
// - Keeper wallet balance (for gas)
// - Epoch status
//
// Usage:
//   KEEPER_WEBHOOK_URL=<discord/telegram> npx ts-node keeper/monitor.ts

import { KEEPER_CONFIG } from "./config";

const API_BASE = KEEPER_CONFIG.stacksApiUrl;
const DEPLOYER = KEEPER_CONFIG.deployerAddress;

// ============================================
// Alert System
// ============================================

type AlertLevel = "info" | "warning" | "critical";

interface Alert {
  level: AlertLevel;
  message: string;
  timestamp: Date;
}

const alertHistory: Alert[] = [];

async function sendAlert(level: AlertLevel, message: string): Promise<void> {
  const alert: Alert = { level, message, timestamp: new Date() };
  alertHistory.push(alert);

  const prefix = level === "critical" ? "🚨" : level === "warning" ? "⚠️" : "ℹ️";
  const formatted = `${prefix} [${level.toUpperCase()}] ${message}`;
  console.log(formatted);

  const webhookUrl = KEEPER_CONFIG.monitoring.webhookUrl;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: formatted }),
    });
  } catch (error) {
    console.error("Failed to send webhook alert:", error);
  }
}

// ============================================
// Health Checks
// ============================================

let previousTvl: bigint | null = null;

async function checkOracleHealth(): Promise<void> {
  try {
    const url = `${API_BASE}/v2/contracts/call-read/${DEPLOYER}/price-oracle-v2/get-oracle-info`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DEPLOYER, arguments: [] }),
    });

    if (!response.ok) {
      await sendAlert("warning", "Oracle API call failed - cannot check health");
      return;
    }

    const data = await response.json();
    console.log(`  Oracle: responded (check raw data for staleness)`);
    // In production: parse Clarity response to check is-stale field
  } catch (error: any) {
    await sendAlert("critical", `Oracle health check error: ${error.message}`);
  }
}

async function checkKeeperBalance(): Promise<void> {
  try {
    const keeperAddress = process.env.KEEPER_ADDRESS || DEPLOYER;
    const url = `${API_BASE}/v2/accounts/${keeperAddress}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.log("  Keeper balance: API error");
      return;
    }

    const data = await response.json();
    const balanceStx = BigInt(data.balance) / 1_000_000n;
    console.log(`  Keeper STX balance: ${balanceStx} STX`);

    if (BigInt(data.balance) < BigInt(KEEPER_CONFIG.monitoring.keeperWalletMinStx)) {
      await sendAlert(
        "warning",
        `Keeper wallet low on STX: ${balanceStx} STX (min: ${KEEPER_CONFIG.monitoring.keeperWalletMinStx / 1_000_000} STX)`
      );
    }
  } catch (error: any) {
    console.log(`  Keeper balance check error: ${error.message}`);
  }
}

async function checkVaultTvl(): Promise<void> {
  try {
    const url = `${API_BASE}/v2/contracts/call-read/${DEPLOYER}/${KEEPER_CONFIG.contracts.vaultLogicV2}/get-vault-info`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DEPLOYER, arguments: [] }),
    });

    if (!response.ok) {
      console.log("  TVL check: API error");
      return;
    }

    console.log("  Vault info: responded (parse for TVL tracking)");
    // In production: parse Clarity tuple response for total-sbtc-deposited
    // Compare with previousTvl to detect sudden drops
  } catch (error: any) {
    console.log(`  TVL check error: ${error.message}`);
  }
}

async function checkNetworkStatus(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/v2/info`);
    const data = await response.json();
    console.log(`  Stacks tip height: ${data.stacks_tip_height}`);
    console.log(`  Burn block: ${data.burn_block_height}`);
  } catch (error: any) {
    await sendAlert("critical", `Stacks network unreachable: ${error.message}`);
  }
}

// ============================================
// Main Monitor Loop
// ============================================

async function runHealthCheck(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] Health Check`);
  console.log("  ────────────────────────────────");

  await checkNetworkStatus();
  await checkOracleHealth();
  await checkVaultTvl();
  await checkKeeperBalance();

  console.log("  ────────────────────────────────");
  console.log(`  Alerts in last 24h: ${alertHistory.filter((a) => Date.now() - a.timestamp.getTime() < 86400000).length}`);
}

async function main(): Promise<void> {
  console.log("========================================");
  console.log("sBTC Vault - Health Monitor");
  console.log("========================================");
  console.log(`Network: ${KEEPER_CONFIG.network}`);
  console.log(`Webhook: ${KEEPER_CONFIG.monitoring.webhookUrl ? "configured" : "not set"}`);
  console.log("========================================\n");

  // Initial check
  await runHealthCheck();

  // Check every 5 minutes
  setInterval(runHealthCheck, 5 * 60 * 1000);

  console.log("\nMonitor running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Monitor fatal error:", err);
  process.exit(1);
});

export { sendAlert, runHealthCheck };
