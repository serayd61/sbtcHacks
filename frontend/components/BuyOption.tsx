"use client";

import { useEffect, useState } from "react";
import { buildBuyOptionTx, buildClaimPayoutTx, getListingsPage, findFirstAvailableListing, getVaultInfo } from "@/lib/vault-calls";
import { formatSBTC, formatUSD, formatSats } from "@/lib/stacks-config";
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

const PAGE_SIZE = 10;

export default function BuyOption({
  address,
  onTxComplete,
  refreshKey,
}: BuyOptionProps) {
  const [listings, setListings] = useState<(Listing & { id: number })[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [sample, setSample] = useState<(Listing & { id: number }) | null>(null);
  const [firstAvailable, setFirstAvailable] = useState<(Listing & { id: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [epochId, setEpochId] = useState<bigint | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [page, setPage] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Fetch chain info + vault info + first page of listings (newest first)
        // This makes ~15 API calls instead of 3300+
        const [chainInfo, vaultInfo, pageData] = await Promise.all([
          getChainInfo().catch(() => null),
          getVaultInfo().catch(() => null),
          getListingsPage(0, PAGE_SIZE),
        ]);

        if (cancelled) return;

        if (chainInfo) setCurrentBlock(chainInfo.tenureHeight);

        const activeEpochId = vaultInfo?.currentEpochId;
        if (activeEpochId) setEpochId(activeEpochId);

        setListings(pageData.items);
        setTotalCount(pageData.totalCount);
        setSample(pageData.sample);

        // Find first available listing in background (for quick buy button)
        findFirstAvailableListing().then(avail => {
          if (!cancelled) setFirstAvailable(avail);
        }).catch(() => {});
      } catch (e) {
        if (!cancelled) console.error("Failed to load listings:", e);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Fetch new page when pagination changes
  useEffect(() => {
    if (page === 0) return; // page 0 already loaded above
    let cancelled = false;

    async function loadPage() {
      try {
        const pageData = await getListingsPage(page, PAGE_SIZE);
        if (!cancelled) setListings(pageData.items);
      } catch (e) {
        console.error("Failed to load page:", e);
      }
    }

    loadPage();
    return () => { cancelled = true; };
  }, [page]);

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

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="h-6 w-48 bg-gray-800 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 bg-gray-800 rounded animate-pulse" />
              <div className="h-6 w-24 bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-12 bg-gray-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  // Empty state
  if (totalCount === 0 && !sample) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Options Market</h2>
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">No options available yet</p>
          <p className="text-gray-600 text-xs mt-1">Options will appear when an epoch is started</p>
          <div className="mt-6 text-left bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">How Options Work</h3>
            <div className="space-y-2">
              <Step num={1} text="Admin starts an epoch with a strike price and creates option listings" />
              <Step num={2} text="You buy a call option by paying a premium (in sBTC)" />
              <Step num={3} text="If BTC price rises above the strike at expiry, your option is In The Money (ITM)" />
              <Step num={4} text="Claim your payout after the epoch is settled by the keeper or admin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Derive epoch-level summary from sample listing (all listings share same params)
  if (!sample) return null;
  const userSold = listings.filter(l => l.sold && l.buyer === address && !l.claimed);
  const pageSold = listings.filter(l => l.sold).length;
  const pageAvailable = listings.filter(l => !l.sold).length;
  const expiryBlock = Number(sample.expiryBlock);
  const isExpired = currentBlock ? expiryBlock <= currentBlock : false;
  const timeRemaining = currentBlock ? estimateBlocksRemaining(currentBlock, expiryBlock) : null;
  const breakEven = sample.strikePrice + (sample.premium * sample.strikePrice) / (sample.collateral || 1n);

  // Pagination
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* ── Epoch Summary Banner ─────────────────────────────── */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-lg font-semibold text-white">
                Epoch #{epochId?.toString() ?? "—"}
              </h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-500/20 font-medium">
              Active
            </span>
          </div>
          <div className="text-right">
            {timeRemaining && (
              <span className={`text-sm font-medium ${isExpired ? "text-red-400" : "text-gray-300"}`}>
                {isExpired ? "Expired" : timeRemaining}
              </span>
            )}
            <p className="text-xs text-gray-500">
              Block #{expiryBlock.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-gray-800/50 mx-4 rounded-lg overflow-hidden mb-4">
          <StatCell
            label="Strike Price"
            value={formatUSD(sample.strikePrice)}
            tooltip="BTC target price. If BTC exceeds this at expiry, options are In The Money (ITM)."
          />
          <StatCell
            label="Premium"
            value={formatSats(sample.premium)}
            sub={formatSBTC(sample.premium) + " sBTC"}
            tooltip="Cost to buy one option. Paid upfront, goes to vault depositors as yield."
          />
          <StatCell
            label="Collateral"
            value={formatSats(sample.collateral)}
            sub={formatSBTC(sample.collateral) + " sBTC"}
            tooltip="sBTC locked per option as backing. Determines max payout if ITM."
          />
          <StatCell
            label="Break-even"
            value={formatUSD(breakEven)}
            valueClass="text-orange-400"
            tooltip="BTC must exceed this price at expiry for the buyer to profit."
          />
          <StatCell
            label="Total"
            value={totalCount.toLocaleString()}
            valueClass="text-green-400"
          />
        </div>

        {/* Listing count bar */}
        <div className="mx-6 mb-4">
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{totalCount.toLocaleString()} total options</span>
            <span>Page {page + 1} of {totalPages}</span>
          </div>
        </div>

        {/* Quick Buy Button */}
        <div className="px-6 pb-5">
          {address ? (
            <button
              onClick={() => firstAvailable && handleBuy(firstAvailable)}
              disabled={pendingId !== null || isExpired || !firstAvailable}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-all text-sm flex items-center justify-center gap-2 min-h-[48px] shadow-lg shadow-orange-500/10"
            >
              {pendingId !== null ? (
                <><Spinner /> Confirming...</>
              ) : isExpired ? (
                "Epoch Expired"
              ) : !firstAvailable ? (
                <><Spinner /> Finding available option...</>
              ) : (
                <>
                  Buy Option
                  <span className="opacity-70 font-normal">
                    ({formatSats(sample.premium)})
                  </span>
                </>
              )}
            </button>
          ) : !address ? (
            <div className="text-center py-3 rounded-lg border border-gray-700 bg-gray-800/50">
              <p className="text-sm text-gray-400">Connect wallet to purchase options</p>
            </div>
          ) : (
            <div className="text-center py-3 rounded-lg border border-gray-700 bg-gray-800/50">
              <p className="text-sm text-gray-500">All options sold out</p>
            </div>
          )}

          {/* User's claimable options */}
          {userSold.length > 0 && (
            <div className="mt-3 space-y-2">
              {userSold.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleClaim(opt.id)}
                  disabled={pendingId === opt.id}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {pendingId === opt.id ? (
                    <><Spinner /> Confirming...</>
                  ) : (
                    <>Claim Payout — Option #{opt.id}</>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Compact Listings Table ──────────────────────────── */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full flex items-center justify-between px-6 py-3 text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className={`w-4 h-4 transition-transform ${showTable ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            View All Listings
          </span>
          <span className="text-xs text-gray-600">
            {totalCount.toLocaleString()} listings
          </span>
        </button>

        {showTable && (
          <div className="border-t border-gray-800">
            {/* Table header */}
            <div className="grid grid-cols-[60px_1fr_1fr_100px] sm:grid-cols-[70px_1fr_1fr_120px] gap-2 px-6 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800/50">
              <span>ID</span>
              <span>Status</span>
              <span>Buyer</span>
              <span className="text-right">Action</span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-gray-800/30">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className={`grid grid-cols-[60px_1fr_1fr_100px] sm:grid-cols-[70px_1fr_1fr_120px] gap-2 px-6 py-2.5 text-sm items-center transition-colors hover:bg-gray-800/30 ${
                    listing.buyer === address ? "bg-blue-900/5 border-l-2 border-l-blue-500/30" : ""
                  }`}
                >
                  {/* ID */}
                  <span className="text-gray-400 font-mono text-xs">#{listing.id}</span>

                  {/* Status */}
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      listing.claimed
                        ? "bg-gray-500"
                        : listing.sold
                        ? "bg-blue-400"
                        : "bg-green-400"
                    }`} />
                    <span className={`text-xs font-medium ${
                      listing.claimed
                        ? "text-gray-500"
                        : listing.sold
                        ? "text-blue-400"
                        : "text-green-400"
                    }`}>
                      {listing.claimed ? "Claimed" : listing.sold ? "Sold" : "Available"}
                    </span>
                  </span>

                  {/* Buyer */}
                  <span className="text-xs text-gray-500 font-mono truncate">
                    {listing.buyer
                      ? `${listing.buyer.slice(0, 6)}...${listing.buyer.slice(-4)}`
                      : "—"
                    }
                  </span>

                  {/* Action */}
                  <span className="text-right">
                    {!listing.sold && address && (
                      <button
                        onClick={() => handleBuy(listing)}
                        disabled={pendingId === listing.id || isExpired}
                        className="text-xs px-3 py-1 rounded-md bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-30 disabled:hover:bg-orange-500/10 transition-colors font-medium"
                      >
                        {pendingId === listing.id ? "..." : "Buy"}
                      </button>
                    )}
                    {listing.sold && listing.buyer === address && !listing.claimed && (
                      <button
                        onClick={() => handleClaim(listing.id)}
                        disabled={pendingId === listing.id}
                        className="text-xs px-3 py-1 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-30 transition-colors font-medium"
                      >
                        {pendingId === listing.id ? "..." : "Claim"}
                      </button>
                    )}
                    {listing.sold && listing.buyer !== address && (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                    {!listing.sold && !address && (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-xs px-3 py-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="text-xs px-3 py-1.5 rounded-md bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function StatCell({
  label,
  value,
  sub,
  valueClass,
  tooltip,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  tooltip?: string;
}) {
  return (
    <div className="bg-gray-900 px-4 py-3">
      <p className="text-gray-500 text-xs flex items-center gap-0.5 mb-1">
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </p>
      <p className={`font-semibold text-sm ${valueClass || "text-white"}`}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

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
