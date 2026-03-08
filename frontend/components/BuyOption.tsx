"use client";

import { useEffect, useState } from "react";
import { openContractCall } from "@stacks/connect";
import {
  fetchCallReadOnlyFunction,
  uintCV,
  cvToJSON,
} from "@stacks/transactions";
import { buildBuyOptionTx, buildClaimPayoutTx } from "@/lib/vault-calls";
import { CONTRACTS, DEPLOYER_ADDRESS, formatSBTC, formatUSD, network } from "@/lib/stacks-config";
import { useToast } from "@/components/Toast";
import { withRetry } from "@/lib/retry";
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
  const { showToast } = useToast();

  useEffect(() => {
    async function loadListings() {
      setLoading(true);
      try {
        const countResult = await withRetry(() =>
          fetchCallReadOnlyFunction({
            contractAddress: CONTRACTS.MARKET.address,
            contractName: CONTRACTS.MARKET.name,
            functionName: "get-listing-count",
            functionArgs: [],
            network,
            senderAddress: DEPLOYER_ADDRESS,
          })
        );
        const count = Number(cvToJSON(countResult).value);

        const items: (Listing & { id: number })[] = [];
        for (let i = 1; i <= count; i++) {
          try {
            const result = await withRetry(() =>
              fetchCallReadOnlyFunction({
                contractAddress: CONTRACTS.MARKET.address,
                contractName: CONTRACTS.MARKET.name,
                functionName: "get-listing",
                functionArgs: [uintCV(i)],
                network,
                senderAddress: DEPLOYER_ADDRESS,
              })
            );
            const json = cvToJSON(result);
            if (json.value) {
              const v = json.value;
              items.push({
                id: i,
                epochId: BigInt(v["epoch-id"].value),
                strikePrice: BigInt(v["strike-price"].value),
                premium: BigInt(v.premium.value),
                collateral: BigInt(v.collateral.value),
                expiryBlock: BigInt(v["expiry-block"].value),
                sold: v.sold.value,
                buyer: v.buyer.value?.value || null,
                createdBlock: BigInt(v["created-block"].value),
                claimed: v.claimed.value,
              });
            }
          } catch {
            // Skip failed individual listing fetches
          }
        }
        setListings(items);
      } catch (e) {
        console.error("Failed to load listings:", e);
      }
      setLoading(false);
    }
    loadListings();
  }, [refreshKey]);

  const handleBuy = async (listing: Listing & { id: number }) => {
    if (!address) return;
    setPendingId(listing.id);
    try {
      const txOptions = buildBuyOptionTx(listing.id, Number(listing.premium), address);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast(`Option #${listing.id} purchased!`, "success", data.txId);
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Purchase cancelled", "info"),
      });
    } catch (e: any) {
      showToast(e.message || "Purchase failed", "error");
    }
    setPendingId(null);
  };

  const handleClaim = async (listingId: number) => {
    if (!address) return;
    setPendingId(listingId);
    try {
      const txOptions = buildClaimPayoutTx(listingId);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast(`Payout claimed for option #${listingId}!`, "success", data.txId);
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Claim cancelled", "info"),
      });
    } catch (e: any) {
      showToast(e.message || "Claim failed", "error");
    }
    setPendingId(null);
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="h-5 w-32 bg-gray-800 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1,2].map(i => (
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
        <h2 className="text-lg font-semibold text-white">Options Market</h2>
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
          <p className="text-gray-600 text-xs mt-1">Options will appear when an epoch starts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm mb-3">
                <div>
                  <p className="text-gray-500 text-xs">Premium</p>
                  <p className="text-white font-medium">{formatSBTC(listing.premium)} sBTC</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Collateral</p>
                  <p className="text-white font-medium">{formatSBTC(listing.collateral)} sBTC</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Expiry Block</p>
                  <p className="text-white font-medium">{listing.expiryBlock.toString()}</p>
                </div>
              </div>
              {!listing.sold && address && (
                <button
                  onClick={() => handleBuy(listing)}
                  disabled={pendingId === listing.id}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {pendingId === listing.id ? (
                    <><Spinner /> Confirming...</>
                  ) : (
                    <>Buy Option ({formatSBTC(listing.premium)} sBTC)</>
                  )}
                </button>
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
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
