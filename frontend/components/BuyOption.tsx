"use client";

import { useEffect, useState } from "react";
import { buildBuyOptionTx, buildClaimPayoutTx, getListingsBatch } from "@/lib/vault-calls";
import { formatSBTC, formatUSD } from "@/lib/stacks-config";
import { useToast } from "@/components/Toast";
import { InfoTip } from "@/components/ui/Tooltip";
import { estimateBlocksRemaining } from "@/lib/block-time";
import { getChainInfo } from "@/lib/hiro-api";
import type { Listing } from "@/lib/types";

interface BuyOptionProps {
  address: string | null;
  onTxComplete: () => void;
  refreshKey: number;
}

export default function BuyOption({
  address,
  onTxComplete,
  refreshKey,
}: BuyOptionProps) {
  const [listings, setListings] = useState<(Listing & { id: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const { showToast } = useToast();

  // Single useEffect: fetch chain info + listings in parallel
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [chainInfo, items] = await Promise.all([
          getChainInfo().catch(() => null),
          getListingsBatch(),
        ]);

        if (cancelled) return;

        if (chainInfo) setCurrentBlock(chainInfo.tenureHeight);
        setListings(items);
      } catch (e) {
        if (!cancelled) console.error("Failed to load listings:", e);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleBuy = async (listing: Listing & { id: number }) => {
    if (!address) return;
    setPendingId(listing.id);
    try {
      const txOptions = buildBuyOptionTx(listing.id, Number(listing.premium), address);
      const { openContractCall } = await import("@stacks/connect");
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast(`Option #${listing.id} purchased!`, "success", data.txId);
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Purchase cancelled", "info"),
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      showToast(message || "Purchase failed", "error");
    }
    setPendingId(null);
  };

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

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="h-5 w-32 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {SKELETON_ITEMS.map(i => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 w-48 bg-gray-700 rounded mb-3" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-8 bg-gray-700 rounded" />
                <div className="h-8 bg-gray-700 rounded" />
                <div className="h-8 bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-white">Options Market</h2>
          <InfoTip text="Call options give the buyer the right to profit if BTC price rises above the strike price before expiry. The vault sells these options and earns the premium." />
        </div>
        {listings.length > 0 && (
          <span className="text-xs text-gray-500">{listings.length} option{listings.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {listings.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No options available yet</p>
          <p className="text-gray-600 text-xs mt-1">Options will appear when an epoch is started and a listing is created by the admin</p>
          {/* How it works */}
          <div className="mt-6 text-left bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">How Options Work</h3>
            <div className="space-y-2">
              <Step num={1} text="Admin starts an epoch with a strike price and creates an option listing" />
              <Step num={2} text="You buy the call option by paying a premium (in sBTC)" />
              <Step num={3} text="If BTC price rises above the strike at expiry, your option is In The Money (ITM)" />
              <Step num={4} text="Claim your payout after the epoch is settled by the keeper or admin" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const expiryBlock = Number(listing.expiryBlock);
            const isExpired = currentBlock ? expiryBlock <= currentBlock : false;
            const timeRemaining = currentBlock
              ? estimateBlocksRemaining(currentBlock, expiryBlock)
              : null;

            return (
              <div
                key={listing.id}
                className={`rounded-lg p-4 border transition-all ${
                  listing.sold
                    ? "bg-gray-800/50 border-gray-700/50"
                    : "bg-gray-800 border-gray-700 hover:border-orange-500/30"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs text-gray-500">
                      Option #{listing.id} | Epoch #{listing.epochId.toString()}
                    </span>
                    <p className="text-white font-semibold">
                      CALL @ {formatUSD(listing.strikePrice)}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      listing.sold
                        ? listing.claimed
                          ? "bg-gray-800 text-gray-500 border border-gray-700"
                          : "bg-blue-900/30 text-blue-400 border border-blue-500/20"
                        : "bg-green-900/30 text-green-400 border border-green-500/20"
                    }`}
                  >
                    {listing.sold ? (listing.claimed ? "Settled" : "Sold") : "Available"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                  <div>
                    <p className="text-gray-500 text-xs flex items-center">
                      Premium
                      <InfoTip text="The cost to buy this option. Paid upfront in sBTC, it goes to the vault as yield for depositors." />
                    </p>
                    <p className="text-white font-medium">{formatSBTC(listing.premium)} sBTC</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs flex items-center">
                      Collateral
                      <InfoTip text="sBTC locked in the vault as backing for this option. Determines the maximum potential payout." />
                    </p>
                    <p className="text-white font-medium">{formatSBTC(listing.collateral)} sBTC</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Expiry</p>
                    <p className="text-white font-medium">
                      Block #{expiryBlock.toLocaleString()}
                    </p>
                    {timeRemaining && (
                      <p className={`text-xs mt-0.5 ${isExpired ? "text-red-400" : "text-gray-500"}`}>
                        {timeRemaining}
                      </p>
                    )}
                  </div>
                  {/* Break-even display for available options */}
                  {!listing.sold && (
                    <div>
                      <p className="text-gray-500 text-xs flex items-center">
                        Break-even
                        <InfoTip text="BTC must exceed this price at expiry for profit. Strike + (Premium/Collateral) * Strike." />
                      </p>
                      <p className="text-orange-400 font-medium text-xs">
                        {formatUSD(
                          listing.strikePrice +
                            (listing.premium * listing.strikePrice) / (listing.collateral || 1n)
                        )}
                      </p>
                    </div>
                  )}
                </div>
                {!listing.sold && address && (
                  <button
                    onClick={() => handleBuy(listing)}
                    disabled={pendingId === listing.id || isExpired}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    {pendingId === listing.id ? (
                      <><Spinner /> Confirming...</>
                    ) : isExpired ? (
                      "Option Expired"
                    ) : (
                      <>Buy Option ({formatSBTC(listing.premium)} sBTC)</>
                    )}
                  </button>
                )}
                {!listing.sold && !address && (
                  <p className="text-center text-xs text-gray-500 py-2">
                    Connect wallet to purchase this option
                  </p>
                )}
                {listing.sold && listing.buyer === address && !listing.claimed && (
                  <button
                    onClick={() => handleClaim(listing.id)}
                    disabled={pendingId === listing.id}
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    {pendingId === listing.id ? (
                      <><Spinner /> Confirming...</>
                    ) : (
                      "Claim Payout"
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Constants outside component (avoids re-creation on render) ──────

const SKELETON_ITEMS = [1, 2] as const;

// ── Sub-components ──────────────────────────────────────────────────

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold shrink-0 mt-0.5">
        {num}
      </span>
      <p className="text-xs text-gray-400 leading-relaxed">{text}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
