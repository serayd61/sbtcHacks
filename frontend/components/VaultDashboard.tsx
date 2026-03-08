"use client";

import { useEffect, useState } from "react";
import { getVaultInfo, getUserInfo, getOracleInfo } from "@/lib/vault-calls";
import { formatUSD, ONE_SBTC } from "@/lib/stacks-config";
import type { VaultInfo, UserInfo, OracleInfo } from "@/lib/types";

interface VaultDashboardProps {
  address: string | null;
  refreshKey: number;
}

export default function VaultDashboard({
  address,
  refreshKey,
}: VaultDashboardProps) {
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [oracleInfo, setOracleInfo] = useState<OracleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [vault, oracle] = await Promise.all([
          getVaultInfo(),
          getOracleInfo(),
        ]);
        setVaultInfo(vault);
        setOracleInfo(oracle);

        if (address) {
          const user = await getUserInfo(address);
          setUserInfo(user);
        } else {
          setUserInfo(null);
        }
      } catch (e) {
        console.error("Failed to load vault info:", e);
        setError("Failed to connect to Stacks network.");
      }
      setLoading(false);
    }
    load();
  }, [address, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="h-5 w-32 bg-gray-800 rounded animate-pulse mb-5" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i}>
                <div className="h-3 w-16 bg-gray-800 rounded animate-pulse mb-2" />
                <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2].map(i => (
            <div key={i} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="h-4 w-24 bg-gray-800 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                {[1,2,3].map(j => (
                  <div key={j} className="flex justify-between">
                    <div className="h-4 w-16 bg-gray-800 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/30 rounded-xl p-6 border border-red-500/30">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  const sharePrice = vaultInfo ? Number(vaultInfo.sharePrice) / ONE_SBTC : 1;
  const tvlSbtc = vaultInfo ? Number(vaultInfo.totalSbtcDeposited) / ONE_SBTC : 0;
  const apy = vaultInfo && vaultInfo.totalEpochsCompleted > 0n
    ? ((sharePrice - 1) * 52 * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-4">
      {/* Vault Stats */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Vault Overview</h2>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            vaultInfo?.activeEpoch
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-gray-800 text-gray-400 border border-gray-700"
          }`}>
            {vaultInfo?.activeEpoch ? "Epoch Active" : "Idle"}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Value Locked" value={tvlSbtc > 0 ? `${tvlSbtc.toFixed(4)} sBTC` : "0 sBTC"} />
          <StatCard label="Share Price" value={sharePrice.toFixed(4) + " sBTC"} />
          <StatCard label="Est. APY" value={`${apy}%`} highlight />
          <StatCard label="Epochs" value={vaultInfo ? vaultInfo.totalEpochsCompleted.toString() : "0"} />
        </div>
      </div>

      {/* Oracle + Epoch Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">BTC Price Oracle</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">BTC/USD</span>
              <span className="text-xl font-bold text-orange-400">{oracleInfo ? formatUSD(oracleInfo.price) : "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Round</span>
              <span className="text-sm text-white">#{oracleInfo ? oracleInfo.currentRound.toString() : "0"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${oracleInfo?.isStale ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>
                {oracleInfo ? (oracleInfo.isStale ? "Stale" : "Fresh") : "-"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Submitters</span>
              <span className="text-sm text-white">{oracleInfo ? oracleInfo.submitterCount.toString() : "0"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Tolerance</span>
              <span className="text-sm text-white">{oracleInfo ? `${Number(oracleInfo.toleranceBps) / 100}%` : "-"}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Epoch Status</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Current Epoch</span>
              <span className="text-sm text-white font-medium">#{vaultInfo ? vaultInfo.currentEpochId.toString() : "0"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Premiums Earned</span>
              <span className="text-sm text-green-400 font-medium">
                {vaultInfo ? `${(Number(vaultInfo.totalPremiumsEarned) / ONE_SBTC).toFixed(4)} sBTC` : "0 sBTC"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Fees Collected</span>
              <span className="text-sm text-yellow-400 font-medium">
                {vaultInfo ? `${(Number(vaultInfo.totalFeesCollected) / ONE_SBTC).toFixed(4)} sBTC` : "0 sBTC"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Vault</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${vaultInfo?.vaultPaused ? "bg-red-900/50 text-red-400" : "bg-green-900/50 text-green-400"}`}>
                {vaultInfo?.vaultPaused ? "Paused" : "Active"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* User Position */}
      {address && userInfo && Number(userInfo.shares) > 0 && (
        <div className="bg-gradient-to-r from-orange-500/5 to-orange-500/10 rounded-xl p-6 border border-orange-500/20">
          <h2 className="text-lg font-semibold text-orange-400 mb-4">Your Position</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Shares</p>
              <p className="text-lg font-semibold text-white mt-1">{(Number(userInfo.shares) / ONE_SBTC).toFixed(4)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Value</p>
              <p className="text-lg font-semibold text-orange-400 mt-1">{(Number(userInfo.sbtcValue) / ONE_SBTC).toFixed(4)} sBTC</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Share Price</p>
              <p className="text-lg font-semibold text-white mt-1">{(Number(userInfo.sharePrice) / ONE_SBTC).toFixed(4)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? "text-green-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
