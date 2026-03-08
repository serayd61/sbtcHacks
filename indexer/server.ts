// indexer/server.ts
// Chainhook Event Indexer for sBTC Options Vault
//
// Receives on-chain events via Hiro Chainhook webhooks
// Stores events in a local JSON-based datastore
// Serves historical data via REST API
//
// Usage:
//   npm run start        - Start indexer server
//   npm run dev          - Start with auto-reload
//
// Endpoints:
//   GET  /api/events              - All events (paginated)
//   GET  /api/events/:type        - Events by type
//   GET  /api/epochs              - All epoch history
//   GET  /api/epochs/:id          - Epoch details
//   GET  /api/deposits            - Deposit history
//   GET  /api/withdrawals         - Withdrawal history
//   GET  /api/stats               - Protocol statistics
//   GET  /api/user/:address       - User activity
//   GET  /health                  - Health check
//   POST /api/chainhook           - Chainhook webhook receiver

import http from "http";
import fs from "fs";
import path from "path";

// ============================================
// Types
// ============================================

interface IndexedEvent {
  id: number;
  type: string;
  blockHeight: number;
  txId: string;
  contract: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface EpochRecord {
  epochId: number;
  strikePrice: number;
  premium: number;
  collateral: number;
  startBlock: number;
  expiryBlock: number;
  settled: boolean;
  settlementPrice: number;
  payout: number;
  outcome: string;
  feesCollected: number;
  premiumEarned: number;
}

interface UserActivity {
  address: string;
  deposits: IndexedEvent[];
  withdrawals: IndexedEvent[];
  optionsBought: IndexedEvent[];
  govTokensClaimed: IndexedEvent[];
}

interface DataStore {
  events: IndexedEvent[];
  epochs: Map<number, EpochRecord>;
  stats: {
    totalEvents: number;
    totalDeposits: number;
    totalWithdrawals: number;
    totalEpochs: number;
    totalOptionsSold: number;
    totalPremiums: number;
    totalPayouts: number;
    totalFees: number;
    lastBlockProcessed: number;
    lastUpdated: number;
  };
}

// ============================================
// Configuration
// ============================================

const PORT = parseInt(process.env.INDEXER_PORT || "3100");
const DATA_DIR = process.env.INDEXER_DATA_DIR || path.join(process.cwd(), "indexer/data");
const DATA_FILE = path.join(DATA_DIR, "events.json");
const DEPLOYER = process.env.DEPLOYER_ADDRESS || "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W";

const WATCHED_CONTRACTS = [
  `${DEPLOYER}.vault-logic-v2`,
  `${DEPLOYER}.vault-data-v1`,
  `${DEPLOYER}.options-market-v2`,
  `${DEPLOYER}.price-oracle-v2`,
  `${DEPLOYER}.insurance-fund`,
  `${DEPLOYER}.governance-token`,
  `${DEPLOYER}.governance-voting`,
  `${DEPLOYER}.vault-strategy-v1`,
];

// ============================================
// Data Store
// ============================================

const store: DataStore = {
  events: [],
  epochs: new Map(),
  stats: {
    totalEvents: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalEpochs: 0,
    totalOptionsSold: 0,
    totalPremiums: 0,
    totalPayouts: 0,
    totalFees: 0,
    lastBlockProcessed: 0,
    lastUpdated: Date.now(),
  },
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData(): void {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      store.events = parsed.events || [];
      if (parsed.epochs) {
        for (const [k, v] of Object.entries(parsed.epochs)) {
          store.epochs.set(Number(k), v as EpochRecord);
        }
      }
      store.stats = { ...store.stats, ...(parsed.stats || {}) };
      console.log(`[indexer] Loaded ${store.events.length} events from disk`);
    } catch (e) {
      console.error("[indexer] Error loading data file:", e);
    }
  }
}

function saveData(): void {
  ensureDataDir();
  const serializable = {
    events: store.events,
    epochs: Object.fromEntries(store.epochs),
    stats: store.stats,
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(serializable, null, 2));
}

// Auto-save every 30 seconds
let saveInterval: ReturnType<typeof setInterval>;

// ============================================
// Event Processing
// ============================================

function processEvent(
  eventType: string,
  blockHeight: number,
  txId: string,
  contract: string,
  data: Record<string, unknown>
): void {
  const event: IndexedEvent = {
    id: store.events.length + 1,
    type: eventType,
    blockHeight,
    txId,
    contract,
    data,
    timestamp: Date.now(),
  };

  store.events.push(event);
  store.stats.totalEvents++;
  store.stats.lastBlockProcessed = Math.max(store.stats.lastBlockProcessed, blockHeight);
  store.stats.lastUpdated = Date.now();

  // Update aggregate stats based on event type
  switch (eventType) {
    case "deposit":
      store.stats.totalDeposits++;
      break;
    case "withdraw":
      store.stats.totalWithdrawals++;
      break;
    case "epoch-started":
      store.stats.totalEpochs++;
      if (data["epoch-id"]) {
        store.epochs.set(Number(data["epoch-id"]), {
          epochId: Number(data["epoch-id"]),
          strikePrice: Number(data["strike-price"] || 0),
          premium: Number(data["premium"] || 0),
          collateral: Number(data["collateral"] || 0),
          startBlock: blockHeight,
          expiryBlock: Number(data["expiry-block"] || 0),
          settled: false,
          settlementPrice: 0,
          payout: 0,
          outcome: "N/A",
          feesCollected: 0,
          premiumEarned: 0,
        });
      }
      break;
    case "epoch-settled":
    case "epoch-settled-oracle":
      if (data["epoch-id"] && store.epochs.has(Number(data["epoch-id"]))) {
        const epoch = store.epochs.get(Number(data["epoch-id"]))!;
        epoch.settled = true;
        epoch.settlementPrice = Number(data["settlement-price"] || 0);
        epoch.payout = Number(data["payout"] || 0);
        epoch.outcome = String(data["outcome"] || "N/A");
        epoch.feesCollected = Number(data["fees-collected"] || 0);
        store.stats.totalPayouts += epoch.payout;
        store.stats.totalFees += epoch.feesCollected;
      }
      break;
    case "option-sold":
    case "option-bought":
      store.stats.totalOptionsSold++;
      store.stats.totalPremiums += Number(data["premium"] || 0);
      break;
    case "insurance-premium-collected":
      // Track insurance premium separately if needed
      break;
  }

  console.log(`[indexer] Event #${event.id}: ${eventType} at block ${blockHeight}`);
}

// Parse Chainhook webhook payload
function processChainhookPayload(payload: unknown): void {
  try {
    const data = payload as {
      apply?: Array<{
        block_identifier?: { index: number };
        transactions?: Array<{
          transaction_identifier?: { hash: string };
          metadata?: {
            receipt?: {
              events?: Array<{
                type: string;
                data?: Record<string, unknown>;
              }>;
            };
          };
          operations?: Array<Record<string, unknown>>;
        }>;
      }>;
    };

    if (!data.apply) return;

    for (const block of data.apply) {
      const blockHeight = block.block_identifier?.index || 0;

      if (!block.transactions) continue;

      for (const tx of block.transactions) {
        const txId = tx.transaction_identifier?.hash || "unknown";
        const events = tx.metadata?.receipt?.events || [];

        for (const event of events) {
          if (event.type === "SmartContractEvent" || event.type === "print_event") {
            const printData = event.data as {
              contract_identifier?: string;
              value?: { event?: string; [key: string]: unknown };
            } | undefined;
            const contract = printData?.contract_identifier || "";

            // Only process events from our contracts
            if (!WATCHED_CONTRACTS.some((c) => contract.includes(c))) continue;

            const eventData = printData?.value || {};
            const eventType = String(eventData.event || "unknown");

            processEvent(eventType, blockHeight, txId, contract, eventData as Record<string, unknown>);
          }
        }
      }
    }

    saveData();
  } catch (e) {
    console.error("[indexer] Error processing Chainhook payload:", e);
  }
}

// ============================================
// REST API
// ============================================

function parseQuery(url: string): { path: string; params: Record<string, string> } {
  const [pathPart, queryPart] = url.split("?");
  const params: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split("&")) {
      const [k, v] = pair.split("=");
      params[decodeURIComponent(k)] = decodeURIComponent(v || "");
    }
  }
  return { path: pathPart, params };
}

function jsonResponse(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  const { path: urlPath, params } = parseQuery(req.url || "/");
  const page = Math.max(1, parseInt(params.page || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || "50")));
  const offset = (page - 1) * limit;

  // Health check
  if (urlPath === "/health") {
    return jsonResponse(res, {
      status: "ok",
      uptime: process.uptime(),
      totalEvents: store.stats.totalEvents,
      lastBlockProcessed: store.stats.lastBlockProcessed,
      lastUpdated: new Date(store.stats.lastUpdated).toISOString(),
    });
  }

  // Chainhook webhook receiver
  if (urlPath === "/api/chainhook" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        processChainhookPayload(payload);
        jsonResponse(res, { ok: true, eventsProcessed: store.stats.totalEvents });
      } catch (e) {
        jsonResponse(res, { error: "Invalid JSON payload" }, 400);
      }
    });
    return;
  }

  // GET endpoints
  if (req.method !== "GET") {
    return jsonResponse(res, { error: "Method not allowed" }, 405);
  }

  // All events (paginated)
  if (urlPath === "/api/events") {
    const sorted = [...store.events].reverse();
    const paged = sorted.slice(offset, offset + limit);
    return jsonResponse(res, {
      events: paged,
      pagination: { page, limit, total: sorted.length, pages: Math.ceil(sorted.length / limit) },
    });
  }

  // Events by type
  const eventTypeMatch = urlPath.match(/^\/api\/events\/(.+)$/);
  if (eventTypeMatch) {
    const type = eventTypeMatch[1];
    const filtered = store.events.filter((e) => e.type === type).reverse();
    const paged = filtered.slice(offset, offset + limit);
    return jsonResponse(res, {
      events: paged,
      type,
      pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) },
    });
  }

  // All epochs
  if (urlPath === "/api/epochs") {
    const epochs = Array.from(store.epochs.values()).sort((a, b) => b.epochId - a.epochId);
    return jsonResponse(res, { epochs, total: epochs.length });
  }

  // Single epoch
  const epochMatch = urlPath.match(/^\/api\/epochs\/(\d+)$/);
  if (epochMatch) {
    const epochId = parseInt(epochMatch[1]);
    const epoch = store.epochs.get(epochId);
    if (!epoch) return jsonResponse(res, { error: "Epoch not found" }, 404);

    // Include related events
    const relatedEvents = store.events.filter(
      (e) => e.data["epoch-id"] !== undefined && Number(e.data["epoch-id"]) === epochId
    );

    return jsonResponse(res, { epoch, events: relatedEvents });
  }

  // Deposits
  if (urlPath === "/api/deposits") {
    const deposits = store.events.filter((e) => e.type === "deposit").reverse();
    const paged = deposits.slice(offset, offset + limit);
    return jsonResponse(res, {
      deposits: paged,
      pagination: { page, limit, total: deposits.length, pages: Math.ceil(deposits.length / limit) },
    });
  }

  // Withdrawals
  if (urlPath === "/api/withdrawals") {
    const withdrawals = store.events.filter((e) => e.type === "withdraw").reverse();
    const paged = withdrawals.slice(offset, offset + limit);
    return jsonResponse(res, {
      withdrawals: paged,
      pagination: { page, limit, total: withdrawals.length, pages: Math.ceil(withdrawals.length / limit) },
    });
  }

  // Protocol stats
  if (urlPath === "/api/stats") {
    const epochs = Array.from(store.epochs.values());
    const settledEpochs = epochs.filter((e) => e.settled);
    const otmCount = settledEpochs.filter((e) => e.outcome === "OTM").length;

    return jsonResponse(res, {
      ...store.stats,
      winRate: settledEpochs.length > 0 ? ((otmCount / settledEpochs.length) * 100).toFixed(1) + "%" : "N/A",
      avgPremium:
        store.stats.totalOptionsSold > 0
          ? Math.round(store.stats.totalPremiums / store.stats.totalOptionsSold)
          : 0,
    });
  }

  // User activity
  const userMatch = urlPath.match(/^\/api\/user\/(.+)$/);
  if (userMatch) {
    const address = userMatch[1];
    const userEvents = store.events.filter(
      (e) => e.data.user === address || e.data.buyer === address || e.data.from === address
    );

    const activity: UserActivity = {
      address,
      deposits: userEvents.filter((e) => e.type === "deposit"),
      withdrawals: userEvents.filter((e) => e.type === "withdraw"),
      optionsBought: userEvents.filter((e) => e.type === "option-bought"),
      govTokensClaimed: userEvents.filter((e) => e.type === "gov-tokens-claimed"),
    };

    return jsonResponse(res, activity);
  }

  // Governance proposals
  if (urlPath === "/api/governance/proposals") {
    const proposals = store.events
      .filter((e) => e.type === "proposal-created" || e.type === "proposal-executed" || e.type === "vote-cast")
      .reverse();
    return jsonResponse(res, { events: proposals, total: proposals.length });
  }

  // 404
  jsonResponse(res, { error: "Not found", availableEndpoints: [
    "/health",
    "/api/events",
    "/api/events/:type",
    "/api/epochs",
    "/api/epochs/:id",
    "/api/deposits",
    "/api/withdrawals",
    "/api/stats",
    "/api/user/:address",
    "/api/governance/proposals",
  ] }, 404);
}

// ============================================
// Server
// ============================================

function startServer(): void {
  loadData();

  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`[indexer] sBTC Options Vault Indexer started on port ${PORT}`);
    console.log(`[indexer] Watching ${WATCHED_CONTRACTS.length} contracts`);
    console.log(`[indexer] Data stored at: ${DATA_DIR}`);
    console.log(`[indexer] Endpoints:`);
    console.log(`  GET  http://localhost:${PORT}/health`);
    console.log(`  GET  http://localhost:${PORT}/api/events`);
    console.log(`  GET  http://localhost:${PORT}/api/epochs`);
    console.log(`  GET  http://localhost:${PORT}/api/stats`);
    console.log(`  POST http://localhost:${PORT}/api/chainhook`);
  });

  // Auto-save interval
  saveInterval = setInterval(saveData, 30_000);

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n[indexer] Shutting down...");
    clearInterval(saveInterval);
    saveData();
    server.close(() => {
      console.log("[indexer] Server stopped");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Run if main module
const isMain = process.argv[1]?.includes("server");
if (isMain) {
  startServer();
}

export { startServer, processEvent, store };
