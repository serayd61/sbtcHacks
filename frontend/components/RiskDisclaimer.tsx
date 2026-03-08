"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "sbtc-vault-risk-accepted";

export default function RiskDisclaimer() {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      setShow(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-lg w-full shadow-2xl animate-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Risk Disclaimer</h2>
              <p className="text-xs text-gray-500">Please read before using the vault</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 space-y-3 text-sm text-gray-400 max-h-[50vh] overflow-y-auto">
          <RiskItem
            title="Smart Contract Risk"
            text="This vault interacts with smart contracts on the Stacks blockchain. Smart contracts may contain bugs or vulnerabilities that could lead to loss of funds."
          />
          <RiskItem
            title="Options Strategy Risk"
            text="The covered call strategy involves selling upside potential. If BTC price rises above the strike price (ITM), the vault may lose a portion of deposited sBTC as payout to option buyers."
          />
          <RiskItem
            title="Market Risk"
            text="Cryptocurrency prices are highly volatile. The value of your sBTC deposit can fluctuate significantly. Past performance does not guarantee future results."
          />
          <RiskItem
            title="Liquidity Risk"
            text="During active epochs, withdrawals may be limited. Your funds may be locked as collateral for written options until the epoch settles."
          />
          <RiskItem
            title="Oracle Risk"
            text="Settlement prices depend on price oracle data. Oracle failures, manipulation, or staleness could affect epoch settlement outcomes."
          />
          <RiskItem
            title="Experimental Software"
            text="This is experimental DeFi software in early development. Use at your own risk and only deposit amounts you can afford to lose."
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 border-t border-gray-800">
          <label className="flex items-start gap-3 cursor-pointer mb-4 mt-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-900 cursor-pointer"
            />
            <span className="text-sm text-gray-300 leading-relaxed">
              I understand the risks involved and agree to use this protocol at my own risk. I acknowledge that I may lose some or all of my deposited funds.
            </span>
          </label>
          <button
            onClick={handleAccept}
            disabled={!checked}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-all text-sm min-h-[44px]"
          >
            I Understand, Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function RiskItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
      <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{text}</p>
    </div>
  );
}
