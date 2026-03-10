"use client";

import { useEffect, useState } from "react";
import { getEpoch, getVaultInfo } from "@/lib/vault-calls";
import { formatUSD, ONE_SBTC } from "@/lib/stacks-config";
import { InfoTip } from "@/components/ui/Tooltip";
import type { Epoch, VaultInfo } from "@/lib/types";
import { withRetry } from "@/lib/retry";

interface EpochHistoryProps {
  refreshKey: number;
}

type EpochRow = Epoch & { id: number };

export default function EpochHistory({ refreshKey }: EpochHistoryProps) {
  const [epochs, setEpochs] = useState<EpochRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const vault: VaultInfo = await withRetry(() => getVaultInfo());
        const currentId = Number(vault.currentEpochId);
        if (currentId === 0) {
          setEpochs([]);
          setLoading(false);
          return;
        }

        const items: EpochRow[] = [];
        for (let i = currentId; i >= 1; i--) {
          try {
            const ep = await withRetry(() => getEpoch(i));
            if (ep) items.push({ ...ep, id: i });
          } catch {
            // skip failed epoch fetches
          }
        }
        setEpochs(items);
      } catch (e) {
        console.error("Failed to load epoch history:", e);
        setError("Failed to load epoch history");
      }
      setLoading(false);
    }
    load();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="h-5 w-36 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-800 rounded animate-pulse" />
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

  if (epochs.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Epoch History</h2>
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No epochs yet</p>
          <p className="text-gray-600 text-xs mt-1">Epoch history will appear after the first epoch is started by the admin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Epoch History</h2>
        <span className="text-xs text-gray-500">{epochs.length} epoch{epochs.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
              <th className="pb-3 pr-4">#</th>
              <th className="pb-3 pr-4">Strike</th>
              <th className="pb-3 pr-4">
                <span className="flex items-center">Premium<InfoTip text="sBTC charged to the option buyer, earned by vault depositors." /></span>
              </th>
              <th className="pb-3 pr-4">Collateral</th>
              <th className="pb-3 pr-4">Settlement</th>
              <th className="pb-3 pr-4">
                <span className="flex items-center">Earned<InfoTip text="Net premium earned by the vault after fees." /></span>
              </th>
              <th className="pb-3 pr-4">
                <span className="flex items-center">Payout<InfoTip text="sBTC paid out from the vault to option buyers if ITM." /></span>
              </th>
              <th className="pb-3">
                <span className="flex items-center">Outcome<InfoTip text="OTM = Out of the Money (vault keeps all collateral). ITM = In the Money (buyer gets payout)." /></span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {epochs.map((ep) => (
              <tr key={ep.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="py-3 pr-4 text-white font-medium">{ep.id}</td>
                <td className="py-3 pr-4 text-white">{formatUSD(ep.strikePrice)}</td>
                <td className="py-3 pr-4 text-white">{(Number(ep.premium) / ONE_SBTC).toFixed(4)}</td>
                <td className="py-3 pr-4 text-white">{(Number(ep.collateral) / ONE_SBTC).toFixed(4)}</td>
                <td className="py-3 pr-4 text-white">
                  {ep.settled ? formatUSD(ep.settlementPrice) : "-"}
                </td>
                <td className="py-3 pr-4 text-green-400 font-medium">
                  {ep.settled ? `${(Number(ep.premiumEarned) / ONE_SBTC).toFixed(4)}` : "-"}
                </td>
                <td className="py-3 pr-4 text-orange-400">
                  {ep.settled ? `${(Number(ep.payout) / ONE_SBTC).toFixed(4)}` : "-"}
                </td>
                <td className="py-3">
                  <OutcomeBadge outcome={ep.outcome} settled={ep.settled} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {epochs.map((ep) => (
          <div key={ep.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <span className="text-white font-semibold">Epoch #{ep.id}</span>
              <OutcomeBadge outcome={ep.outcome} settled={ep.settled} />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Strike</p>
                <p className="text-white">{formatUSD(ep.strikePrice)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Settlement</p>
                <p className="text-white">{ep.settled ? formatUSD(ep.settlementPrice) : "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Premium Earned</p>
                <p className="text-green-400 font-medium">
                  {ep.settled ? `${(Number(ep.premiumEarned) / ONE_SBTC).toFixed(4)} sBTC` : "-"}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Payout</p>
                <p className="text-orange-400">
                  {ep.settled ? `${(Number(ep.payout) / ONE_SBTC).toFixed(4)} sBTC` : "-"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome, settled }: { outcome: string; settled: boolean }) {
  if (!settled) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 border border-blue-500/20">
        Active
      </span>
    );
  }

  const isOtm = outcome === "otm" || outcome === "OTM";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        isOtm
          ? "bg-green-900/40 text-green-400 border border-green-500/20"
          : "bg-orange-900/40 text-orange-400 border border-orange-500/20"
      }`}
    >
      {isOtm ? "OTM ✓" : "ITM"}
    </span>
  );
}
