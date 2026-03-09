"use client";

import { useWallet } from "@/components/layout/Providers";
import VaultDashboard from "@/components/VaultDashboard";
import DepositWithdraw from "@/components/DepositWithdraw";
import PerformanceChart from "@/components/PerformanceChart";
import EpochHistory from "@/components/EpochHistory";
import TransactionHistory from "@/components/TransactionHistory";
import FaucetButton from "@/components/FaucetButton";
import UserOptions from "@/components/UserOptions";

export default function DashboardPage() {
  const { address, refreshKey, refresh } = useWallet();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Vault Dashboard
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Deposit sBTC, earn yield through covered call options
            </p>
          </div>
          <FaucetButton address={address} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Dashboard + Charts */}
        <div className="lg:col-span-2 space-y-6">
          <VaultDashboard address={address} refreshKey={refreshKey} />
          <PerformanceChart refreshKey={refreshKey} />
        </div>

        {/* Right: Actions */}
        <div className="space-y-6">
          <DepositWithdraw address={address} onTxComplete={refresh} />

          {/* How It Works */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4">
              How It Works
            </h2>
            <ol className="space-y-3 text-sm text-gray-400">
              {[
                "Deposit sBTC into the vault to receive shares",
                "Vault writes covered call options each epoch",
                "Option buyers pay premiums in sBTC",
                "Premiums auto-compound into vault share price",
                "Withdraw anytime between epochs with profit",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* User Options */}
      {address && (
        <div className="mt-6">
          <UserOptions address={address} refreshKey={refreshKey} onTxComplete={refresh} />
        </div>
      )}

      {/* Full-width sections */}
      <div className="mt-6 space-y-6">
        <EpochHistory refreshKey={refreshKey} />
        <TransactionHistory address={address} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
