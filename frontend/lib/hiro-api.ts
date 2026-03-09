import { IS_MAINNET, DEPLOYER_ADDRESS } from "./stacks-config";
import { withRetry } from "./retry";

const HIRO_API = IS_MAINNET
  ? "https://api.mainnet.hiro.so"
  : "https://api.testnet.hiro.so";

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
 */
export async function getChainInfo(): Promise<ChainInfo> {
  return withRetry(async () => {
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
  });
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

    return (data.results || [])
      .filter((tx: any) => {
        if (tx.tx_type !== "contract_call") return false;
        const contractId = tx.contract_call?.contract_id || "";
        return contractId.toLowerCase().startsWith(deployerLower);
      })
      .map((tx: any) => ({
        txId: tx.tx_id,
        type: tx.tx_type,
        functionName: tx.contract_call?.function_name || "",
        contractId: tx.contract_call?.contract_id || "",
        sender: tx.sender_address,
        status: tx.tx_status,
        blockHeight: tx.block_height || 0,
        blockTime: tx.burn_block_time || 0,
        fee: Number(tx.fee_rate || 0),
      }));
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
  const base = IS_MAINNET
    ? "https://explorer.hiro.so/txid"
    : "https://explorer.hiro.so/txid";
  const suffix = IS_MAINNET ? "" : "?chain=testnet";
  return `${base}/${txId}${suffix}`;
}
