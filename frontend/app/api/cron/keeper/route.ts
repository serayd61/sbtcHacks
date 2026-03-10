import { NextResponse } from "next/server";
import {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  contractPrincipalCV,
  deserializeCV,
  cvToJSON,
  serializeCV,
  getAddressFromPrivateKey,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";

// ============================================
// Config
// ============================================

const API_BASE = "https://api.mainnet.hiro.so";
const DEPLOYER = (
  process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS ||
  "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W"
).trim();

const CONTRACTS = {
  vault: "vault-logic-v2",
  oracle: "price-oracle-v2",
  market: "options-market-v2",
  mockSbtc: "mock-sbtc",
};

const EPOCH_CONFIG = {
  strikeOtmPercent: 5,
  durationBlocks: 1008, // ~7 days
  premiumPct: 0.025, // 2.5% of TVL
};

const PRICE_ENDPOINTS = {
  coingecko:
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
  binance: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
  kraken: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
};

// ============================================
// Helpers
// ============================================

// H-6 FIX: Execution lock to prevent concurrent keeper runs
let isExecuting = false;
let lastExecutionTime = 0;
const MIN_EXECUTION_INTERVAL_MS = 30_000; // 30 seconds cooldown

// L-4 FIX: Rate limiting
let requestCount = 0;
let rateWindowStart = Date.now();
const MAX_REQUESTS_PER_MINUTE = 6;

let pendingNonce: bigint | null = null;

async function getNextNonce(address: string): Promise<bigint> {
  if (pendingNonce !== null) {
    pendingNonce += 1n;
    return pendingNonce;
  }
  const res = await fetch(`${API_BASE}/extended/v1/address/${address}/nonces`);
  const data = await res.json();
  pendingNonce = BigInt(data.possible_next_nonce);
  return pendingNonce;
}

function resolvePrivateKey(): string | null {
  const raw = process.env.KEEPER_PRIVATE_KEY?.trim();
  if (!raw) return null;
  let hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  if (hex.length === 64) hex += "01";
  if (hex.length !== 66) return null;
  return hex;
}

async function readOnly(contract: string, fn: string, args: any[] = []) {
  const serializedArgs = args.map((a) => `0x${serializeCV(a)}`);
  const url = `${API_BASE}/v2/contracts/call-read/${DEPLOYER}/${contract}/${encodeURIComponent(fn)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: DEPLOYER, arguments: serializedArgs }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.okay) return null;
  return cvToJSON(deserializeCV(json.result));
}

async function broadcast(opts: {
  contractName: string;
  functionName: string;
  functionArgs: any[];
  senderKey: string;
}): Promise<string> {
  const address = getAddressFromPrivateKey(opts.senderKey, STACKS_MAINNET);
  const nonce = await getNextNonce(address);
  const tx = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName: opts.contractName,
    functionName: opts.functionName,
    functionArgs: opts.functionArgs,
    senderKey: opts.senderKey,
    network: STACKS_MAINNET,
    fee: 10000n,
    nonce,
  });
  const result = await broadcastTransaction({
    transaction: tx,
    network: STACKS_MAINNET,
  });
  if (typeof result === "object" && "error" in result) {
    throw new Error(
      `Broadcast: ${(result as any).error} — ${(result as any).reason}`
    );
  }
  return typeof result === "string" ? result : result.txid;
}

// ============================================
// Price fetching
// ============================================

// Timeout for external API calls (10 seconds)
const FETCH_TIMEOUT = 10_000;
// Min/max BTC price sanity check (reject obviously wrong prices)
const MIN_BTC_PRICE = 1_000;
const MAX_BTC_PRICE = 1_000_000;

function isValidPrice(price: number): boolean {
  return typeof price === "number" && !isNaN(price) && price >= MIN_BTC_PRICE && price <= MAX_BTC_PRICE;
}

async function fetchMedianPrice(): Promise<number | null> {
  // Fetch all prices in parallel with timeouts
  const results = await Promise.allSettled([
    fetch(PRICE_ENDPOINTS.coingecko, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const price = (await r.json()).bitcoin?.usd;
        if (!isValidPrice(price)) throw new Error(`Invalid price: ${price}`);
        return price as number;
      }),
    fetch(PRICE_ENDPOINTS.binance, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const price = parseFloat((await r.json()).price);
        if (!isValidPrice(price)) throw new Error(`Invalid price: ${price}`);
        return price;
      }),
    fetch(PRICE_ENDPOINTS.kraken, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        const p = d.result?.XXBTZUSD || d.result?.XBTUSD;
        if (!p) throw new Error("No Kraken data");
        const price = parseFloat(p.c[0]);
        if (!isValidPrice(price)) throw new Error(`Invalid price: ${price}`);
        return price;
      }),
  ]);

  const prices = results
    .filter((r): r is PromiseFulfilledResult<number> => r.status === "fulfilled")
    .map((r) => r.value);

  if (prices.length < 2) return null;
  prices.sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 0
    ? (prices[mid - 1] + prices[mid]) / 2
    : prices[mid];
}

// ============================================
// Main keeper logic
// ============================================

export const maxDuration = 60; // 60s for Pro plan

export async function GET(request: Request) {
  // C-4 FIX: CRON_SECRET is now MANDATORY — no unauthenticated access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // L-4 FIX: Rate limiting — max 6 requests per minute
  const now = Date.now();
  if (now - rateWindowStart > 60_000) {
    requestCount = 0;
    rateWindowStart = now;
  }
  requestCount++;
  if (requestCount > MAX_REQUESTS_PER_MINUTE) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // H-6 FIX: Prevent concurrent execution
  if (isExecuting) {
    return NextResponse.json({ error: "Already executing", ok: false }, { status: 409 });
  }
  if (now - lastExecutionTime < MIN_EXECUTION_INTERVAL_MS) {
    return NextResponse.json({ error: "Cooldown active", ok: false }, { status: 429 });
  }
  isExecuting = true;
  lastExecutionTime = now;

  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    console.log(`[keeper] ${msg}`);
  };
  const txIds: string[] = [];
  pendingNonce = null;

  try {
    const privateKey = resolvePrivateKey();
    const dryRun = !privateKey;
    if (dryRun) log("DRY RUN — set KEEPER_PRIVATE_KEY env var for full automation");

    // 1. Fetch BTC price
    const btcPrice = await fetchMedianPrice();
    if (!btcPrice) {
      log("Failed to get reliable BTC price (need 2+ sources)");
      return NextResponse.json({ ok: false, logs, error: "No price data" });
    }
    const onChainPrice = BigInt(Math.round(btcPrice * 1_000_000));
    log(`BTC/USD: $${btcPrice.toLocaleString()} → on-chain: ${onChainPrice}`);

    // 2. Update oracle price
    if (!dryRun) {
      try {
        const txId = await broadcast({
          contractName: CONTRACTS.oracle,
          functionName: "set-btc-price",
          functionArgs: [uintCV(onChainPrice)],
          senderKey: privateKey,
        });
        log(`Oracle price updated: ${txId}`);
        txIds.push(txId);
      } catch (e: any) {
        log(`Oracle update failed: ${e.message}`);
      }
    } else {
      log("[dry] Would update oracle price");
    }

    // 3. Read vault state
    const vaultResult = await readOnly(CONTRACTS.vault, "get-vault-info");
    if (!vaultResult) {
      log("Failed to read vault info");
      return NextResponse.json({ ok: false, logs, txIds });
    }

    const v = vaultResult.value.value;
    const activeEpoch: boolean = v["active-epoch"].value;
    const currentEpochId = BigInt(v["current-epoch-id"].value);
    const totalDeposited = BigInt(v["total-sbtc-deposited"].value);
    const vaultPaused: boolean = v["vault-paused"].value;

    log(
      `Vault: epoch #${currentEpochId} | active=${activeEpoch} | TVL=${(Number(totalDeposited) / 1e8).toFixed(4)} sBTC | paused=${vaultPaused}`
    );

    if (vaultPaused) {
      log("Vault paused — skipping epoch management");
      return NextResponse.json({ ok: true, dryRun, btcPrice, logs, txIds });
    }

    // 4. Get current block height
    // IMPORTANT: Clarity's `block-height` = tenure_height (not stacks_tip_height)
    // post-Nakamoto. The contract checks expiry against tenure_height.
    const infoRes = await fetch(`${API_BASE}/v2/info`);
    const info = await infoRes.json();
    const tenureHeight = BigInt(info.tenure_height);
    const stacksHeight = BigInt(info.stacks_tip_height);
    log(`Tenure height: #${tenureHeight} | Stacks height: #${stacksHeight}`);

    // 5. Handle active epoch — check if expired
    if (activeEpoch && currentEpochId > 0n) {
      const epochResult = await readOnly(CONTRACTS.vault, "get-epoch", [
        uintCV(currentEpochId),
      ]);
      if (epochResult?.value) {
        const ep = epochResult.value.value || epochResult.value;
        const expiryBlock = BigInt(ep["expiry-block"].value);
        const settled: boolean = ep.settled.value;

        if (!settled && tenureHeight >= expiryBlock) {
          log(`Epoch #${currentEpochId} EXPIRED (expiry=${expiryBlock}, now=${tenureHeight}) — settling...`);
          if (!dryRun) {
            try {
              const txId = await broadcast({
                contractName: CONTRACTS.vault,
                functionName: "settle-epoch-with-oracle",
                functionArgs: [
                  contractPrincipalCV(DEPLOYER, CONTRACTS.mockSbtc),
                  uintCV(currentEpochId),
                ],
                senderKey: privateKey,
              });
              log(`Settled epoch #${currentEpochId}: ${txId}`);
              txIds.push(txId);
            } catch (e: any) {
              log(`Settle failed: ${e.message}`);
            }
          } else {
            log("[dry] Would settle expired epoch");
          }
        } else if (!settled) {
          const remaining = expiryBlock - tenureHeight;
          const hours = (Number(remaining) * 10) / 60;
          log(`Epoch active — ${remaining} blocks remaining (~${hours.toFixed(1)}h)`);
        } else {
          log("Epoch already settled — will start new one next cycle");
        }
      }
    }

    // 6. Start new epoch if no active epoch + has deposits
    if (!activeEpoch && totalDeposited > 0n) {
      const strikeUsd =
        btcPrice * (1 + EPOCH_CONFIG.strikeOtmPercent / 100);
      const strike = BigInt(Math.round(strikeUsd * 1_000_000));
      const duration = EPOCH_CONFIG.durationBlocks;
      const premiumSats = BigInt(
        Math.round(Number(totalDeposited) * EPOCH_CONFIG.premiumPct)
      );

      log(
        `Starting new epoch: strike=$${strikeUsd.toLocaleString()} | premium=${(Number(premiumSats) / 1e8).toFixed(4)} sBTC | duration=${duration} blocks`
      );

      if (!dryRun) {
        try {
          // Step 1: start-epoch
          const txId = await broadcast({
            contractName: CONTRACTS.vault,
            functionName: "start-epoch",
            functionArgs: [
              uintCV(strike),
              uintCV(premiumSats),
              uintCV(duration),
            ],
            senderKey: privateKey,
          });
          log(`Start epoch TX: ${txId}`);
          txIds.push(txId);

          // Step 2: create-listing on market
          const newEpochId = currentEpochId + 1n;
          const expiryBlock = tenureHeight + BigInt(duration);
          try {
            const listingTx = await broadcast({
              contractName: CONTRACTS.market,
              functionName: "create-listing",
              functionArgs: [
                uintCV(newEpochId),
                uintCV(strike),
                uintCV(premiumSats),
                uintCV(totalDeposited),
                uintCV(expiryBlock),
              ],
              senderKey: privateKey,
            });
            log(`Create listing TX: ${listingTx}`);
            txIds.push(listingTx);
          } catch (e: any) {
            log(`Create listing failed: ${e.message}`);
          }
        } catch (e: any) {
          log(`Start epoch failed: ${e.message}`);
        }
      } else {
        log("[dry] Would start epoch + create listing");
      }
    } else if (!activeEpoch && totalDeposited === 0n) {
      log("No deposits in vault — waiting");
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      block: Number(tenureHeight),
      btcPrice,
      dryRun,
      txIds,
      logs,
    });
  } catch (error: unknown) {
    // C-5 FIX: Sanitize error messages — never leak private key or internal state
    const safeMessage = error instanceof Error
      ? error.message.replace(/[0-9a-fA-F]{32,}/g, "[REDACTED]")
      : "Unknown error";
    log(`Fatal: ${safeMessage}`);
    return NextResponse.json(
      { ok: false, error: "Internal keeper error", txIds: txIds.length, logs: [`Error occurred — check server logs`] },
      { status: 500 }
    );
  } finally {
    // H-6 FIX: Always release the lock
    isExecuting = false;
  }
}
