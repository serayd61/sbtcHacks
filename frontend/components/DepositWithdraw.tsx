"use client";

import { useState, useEffect } from "react";
import { buildDepositTx, buildWithdrawTx, getUserInfo, getVaultInfo } from "@/lib/vault-calls";
import { parseSBTC, ONE_SBTC } from "@/lib/stacks-config";
import { useToast } from "@/components/Toast";
import { InfoTip } from "@/components/ui/Tooltip";
import { withRetry } from "@/lib/retry";
import type { UserInfo, VaultInfo } from "@/lib/types";

interface DepositWithdrawProps {
  address: string | null;
  onTxComplete: () => void;
  refreshKey?: number;
}

export default function DepositWithdraw({
  address,
  onTxComplete,
  refreshKey,
}: DepositWithdrawProps) {
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [pending, setPending] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const { showToast } = useToast();

  // Fetch user balance for Max button and withdrawal preview
  useEffect(() => {
    async function loadBalance() {
      try {
        const vault = await withRetry(() => getVaultInfo());
        setVaultInfo(vault);
        if (address) {
          const info = await withRetry(() => getUserInfo(address));
          setUserInfo(info);
        } else {
          setUserInfo(null);
        }
      } catch {
        // Non-critical — balance display is optional
      }
    }
    loadBalance();
  }, [address, refreshKey]);

  const userShares = userInfo ? Number(userInfo.shares) / ONE_SBTC : 0;
  const userValue = userInfo ? Number(userInfo.sbtcValue) / ONE_SBTC : 0;
  const isVaultPaused = vaultInfo?.vaultPaused ?? false;

  const handleDeposit = async () => {
    if (!address || !depositAmount) return;
    const amount = parseSBTC(depositAmount);
    if (amount <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    if (isVaultPaused) {
      showToast("Vault is currently paused", "error");
      return;
    }
    setPending(true);
    try {
      const txOptions = buildDepositTx(amount, address);
      const { openContractCall } = await import("@stacks/connect");
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast(`Deposit of ${depositAmount} sBTC submitted!`, "success", data.txId);
          setDepositAmount("");
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Deposit cancelled", "info"),
      });
    } catch (e: any) {
      showToast(e.message || "Deposit failed", "error");
    }
    setPending(false);
  };

  const handleWithdraw = async () => {
    if (!address || !withdrawShares) return;
    const shares = parseSBTC(withdrawShares);
    if (shares <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    if (parseFloat(withdrawShares) > userShares) {
      showToast("Insufficient shares balance", "error");
      return;
    }
    setPending(true);
    try {
      const txOptions = buildWithdrawTx(shares, address);
      const { openContractCall } = await import("@stacks/connect");
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast(`Withdrawal of ${withdrawShares} shares submitted!`, "success", data.txId);
          setWithdrawShares("");
          setTimeout(onTxComplete, 3000);
        },
        onCancel: () => showToast("Withdrawal cancelled", "info"),
      });
    } catch (e: any) {
      showToast(e.message || "Withdrawal failed", "error");
    }
    setPending(false);
  };

  const handleMaxWithdraw = () => {
    if (userShares > 0) {
      setWithdrawShares(userShares.toFixed(8).replace(/\.?0+$/, ""));
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-800 p-1 rounded-lg" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "deposit"}
          onClick={() => setActiveTab("deposit")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all min-h-[40px] ${
            activeTab === "deposit"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Deposit
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "withdraw"}
          onClick={() => setActiveTab("withdraw")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all min-h-[40px] ${
            activeTab === "withdraw"
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Vault paused warning */}
      {isVaultPaused && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-yellow-900/20 border border-yellow-500/20 flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-xs text-yellow-400">Vault is paused — deposits and withdrawals are temporarily disabled</p>
        </div>
      )}

      {activeTab === "deposit" ? (
        <div className="space-y-4" role="tabpanel" aria-label="Deposit panel">
          <div>
            <label htmlFor="deposit-amount" className="flex items-center text-sm text-gray-400 mb-1.5">
              Amount (sBTC)
              <InfoTip text="sBTC is a 1:1 Bitcoin-backed token on Stacks. Depositing into the vault earns yield from covered call option premiums." />
            </label>
            <div className="relative">
              <input
                id="deposit-amount"
                type="number"
                step="0.0001"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                disabled={isVaultPaused}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all pr-16 min-h-[48px] disabled:opacity-50"
                aria-describedby="deposit-help"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">sBTC</span>
            </div>
            <p id="deposit-help" className="text-xs text-gray-600 mt-1.5">
              Deposit sBTC to receive vault shares and earn yield
            </p>
          </div>
          <button
            onClick={handleDeposit}
            disabled={!address || !depositAmount || pending || isVaultPaused}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 min-h-[48px]"
          >
            {pending ? <><Spinner /> Confirming...</> : !address ? "Connect Wallet to Deposit" : "Deposit sBTC"}
          </button>
        </div>
      ) : (
        <div className="space-y-4" role="tabpanel" aria-label="Withdraw panel">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="withdraw-shares" className="flex items-center text-sm text-gray-400">
                Shares to Withdraw
                <InfoTip text="Vault shares represent your proportional ownership. When you withdraw, shares are burned and you receive the equivalent sBTC value." />
              </label>
              {address && userShares > 0 && (
                <button
                  onClick={handleMaxWithdraw}
                  className="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-orange-500/10"
                  aria-label="Set maximum withdrawal amount"
                >
                  MAX
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="withdraw-shares"
                type="number"
                step="0.0001"
                min="0"
                max={userShares || undefined}
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder="0.00"
                disabled={isVaultPaused}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all pr-20 min-h-[48px] disabled:opacity-50"
                aria-describedby="withdraw-help"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">shares</span>
            </div>
            {/* Balance display */}
            {address && userShares > 0 && (
              <div className="flex items-center justify-between mt-1.5">
                <p id="withdraw-help" className="text-xs text-gray-600">
                  Available: {userShares.toFixed(4)} shares
                </p>
                <p className="text-xs text-gray-600">
                  ≈ {userValue.toFixed(4)} sBTC
                </p>
              </div>
            )}
            {address && userShares === 0 && (
              <p id="withdraw-help" className="text-xs text-gray-600 mt-1.5">
                No shares to withdraw — deposit sBTC first
              </p>
            )}
            {/* Withdraw amount preview */}
            {withdrawShares && parseFloat(withdrawShares) > 0 && vaultInfo && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Estimated receive</span>
                  <span className="text-white font-medium">
                    ~{(parseFloat(withdrawShares) * (Number(vaultInfo.sharePrice) / ONE_SBTC)).toFixed(4)} sBTC
                  </span>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={handleWithdraw}
            disabled={!address || !withdrawShares || pending || isVaultPaused}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 min-h-[48px]"
          >
            {pending ? <><Spinner /> Confirming...</> : !address ? "Connect Wallet to Withdraw" : "Withdraw sBTC"}
          </button>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
