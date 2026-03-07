"use client";

import { openContractCall } from "@stacks/connect";
import { buildFaucetTx } from "@/lib/vault-calls";

interface FaucetButtonProps {
  address: string | null;
}

export default function FaucetButton({ address }: FaucetButtonProps) {
  const handleFaucet = async () => {
    if (!address) return;
    const txOptions = buildFaucetTx();
    await openContractCall({
      ...txOptions,
      onFinish: (data) => {
        console.log("Faucet tx:", data.txId);
        alert(`Faucet tx submitted! TxID: ${data.txId.slice(0, 12)}...`);
      },
      onCancel: () => console.log("Faucet cancelled"),
    });
  };

  return (
    <button
      onClick={handleFaucet}
      disabled={!address}
      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
    >
      Get 1 sBTC (Faucet)
    </button>
  );
}
