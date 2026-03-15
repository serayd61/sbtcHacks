"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/layout/Providers";
import BuyOption from "@/components/BuyOption";
import UserOptions from "@/components/UserOptions";
import { getVaultInfo, getOracleInfo, getMarketInfo } from "@/lib/vault-calls";
import { formatSBTC, formatUSD } from "@/lib/stacks-config";
import type { VaultInfo, OracleInfo, MarketInfo } from "@/lib/types";

export default function MarketPage() {
  const { address, refreshKey, refresh } = useWallet();
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [oracle, setOracle] = useState<OracleInfo | null>(null);
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);

  useEffect(() => {
    Promise.all([
      getVaultInfo().catch(() => null),
      getOracleInfo().catch(() => null),
      getMarketInfo().catch(() => null),
    ]).then(([v, o, m]) => {
      setVaultInfo(v);
      setOracle(o);
      setMarketInfo(m);
    });
  }, [refreshKey]);

  const btcPrice = oracle ? formatUSD(oracle.price) : "—";
  const tvl = vaultInfo ? formatSBTC(vaultInfo.totalSbtcDeposited) : "—";
  const optionsSold = marketInfo ? Number(marketInfo.totalOptionsSold).toLocaleString() : "—";
  const totalVolume = marketInfo ? `${formatSBTC(marketInfo.totalVolume)}` : "—";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Options Market
            </h1>
            <p className="text-gray-500 text-sm">
              Browse and purchase covered call options on sBTC
            </p>
          </div>
        </div>
      </div>

      {/* Live Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <MiniStat label="BTC Price" value={btcPrice} icon="price" pulse />
        <MiniStat label="Vault TVL" value={`${tvl} sBTC`} icon="vault" />
        <MiniStat label="Options Sold" value={optionsSold} icon="epoch" />
        <MiniStat label="Total Volume" value={`${totalVolume} sBTC`} icon="premium" />
      </div>

      {/* Main Content Grid */}
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
        <div className="space-y-5">
          {/* User positions (only when connected + has positions) */}
          <UserOptions
            address={address}
            refreshKey={refreshKey}
            onTxComplete={refresh}
          />

          {/* How It Works */}
          <div className="bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </span>
                How It Works
              </h3>
            </div>
            <div className="px-5 pb-5 space-y-3">
              <StepItem num={1} title="Deposit sBTC" desc="Deposit into the vault to earn yield from option premiums" />
              <StepItem num={2} title="Options Created" desc="Each epoch, covered call options are created with a strike price" />
              <StepItem num={3} title="Buy an Option" desc="Pay a premium in sBTC to get exposure to BTC upside" />
              <StepItem num={4} title="Settlement" desc="At expiry, ITM options pay out the difference. OTM options expire" />
            </div>
          </div>

          {/* Quick Reference */}
          <div className="bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </span>
                Quick Reference
              </h3>
            </div>
            <div className="px-5 pb-5 space-y-2.5">
              <RefItem color="orange" label="OTM" desc="Out of the Money — BTC below strike. Option expires worthless." />
              <RefItem color="green" label="ITM" desc="In the Money — BTC above strike. Buyer profits from the difference." />
              <RefItem color="blue" label="Strike" desc="Target price. If BTC exceeds this at expiry, the option is ITM." />
              <RefItem color="purple" label="Premium" desc="Cost of the option. Paid in sBTC, goes to vault depositors as yield." />
              <RefItem color="amber" label="Collateral" desc="sBTC locked per option. Determines the maximum payout if ITM." />
            </div>
          </div>

          {/* Protocol Info */}
          <div className="bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              Protocol
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-gray-800/50">
                <span className="text-gray-500">Network</span>
                <span className="text-gray-300 font-medium">Stacks Mainnet</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-800/50">
                <span className="text-gray-500">Token</span>
                <span className="text-gray-300 font-medium">sBTC (mock)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-800/50">
                <span className="text-gray-500">Strategy</span>
                <span className="text-gray-300 font-medium">Covered Calls</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-800/50">
                <span className="text-gray-500">Epoch Duration</span>
                <span className="text-gray-300 font-medium">~7 days</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Management Fee</span>
                <span className="text-gray-300 font-medium">2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function MiniStat({
  label,
  value,
  icon,
  pulse,
}: {
  label: string;
  value: string;
  icon: "price" | "vault" | "epoch" | "premium";
  pulse?: boolean;
}) {
  const iconMap = {
    price: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    vault: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    epoch: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    premium: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  };

  const colorMap = {
    price: "text-green-400",
    vault: "text-blue-400",
    epoch: "text-purple-400",
    premium: "text-orange-400",
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={colorMap[icon]}>{iconMap[icon]}</span>
        <span className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</span>
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
      </div>
      <p className="text-white font-semibold text-sm truncate">{value}</p>
    </div>
  );
}

function StepItem({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10 text-orange-400 text-[11px] font-bold shrink-0 mt-0.5 border border-orange-500/20">
        {num}
      </span>
      <div>
        <p className="text-sm text-white font-medium leading-tight">{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function RefItem({ color, label, desc }: { color: string; label: string; desc: string }) {
  const colorClasses: Record<string, { dot: string; text: string; bg: string }> = {
    orange: { dot: "bg-orange-400", text: "text-orange-400", bg: "bg-orange-400/10" },
    green: { dot: "bg-green-400", text: "text-green-400", bg: "bg-green-400/10" },
    blue: { dot: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-400/10" },
    purple: { dot: "bg-purple-400", text: "text-purple-400", bg: "bg-purple-400/10" },
    amber: { dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-400/10" },
  };
  const c = colorClasses[color] || colorClasses.orange;

  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      <div>
        <span className={`text-xs font-semibold ${c.text}`}>{label}</span>
        <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
