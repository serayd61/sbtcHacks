"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { ToastProvider, useToast } from "@/components/Toast";
import { IS_MAINNET } from "@/lib/stacks-config";

interface WalletContextType {
  address: string | null;
  setAddress: (address: string | null) => void;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnecting: boolean;
  refreshKey: number;
  refresh: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  setAddress: () => {},
  connectWallet: async () => {},
  disconnectWallet: () => {},
  isConnecting: false,
  refreshKey: 0,
  refresh: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

/* Inner component that can use useToast() since it's inside ToastProvider */
function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("stx-address");
    if (saved) setAddress(saved);
  }, []);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "stx-address") {
        setAddress(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { connect } = await import("@stacks/connect");
      const response = await connect();
      const prefix = IS_MAINNET ? "SP" : "ST";
      const stxEntry = response.addresses.find(
        (a: { address: string }) => a.address.startsWith(prefix)
      );
      const addr = stxEntry?.address || response.addresses[0]?.address;
      if (addr) {
        setAddress(addr);
        localStorage.setItem("stx-address", addr);
        showToast("Wallet connected!", "success");
      } else {
        showToast("No Stacks address found in wallet", "error");
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes("cancel") || msg.includes("closed")) {
        showToast("Wallet connection cancelled", "info");
      } else {
        console.error("Wallet connection failed:", e);
        showToast("Failed to connect wallet. Is Leather/Xverse installed?", "error");
      }
    }
    setIsConnecting(false);
  }, [showToast]);

  const handleDisconnect = useCallback(async () => {
    try {
      const { disconnect } = await import("@stacks/connect");
      disconnect();
    } catch {
      // ignore disconnect errors
    }
    setAddress(null);
    localStorage.removeItem("stx-address");
    showToast("Wallet disconnected", "info");
  }, [showToast]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <WalletContext.Provider
      value={{
        address,
        setAddress,
        connectWallet: handleConnect,
        disconnectWallet: handleDisconnect,
        isConnecting,
        refreshKey,
        refresh,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <WalletProvider>{children}</WalletProvider>
    </ToastProvider>
  );
}
