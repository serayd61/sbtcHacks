"use client";

import { useState } from "react";
import { openContractCall } from "@stacks/connect";
import { buildDepositTx, buildWithdrawTx } from "@/lib/vault-calls";
import { parseSBTC } from "@/lib/stacks-config";

interface DepositWithdrawProps {
  address: string | null;
  onTxComplete: () => void;
}

export default function DepositWithdraw({
  address,
  onTxComplete,
}: DepositWithdrawProps) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  const handleDeposit = async () => {
    if (!address || !depositAmount) return;
    const amount = parseSBTC(depositAmount);
    if (amount <= 0) return;

    const txOptions = buildDepositTx(amount, address);
    await openContractCall({
      ...txOptions,
      onFinish: (data) => {
        console.log("Deposit tx:", data.txId);
        setDepositAmount("");
        setTimeout(onTxComplete, 3000);
      },
      onCancel: () => console.log("Deposit cancelled"),
    });
  };

  const handleWithdraw = async () => {
    if (!address || !withdrawShares) return;
    const shares = parseSBTC(withdrawShares);
    if (shares <= 0) return;

    const txOptions = buildWithdrawTx(shares, address);
    await openContractCall({
      ...txOptions,
      onFinish: (data) => {
        console.log("Withdraw tx:", data.txId);
        setWithdrawShares("");
        setTimeout(onTxComplete, 3000);
      },
      onCancel: () => console.log("Withdraw cancelled"),
    });
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("deposit")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "deposit"
              ? "bg-orange-500 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab("withdraw")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === "withdraw"
              ? "bg-orange-500 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          Withdraw
        </button>
      </div>

      {activeTab === "deposit" ? (
        <div className="space-y-3">
          <label className="block text-sm text-gray-400">
            Amount (sBTC)
          </label>
          <input
            type="number"
            step="0.00000001"
            min="0"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="0.5"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={handleDeposit}
            disabled={!address || !depositAmount}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Deposit sBTC
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm text-gray-400">
            Shares to Withdraw
          </label>
          <input
            type="number"
            step="0.00000001"
            min="0"
            value={withdrawShares}
            onChange={(e) => setWithdrawShares(e.target.value)}
            placeholder="0.5"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
          />
          <button
            onClick={handleWithdraw}
            disabled={!address || !withdrawShares}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Withdraw sBTC
          </button>
        </div>
      )}
    </div>
  );
}
