"use client";

import Providers from "./Providers";
import Header from "./Header";
import RiskDisclaimer from "@/components/RiskDisclaimer";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <RiskDisclaimer />
      <Header />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <footer className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
          <p>sBTC Options Vault</p>
          <div className="flex items-center gap-4">
            <span>Built for BUIDL BATTLE #2</span>
            <span className="text-gray-700">|</span>
            <span>Powered by Stacks</span>
          </div>
        </div>
      </footer>
    </Providers>
  );
}
