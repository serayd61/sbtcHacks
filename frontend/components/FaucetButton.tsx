"use client";

import { useState } from "react";
import { buildFaucetTx } from "@/lib/vault-calls";
import { useToast } from "@/components/Toast";

interface FaucetButtonProps {
  address: string | null;
}

export default function FaucetButton({ address }: FaucetButtonProps) {
  const [pending, setPending] = useState(false);
  const { showToast } = useToast();

  const handleFaucet = async () => {
    if (!address) return;
    setPending(true);
    try {
      const txOptions = buildFaucetTx();
      const { openContractCall } = await import("@stacks/connect");
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          showToast("1 sBTC minted from faucet!", "success", data.txId);
        },
        onCancel: () => showToast("Faucet cancelled", "info"),
      });
    } catch (e: any) {
      showToast(e.message || "Faucet failed", "error");
    }
    setPending(false);
  };

  return (
    <button
      onClick={handleFaucet}
      disabled={!address || pending}
      className="bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 disabled:bg-gray-800 disabled:border-gray-700 disabled:text-gray-500 text-orange-400 font-semibold px-4 py-2 rounded-lg transition-colors text-sm flex items-center gap-2 min-h-[40px]"
      aria-label="Get 1 testnet sBTC from faucet"
    >
      {pending ? (
        <>
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Minting...
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Get 1 sBTC (Testnet)
        </>
      )}
    </button>
  );
}
