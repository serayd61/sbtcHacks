// keeper/price-submitter.ts
// Fetches BTC/USD prices from multiple sources and submits median to on-chain oracle
//
// Usage:
//   KEEPER_PRIVATE_KEY=<hex-key> npx ts-node keeper/price-submitter.ts
//
// Runs every 10 minutes (configurable in config.ts)

import { KEEPER_CONFIG, PRICE_ENDPOINTS, PriceSource } from "./config";
import { broadcastTx, requirePrivateKey, DEPLOYER } from "./tx-sender";

// ============================================
// Price Fetching (parallel with timeouts)
// ============================================

const FETCH_TIMEOUT_MS = 10_000; // 10 seconds per source
const MIN_BTC_PRICE = 1_000; // $1K floor (reject garbage)
const MAX_BTC_PRICE = 1_000_000; // $1M ceiling

interface PriceFetchResult {
  source: PriceSource;
  price: number; // USD
  timestamp: number;
  success: boolean;
  error?: string;
}

function isValidPrice(price: number): boolean {
  return typeof price === "number" && !isNaN(price) && price >= MIN_BTC_PRICE && price <= MAX_BTC_PRICE;
}

async function fetchCoinGeckoPrice(): Promise<number> {
  const response = await fetch(PRICE_ENDPOINTS.coingecko, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const data = await response.json();
  const price = data.bitcoin?.usd;
  if (!isValidPrice(price)) throw new Error(`Invalid price: ${price}`);
  return price;
}

async function fetchBinancePrice(): Promise<number> {
  const response = await fetch(PRICE_ENDPOINTS.binance, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  const data = await response.json();
  const price = parseFloat(data.price);
  if (!isValidPrice(price)) throw new Error(`Invalid price: ${price}`);
  return price;
}

async function fetchKrakenPrice(): Promise<number> {
  const response = await fetch(PRICE_ENDPOINTS.kraken, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Kraken HTTP ${response.status}`);
  const data = await response.json();
  // Kraken returns: { result: { XXBTZUSD: { c: ["85000.0", "0.001"] } } }
  const pair = data.result?.XXBTZUSD || data.result?.XBTUSD;
  if (!pair) throw new Error("Kraken: unexpected response format");
  const price = parseFloat(pair.c[0]); // Last trade close price
  if (!isValidPrice(price)) throw new Error(`Invalid price: ${price}`);
  return price;
}

const PRICE_FETCHERS: Record<PriceSource, () => Promise<number>> = {
  coingecko: fetchCoinGeckoPrice,
  binance: fetchBinancePrice,
  kraken: fetchKrakenPrice,
};

/**
 * Fetch prices from all sources in parallel (Promise.allSettled)
 * Much faster than sequential — 3 fetches overlap instead of chaining
 */
async function fetchAllPrices(): Promise<PriceFetchResult[]> {
  const sources = KEEPER_CONFIG.oracle.priceSources;
  const settled = await Promise.allSettled(sources.map((s) => PRICE_FETCHERS[s]()));

  const results: PriceFetchResult[] = sources.map((source, i) => {
    const result = settled[i];
    if (result.status === "fulfilled") {
      console.log(`  [${source}] $${result.value.toLocaleString()}`);
      return { source, price: result.value, timestamp: Date.now(), success: true };
    }
    const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
    console.warn(`  [${source}] FAILED: ${errorMsg}`);
    return { source, price: 0, timestamp: Date.now(), success: false, error: errorMsg };
  });

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
 * Read current on-chain oracle price to check tolerance
 * Returns price in on-chain format (6 decimals) or null if unavailable
 */
async function getCurrentOraclePrice(): Promise<bigint | null> {
  try {
    const url = `${KEEPER_CONFIG.stacksApiUrl}/v2/contracts/call-read/${DEPLOYER}/${KEEPER_CONFIG.contracts.priceOracleV2}/get-btc-price-unchecked`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: DEPLOYER, arguments: [] }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.okay || !data.result) return null;
    // Parse uint from Clarity hex: 0x01 + 16 bytes big-endian
    const hex = data.result.startsWith("0x") ? data.result.slice(2) : data.result;
    // Skip first byte (type prefix 0x01 for uint)
    const valueHex = hex.slice(2);
    return BigInt("0x" + valueHex);
  } catch {
    return null;
  }
}

/**
 * Check if new price deviates enough from on-chain price to justify a TX
 * Uses toleranceBps from config (default 200 = 2%)
 */
function isPriceDeviationSignificant(newPrice: bigint, currentPrice: bigint): boolean {
  if (currentPrice === 0n) return true; // First price, always submit
  const diff = newPrice > currentPrice ? newPrice - currentPrice : currentPrice - newPrice;
  const threshold = (currentPrice * BigInt(KEEPER_CONFIG.oracle.toleranceBps)) / 10_000n;
  return diff >= threshold;
}

/**
 * Submit price to on-chain oracle
 * Uses shared tx-sender for nonce management
 */
async function submitPriceOnChain(price: bigint): Promise<string> {
  const { uintCV, AnchorMode } = await import("@stacks/transactions");

  const privateKey = await requirePrivateKey();

  return broadcastTx({
    contractAddress: KEEPER_CONFIG.deployerAddress,
    contractName: KEEPER_CONFIG.contracts.priceOracleV2,
    functionName: "set-btc-price",
    functionArgs: [uintCV(price)],
    senderKey: privateKey,
    anchorMode: AnchorMode.Any,
    fee: 5000n,
  });
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to send alert:", msg);
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

  // Tolerance check: skip TX if price hasn't moved significantly
  const currentOnChain = await getCurrentOraclePrice();
  if (currentOnChain !== null) {
    console.log(`  On-chain: ${currentOnChain} ($${(Number(currentOnChain) / 1_000_000).toLocaleString()})`);
    if (!isPriceDeviationSignificant(onChainPrice, currentOnChain)) {
      console.log(`  Price within ${KEEPER_CONFIG.oracle.toleranceBps / 100}% tolerance — skipping TX (saves gas)`);
      return;
    }
    const deviationPct = Math.abs(Number(onChainPrice - currentOnChain)) / Number(currentOnChain) * 100;
    console.log(`  Deviation: ${deviationPct.toFixed(2)}% — submitting update`);
  }

  try {
    const txId = await submitPriceOnChain(onChainPrice);
    console.log(`  Submitted! TX: ${txId}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("KEEPER_PRIVATE_KEY")) {
      console.log("  [DRY RUN] No private key set - skipping on-chain submission");
    } else {
      console.error(`  Submit failed: ${msg}`);
      await sendAlert(`Price submission failed: ${msg}`);
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
const isMain = process.argv[1]?.includes("price-submitter");
if (isMain) {
  main().catch((err) => {
    console.error("Keeper fatal error:", err);
    process.exit(1);
  });
}

export {
  fetchAllPrices,
  calculateMedianPrice,
  priceToOnChain,
  runPriceUpdate,
  getCurrentOraclePrice,
  isPriceDeviationSignificant,
};
