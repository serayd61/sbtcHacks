"use client";

import { useState, useEffect } from "react";
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
    <main className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-bold text-sm">
              BV
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
      <section className="border-b border-gray-800 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Earn Yield on Your{" "}
            <span className="text-orange-400">sBTC</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Deposit sBTC into the vault. The vault writes weekly covered call
            options. Premiums earned are automatically compounded into your
            deposit.
          </p>
          <div className="flex justify-center gap-6 mt-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">
                Covered Calls
              </p>
              <p className="text-xs text-gray-500 mt-1">Strategy</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">
                Auto-Compound
              </p>
              <p className="text-xs text-gray-500 mt-1">Yield</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">On-Chain</p>
              <p className="text-xs text-gray-500 mt-1">Transparency</p>
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
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold">1.</span>
                  <span>
                    Deposit sBTC into the vault to receive shares
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold">2.</span>
                  <span>
                    Vault writes covered call options each epoch
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold">3.</span>
                  <span>
                    Option buyers pay premiums in sBTC
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold">4.</span>
                  <span>
                    Premiums auto-compound into vault share price
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-orange-400 font-bold">5.</span>
                  <span>
                    Withdraw anytime between epochs with profit
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
          <p>
            sBTC Options Vault | Built for BUIDL BATTLE #2 | Powered by Stacks
          </p>
        </div>
      </footer>
    </main>
  );
}
