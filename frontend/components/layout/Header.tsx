"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { useWallet } from "./Providers";
import NetworkStatus from "@/components/NetworkStatus";
import { DEPLOYER_ADDRESS } from "@/lib/stacks-config";
import { buildFaucetTx } from "@/lib/vault-calls";
import { useToast } from "@/components/Toast";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon, adminOnly: false },
  { href: "/market", label: "Market", icon: MarketIcon, adminOnly: false },
  { href: "/governance", label: "Governance", icon: GovernanceIcon, adminOnly: false },
  { href: "/admin", label: "Admin", icon: AdminIcon, adminOnly: true },
];

export default function Header() {
  const { address, connectWallet, disconnectWallet, isConnecting } = useWallet();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faucetPending, setFaucetPending] = useState(false);
  const { showToast } = useToast();

  const handleFaucet = async () => {
    if (!address || faucetPending) return;
    setFaucetPending(true);
    try {
      const txOptions = buildFaucetTx();
      const { openContractCall } = await import("@stacks/connect");
      await openContractCall({
        ...txOptions,
        onFinish: (data) => showToast("1 sBTC minted from faucet!", "success", data.txId),
        onCancel: () => showToast("Faucet cancelled", "info"),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(msg || "Faucet failed", "error");
    }
    setFaucetPending(false);
  };

  // M-4 FIX: Only show admin nav to deployer address
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.adminOnly || address === DEPLOYER_ADDRESS),
    [address]
  );

  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.546z" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-white leading-tight">sBTC Options Vault</h1>
              <p className="text-[10px] text-gray-500 leading-tight">Covered Call Yield on Bitcoin</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-orange-500/10 text-orange-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: Network + Wallet */}
          <div className="flex items-center gap-2 sm:gap-3">
            <NetworkStatus />

            {address ? (
              <div className="flex items-center gap-2">
                {/* Faucet button — mock-sbtc faucet for testing */}
                <button
                  onClick={handleFaucet}
                  disabled={faucetPending}
                  className="text-xs bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/20 disabled:opacity-50 text-orange-400 font-medium px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Get 1 test sBTC from faucet"
                  aria-label="Get 1 testnet sBTC from faucet"
                >
                  {faucetPending ? (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v12m6-6H6" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">Faucet</span>
                </button>
                <span className="text-xs bg-gray-800 px-3 py-1.5 rounded-lg font-mono text-orange-400 hidden sm:block">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <span className="text-xs bg-gray-800 px-2 py-1.5 rounded-lg font-mono text-orange-400 sm:hidden">
                  {address.slice(0, 4)}..{address.slice(-3)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="text-xs text-gray-500 hover:text-white transition-colors p-1.5"
                  title="Disconnect"
                  aria-label="Disconnect wallet"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 border-t border-gray-800 pt-3 space-y-1" aria-label="Mobile navigation">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-orange-500/10 text-orange-400"
                      : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function MarketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function GovernanceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  );
}

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
