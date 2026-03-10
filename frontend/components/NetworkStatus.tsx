"use client";

import { useEffect, useState } from "react";
import { getChainInfo } from "@/lib/hiro-api";
import type { ChainInfo } from "@/lib/hiro-api";
import { IS_MAINNET } from "@/lib/stacks-config";

export default function NetworkStatus() {
  const [chainInfo, setChainInfo] = useState<ChainInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "online" | "degraded" | "offline">("loading");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const info = await getChainInfo();
        setChainInfo(info);
        setStatus("online");
      } catch {
        setStatus("offline");
      }
    }
    check();
    const interval = setInterval(check, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const statusColors = {
    loading: "bg-gray-500",
    online: "bg-green-500",
    degraded: "bg-yellow-500",
    offline: "bg-red-500",
  };

  const statusLabels = {
    loading: "Connecting...",
    online: "Online",
    degraded: "Degraded",
    offline: "Offline",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 transition-colors text-xs min-h-[36px]"
        title="Stacks Network Status"
      >
        <span className={`w-2 h-2 rounded-full ${statusColors[status]} ${status === "loading" ? "animate-pulse" : ""}`} />
        <span className="text-gray-400 hidden sm:inline">
          {status === "online" && chainInfo
            ? `Block #${chainInfo.tenureHeight.toLocaleString()}`
            : statusLabels[status]}
        </span>
        <span className="text-gray-400 sm:hidden">
          {status === "online" && chainInfo
            ? `#${chainInfo.tenureHeight.toLocaleString()}`
            : ""}
        </span>
      </button>

      {/* Details Popover */}
      {showDetails && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowDetails(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 rounded-xl border border-gray-700 shadow-xl z-40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
              <span className="text-sm font-semibold text-white">
                Stacks Network {statusLabels[status]}
              </span>
            </div>

            {chainInfo ? (
              <div className="space-y-2 text-sm">
                <InfoRow label="Tenure Height" value={`#${chainInfo.tenureHeight.toLocaleString()}`} hint="Used by smart contracts" />
                <InfoRow label="Bitcoin Block" value={`#${chainInfo.burnBlockHeight.toLocaleString()}`} />
                <InfoRow label="Stacks Block" value={`#${chainInfo.stacksTipHeight.toLocaleString()}`} />
                {chainInfo.peerCount > 0 && (
                  <InfoRow label="Peers" value={chainInfo.peerCount.toString()} />
                )}
                <div className="pt-2 mt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-600">
                    Network: Stacks {IS_MAINNET ? "Mainnet" : "Testnet"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Unable to fetch network info</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">
        {label}
        {hint && <span className="text-gray-600 text-xs ml-1">({hint})</span>}
      </span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}
