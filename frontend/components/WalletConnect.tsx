"use client";

import { showConnect } from "@stacks/connect";
import { useCallback } from "react";

interface WalletConnectProps {
  address: string | null;
  setAddress: (address: string | null) => void;
}

export default function WalletConnect({
  address,
  setAddress,
}: WalletConnectProps) {
  const connectWallet = useCallback(() => {
    showConnect({
      appDetails: {
        name: "sBTC Options Vault",
        icon: "/btc-icon.png",
      },
      onFinish: (data) => {
        const addr = data.userSession.loadUserData().profile.stxAddress.mainnet;
        setAddress(addr);
        localStorage.setItem("stx-address", addr);
      },
      onCancel: () => {
        console.log("User cancelled");
      },
    });
  }, [setAddress]);

  const disconnect = () => {
    setAddress(null);
    localStorage.removeItem("stx-address");
  };

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm bg-gray-800 px-3 py-1.5 rounded-lg font-mono text-orange-400">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={disconnect}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
    >
      Connect Wallet
    </button>
  );
}
