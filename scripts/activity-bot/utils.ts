import {
  makeContractCall,
  makeSTXTokenTransfer,
  broadcastTransaction,
  AnchorMode,
  type ClarityValue,
} from "@stacks/transactions";
import { BOT_CONFIG } from "./config.js";

// ============================================
// Nonce Management
// ============================================

const nonceCache = new Map<string, bigint>();

export async function getNextNonce(address: string): Promise<bigint> {
  if (nonceCache.has(address)) {
    const next = nonceCache.get(address)! + 1n;
    nonceCache.set(address, next);
    return next;
  }

  const res = await fetch(
    `${BOT_CONFIG.apiUrl}/extended/v1/address/${address}/nonces`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch nonce for ${address}: ${res.status}`);
  }
  const data = (await res.json()) as { possible_next_nonce: number };
  const nonce = BigInt(data.possible_next_nonce);
  nonceCache.set(address, nonce);
  return nonce;
}

export function presetNonce(address: string, nonce: bigint): void {
  nonceCache.set(address, nonce - 1n); // Will be incremented on next call
}

export function resetNonceCache(): void {
  nonceCache.clear();
}

// ============================================
// Transaction Broadcasting
// ============================================

export async function broadcastSTXTransfer(opts: {
  recipientAddress: string;
  amount: bigint;
  senderKey: string;
  nonce: bigint;
  fee?: bigint;
}): Promise<string | null> {
  const tx = await makeSTXTokenTransfer({
    recipient: opts.recipientAddress,
    amount: opts.amount,
    senderKey: opts.senderKey,
    network: BOT_CONFIG.network,
    anchorMode: AnchorMode.Any,
    fee: opts.fee ?? BOT_CONFIG.defaultFee,
    nonce: opts.nonce,
  });

  return broadcastTx(tx);
}

export async function broadcastContractCall(opts: {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  senderKey: string;
  nonce: bigint;
  fee?: bigint;
}): Promise<string | null> {
  const tx = await makeContractCall({
    contractAddress: opts.contractAddress,
    contractName: opts.contractName,
    functionName: opts.functionName,
    functionArgs: opts.functionArgs,
    senderKey: opts.senderKey,
    network: BOT_CONFIG.network,
    anchorMode: AnchorMode.Any,
    fee: opts.fee ?? BOT_CONFIG.defaultFee,
    nonce: opts.nonce,
  });

  return broadcastTx(tx);
}

async function broadcastTx(
  tx: Awaited<ReturnType<typeof makeContractCall>>,
  maxRetries = 3
): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await broadcastTransaction({
        transaction: tx,
        network: BOT_CONFIG.network,
      });

      if (typeof result === "string") {
        return result;
      }

      const r = result as {
        error?: string;
        reason?: string;
        txid?: string;
      };

      if (r.error) {
        if (r.reason === "ConflictingNonceInMempool") {
          console.warn(`  Nonce conflict, skipping...`);
          return null;
        }
        if (r.reason === "ContractAlreadyExists") {
          return null;
        }
        throw new Error(`${r.error}: ${r.reason}`);
      }

      return r.txid ?? null;
    } catch (e) {
      if (attempt < maxRetries - 1) {
        const delay = 5000 * (attempt + 1);
        console.warn(
          `  Broadcast attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...`
        );
        await sleep(delay);
      } else {
        console.error(`  Broadcast failed after ${maxRetries} attempts:`, e);
        return null;
      }
    }
  }
  return null;
}

// ============================================
// Batch Processing
// ============================================

export interface BatchResult {
  successful: number;
  failed: number;
  txIds: string[];
  failedIndices: number[];
}

export async function processBatch<T>(
  items: T[],
  batchSize: number,
  processFn: (item: T, index: number) => Promise<string | null>,
  delayMs: number,
  label: string
): Promise<BatchResult> {
  const result: BatchResult = {
    successful: 0,
    failed: 0,
    txIds: [],
    failedIndices: [],
  };

  const totalBatches = Math.ceil(items.length / batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, items.length);
    const batchItems = items.slice(start, end);

    console.log(
      `  [${label}] Batch ${batch + 1}/${totalBatches} (${start + 1}-${end}/${items.length})`
    );

    const promises = batchItems.map((item, i) => processFn(item, start + i));
    const results = await Promise.allSettled(promises);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && r.value) {
        result.successful++;
        result.txIds.push(r.value);
      } else {
        result.failed++;
        result.failedIndices.push(start + i);
        if (r.status === "rejected") {
          console.error(`    Failed #${start + i}: ${r.reason}`);
        }
      }
    }

    console.log(
      `    Batch result: ${results.filter((r) => r.status === "fulfilled" && r.value).length} OK, ${results.filter((r) => r.status !== "fulfilled" || !r.value).length} failed`
    );

    // Wait between batches (except last)
    if (batch < totalBatches - 1) {
      console.log(`    Waiting ${delayMs / 1000}s before next batch...`);
      await sleep(delayMs);
    }
  }

  return result;
}

// ============================================
// Progress Tracking
// ============================================

import fs from "fs";
import path from "path";

export interface ProgressState {
  step: string;
  completedIndices: number[];
  failedIndices: number[];
  lastBatchIndex: number;
  updatedAt: string;
}

export function loadProgress(step: string): ProgressState | null {
  const filePath = path.resolve(BOT_CONFIG.progressFile);
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (data.step === step) return data;
    return null;
  } catch {
    return null;
  }
}

export function saveProgress(state: ProgressState): void {
  const filePath = path.resolve(BOT_CONFIG.progressFile);
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

export function clearProgress(): void {
  const filePath = path.resolve(BOT_CONFIG.progressFile);
  try {
    fs.unlinkSync(filePath);
  } catch {}
}

// ============================================
// Helpers
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getSTXBalance(address: string): Promise<bigint> {
  const res = await fetch(
    `${BOT_CONFIG.apiUrl}/extended/v1/address/${address}/stx`
  );
  if (!res.ok) return 0n;
  const data = (await res.json()) as { balance: string };
  return BigInt(data.balance);
}

export async function getTokenBalance(
  address: string,
  contractId: string
): Promise<bigint> {
  const res = await fetch(
    `${BOT_CONFIG.apiUrl}/extended/v1/address/${address}/balances`
  );
  if (!res.ok) return 0n;
  const data = (await res.json()) as {
    fungible_tokens: Record<string, { balance: string }>;
  };
  const key = `${contractId}::mock-sbtc`;
  return BigInt(data.fungible_tokens?.[key]?.balance ?? "0");
}

export function privateKeyToStxAddress(privateKey: string): string {
  // Lazy import to avoid circular
  const { getAddressFromPrivateKey } = require("@stacks/transactions");
  return getAddressFromPrivateKey(privateKey, BOT_CONFIG.network);
}
