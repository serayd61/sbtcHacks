"use client";

import { useWallet } from "@/components/layout/Providers";
import BuyOption from "@/components/BuyOption";

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

      <div className="max-w-3xl">
        <BuyOption
          address={address}
          onTxComplete={refresh}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
}
