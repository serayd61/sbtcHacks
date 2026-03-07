"use client";

import { useEffect, useState } from "react";
import { getVaultInfo, getUserInfo, getOracleInfo } from "@/lib/vault-calls";
import { formatSBTC, formatUSD, ONE_SBTC } from "@/lib/stacks-config";
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

  useEffect(() => {
    async function load() {
      setLoading(true);
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
        }
      } catch (e) {
        console.error("Failed to load vault info:", e);
      }
      setLoading(false);
    }
    load();
  }, [address, refreshKey]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse text-gray-500">Loading vault data...</div>
      </div>
    );
  }

  const sharePrice = vaultInfo
    ? Number(vaultInfo.sharePrice) / ONE_SBTC
    : 1;
  const apy =
    vaultInfo && vaultInfo.totalEpochsCompleted > 0n
      ? ((sharePrice - 1) * 52 * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-4">
      {/* Vault Stats */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">
          Vault Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="TVL"
            value={
              vaultInfo ? `${formatSBTC(vaultInfo.totalSbtcDeposited)} sBTC` : "-"
            }
          />
          <StatCard
            label="Share Price"
            value={sharePrice.toFixed(8) + " sBTC"}
          />
          <StatCard label="Est. APY" value={`${apy}%`} highlight />
          <StatCard
            label="Epochs"
            value={vaultInfo ? vaultInfo.totalEpochsCompleted.toString() : "0"}
          />
        </div>
      </div>

      {/* Oracle Info */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">
          BTC Price Oracle
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="BTC/USD"
            value={oracleInfo ? formatUSD(oracleInfo.price) : "-"}
            highlight
          />
          <StatCard
            label="Round"
            value={oracleInfo ? oracleInfo.currentRound.toString() : "-"}
          />
          <StatCard
            label="Status"
            value={
              oracleInfo
                ? oracleInfo.isStale
                  ? "Stale"
                  : "Fresh"
                : "-"
            }
          />
        </div>
      </div>

      {/* Epoch Status */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Epoch Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Current Epoch"
            value={vaultInfo ? `#${vaultInfo.currentEpochId}` : "#0"}
          />
          <StatCard
            label="Status"
            value={
              vaultInfo?.activeEpoch ? "Active" : "Idle"
            }
            highlight={vaultInfo?.activeEpoch}
          />
          <StatCard
            label="Premiums Earned"
            value={
              vaultInfo
                ? `${formatSBTC(vaultInfo.totalPremiumsEarned)} sBTC`
                : "-"
            }
          />
          <StatCard
            label="Vault Status"
            value={vaultInfo?.vaultPaused ? "Paused" : "Active"}
          />
        </div>
      </div>

      {/* User Position */}
      {address && userInfo && (
        <div className="bg-gray-900 rounded-xl p-6 border border-orange-500/30">
          <h2 className="text-lg font-semibold text-orange-400 mb-4">
            Your Position
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              label="Your Shares"
              value={formatSBTC(userInfo.shares)}
            />
            <StatCard
              label="sBTC Value"
              value={`${formatSBTC(userInfo.sbtcValue)} sBTC`}
              highlight
            />
            <StatCard
              label="Share Price"
              value={
                (Number(userInfo.sharePrice) / ONE_SBTC).toFixed(8) + " sBTC"
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={`text-lg font-semibold mt-1 ${
          highlight ? "text-orange-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
