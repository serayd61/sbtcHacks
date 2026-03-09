"use client";

import { useEffect, useState } from "react";
import {
  fetchCallReadOnlyFunction,
  uintCV,
  cvToJSON,
} from "@stacks/transactions";
import { buildClaimPayoutTx } from "@/lib/vault-calls";
import { CONTRACTS, DEPLOYER_ADDRESS, formatSBTC, formatUSD, ONE_SBTC, network } from "@/lib/stacks-config";
import { getOracleInfo, getEpoch } from "@/lib/vault-calls";
import { withRetry } from "@/lib/retry";
import { useToast } from "@/components/Toast";
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
  const { showToast } = useToast();

  useEffect(() => {
    if (!address) {
      setMyOptions([]);
      setLoading(false);
      return;
    }
    async function load() {
      setLoading(true);
      try {
        const [oracleInfo, countResult] = await Promise.all([
          withRetry(() => getOracleInfo()),
          withRetry(() =>
            fetchCallReadOnlyFunction({
              contractAddress: CONTRACTS.MARKET.address,
              contractName: CONTRACTS.MARKET.name,
              functionName: "get-listing-count",
              functionArgs: [],
              network,
              senderAddress: DEPLOYER_ADDRESS,
            })
          ),
        ]);
        setOracle(oracleInfo);
        const count = Number(cvToJSON(countResult).value);

        const items: UserListing[] = [];
        const epochMap = new Map<number, Epoch>();

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
              const v = json.value.value || json.value;
              const buyer = v.buyer.value?.value || null;
              if (buyer === address) {
                const listing: UserListing = {
                  id: i,
                  epochId: BigInt(v["epoch-id"].value),
                  strikePrice: BigInt(v["strike-price"].value),
                  premium: BigInt(v.premium.value),
                  collateral: BigInt(v.collateral.value),
                  expiryBlock: BigInt(v["expiry-block"].value),
                  sold: v.sold.value,
                  buyer,
                  createdBlock: BigInt(v["created-block"].value),
                  claimed: v.claimed.value,
                };
                items.push(listing);
                // Fetch epoch data for P&L
                const eid = Number(listing.epochId);
                if (!epochMap.has(eid)) {
                  const ep = await withRetry(() => getEpoch(eid));
                  if (ep) epochMap.set(eid, ep);
                }
              }
            }
          } catch {
            // skip
          }
        }
        setMyOptions(items);
        setEpochs(epochMap);
      } catch (e) {
        console.error("Failed to load user options:", e);
      }
      setLoading(false);
    }
    load();
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
    } catch (e: any) {
      showToast(e.message || "Claim failed", "error");
    }
    setPendingId(null);
  };

  if (!address || loading) return null;
  if (myOptions.length === 0) return null;

  const currentPrice = oracle ? Number(oracle.price) : 0;

  return (
    <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/10 rounded-xl p-6 border border-blue-500/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-blue-400">Your Options</h2>
        <span className="text-xs text-gray-500">
          {myOptions.length} position{myOptions.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {myOptions.map((opt) => {
          const epoch = epochs.get(Number(opt.epochId));
          const strikeUsd = Number(opt.strikePrice) / 1_000_000;
          const currentUsd = currentPrice / 1_000_000;
          const premiumSbtc = Number(opt.premium) / ONE_SBTC;
          const collateralSbtc = Number(opt.collateral) / ONE_SBTC;

          // P&L calculation for call option
          const isItm = currentUsd > strikeUsd;
          const intrinsicValue = isItm
            ? ((currentUsd - strikeUsd) / currentUsd) * collateralSbtc
            : 0;
          const pnl = intrinsicValue - premiumSbtc;
          const pnlPercent = premiumSbtc > 0 ? (pnl / premiumSbtc) * 100 : 0;

          // Status
          let status: string;
          let statusClass: string;
          if (opt.claimed) {
            status = "Settled";
            statusClass = "bg-gray-800 text-gray-500 border-gray-700";
          } else if (epoch?.settled) {
            status = "Ready to Claim";
            statusClass = "bg-green-900/30 text-green-400 border-green-500/20";
          } else {
            status = "Active";
            statusClass = "bg-blue-900/30 text-blue-400 border-blue-500/20";
          }

          return (
            <div
              key={opt.id}
              className="bg-gray-900/60 rounded-lg p-4 border border-gray-700/50"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-xs text-gray-500">
                    Option #{opt.id} | Epoch #{opt.epochId.toString()}
                  </span>
                  <p className="text-white font-semibold">
                    CALL @ {formatUSD(opt.strikePrice)}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusClass}`}>
                  {status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <p className="text-gray-500 text-xs">Premium Paid</p>
                  <p className="text-white font-medium">{premiumSbtc.toFixed(4)} sBTC</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Collateral</p>
                  <p className="text-white font-medium">{collateralSbtc.toFixed(4)} sBTC</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Current BTC</p>
                  <p className="text-white font-medium">{formatUSD(BigInt(currentPrice))}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Unrealized P&L</p>
                  <p className={`font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} sBTC
                    <span className="text-xs ml-1 opacity-70">
                      ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                    </span>
                  </p>
                </div>
              </div>

              {/* Settled P&L */}
              {epoch?.settled && !opt.claimed && (
                <div className="mb-3 p-2 rounded bg-green-900/20 border border-green-500/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Settlement Price</span>
                    <span className="text-white font-medium">{formatUSD(epoch.settlementPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Outcome</span>
                    <span className={`font-medium ${epoch.outcome === "otm" || epoch.outcome === "OTM" ? "text-red-400" : "text-green-400"}`}>
                      {epoch.outcome === "otm" || epoch.outcome === "OTM" ? "OTM (Expired)" : "ITM (In the Money)"}
                    </span>
                  </div>
                  {Number(epoch.payout) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Payout</span>
                      <span className="text-green-400 font-bold">
                        {(Number(epoch.payout) / ONE_SBTC).toFixed(4)} sBTC
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Claim button */}
              {epoch?.settled && !opt.claimed && (
                <button
                  onClick={() => handleClaim(opt.id)}
                  disabled={pendingId === opt.id}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {pendingId === opt.id ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Confirming...
                    </>
                  ) : (
                    "Claim Payout"
                  )}
                </button>
              )}

              {/* Progress bar for active options */}
              {!epoch?.settled && !opt.claimed && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>
                      {isItm ? "In the Money" : "Out of the Money"}
                    </span>
                    <span>Expiry: Block #{opt.expiryBlock.toString()}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isItm ? "bg-green-500" : "bg-orange-500"}`}
                      style={{ width: `${Math.min(100, Math.abs(pnlPercent))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
