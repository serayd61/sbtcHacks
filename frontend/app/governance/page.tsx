"use client";

import { useWallet } from "@/components/layout/Providers";

export default function GovernancePage() {
  const { address } = useWallet();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Governance
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Vote on proposals and manage the vault protocol
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Governance Token Info */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Governance Token</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Token</span>
              <span className="text-sm text-white font-medium">VAULT-GOV</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Your Balance</span>
              <span className="text-sm text-orange-400 font-medium">
                {address ? "—" : "Connect wallet to view"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Voting Power</span>
              <span className="text-sm text-white">1 token = 1 vote</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-600">
              Governance tokens are earned by depositing sBTC into the vault.
              Use them to vote on protocol parameters and proposals.
            </p>
          </div>
        </div>

        {/* Active Proposals */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Active Proposals</h3>
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No active proposals</p>
            <p className="text-gray-600 text-xs mt-1">
              Proposals will appear here when submitted
            </p>
          </div>
        </div>
      </div>

      {/* Past Proposals */}
      <div className="mt-6">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Proposal History</h3>
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm">No proposals have been submitted yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
