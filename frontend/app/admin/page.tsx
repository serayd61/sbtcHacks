"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@/components/layout/Providers";
import { DEPLOYER_ADDRESS } from "@/lib/stacks-config";

const AdminPanel = dynamic(() => import("@/components/AdminPanel"), { ssr: false });

export default function AdminPage() {
  const { address, refresh } = useWallet();

  const isAdmin = address === DEPLOYER_ADDRESS;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Admin Panel
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Manage vault epochs, oracle prices, and option listings
        </p>
      </div>

      {!address ? (
        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Wallet Required</h3>
          <p className="text-gray-400 text-sm">
            Connect your wallet to access admin functions
          </p>
        </div>
      ) : !isAdmin ? (
        <div className="bg-gray-900 rounded-xl p-8 border border-yellow-500/20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Admin Access Required</h3>
          <p className="text-gray-400 text-sm mb-3">
            Admin functions are restricted to the contract deployer.
          </p>
          <p className="text-xs text-gray-600 font-mono">
            Connected: {address.slice(0, 8)}...{address.slice(-6)}
          </p>
          <p className="text-xs text-gray-600 font-mono mt-1">
            Required: {DEPLOYER_ADDRESS.slice(0, 8)}...{DEPLOYER_ADDRESS.slice(-6)}
          </p>
        </div>
      ) : (
        <div className="max-w-2xl">
          <AdminPanel address={address} onTxComplete={refresh} />
        </div>
      )}
    </div>
  );
}
