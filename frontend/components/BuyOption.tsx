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

  useEffect(() => {
    async function loadListings() {
      setLoading(true);
      try {
        // Get listing count
        const countResult = await fetchCallReadOnlyFunction({
          contractAddress: CONTRACTS.MARKET.address,
          contractName: CONTRACTS.MARKET.name,
          functionName: "get-listing-count",
          functionArgs: [],
          network,
          senderAddress: DEPLOYER_ADDRESS,
        });
        const count = Number(cvToJSON(countResult).value);

        const items: (Listing & { id: number })[] = [];
        for (let i = 1; i <= count; i++) {
          const result = await fetchCallReadOnlyFunction({
            contractAddress: CONTRACTS.MARKET.address,
            contractName: CONTRACTS.MARKET.name,
            functionName: "get-listing",
            functionArgs: [uintCV(i)],
            network,
            senderAddress: DEPLOYER_ADDRESS,
          });
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
    const txOptions = buildBuyOptionTx(listing.id, Number(listing.premium), address);
    await openContractCall({
      ...txOptions,
      onFinish: (data) => {
        console.log("Buy option tx:", data.txId);
        setTimeout(onTxComplete, 3000);
      },
      onCancel: () => console.log("Buy cancelled"),
    });
  };

  const handleClaim = async (listingId: number) => {
    if (!address) return;
    const txOptions = buildClaimPayoutTx(listingId);
    await openContractCall({
      ...txOptions,
      onFinish: (data) => {
        console.log("Claim tx:", data.txId);
        setTimeout(onTxComplete, 3000);
      },
      onCancel: () => console.log("Claim cancelled"),
    });
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse text-gray-500">Loading options...</div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-2">Options Market</h2>
        <p className="text-gray-500">No options available yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-4">Options Market</h2>
      <div className="space-y-3">
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
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
                className={`text-xs px-2 py-1 rounded ${
                  listing.sold
                    ? "bg-red-900/50 text-red-400"
                    : "bg-green-900/50 text-green-400"
                }`}
              >
                {listing.sold ? "Sold" : "Available"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm mb-3">
              <div>
                <p className="text-gray-500">Premium</p>
                <p className="text-white">{formatSBTC(listing.premium)} sBTC</p>
              </div>
              <div>
                <p className="text-gray-500">Collateral</p>
                <p className="text-white">
                  {formatSBTC(listing.collateral)} sBTC
                </p>
              </div>
              <div>
                <p className="text-gray-500">Expiry Block</p>
                <p className="text-white">{listing.expiryBlock.toString()}</p>
              </div>
            </div>
            {!listing.sold && address && (
              <button
                onClick={() => handleBuy(listing)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
              >
                Buy Option ({formatSBTC(listing.premium)} sBTC)
              </button>
            )}
            {listing.sold &&
              listing.buyer === address &&
              !listing.claimed && (
                <button
                  onClick={() => handleClaim(listing.id)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
                >
                  Claim Payout
                </button>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
