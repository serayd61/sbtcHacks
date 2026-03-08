"use client";

import { useState } from "react";
import { openContractCall } from "@stacks/connect";
import {
  buildStartEpochTx,
  buildCreateListingTx,
  buildSettleEpochTx,
  buildSetPriceTx,
} from "@/lib/vault-calls";
import { useToast } from "@/components/Toast";

interface AdminPanelProps {
  address: string | null;
  onTxComplete: () => void;
}

export default function AdminPanel({ address, onTxComplete }: AdminPanelProps) {
  const [showAdmin, setShowAdmin] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const { showToast } = useToast();

  const [btcPrice, setBtcPrice] = useState("85000");
  const [strikePrice, setStrikePrice] = useState("90000");
  const [premium, setPremium] = useState("0.05");
  const [duration, setDuration] = useState("100");
  const [epochId, setEpochId] = useState("1");
  const [listingPremium, setListingPremium] = useState("0.05");
  const [collateral, setCollateral] = useState("5");
  const [expiryBlocks, setExpiryBlocks] = useState("100");
  const [settleEpochId, setSettleEpochId] = useState("1");
  const [settlementPrice, setSettlementPrice] = useState("85000");

  const exec = async (name: string, fn: () => Promise<void>) => {
    setPending(name);
    try {
      await fn();
    } catch (e: any) {
      showToast(e.message || `${name} failed`, "error");
    }
    setPending(null);
  };

  const handleSetPrice = () =>
    exec("setPrice", async () => {
      const price = Math.floor(parseFloat(btcPrice) * 1_000_000);
      await openContractCall({
        ...buildSetPriceTx(price),
        onFinish: (d) => {
          showToast(`BTC price set to $${btcPrice}`, "success", d.txId);
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Cancelled", "info"),
      });
    });

  const handleStartEpoch = () =>
    exec("startEpoch", async () => {
      const strike = Math.floor(parseFloat(strikePrice) * 1_000_000);
      const prem = Math.floor(parseFloat(premium) * 100_000_000);
      const dur = parseInt(duration);
      await openContractCall({
        ...buildStartEpochTx(strike, prem, dur),
        onFinish: (d) => {
          showToast(`Epoch started! Strike: $${strikePrice}`, "success", d.txId);
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Cancelled", "info"),
      });
    });

  const handleCreateListing = () =>
    exec("createListing", async () => {
      const epoch = parseInt(epochId);
      const strike = Math.floor(parseFloat(strikePrice) * 1_000_000);
      const prem = Math.floor(parseFloat(listingPremium) * 100_000_000);
      const coll = Math.floor(parseFloat(collateral) * 100_000_000);
      const expiry = parseInt(expiryBlocks);
      await openContractCall({
        ...buildCreateListingTx(epoch, strike, prem, coll, expiry),
        onFinish: (d) => {
          showToast("Option listing created!", "success", d.txId);
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Cancelled", "info"),
      });
    });

  const handleSettleEpoch = () =>
    exec("settleEpoch", async () => {
      const epoch = parseInt(settleEpochId);
      const price = Math.floor(parseFloat(settlementPrice) * 1_000_000);
      await openContractCall({
        ...buildSettleEpochTx(epoch, price),
        onFinish: (d) => {
          showToast(`Epoch #${epoch} settled at $${settlementPrice}`, "success", d.txId);
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Cancelled", "info"),
      });
    });

  return (
    <div className="bg-gray-900 rounded-xl border border-yellow-500/20 overflow-hidden">
      <button
        onClick={() => setShowAdmin(!showAdmin)}
        className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-yellow-400">Admin Panel</h2>
        </div>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${showAdmin ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showAdmin && (
        <div className="px-6 pb-6 space-y-5">
          {/* Set Oracle Price */}
          <AdminSection title="1. Set BTC/USD Price" color="yellow">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={btcPrice}
                  onChange={(e) => setBtcPrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500 min-h-[44px]"
                  placeholder="85000"
                />
              </div>
              <ActionButton onClick={handleSetPrice} disabled={!address} loading={pending === "setPrice"} color="yellow">
                Set Price
              </ActionButton>
            </div>
          </AdminSection>

          {/* Start Epoch */}
          <AdminSection title="2. Start Epoch" color="blue">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Strike ($)</label>
                <input type="number" value={strikePrice} onChange={(e) => setStrikePrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Premium (sBTC)</label>
                <input type="number" value={premium} onChange={(e) => setPremium(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Duration</label>
                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 min-h-[44px]" />
              </div>
            </div>
            <ActionButton onClick={handleStartEpoch} disabled={!address} loading={pending === "startEpoch"} color="blue" full>
              Start Epoch
            </ActionButton>
          </AdminSection>

          {/* Create Listing */}
          <AdminSection title="3. Create Option Listing" color="purple">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Epoch ID</label>
                <input type="number" value={epochId} onChange={(e) => setEpochId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Premium (sBTC)</label>
                <input type="number" value={listingPremium} onChange={(e) => setListingPremium(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Collateral (sBTC)</label>
                <input type="number" value={collateral} onChange={(e) => setCollateral(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Expiry (blocks)</label>
                <input type="number" value={expiryBlocks} onChange={(e) => setExpiryBlocks(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 min-h-[44px]" />
              </div>
            </div>
            <ActionButton onClick={handleCreateListing} disabled={!address} loading={pending === "createListing"} color="purple" full>
              Create Listing
            </ActionButton>
          </AdminSection>

          {/* Settle Epoch */}
          <AdminSection title="4. Settle Epoch" color="red">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Epoch ID</label>
                <input type="number" value={settleEpochId} onChange={(e) => setSettleEpochId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Settlement Price ($)</label>
                <input type="number" value={settlementPrice} onChange={(e) => setSettlementPrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 min-h-[44px]" />
              </div>
            </div>
            <ActionButton onClick={handleSettleEpoch} disabled={!address} loading={pending === "settleEpoch"} color="red" full>
              Settle Epoch
            </ActionButton>
          </AdminSection>
        </div>
      )}
    </div>
  );
}

function AdminSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const borderColors: Record<string, string> = {
    yellow: "border-l-yellow-500/50",
    blue: "border-l-blue-500/50",
    purple: "border-l-purple-500/50",
    red: "border-l-red-500/50",
  };
  return (
    <div className={`border-l-2 ${borderColors[color] || "border-l-gray-700"} pl-4`}>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  loading,
  color,
  full,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  color: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    yellow: "bg-yellow-600 hover:bg-yellow-700",
    blue: "bg-blue-600 hover:bg-blue-700",
    purple: "bg-purple-600 hover:bg-purple-700",
    red: "bg-red-600 hover:bg-red-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${full ? "w-full" : ""} ${colorMap[color] || "bg-gray-600"} disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px]`}
    >
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
