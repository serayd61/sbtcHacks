"use client";

import { useWallet } from "@/components/layout/Providers";
import BuyOption from "@/components/BuyOption";
import UserOptions from "@/components/UserOptions";

export default function MarketPage() {
  const { address, refreshKey, refresh } = useWallet();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Options Market
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Browse and purchase covered call options on sBTC
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: Epoch summary + listings */}
        <div className="lg:col-span-2">
          <BuyOption
            address={address}
            onTxComplete={refresh}
            refreshKey={refreshKey}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* User positions */}
          <UserOptions
            address={address}
            refreshKey={refreshKey}
            onTxComplete={refresh}
          />

          {/* Quick Guide */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Guide</h3>
            <div className="space-y-3 text-xs text-gray-500">
              <GuideItem color="text-orange-400" label="OTM" text="Out of the Money — BTC is below strike. Option expires worthless, vault keeps collateral." />
              <GuideItem color="text-green-400" label="ITM" text="In the Money — BTC is above strike. Buyer profits from the difference after settlement." />
              <GuideItem color="text-blue-400" label="Strike" text="Target price. If BTC exceeds this at expiry, the option is ITM." />
              <GuideItem color="text-purple-400" label="Premium" text="Cost of the option. Paid upfront in sBTC, goes to vault depositors as yield." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GuideItem({ color, label, text }: { color: string; label: string; text: string }) {
  return (
    <div className="flex gap-2">
      <span className={`${color} font-bold shrink-0 w-14`}>{label}</span>
      <span>{text}</span>
    </div>
  );
}
