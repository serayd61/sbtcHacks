"use client";

import { useEffect, useState } from "react";
import { buildClaimPayoutTx, getListingsBatch, getEpochsBatch, getOracleInfo } from "@/lib/vault-calls";
import { formatUSD, formatSats, ONE_SBTC } from "@/lib/stacks-config";
import { getChainInfo } from "@/lib/hiro-api";
import { useToast } from "@/components/Toast";
import { InfoTip } from "@/components/ui/Tooltip";
import { estimateBlocksRemaining } from "@/lib/block-time";
import type { Listing, OracleInfo, Epoch } from "@/lib/types";

interface UserOptionsProps {
  address: string | null;
  refreshKey: number;
  onTxComplete: () => void;
}

type UserListing = Listing & { id: number };

export default function UserOptions({ address, refreshKey, onTxComplete }: UserOptionsProps) {
  const [myOptions, setMyOptions] = useState<UserListing[]>([]);
  const [oracle, setOracle] = useState<OracleInfo | null>(null);
  const [epochs, setEpochs] = useState<Map<number, Epoch>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!address) {
      setMyOptions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [chainInfo, oracleInfo, allListings] = await Promise.all([
          getChainInfo().catch(() => null),
          getOracleInfo(),
          getListingsBatch(),
        ]);

        if (cancelled) return;

        if (chainInfo) setCurrentBlock(chainInfo.tenureHeight);
        setOracle(oracleInfo);

        const userListings = allListings.filter((l) => l.buyer === address);
        const epochIds = [...new Set(userListings.map((l) => Number(l.epochId)))];
        const epochMap = await getEpochsBatch(epochIds);

        if (cancelled) return;

        setMyOptions(userListings);
        setEpochs(epochMap);
      } catch (e) {
        if (!cancelled) console.error("Failed to load user options:", e);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [address, refreshKey]);

  const handleClaim = async (listingId: number) => {
    if (!address) return;
    setPendingId(listingId);
    try {
      const txOptions = buildClaimPayoutTx(listingId);
      const { openContractCall } = await import("@stacks/connect");
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast(`Payout claimed for option #${listingId}!`, "success", data.txId);
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Claim cancelled", "info"),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      showToast(message || "Claim failed", "error");
    }
    setPendingId(null);
  };

  if (!address) return null;

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-500/5 via-gray-900 to-purple-500/5 rounded-xl p-5 border border-blue-500/20">
        <div className="h-5 w-32 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="bg-gray-800/50 rounded-lg p-4 animate-pulse">
          <div className="h-4 w-48 bg-gray-700 rounded mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (myOptions.length === 0) return null;

  const currentPrice = oracle ? Number(oracle.price) : 0;

  return (
    <div className="bg-gradient-to-br from-blue-500/5 via-gray-900 to-purple-500/5 rounded-xl p-5 border border-blue-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-blue-400">Your Positions</h2>
          <InfoTip text="Options you've purchased. Active options are waiting for expiry. Settled ITM options can be claimed for payout." />
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 border border-blue-500/20 font-medium">
          {myOptions.length} position{myOptions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {myOptions.map((opt) => (
          <OptionCard
            key={opt.id}
            opt={opt}
            epoch={epochs.get(Number(opt.epochId))}
            currentPrice={currentPrice}
            currentBlock={currentBlock}
            pendingId={pendingId}
            onClaim={handleClaim}
          />
        ))}
      </div>
    </div>
  );
}

// ── Option Card ─────────────────────────────────────────────────────

interface OptionCardProps {
  opt: UserListing;
  epoch: Epoch | undefined;
  currentPrice: number;
  currentBlock: number | null;
  pendingId: number | null;
  onClaim: (id: number) => void;
}

function OptionCard({ opt, epoch, currentPrice, currentBlock, pendingId, onClaim }: OptionCardProps) {
  const strikeUsd = Number(opt.strikePrice) / 1_000_000;
  const currentUsd = currentPrice / 1_000_000;
  const premiumSbtc = Number(opt.premium) / ONE_SBTC;
  const collateralSbtc = Number(opt.collateral) / ONE_SBTC;
  const expiryBlock = Number(opt.expiryBlock);

  // P&L calculation
  const isItm = currentUsd > strikeUsd;
  const intrinsicValue = isItm
    ? ((currentUsd - strikeUsd) / currentUsd) * collateralSbtc
    : 0;
  const pnl = intrinsicValue - premiumSbtc;
  const pnlPercent = premiumSbtc > 0 ? (pnl / premiumSbtc) * 100 : 0;

  const timeRemaining = currentBlock ? estimateBlocksRemaining(currentBlock, expiryBlock) : null;
  const isExpired = currentBlock ? expiryBlock <= currentBlock : false;

  // Status
  let status: string;
  let statusClass: string;
  let statusDot: string;
  if (opt.claimed) {
    status = "Settled";
    statusClass = "text-gray-500 bg-gray-800 border-gray-700";
    statusDot = "bg-gray-500";
  } else if (epoch?.settled) {
    status = "Claimable";
    statusClass = "text-green-400 bg-green-900/30 border-green-500/20";
    statusDot = "bg-green-400 animate-pulse";
  } else if (isExpired) {
    status = "Settling";
    statusClass = "text-yellow-400 bg-yellow-900/30 border-yellow-500/20";
    statusDot = "bg-yellow-400";
  } else {
    status = "Active";
    statusClass = "text-blue-400 bg-blue-900/30 border-blue-500/20";
    statusDot = "bg-blue-400";
  }

  return (
    <div className="bg-gray-900/80 rounded-lg border border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">
            CALL @ {formatUSD(opt.strikePrice)}
          </span>
          <span className="text-xs text-gray-600">#{opt.id}</span>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1.5 ${statusClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          {status}
        </span>
      </div>

      {/* Price comparison bar */}
      {!opt.claimed && currentUsd > 0 && (
        <div className="px-4 py-2 bg-gray-800/30">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500">Strike {formatUSD(opt.strikePrice)}</span>
            <span className={`font-medium ${isItm ? "text-green-400" : "text-orange-400"}`}>
              Current {formatUSD(BigInt(currentPrice))}
            </span>
          </div>
          <div className="relative h-1.5 bg-gray-700 rounded-full overflow-hidden">
            {/* Strike marker */}
            <div className="absolute h-full w-px bg-gray-500 z-10" style={{ left: "50%" }} />
            {/* Price position relative to strike */}
            {(() => {
              const ratio = strikeUsd > 0 ? currentUsd / strikeUsd : 0;
              const barWidth = Math.min(100, Math.max(0, ratio * 50));
              return (
                <div
                  className={`h-full rounded-full transition-all ${isItm ? "bg-green-500" : "bg-orange-500"}`}
                  style={{ width: `${barWidth}%` }}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px bg-gray-800/30">
        <div className="bg-gray-900/80 px-4 py-2.5">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Premium Paid</p>
          <p className="text-white text-sm font-medium">{formatSats(opt.premium)}</p>
        </div>
        <div className="bg-gray-900/80 px-4 py-2.5">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Collateral</p>
          <p className="text-white text-sm font-medium">{formatSats(opt.collateral)}</p>
        </div>
      </div>

      {/* P&L */}
      {!opt.claimed && (
        <div className="px-4 py-3 border-t border-gray-800/50">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs flex items-center gap-0.5">
              Unrealized P&L
              <InfoTip text="Estimated profit/loss based on current BTC price vs. strike, minus premium paid." />
            </span>
            <div className="text-right">
              <span className={`text-lg font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} sBTC
              </span>
              <span className={`text-xs ml-1.5 ${pnl >= 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Settled info */}
      {epoch?.settled && !opt.claimed && (
        <div className="mx-4 mb-3 p-3 rounded-lg bg-green-900/10 border border-green-500/10">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Settlement</span>
            <span className="text-white font-medium">{formatUSD(epoch.settlementPrice)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Outcome</span>
            <span className={`font-bold ${
              epoch.outcome === "otm" || epoch.outcome === "OTM" ? "text-red-400" : "text-green-400"
            }`}>
              {epoch.outcome === "otm" || epoch.outcome === "OTM" ? "OTM" : "ITM"}
            </span>
          </div>
          {Number(epoch.payout) > 0 && (
            <div className="flex justify-between text-xs mt-1">
              <span className="text-gray-400">Payout</span>
              <span className="text-green-400 font-bold">{formatSats(epoch.payout)}</span>
            </div>
          )}
        </div>
      )}

      {/* Claim button */}
      {epoch?.settled && !opt.claimed && (
        <div className="px-4 pb-4">
          <button
            onClick={() => onClaim(opt.id)}
            disabled={pendingId === opt.id}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 min-h-[44px]"
          >
            {pendingId === opt.id ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Confirming...
              </>
            ) : (
              "Claim Payout"
            )}
          </button>
        </div>
      )}

      {/* Progress footer for active */}
      {!epoch?.settled && !opt.claimed && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${isItm ? "bg-green-400" : "bg-orange-400"}`} />
              {isItm ? "ITM" : "OTM"}
            </span>
            <span className={isExpired ? "text-red-400" : ""}>
              {timeRemaining ?? `Block #${expiryBlock.toLocaleString()}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
