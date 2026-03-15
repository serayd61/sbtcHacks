"use client";

import { useEffect, useState } from "react";
import { getMarketInfo, getVaultInfo } from "@/lib/vault-calls";
import { formatSBTC } from "@/lib/stacks-config";
import type { MarketInfo, VaultInfo } from "@/lib/types";

interface Props {
  refreshKey: number;
}

export default function ProtocolActivity({ refreshKey }: Props) {
  const [market, setMarket] = useState<MarketInfo | null>(null);
  const [vault, setVault] = useState<VaultInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [m, v] = await Promise.all([
        getMarketInfo().catch(() => null),
        getVaultInfo().catch(() => null),
      ]);
      if (!cancelled) {
        setMarket(m);
        setVault(v);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-800 rounded w-40 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalListings = market ? Number(market.totalListings) : 0;
  const totalSold = market ? Number(market.totalOptionsSold) : 0;
  const totalVolume = market ? market.totalVolume : 0n;
  const sellThrough = totalListings > 0 ? ((totalSold / totalListings) * 100).toFixed(1) : "0";
  const epochsCompleted = vault ? Number(vault.totalEpochsCompleted) : 0;
  const premiumsEarned = vault ? vault.totalPremiumsEarned : 0n;

  const stats = [
    {
      label: "Options Listed",
      value: totalListings.toLocaleString(),
      color: "text-white",
    },
    {
      label: "Options Sold",
      value: totalSold.toLocaleString(),
      color: "text-green-400",
    },
    {
      label: "Total Volume",
      value: `${formatSBTC(totalVolume)} sBTC`,
      color: "text-orange-400",
    },
    {
      label: "Sell-Through Rate",
      value: `${sellThrough}%`,
      color: Number(sellThrough) >= 50 ? "text-green-400" : "text-yellow-400",
    },
    {
      label: "Epochs Completed",
      value: epochsCompleted.toLocaleString(),
      color: "text-white",
    },
    {
      label: "Premiums Earned",
      value: `${formatSBTC(premiumsEarned)} sBTC`,
      color: "text-green-400",
    },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <h3 className="text-lg font-semibold text-white">Protocol Activity</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
