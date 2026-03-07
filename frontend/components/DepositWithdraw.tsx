"use client";

import { useState } from "react";
import { openContractCall } from "@stacks/connect";
import { buildDepositTx, buildWithdrawTx } from "@/lib/vault-calls";
import { parseSBTC } from "@/lib/stacks-config";
import { useToast } from "@/components/Toast";

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
  const [pending, setPending] = useState(false);
  const { showToast } = useToast();

  const handleDeposit = async () => {
    if (!address || !depositAmount) return;
    const amount = parseSBTC(depositAmount);
    if (amount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    setPending(true);
    try {
      const txOptions = buildDepositTx(amount, address);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast(`Deposit of ${depositAmount} sBTC submitted!`, "success", data.txId);
          setDepositAmount("");
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Deposit cancelled", "info"),
      });
    } catch (e: any) {
      showToast(e.message || "Deposit failed", "error");
    }
    setPending(false);
  };

  const handleWithdraw = async () => {
    if (!address || !withdrawShares) return;
    const shares = parseSBTC(withdrawShares);
    if (shares <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    setPending(true);
    try {
      const txOptions = buildWithdrawTx(shares, address);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast(`Withdrawal of ${withdrawShares} shares submitted!`, "success", data.txId);
          setWithdrawShares("");
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Withdrawal cancelled", "info"),
      });
    } catch (e: any) {
      showToast(e.message || "Withdrawal failed", "error");
    }
    setPending(false);
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex gap-1 mb-5 bg-gray-800 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab("deposit")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
            activeTab === "deposit"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab("withdraw")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
            activeTab === "withdraw"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Withdraw
        </button>
      </div>

      {activeTab === "deposit" ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Amount (sBTC)</label>
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.5"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">sBTC</span>
            </div>
          </div>
          <button
            onClick={handleDeposit}
            disabled={!address || !depositAmount || pending}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {pending ? <><Spinner /> Confirming...</> : !address ? "Connect Wallet" : "Deposit sBTC"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Shares to Withdraw</label>
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder="0.5"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all pr-20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">shares</span>
            </div>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!address || !withdrawShares || pending}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {pending ? <><Spinner /> Confirming...</> : !address ? "Connect Wallet" : "Withdraw sBTC"}
          </button>
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
