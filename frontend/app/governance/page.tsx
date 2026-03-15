"use client";

import { useWallet } from "@/components/layout/Providers";
import { useCallback, useEffect, useState } from "react";
import { openContractCall } from "@stacks/connect";
import {
  getGovernanceTokenInfo,
  getGovBalance,
  getGovEntitlement,
  getProposalCount,
  getProposal,
  getProtocolParams,
  buildClaimGovTokensTx,
  buildCreateProposalTx,
  buildVoteTx,
  buildExecuteProposalTx,
} from "@/lib/vault-calls";
import type {
  GovernanceTokenInfo,
  GovEntitlement,
  Proposal,
  ProtocolParams,
} from "@/lib/types";

const GOV_DECIMALS = 6;
const VOTE_PERIOD_BLOCKS = 1008;
const EXECUTION_DELAY = 144;

const PARAM_LABELS: Record<string, { label: string; unit: string; description: string }> = {
  "strike-otm-bps": { label: "Strike OTM", unit: "bps", description: "How far out-of-the-money strike prices are set (500 = 5%)" },
  "management-fee-bps": { label: "Management Fee", unit: "bps", description: "Annual management fee on vault assets (200 = 2%)" },
  "performance-fee-bps": { label: "Performance Fee", unit: "bps", description: "Fee on profits earned from premiums (1000 = 10%)" },
  "epoch-duration": { label: "Epoch Duration", unit: "blocks", description: "Length of each option epoch in blocks (1008 = ~7 days)" },
  "insurance-fee-bps": { label: "Insurance Fee", unit: "bps", description: "Portion allocated to insurance fund (500 = 5%)" },
  "withdrawal-limit-bps": { label: "Withdrawal Limit", unit: "bps", description: "Max withdrawal per period (2500 = 25%)" },
};

function formatGov(raw: bigint): string {
  const val = Number(raw) / 10 ** GOV_DECIMALS;
  if (val === 0) return "0";
  if (val >= 1000) return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatBps(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(1)}%`;
}

export default function GovernancePage() {
  const { address } = useWallet();
  const [tokenInfo, setTokenInfo] = useState<GovernanceTokenInfo | null>(null);
  const [entitlement, setEntitlement] = useState<GovEntitlement | null>(null);
  const [govBalance, setGovBalance] = useState<bigint>(0n);
  const [params, setParams] = useState<ProtocolParams | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalCount, setProposalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [voting, setVoting] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newParamKey, setNewParamKey] = useState("strike-otm-bps");
  const [newParamValue, setNewParamValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ti, pp, pc] = await Promise.all([
        getGovernanceTokenInfo().catch(() => null),
        getProtocolParams().catch(() => null),
        getProposalCount().catch(() => 0),
      ]);
      setTokenInfo(ti);
      setParams(pp);
      setProposalCount(pc);

      // Load proposals
      if (pc > 0) {
        const proposalPromises = Array.from({ length: Math.min(pc, 20) }, (_, i) =>
          getProposal(pc - i).catch(() => null)
        );
        const results = await Promise.all(proposalPromises);
        setProposals(results.filter((p): p is Proposal => p !== null));
      }

      // Load user-specific data
      if (address) {
        const [bal, ent] = await Promise.all([
          getGovBalance(address).catch(() => 0n),
          getGovEntitlement(address).catch(() => null),
        ]);
        setGovBalance(bal);
        setEntitlement(ent);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load governance data");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClaim = async () => {
    if (!address) return;
    setClaiming(true);
    try {
      const tx = buildClaimGovTokensTx();
      await openContractCall({ ...tx, onFinish: () => setTimeout(loadData, 5000) });
    } catch {
      // user cancelled
    } finally {
      setClaiming(false);
    }
  };

  const handleVote = async (proposalId: number, support: boolean) => {
    if (!address) return;
    setVoting(proposalId);
    try {
      const tx = buildVoteTx(proposalId, support);
      await openContractCall({ ...tx, onFinish: () => setTimeout(loadData, 5000) });
    } catch {
      // user cancelled
    } finally {
      setVoting(null);
    }
  };

  const handleExecute = async (proposalId: number) => {
    try {
      const tx = buildExecuteProposalTx(proposalId);
      await openContractCall({ ...tx, onFinish: () => setTimeout(loadData, 5000) });
    } catch {
      // user cancelled
    }
  };

  const handleCreateProposal = async () => {
    if (!address || !newParamValue) return;
    try {
      const tx = buildCreateProposalTx(newParamKey, parseInt(newParamValue));
      await openContractCall({
        ...tx,
        onFinish: () => {
          setShowCreateForm(false);
          setNewParamValue("");
          setTimeout(loadData, 5000);
        },
      });
    } catch {
      // user cancelled
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-900 rounded-xl" />
            <div className="h-64 bg-gray-900 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Governance
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          Vote on proposals and manage protocol parameters with sVGOV tokens
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={loadData} className="text-red-300 text-xs underline mt-1">
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Governance Token Card */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Governance Token</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Token</span>
              <span className="text-sm text-white font-medium">
                {tokenInfo?.symbol || "sVGOV"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total Supply</span>
              <span className="text-sm text-white font-medium">
                {tokenInfo ? formatGov(tokenInfo.totalSupply) : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Your Balance</span>
              <span className="text-sm text-orange-400 font-medium">
                {address ? `${formatGov(govBalance)} sVGOV` : "Connect wallet"}
              </span>
            </div>
            {address && entitlement && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Claimable</span>
                <span className="text-sm text-green-400 font-medium">
                  {formatGov(entitlement.claimable)} sVGOV
                </span>
              </div>
            )}
          </div>
          {address && entitlement && entitlement.claimable > 0n && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="mt-4 w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {claiming ? "Claiming..." : `Claim ${formatGov(entitlement.claimable)} sVGOV`}
            </button>
          )}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-600">
              Deposit sBTC into the vault to earn governance tokens.
              1 sBTC deposited = 1,000 sVGOV tokens. Use them to vote on protocol parameters.
            </p>
          </div>
        </div>

        {/* Protocol Parameters Card */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Protocol Parameters</h3>
          {params ? (
            <div className="space-y-3">
              {Object.entries(PARAM_LABELS).map(([key, meta]) => {
                const value = params[
                  key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) as keyof ProtocolParams
                ];
                return (
                  <div key={key} className="group">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{meta.label}</span>
                      <span className="text-sm text-white font-medium">
                        {meta.unit === "bps" ? formatBps(value) : `${Number(value).toLocaleString()} ${meta.unit}`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 mt-0.5 hidden group-hover:block">
                      {meta.description}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">Parameters not initialized yet</p>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-600">
              These parameters are controlled by governance. Create a proposal to change them.
            </p>
          </div>
        </div>
      </div>

      {/* Create Proposal Section */}
      <div className="mt-6">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Proposals</h3>
            {address && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="text-sm bg-gray-800 hover:bg-gray-700 text-orange-400 px-4 py-1.5 rounded-lg transition-colors"
              >
                {showCreateForm ? "Cancel" : "New Proposal"}
              </button>
            )}
          </div>

          {showCreateForm && (
            <div className="mb-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-medium text-white mb-3">Create New Proposal</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Parameter</label>
                  <select
                    value={newParamKey}
                    onChange={(e) => setNewParamKey(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg text-sm text-white p-2.5"
                  >
                    {Object.entries(PARAM_LABELS).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-600 mt-1">
                    {PARAM_LABELS[newParamKey]?.description}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    New Value ({PARAM_LABELS[newParamKey]?.unit})
                  </label>
                  <input
                    type="number"
                    value={newParamValue}
                    onChange={(e) => setNewParamValue(e.target.value)}
                    placeholder={`Enter new value in ${PARAM_LABELS[newParamKey]?.unit}`}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg text-sm text-white p-2.5"
                  />
                </div>
                <button
                  onClick={handleCreateProposal}
                  disabled={!newParamValue}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Submit Proposal
                </button>
                <p className="text-xs text-gray-600">
                  Requires 1,000+ sVGOV tokens. Voting period: ~7 days. Execution delay: ~24 hours.
                </p>
              </div>
            </div>
          )}

          {/* Proposals List */}
          {proposals.length > 0 ? (
            <div className="space-y-4">
              {proposals.map((p) => {
                const totalVotes = p.votesFor + p.votesAgainst;
                const forPct = totalVotes > 0n ? Number((p.votesFor * 100n) / totalVotes) : 0;
                const againstPct = totalVotes > 0n ? 100 - forPct : 0;
                const paramMeta = PARAM_LABELS[p.paramKey];

                return (
                  <div key={p.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs text-gray-500">Proposal #{p.id}</span>
                        <h4 className="text-sm font-medium text-white">
                          Change {paramMeta?.label || p.paramKey} to{" "}
                          {paramMeta?.unit === "bps"
                            ? formatBps(p.paramValue)
                            : `${Number(p.paramValue).toLocaleString()} ${paramMeta?.unit || ""}`}
                        </h4>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          p.executed
                            ? "bg-green-900/50 text-green-400"
                            : "bg-orange-900/50 text-orange-400"
                        }`}
                      >
                        {p.executed ? "Executed" : "Active"}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">
                      by {p.proposer.slice(0, 8)}...{p.proposer.slice(-4)} | Block #{Number(p.startBlock).toLocaleString()}
                    </p>

                    {/* Vote Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-green-400">For: {formatGov(p.votesFor)}</span>
                        <span className="text-red-400">Against: {formatGov(p.votesAgainst)}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden flex">
                        {totalVotes > 0n && (
                          <>
                            <div
                              className="bg-green-500 h-full"
                              style={{ width: `${forPct}%` }}
                            />
                            <div
                              className="bg-red-500 h-full"
                              style={{ width: `${againstPct}%` }}
                            />
                          </>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Total votes: {formatGov(totalVotes)} sVGOV
                      </p>
                    </div>

                    {/* Actions */}
                    {!p.executed && address && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVote(p.id, true)}
                          disabled={voting === p.id}
                          className="flex-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 text-xs font-medium py-2 rounded-lg transition-colors border border-green-800/50"
                        >
                          {voting === p.id ? "..." : "Vote For"}
                        </button>
                        <button
                          onClick={() => handleVote(p.id, false)}
                          disabled={voting === p.id}
                          className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-medium py-2 rounded-lg transition-colors border border-red-800/50"
                        >
                          {voting === p.id ? "..." : "Vote Against"}
                        </button>
                        <button
                          onClick={() => handleExecute(p.id)}
                          className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                          title={`Executable after block #${Number(p.startBlock) + VOTE_PERIOD_BLOCKS + EXECUTION_DELAY}`}
                        >
                          Execute
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">No proposals yet</p>
              <p className="text-gray-600 text-xs mt-1">
                {address
                  ? "Be the first to create a proposal and shape the protocol"
                  : "Connect your wallet to create proposals and vote"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Governance Info */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <p className="text-2xl font-bold text-white">{proposalCount}</p>
          <p className="text-xs text-gray-500 mt-1">Total Proposals</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <p className="text-2xl font-bold text-white">~7 days</p>
          <p className="text-xs text-gray-500 mt-1">Voting Period</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <p className="text-2xl font-bold text-white">10%</p>
          <p className="text-xs text-gray-500 mt-1">Quorum Required</p>
        </div>
      </div>

      {/* How Governance Works */}
      <div className="mt-6 bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">How Governance Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-900/30 flex items-center justify-center text-orange-400 font-bold text-sm">1</div>
            <h4 className="text-sm font-medium text-white">Deposit & Claim</h4>
            <p className="text-xs text-gray-500 mt-1">Deposit sBTC to vault, claim sVGOV governance tokens</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-900/30 flex items-center justify-center text-orange-400 font-bold text-sm">2</div>
            <h4 className="text-sm font-medium text-white">Create Proposal</h4>
            <p className="text-xs text-gray-500 mt-1">Need 1,000+ sVGOV to propose parameter changes</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-900/30 flex items-center justify-center text-orange-400 font-bold text-sm">3</div>
            <h4 className="text-sm font-medium text-white">Vote</h4>
            <p className="text-xs text-gray-500 mt-1">~7 day voting period, 10% quorum, token-weighted votes</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-900/30 flex items-center justify-center text-orange-400 font-bold text-sm">4</div>
            <h4 className="text-sm font-medium text-white">Execute</h4>
            <p className="text-xs text-gray-500 mt-1">24h delay after vote passes, then anyone can execute</p>
          </div>
        </div>
      </div>
    </div>
  );
}
