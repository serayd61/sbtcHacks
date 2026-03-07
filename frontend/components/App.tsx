"use client";

import { useState, useEffect } from "react";
import { ToastProvider } from "@/components/Toast";
import WalletConnect from "@/components/WalletConnect";
import FaucetButton from "@/components/FaucetButton";
import VaultDashboard from "@/components/VaultDashboard";
import DepositWithdraw from "@/components/DepositWithdraw";
import BuyOption from "@/components/BuyOption";
import AdminPanel from "@/components/AdminPanel";

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("stx-address");
    if (saved) setAddress(saved);
  }, []);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <ToastProvider>
      <main className="min-h-screen bg-black">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg shadow-orange-500/20">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  sBTC Options Vault
                </h1>
                <p className="text-xs text-gray-500">
                  Covered Call Yield on Bitcoin
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FaucetButton address={address} />
              <WalletConnect address={address} setAddress={setAddress} />
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="border-b border-gray-800 bg-gradient-to-b from-gray-950 via-gray-950 to-black relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(249,115,22,0.12),transparent)]" />
          <div className="max-w-6xl mx-auto px-4 py-14 text-center relative">
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium">
              Built on Stacks + sBTC
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Earn Yield on Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
                sBTC
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
              Deposit sBTC into the vault. The vault writes weekly covered call
              options. Premiums earned are automatically compounded into your
              deposit.
            </p>
            <div className="flex justify-center gap-8 mt-10">
              <div className="text-center group">
                <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                  <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-orange-400">Covered Calls</p>
                <p className="text-xs text-gray-500 mt-0.5">Strategy</p>
              </div>
              <div className="text-center group">
                <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-green-400">Auto-Compound</p>
                <p className="text-xs text-gray-500 mt-0.5">Yield</p>
              </div>
              <div className="text-center group">
                <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-blue-400">On-Chain</p>
                <p className="text-xs text-gray-500 mt-0.5">Transparency</p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Dashboard */}
            <div className="lg:col-span-2 space-y-6">
              <VaultDashboard address={address} refreshKey={refreshKey} />
              <BuyOption
                address={address}
                onTxComplete={refresh}
                refreshKey={refreshKey}
              />
            </div>

            {/* Right: Actions */}
            <div className="space-y-6">
              <DepositWithdraw address={address} onTxComplete={refresh} />
              <AdminPanel address={address} onTxComplete={refresh} />

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
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-800 mt-12">
          <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between text-sm text-gray-500">
            <p>sBTC Options Vault</p>
            <div className="flex items-center gap-4">
              <span>Built for BUIDL BATTLE #2</span>
              <span className="text-gray-700">|</span>
              <span>Powered by Stacks</span>
            </div>
          </div>
        </footer>
      </main>
    </ToastProvider>
  );
}
