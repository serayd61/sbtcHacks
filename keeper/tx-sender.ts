// keeper/tx-sender.ts
// Shared transaction broadcaster with global nonce tracking
//
// All keeper services must use this module to avoid nonce conflicts
// when multiple TXs are broadcast in the same cycle.

import { KEEPER_CONFIG } from "./config";
import { resolvePrivateKey } from "./key-utils";

const API_BASE = KEEPER_CONFIG.stacksApiUrl;
const DEPLOYER = KEEPER_CONFIG.deployerAddress;

// ============================================
// Global Nonce Tracker
// ============================================

let pendingNonce: bigint | null = null;

/**
 * Get the next available nonce.
 * First call in a cycle fetches from the API.
 * Subsequent calls increment the cached value.
 */
async function getNextNonce(): Promise<bigint> {
  if (pendingNonce !== null) {
    pendingNonce += 1n;
    return pendingNonce;
  }

  const response = await fetch(
    `${API_BASE}/extended/v1/address/${DEPLOYER}/nonces`
  );
  const data = await response.json();
  pendingNonce = BigInt(data.possible_next_nonce);
  return pendingNonce;
}

/**
 * Reset nonce tracker — call at the start of each keeper cycle
 * so the next broadcastTx() fetches a fresh nonce from the API.
 */
export function resetNonceTracker(): void {
  pendingNonce = null;
}

// ============================================
// Shared Transaction Broadcaster
// ============================================

async function getStacksDeps() {
  const { makeContractCall, broadcastTransaction, uintCV, contractPrincipalCV, AnchorMode } =
    await import("@stacks/transactions");
  const { STACKS_MAINNET, STACKS_TESTNET } = await import("@stacks/network");

  const network =
    KEEPER_CONFIG.network === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

  return { makeContractCall, broadcastTransaction, uintCV, contractPrincipalCV, AnchorMode, network };
}

/**
 * Broadcast a contract call transaction with managed nonce.
 * All keeper services should use this instead of broadcasting directly.
 *
 * @param txOptions - makeContractCall options (without network/nonce)
 * @returns Transaction ID
 */
export async function broadcastTx(txOptions: {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: unknown[];
  senderKey: string;
  anchorMode: unknown;
  fee: bigint;
}): Promise<string> {
  const { makeContractCall, broadcastTransaction, network } = await getStacksDeps();
  const nonce = await getNextNonce();

  const tx = await makeContractCall({ ...txOptions, network, nonce } as Parameters<typeof makeContractCall>[0]);
  const result = await broadcastTransaction({ transaction: tx, network });

  if (typeof result === "object" && result !== null && "error" in result) {
    const errObj = result as Record<string, unknown>;
    throw new Error(`Broadcast failed: ${errObj.error} - ${errObj.reason}`);
  }

  return typeof result === "string" ? result : (result as { txid: string }).txid;
}

/**
 * Get a private key or throw if not available.
 * Convenience wrapper for services that require a key.
 */
export async function requirePrivateKey(): Promise<string> {
  const key = await resolvePrivateKey();
  if (!key) {
    throw new Error("KEEPER_PRIVATE_KEY environment variable required (hex key or mnemonic)");
  }
  return key;
}

// Re-export stacks helpers for convenience
export async function getUintCV(value: bigint) {
  const { uintCV } = await import("@stacks/transactions");
  return uintCV(value);
}

export async function getContractPrincipalCV(address: string, name: string) {
  const { contractPrincipalCV } = await import("@stacks/transactions");
  return contractPrincipalCV(address, name);
}

export { DEPLOYER };
