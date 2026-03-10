"use client";

import { useWallet } from "@/components/layout/Providers";
import BuyOption from "@/components/BuyOption";
import UserOptions from "@/components/UserOptions";

export default function MarketPage() {
  const { address, refreshKey, refresh } = useWallet();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Options Market
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Browse and purchase covered call options on sBTC
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: Options listings */}
        <div className="lg:col-span-2">
          <BuyOption
            address={address}
            onTxComplete={refresh}
            refreshKey={refreshKey}
          />
        </div>

        {/* Sidebar: Quick info */}
        <div className="space-y-6">
          {/* Your options */}
          <UserOptions
            address={address}
            refreshKey={refreshKey}
            onTxComplete={refresh}
          />

          {/* Info card */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Quick Guide</h3>
            <div className="space-y-3 text-xs text-gray-500">
              <div className="flex gap-2">
                <span className="text-orange-400 font-bold shrink-0">OTM</span>
                <span>Out of the Money — BTC price is below strike. Option expires worthless for buyer, vault keeps collateral.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-green-400 font-bold shrink-0">ITM</span>
                <span>In the Money — BTC price is above strike. Buyer profits from the difference, claim payout after settlement.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-400 font-bold shrink-0">Strike</span>
                <span>The target price. If BTC exceeds this at expiry, the option is ITM.</span>
              </div>
              <div className="flex gap-2">
                <span className="text-purple-400 font-bold shrink-0">Premium</span>
                <span>The price you pay for the option. Goes to vault depositors as yield.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
