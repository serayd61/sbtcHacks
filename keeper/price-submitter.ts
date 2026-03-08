// keeper/price-submitter.ts
// Fetches BTC/USD prices from multiple sources and submits median to on-chain oracle
//
// Usage:
//   KEEPER_PRIVATE_KEY=<hex-key> npx ts-node keeper/price-submitter.ts
//
// Runs every 10 minutes (configurable in config.ts)

import { KEEPER_CONFIG, PRICE_ENDPOINTS, PriceSource } from "./config";

// ============================================
// Price Fetching
// ============================================

interface PriceFetchResult {
  source: PriceSource;
  price: number; // USD
  timestamp: number;
  success: boolean;
  error?: string;
}

async function fetchCoinGeckoPrice(): Promise<number> {
  const response = await fetch(PRICE_ENDPOINTS.coingecko);
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const data = await response.json();
  return data.bitcoin.usd;
}

async function fetchBinancePrice(): Promise<number> {
  const response = await fetch(PRICE_ENDPOINTS.binance);
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  const data = await response.json();
  return parseFloat(data.price);
}

async function fetchKrakenPrice(): Promise<number> {
  const response = await fetch(PRICE_ENDPOINTS.kraken);
  if (!response.ok) throw new Error(`Kraken HTTP ${response.status}`);
  const data = await response.json();
  // Kraken returns: { result: { XXBTZUSD: { c: ["85000.0", "0.001"] } } }
  const pair = data.result?.XXBTZUSD || data.result?.XBTUSD;
  if (!pair) throw new Error("Kraken: unexpected response format");
  return parseFloat(pair.c[0]); // Last trade close price
}

const PRICE_FETCHERS: Record<PriceSource, () => Promise<number>> = {
  coingecko: fetchCoinGeckoPrice,
  binance: fetchBinancePrice,
  kraken: fetchKrakenPrice,
};

/**
 * Fetch prices from all configured sources
 */
async function fetchAllPrices(): Promise<PriceFetchResult[]> {
  const results: PriceFetchResult[] = [];

  for (const source of KEEPER_CONFIG.oracle.priceSources) {
    try {
      const price = await PRICE_FETCHERS[source]();
      results.push({
        source,
        price,
        timestamp: Date.now(),
        success: true,
      });
      console.log(`  [${source}] $${price.toLocaleString()}`);
    } catch (error: any) {
      results.push({
        source,
        price: 0,
        timestamp: Date.now(),
        success: false,
        error: error.message,
      });
      console.warn(`  [${source}] FAILED: ${error.message}`);
    }
  }

  return results;
}

// ============================================
// Median Calculation
// ============================================

/**
 * Calculate median price from successful fetches
 * Requires at least 2 successful sources for safety
 */
function calculateMedianPrice(results: PriceFetchResult[]): number | null {
  const validPrices = results
    .filter((r) => r.success && r.price > 0)
    .map((r) => r.price)
    .sort((a, b) => a - b);

  if (validPrices.length < 2) {
    console.error(`Not enough valid prices: ${validPrices.length}/2 minimum required`);
    return null;
  }

  const mid = Math.floor(validPrices.length / 2);
  if (validPrices.length % 2 === 0) {
    return (validPrices[mid - 1] + validPrices[mid]) / 2;
  }
  return validPrices[mid];
}

// ============================================
// On-chain Submission
// ============================================

/**
 * Convert USD price to on-chain format (6 decimal precision)
 * Example: $85,000.50 -> 85000500000
 */
function priceToOnChain(usdPrice: number): bigint {
  return BigInt(Math.round(usdPrice * 1_000_000));
}

/**
 * Submit price to on-chain oracle
 * Uses @stacks/transactions (install separately)
 */
async function submitPriceOnChain(price: bigint): Promise<string> {
  // Dynamic import to avoid requiring stacks deps when not needed
  const { makeContractCall, broadcastTransaction, uintCV, AnchorMode } = await import(
    "@stacks/transactions"
  );
  const { StacksMainnet, StacksTestnet } = await import("@stacks/network");

  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("KEEPER_PRIVATE_KEY environment variable required");
  }

  const network =
    KEEPER_CONFIG.network === "mainnet" ? new StacksMainnet() : new StacksTestnet();

  const txOptions = {
    contractAddress: KEEPER_CONFIG.deployerAddress,
    contractName: KEEPER_CONFIG.contracts.priceOracleV2,
    functionName: "submit-price",
    functionArgs: [uintCV(price)],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    fee: 5000n, // 0.005 STX
  };

  const tx = await makeContractCall(txOptions);
  const result = await broadcastTransaction({ transaction: tx, network });

  if ("error" in result) {
    throw new Error(`Broadcast failed: ${result.error} - ${result.reason}`);
  }

  return typeof result === "string" ? result : result.txid;
}

// ============================================
// Monitoring
// ============================================

async function sendAlert(message: string): Promise<void> {
  const webhookUrl = KEEPER_CONFIG.monitoring.webhookUrl;
  if (!webhookUrl) {
    console.warn(`[ALERT] ${message}`);
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `[sBTC Vault Keeper] ${message}`,
      }),
    });
  } catch (error) {
    console.error("Failed to send alert:", error);
  }
}

// ============================================
// Main Loop
// ============================================

async function runPriceUpdate(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] Fetching BTC/USD prices...`);

  const results = await fetchAllPrices();
  const medianPrice = calculateMedianPrice(results);

  if (medianPrice === null) {
    await sendAlert("Failed to calculate median price - not enough valid sources!");
    return;
  }

  const onChainPrice = priceToOnChain(medianPrice);
  console.log(`  Median: $${medianPrice.toLocaleString()} -> on-chain: ${onChainPrice}`);

  // Check if we should submit (only if price changed significantly)
  try {
    const txId = await submitPriceOnChain(onChainPrice);
    console.log(`  Submitted! TX: ${txId}`);
  } catch (error: any) {
    if (error.message.includes("KEEPER_PRIVATE_KEY")) {
      console.log("  [DRY RUN] No private key set - skipping on-chain submission");
    } else {
      console.error(`  Submit failed: ${error.message}`);
      await sendAlert(`Price submission failed: ${error.message}`);
    }
  }
}

/**
 * Start the keeper bot
 */
async function main(): Promise<void> {
  console.log("========================================");
  console.log("sBTC Vault - Price Oracle Keeper");
  console.log("========================================");
  console.log(`Network: ${KEEPER_CONFIG.network}`);
  console.log(`Update interval: ${KEEPER_CONFIG.oracle.updateIntervalMs / 1000}s`);
  console.log(`Sources: ${KEEPER_CONFIG.oracle.priceSources.join(", ")}`);
  console.log(`Tolerance: ${KEEPER_CONFIG.oracle.toleranceBps / 100}%`);
  console.log("========================================\n");

  // Initial run
  await runPriceUpdate();

  // Schedule periodic updates
  setInterval(runPriceUpdate, KEEPER_CONFIG.oracle.updateIntervalMs);

  console.log("\nKeeper running. Press Ctrl+C to stop.");
}

// Run if called directly
main().catch((err) => {
  console.error("Keeper fatal error:", err);
  process.exit(1);
});

export { fetchAllPrices, calculateMedianPrice, priceToOnChain, runPriceUpdate };
