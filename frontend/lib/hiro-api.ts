import { HIRO_API_URL, IS_MAINNET, DEPLOYER_ADDRESS } from "./stacks-config";
import { withRetry } from "./retry";
import { cached } from "./cache";

// Uses proxy in browser (/api/stacks/...), direct Hiro API on server
const HIRO_API = HIRO_API_URL;

export interface ChainInfo {
  stacksTipHeight: number;
  burnBlockHeight: number;
  tenureHeight: number;
  serverVersion: string;
  networkId: number;
  peerCount: number;
}

export interface TransactionEvent {
  txId: string;
  type: string;
  functionName: string;
  contractId: string;
  sender: string;
  status: "success" | "abort_by_response" | "abort_by_post_condition" | "pending";
  blockHeight: number;
  blockTime: number;
  fee: number;
}

/**
 * Fetch Stacks chain info (block heights, version, etc.)
 * Cached for 15s to avoid duplicate calls from multiple components.
 */
export function getChainInfo(): Promise<ChainInfo> {
  return cached("chain-info", () =>
    withRetry(async () => {
      const res = await fetch(`${HIRO_API}/v2/info`, {
        next: { revalidate: 30 },
      });
      if (!res.ok) throw new Error(`Chain info failed: ${res.status}`);
      const data = await res.json();
      return {
        stacksTipHeight: data.stacks_tip_height,
        burnBlockHeight: data.burn_block_height,
        tenureHeight: data.tenure_height || data.burn_block_height,
        serverVersion: data.server_version || "",
        networkId: data.network_id || 0,
        peerCount: data.peer_count || 0,
      };
    }),
    15_000 // 15s TTL — block info changes slowly
  );
}

/**
 * Fetch recent transactions for an address, filtered to vault/market contract calls.
 */
export async function getAddressTransactions(
  address: string,
  limit = 20
): Promise<TransactionEvent[]> {
  return withRetry(async () => {
    const res = await fetch(
      `${HIRO_API}/extended/v1/address/${address}/transactions?limit=${limit}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error(`Tx fetch failed: ${res.status}`);
    const data = await res.json();

    const deployerLower = DEPLOYER_ADDRESS.toLowerCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data.results || []) as Record<string, unknown>[])
      .filter((tx) => {
        if (tx.tx_type !== "contract_call") return false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contractId = (tx.contract_call as any)?.contract_id || "";
        return (contractId as string).toLowerCase().startsWith(deployerLower);
      })
      .map((tx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cc = tx.contract_call as any;
        return {
          txId: tx.tx_id as string,
          type: tx.tx_type as string,
          functionName: (cc?.function_name || "") as string,
          contractId: (cc?.contract_id || "") as string,
          sender: tx.sender_address as string,
          status: tx.tx_status as TransactionEvent["status"],
          blockHeight: (tx.block_height || 0) as number,
          blockTime: (tx.burn_block_time || 0) as number,
          fee: Number(tx.fee_rate || 0),
        };
      });
  });
}

/**
 * Get Hiro API base URL.
 */
export function getHiroApiUrl(): string {
  return HIRO_API;
}

/**
 * Get explorer URL for a transaction.
 */
export function getExplorerTxUrl(txId: string): string {
  // BUG-6 FIX: Remove pointless ternary — both branches were identical
  const suffix = IS_MAINNET ? "" : "?chain=testnet";
  return `https://explorer.hiro.so/txid/${txId}${suffix}`;
}
