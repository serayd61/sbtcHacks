// keeper/monitor.ts
// Vault health monitoring and alerting
//
// Monitors:
// - TVL changes (sudden drops)
// - Oracle freshness & price validity
// - Keeper wallet balance (for gas)
// - Epoch status
// - Insurance fund balance
//
// Usage:
//   KEEPER_WEBHOOK_URL=<discord/telegram> npx ts-node keeper/monitor.ts

import { KEEPER_CONFIG } from "./config";
import { parseVaultInfo, parseOracleInfo, parseClarityHex } from "./clarity-parser";
import type { ParsedVaultInfo } from "./clarity-parser";

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
const recentAlerts = new Map<string, number>();

async function sendAlert(level: AlertLevel, message: string): Promise<void> {
  const alert: Alert = { level, message, timestamp: new Date() };

  // Dedup: don't send same alert within 30 minutes
  const key = `${level}:${message}`;
  const lastSent = recentAlerts.get(key);
  if (lastSent && Date.now() - lastSent < 30 * 60 * 1000) {
    return;
  }
  recentAlerts.set(key, Date.now());

  alertHistory.push(alert);

  const prefix = level === "critical" ? "\u{1F6A8}" : level === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
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
// API Helpers
// ============================================

async function callReadOnly(contract: string, fn: string, args: string[] = []): Promise<any> {
  const url = `${API_BASE}/v2/contracts/call-read/${DEPLOYER}/${contract}/${fn}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: DEPLOYER, arguments: args }),
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${contract}.${fn}`);
  }

  return response.json();
}

// ============================================
// Health Checks
// ============================================

let previousTvl: bigint | null = null;
let previousVaultInfo: ParsedVaultInfo | null = null;

async function checkOracleHealth(): Promise<void> {
  try {
    const result = await callReadOnly("price-oracle-v2", "get-oracle-info");

    if (!result.okay || !result.result) {
      await sendAlert("warning", "Oracle API returned error response");
      return;
    }

    const oracle = parseOracleInfo(result.result);
    const priceUsd = Number(oracle.price) / 1_000_000;

    console.log(`  Oracle: $${priceUsd.toLocaleString()} | Round #${oracle.currentRound} | ${oracle.isStale ? "STALE" : "Fresh"} | ${oracle.submitterCount} submitters`);

    if (oracle.isStale) {
      await sendAlert("critical", `Oracle price is STALE! Last update block: ${oracle.lastUpdateBlock}. Price may be outdated.`);
    }

    if (oracle.submitterCount < 2n) {
      await sendAlert("warning", `Oracle has only ${oracle.submitterCount} submitter(s). Minimum 2 recommended.`);
    }

    if (priceUsd === 0) {
      await sendAlert("critical", "Oracle returning $0 price — settlement will fail!");
    }
  } catch (error: any) {
    await sendAlert("critical", `Oracle health check failed: ${error.message}`);
  }
}

async function checkVaultHealth(): Promise<void> {
  try {
    const result = await callReadOnly(KEEPER_CONFIG.contracts.vaultLogicV2, "get-vault-info");

    if (!result.okay || !result.result) {
      await sendAlert("warning", "Vault info API returned error");
      return;
    }

    const vault = parseVaultInfo(result.result);
    const tvlSbtc = Number(vault.totalSbtcDeposited) / 100_000_000;
    const sharePrice = Number(vault.sharePrice) / 100_000_000;

    console.log(`  Vault: TVL=${tvlSbtc.toFixed(4)} sBTC | Share=${sharePrice.toFixed(4)} | Epochs=${vault.totalEpochsCompleted} | ${vault.vaultPaused ? "PAUSED" : "Active"}`);

    // Check TVL drop
    if (previousTvl !== null && previousTvl > 0n) {
      const tvlChange = Number(vault.totalSbtcDeposited - previousTvl) / Number(previousTvl) * 100;

      if (tvlChange < -KEEPER_CONFIG.monitoring.tvlDropAlertPercent) {
        await sendAlert(
          "critical",
          `TVL dropped ${Math.abs(tvlChange).toFixed(1)}% (${Number(previousTvl) / 100_000_000} -> ${tvlSbtc.toFixed(4)} sBTC)`
        );
      }
    }
    previousTvl = vault.totalSbtcDeposited;

    // Check if vault is paused
    if (vault.vaultPaused) {
      await sendAlert("warning", "Vault is PAUSED — deposits and new epochs are blocked");
    }

    // Check share price anomaly
    if (vault.totalShares > 0n && vault.sharePrice === 0n) {
      await sendAlert("critical", "Share price is 0 with active shares — potential calculation error!");
    }

    previousVaultInfo = vault;
  } catch (error: any) {
    await sendAlert("warning", `Vault health check failed: ${error.message}`);
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
    const balanceMicroStx = BigInt(data.balance);
    const balanceStx = Number(balanceMicroStx) / 1_000_000;

    console.log(`  Keeper: ${balanceStx.toFixed(2)} STX`);

    if (balanceMicroStx < BigInt(KEEPER_CONFIG.monitoring.keeperWalletMinStx)) {
      await sendAlert(
        "warning",
        `Keeper wallet low: ${balanceStx.toFixed(2)} STX (min: ${KEEPER_CONFIG.monitoring.keeperWalletMinStx / 1_000_000} STX)`
      );
    }
  } catch (error: any) {
    console.log(`  Keeper balance: ${error.message}`);
  }
}

async function checkNetworkStatus(): Promise<{ height: number; burnHeight: number } | null> {
  try {
    const response = await fetch(`${API_BASE}/v2/info`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const height = data.stacks_tip_height;
    const burnHeight = data.burn_block_height;

    console.log(`  Network: Stacks #${height.toLocaleString()} | BTC #${burnHeight.toLocaleString()}`);
    return { height, burnHeight };
  } catch (error: any) {
    await sendAlert("critical", `Stacks network unreachable: ${error.message}`);
    return null;
  }
}

async function checkInsuranceFund(): Promise<void> {
  try {
    const result = await callReadOnly("insurance-fund", "get-fund-info");

    if (!result.okay || !result.result) {
      console.log("  Insurance: not deployed or error");
      return;
    }

    const data = parseClarityHex(result.result);
    const balance = Number(BigInt(data["total-balance"] ?? 0)) / 100_000_000;

    console.log(`  Insurance: ${balance.toFixed(4)} sBTC`);
  } catch {
    console.log("  Insurance: contract not available");
  }
}

// ============================================
// Status Report
// ============================================

function getStatusReport(): string {
  const recentCount = alertHistory.filter(
    (a) => Date.now() - a.timestamp.getTime() < 86400000
  ).length;

  const criticalCount = alertHistory.filter(
    (a) => a.level === "critical" && Date.now() - a.timestamp.getTime() < 86400000
  ).length;

  return `Alerts 24h: ${recentCount} total, ${criticalCount} critical`;
}

// ============================================
// Main Monitor Loop
// ============================================

async function runHealthCheck(): Promise<void> {
  const separator = "  " + "\u2500".repeat(40);
  console.log(`\n[${new Date().toISOString()}] Health Check`);
  console.log(separator);

  const network = await checkNetworkStatus();
  if (!network) {
    console.log("  Skipping remaining checks — network unreachable");
    return;
  }

  await checkOracleHealth();
  await checkVaultHealth();
  await checkInsuranceFund();
  await checkKeeperBalance();

  console.log(separator);
  console.log(`  ${getStatusReport()}`);
}

async function main(): Promise<void> {
  console.log("========================================");
  console.log("sBTC Vault - Health Monitor");
  console.log("========================================");
  console.log(`Network:   ${KEEPER_CONFIG.network}`);
  console.log(`API:       ${KEEPER_CONFIG.stacksApiUrl}`);
  console.log(`Webhook:   ${KEEPER_CONFIG.monitoring.webhookUrl ? "configured" : "not set"}`);
  console.log(`TVL alert: >${KEEPER_CONFIG.monitoring.tvlDropAlertPercent}% drop`);
  console.log(`Min STX:   ${KEEPER_CONFIG.monitoring.keeperWalletMinStx / 1_000_000} STX`);
  console.log("========================================\n");

  // Initial check
  await runHealthCheck();

  // Check every 5 minutes
  setInterval(runHealthCheck, 5 * 60 * 1000);

  console.log("\nMonitor running. Press Ctrl+C to stop.");
}

// Run if called directly
const isMain = process.argv[1]?.includes("monitor");
if (isMain) {
  main().catch((err) => {
    console.error("Monitor fatal error:", err);
    process.exit(1);
  });
}

export { sendAlert, runHealthCheck, checkOracleHealth, checkVaultHealth, checkKeeperBalance };
