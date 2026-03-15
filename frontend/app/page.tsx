"use client";

import { useWallet } from "@/components/layout/Providers";
import VaultDashboard from "@/components/VaultDashboard";
import DepositWithdraw from "@/components/DepositWithdraw";
import PerformanceChart from "@/components/PerformanceChart";
import EpochHistory from "@/components/EpochHistory";
import TransactionHistory from "@/components/TransactionHistory";
import FaucetButton from "@/components/FaucetButton";
import UserOptions from "@/components/UserOptions";
import { IS_MAINNET } from "@/lib/stacks-config";
import Link from "next/link";

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
          {/* Security: Hide faucet on mainnet — only show for testnet */}
          {!IS_MAINNET && <FaucetButton address={address} />}
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
          <DepositWithdraw address={address} onTxComplete={refresh} refreshKey={refreshKey} />

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

          {/* Whitepaper CTA */}
          <Link
            href="/whitepaper"
            className="group flex items-center gap-4 bg-gradient-to-br from-orange-500/10 to-amber-500/5 rounded-xl p-5 border border-orange-500/20 hover:border-orange-500/40 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0 group-hover:bg-orange-500/25 transition-colors">
              <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">
                Read the Whitepaper
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Architecture, pricing model, security & roadmap
              </p>
            </div>
            <svg className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
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
