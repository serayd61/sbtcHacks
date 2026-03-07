"use client";

import { useState } from "react";
import { openContractCall } from "@stacks/connect";
import {
  buildStartEpochTx,
  buildCreateListingTx,
  buildSettleEpochTx,
  buildSetPriceTx,
} from "@/lib/vault-calls";

interface AdminPanelProps {
  address: string | null;
  onTxComplete: () => void;
}

export default function AdminPanel({ address, onTxComplete }: AdminPanelProps) {
  const [showAdmin, setShowAdmin] = useState(false);

  // Oracle
  const [btcPrice, setBtcPrice] = useState("85000");

  // Epoch
  const [strikePrice, setStrikePrice] = useState("90000");
  const [premium, setPremium] = useState("0.05");
  const [duration, setDuration] = useState("100");

  // Listing
  const [epochId, setEpochId] = useState("1");
  const [listingPremium, setListingPremium] = useState("0.05");
  const [collateral, setCollateral] = useState("5");
  const [expiryBlocks, setExpiryBlocks] = useState("100");

  // Settlement
  const [settleEpochId, setSettleEpochId] = useState("1");
  const [settlementPrice, setSettlementPrice] = useState("85000");

  const handleSetPrice = async () => {
    const price = Math.floor(parseFloat(btcPrice) * 1_000_000);
    const txOptions = buildSetPriceTx(price);
    await openContractCall({
      ...txOptions,
      onFinish: () => setTimeout(onTxComplete, 3000),
      onCancel: () => {},
    });
  };

  const handleStartEpoch = async () => {
    const strike = Math.floor(parseFloat(strikePrice) * 1_000_000);
    const prem = Math.floor(parseFloat(premium) * 100_000_000);
    const dur = parseInt(duration);
    const txOptions = buildStartEpochTx(strike, prem, dur);
    await openContractCall({
      ...txOptions,
      onFinish: () => setTimeout(onTxComplete, 3000),
      onCancel: () => {},
    });
  };

  const handleCreateListing = async () => {
    const epoch = parseInt(epochId);
    const strike = Math.floor(parseFloat(strikePrice) * 1_000_000);
    const prem = Math.floor(parseFloat(listingPremium) * 100_000_000);
    const coll = Math.floor(parseFloat(collateral) * 100_000_000);
    const expiry = parseInt(expiryBlocks);
    const txOptions = buildCreateListingTx(epoch, strike, prem, coll, expiry);
    await openContractCall({
      ...txOptions,
      onFinish: () => setTimeout(onTxComplete, 3000),
      onCancel: () => {},
    });
  };

  const handleSettleEpoch = async () => {
    const epoch = parseInt(settleEpochId);
    const price = Math.floor(parseFloat(settlementPrice) * 1_000_000);
    const txOptions = buildSettleEpochTx(epoch, price);
    await openContractCall({
      ...txOptions,
      onFinish: () => setTimeout(onTxComplete, 3000),
      onCancel: () => {},
    });
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <button
        onClick={() => setShowAdmin(!showAdmin)}
        className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-gray-800/50 transition-colors"
      >
        <h2 className="text-lg font-semibold text-yellow-400">
          Admin Panel
        </h2>
        <span className="text-gray-500">{showAdmin ? "Hide" : "Show"}</span>
      </button>

      {showAdmin && (
        <div className="px-6 pb-6 space-y-6">
          {/* Set Oracle Price */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">
              Set BTC/USD Price
            </h3>
            <div className="flex gap-2">
              <input
                type="number"
                value={btcPrice}
                onChange={(e) => setBtcPrice(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="85000"
              />
              <button
                onClick={handleSetPrice}
                disabled={!address}
                className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Set Price
              </button>
            </div>
          </div>

          {/* Start Epoch */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">Start Epoch</h3>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Strike ($)"
              />
              <input
                type="number"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Premium (sBTC)"
              />
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Duration (blocks)"
              />
            </div>
            <button
              onClick={handleStartEpoch}
              disabled={!address}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-2 rounded-lg text-sm font-semibold"
            >
              Start Epoch
            </button>
          </div>

          {/* Create Listing */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">
              Create Option Listing
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={epochId}
                onChange={(e) => setEpochId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Epoch ID"
              />
              <input
                type="number"
                value={listingPremium}
                onChange={(e) => setListingPremium(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Premium (sBTC)"
              />
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Collateral (sBTC)"
              />
              <input
                type="number"
                value={expiryBlocks}
                onChange={(e) => setExpiryBlocks(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Expiry Block"
              />
            </div>
            <button
              onClick={handleCreateListing}
              disabled={!address}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white py-2 rounded-lg text-sm font-semibold"
            >
              Create Listing
            </button>
          </div>

          {/* Settle Epoch */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">
              Settle Epoch
            </h3>
            <div className="flex gap-2">
              <input
                type="number"
                value={settleEpochId}
                onChange={(e) => setSettleEpochId(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Epoch ID"
              />
              <input
                type="number"
                value={settlementPrice}
                onChange={(e) => setSettlementPrice(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder="Settlement Price ($)"
              />
            </div>
            <button
              onClick={handleSettleEpoch}
              disabled={!address}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white py-2 rounded-lg text-sm font-semibold"
            >
              Settle Epoch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
