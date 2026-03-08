"use client";

import { useEffect, useState } from "react";
import { getAddressTransactions, getExplorerTxUrl } from "@/lib/hiro-api";
import type { TransactionEvent } from "@/lib/hiro-api";

interface TransactionHistoryProps {
  address: string | null;
  refreshKey: number;
}

const FUNCTION_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  "buy-option": "Buy Option",
  "claim-payout": "Claim Payout",
  "start-epoch": "Start Epoch",
  "settle-epoch": "Settle Epoch",
  "settle-epoch-with-oracle": "Settle (Oracle)",
  "create-listing": "Create Listing",
  "set-btc-price": "Set Price",
  "submit-price": "Submit Price",
  faucet: "Faucet",
  "set-vault-paused": "Pause/Unpause",
  "add-submitter": "Add Submitter",
  "remove-submitter": "Remove Submitter",
};

const FUNCTION_COLORS: Record<string, string> = {
  deposit: "text-green-400",
  withdraw: "text-orange-400",
  "buy-option": "text-blue-400",
  "claim-payout": "text-purple-400",
  faucet: "text-yellow-400",
};

export default function TransactionHistory({
  address,
  refreshKey,
}: TransactionHistoryProps) {
  const [txs, setTxs] = useState<TransactionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setTxs([]);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getAddressTransactions(address!, 30);
        setTxs(result);
      } catch (e) {
        console.error("Failed to load transactions:", e);
        setError("Failed to load transaction history");
      }
      setLoading(false);
    }
    load();
  }, [address, refreshKey]);

  if (!address) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Connect wallet to view transactions</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="h-5 w-40 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/30 rounded-xl p-6 border border-red-500/30">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Transaction History</h2>
        {txs.length > 0 && (
          <span className="text-xs text-gray-500">{txs.length} tx{txs.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {txs.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-500 text-sm">No vault transactions found</p>
          <p className="text-gray-600 text-xs mt-1">Your deposit, withdraw, and option transactions will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {txs.map((tx) => (
            <a
              key={tx.txId}
              href={getExplorerTxUrl(tx.txId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-700 transition-all group min-h-[44px]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <StatusDot status={tx.status} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${FUNCTION_COLORS[tx.functionName] || "text-white"}`}>
                    {FUNCTION_LABELS[tx.functionName] || tx.functionName}
                  </p>
                  <p className="text-xs text-gray-600 font-mono truncate">
                    {tx.txId.slice(0, 10)}...{tx.txId.slice(-6)}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                {tx.blockHeight > 0 && (
                  <p className="text-xs text-gray-500">Block #{tx.blockHeight}</p>
                )}
                {tx.blockTime > 0 && (
                  <p className="text-xs text-gray-600">{formatRelativeTime(tx.blockTime)}</p>
                )}
              </div>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 ml-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: "bg-green-500",
    abort_by_response: "bg-red-500",
    abort_by_post_condition: "bg-red-500",
    pending: "bg-yellow-500 animate-pulse",
  };

  return (
    <div className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || "bg-gray-500"}`} />
  );
}

function formatRelativeTime(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTimestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
