"use client";

import Link from "next/link";

export default function WhitepaperPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          Testnet Phase — Mock sBTC
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-3">
          sBTC Options Vault
        </h1>
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
          Bitcoin Yield Through Automated Covered Call Options on Stacks
        </p>
        <p className="text-sm text-gray-600 mt-3">Whitepaper v1.0 — March 2026</p>
      </div>

      {/* Table of Contents */}
      <div className="bg-gray-900/80 backdrop-blur rounded-xl border border-gray-800 p-6 mb-10">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Table of Contents
        </h2>
        <nav className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {[
            { n: "1", label: "Problem", id: "problem" },
            { n: "2", label: "Solution: sBTC Options Vault", id: "solution" },
            { n: "3", label: "Technical Architecture", id: "architecture" },
            { n: "4", label: "Pricing Model", id: "pricing" },
            { n: "5", label: "Fee Structure", id: "fees" },
            { n: "6", label: "Security", id: "security" },
            { n: "7", label: "User Guide (Testnet)", id: "guide" },
            { n: "8", label: "Keeper Bot & Automation", id: "keeper" },
            { n: "9", label: "Technical Constants", id: "constants" },
            { n: "10", label: "Roadmap", id: "roadmap" },
            { n: "11", label: "Comparison", id: "comparison" },
            { n: "12", label: "Risk Disclosures", id: "risks" },
          ].map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            >
              <span className="w-6 h-6 rounded-md bg-orange-500/10 text-orange-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                {item.n}
              </span>
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Content */}
      <article className="space-y-12">
        {/* Abstract */}
        <Section>
          <div className="bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-xl border border-orange-500/10 p-6">
            <h2 className="text-lg font-semibold text-orange-400 mb-3">Abstract</h2>
            <p className="text-gray-300 leading-relaxed">
              sBTC Options Vault is a decentralized DeFi protocol on the Stacks blockchain that enables Bitcoin
              holders to earn passive income through automated covered call option strategies. Inspired by Ribbon
              Finance (Ethereum) and Friktion (Solana), it brings this proven yield strategy to the Bitcoin
              ecosystem for the first time.
            </p>
            <p className="text-gray-300 leading-relaxed mt-3">
              Users deposit sBTC and receive vault shares. Every 7-day epoch, covered call options are
              automatically created, and premiums collected from buyers generate yield for vault depositors. The
              entire process is managed by on-chain Clarity smart contracts.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium">
                LIVE ON MAINNET
              </span>
              <span className="text-gray-500">Using mock sBTC (faucet) for risk-free testing</span>
            </div>
          </div>
        </Section>

        {/* 1. Problem */}
        <Section id="problem">
          <SectionTitle number="1">Problem</SectionTitle>
          <p className="text-gray-300 leading-relaxed">
            Bitcoin, with its $1.7 trillion market cap, is the world&apos;s largest crypto asset. However, the vast
            majority of BTC holders simply &quot;hodl&quot; — yield opportunities are limited:
          </p>
          <ul className="mt-4 space-y-3">
            <BulletItem icon="x" color="red">
              <strong>CeFi platforms</strong> (Celsius, BlockFi) carry insolvency risks
            </BulletItem>
            <BulletItem icon="x" color="red">
              <strong>DeFi yield</strong> mostly exists in Ethereum/Solana ecosystems — limited for BTC
            </BulletItem>
            <BulletItem icon="x" color="red">
              <strong>Wrapped BTC</strong> (wBTC) creates trust concerns and bridge risks
            </BulletItem>
            <BulletItem icon="x" color="red">
              <strong>Staking</strong> is not possible with Bitcoin&apos;s PoW architecture
            </BulletItem>
          </ul>
          <p className="text-gray-400 mt-4 text-sm leading-relaxed">
            Bitcoin holders need transparent, on-chain yield mechanisms where they can put their assets to work
            in a trustless manner.
          </p>
        </Section>

        {/* 2. Solution */}
        <Section id="solution">
          <SectionTitle number="2">Solution: sBTC Options Vault</SectionTitle>

          <h3 className="text-white font-semibold mt-6 mb-2">What is sBTC?</h3>
          <p className="text-gray-300 leading-relaxed">
            sBTC is a fully decentralized token that pegs Bitcoin 1:1 to the Stacks blockchain. It preserves
            Bitcoin&apos;s security guarantees while enabling interaction with smart contracts on Stacks.
          </p>

          <h3 className="text-white font-semibold mt-8 mb-2">Covered Call Strategy</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            The covered call is one of the most common and safest option strategies in traditional finance:
          </p>

          <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5 font-mono text-sm">
            <p className="text-gray-500 mb-3">Scenario: BTC currently at $84,000</p>
            <div className="space-y-2 text-gray-300">
              <p><span className="text-orange-400">1.</span> Vault depositors deposit sBTC</p>
              <p><span className="text-orange-400">2.</span> Protocol creates covered call options at $88,200 strike (5% OTM)</p>
              <p><span className="text-orange-400">3.</span> Buyers pay premium (e.g., 0.01 sBTC) per option</p>
              <p><span className="text-orange-400">4.</span> After 7 days:</p>
              <p className="pl-4">
                <span className="text-green-400">BTC &lt; $88,200 (OTM):</span> Option expires worthless, vault keeps premium
              </p>
              <p className="pl-4">
                <span className="text-blue-400">BTC &gt; $88,200 (ITM):</span> Buyer receives payout, vault still keeps premium
              </p>
            </div>
          </div>

          <div className="mt-4 bg-orange-500/5 border border-orange-500/10 rounded-lg px-4 py-3">
            <p className="text-sm text-gray-300">
              <span className="text-orange-400 font-semibold">Why 5% OTM?</span>{" "}
              Statistically, the probability of BTC rising more than 5% in 7 days is low. This ensures vault
              depositors earn premium income in most epochs.
            </p>
          </div>

          <h3 className="text-white font-semibold mt-8 mb-4">Epoch Lifecycle</h3>
          <div className="bg-gray-900/80 rounded-xl border border-gray-800 overflow-hidden">
            <div className="divide-y divide-gray-800">
              <EpochStep phase="Start" color="orange" items={[
                "Calculate strike price: Spot × 1.05 (5% OTM)",
                "Calculate premium: Black-Scholes model (IV: 80%)",
                "Create 100 option listings (batch TX)"
              ]} />
              <EpochStep phase="Active (7 days)" color="blue" items={[
                "Buyers purchase options (premium flows to vault)",
                "Oracle updates BTC price every 10 minutes"
              ]} />
              <EpochStep phase="Settlement" color="green" items={[
                "Automatic settlement with oracle price",
                "OTM: Vault keeps all collateral + premiums",
                "ITM: Difference paid to buyers, vault keeps premiums"
              ]} />
              <EpochStep phase="Next Epoch" color="purple" items={[
                "New epoch starts automatically",
                "Cycle repeats with fresh parameters"
              ]} />
            </div>
          </div>
        </Section>

        {/* 3. Architecture */}
        <Section id="architecture">
          <SectionTitle number="3">Technical Architecture</SectionTitle>

          <h3 className="text-white font-semibold mt-6 mb-3">Smart Contracts (Clarity — Stacks)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Contract</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                <tr>
                  <td className="py-3 px-4 font-mono text-orange-400 text-xs">vault-logic-v2</td>
                  <td className="py-3 px-4 text-gray-300">Core logic: deposit, withdraw, epoch management, settlement, fees</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-orange-400 text-xs">vault-data-v1</td>
                  <td className="py-3 px-4 text-gray-300">Data layer: shares, epochs, TVL — upgradeable architecture</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-orange-400 text-xs">options-market-v5</td>
                  <td className="py-3 px-4 text-gray-300">Options marketplace: listings, purchases, payouts, batch operations</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-orange-400 text-xs">price-oracle-v2</td>
                  <td className="py-3 px-4 text-gray-300">Multi-source BTC/USD oracle: staleness checks, tolerance bands</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-orange-400 text-xs">mock-sbtc</td>
                  <td className="py-3 px-4 text-gray-300">Test token (SIP-010): faucet mint of 1 sBTC (testnet phase)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-white font-semibold mt-8 mb-3">Contract Addresses (Stacks Mainnet)</h3>
          <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-4 font-mono text-xs space-y-1.5 overflow-x-auto">
            <p className="text-gray-500">Deployer:</p>
            <p className="text-orange-400 break-all">SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W</p>
          </div>

          <h3 className="text-white font-semibold mt-8 mb-3">Vault Mechanism</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MechanismCard
              title="Deposit"
              formula="shares = (amount × total_shares) / total_sbtc"
              desc="User deposits sBTC, receives proportional vault shares"
            />
            <MechanismCard
              title="Withdraw"
              formula="sbtc = (shares × total_sbtc) / total_shares"
              desc="Shares are burned, proportional sBTC is returned"
            />
          </div>
          <div className="mt-4 bg-blue-500/5 border border-blue-500/10 rounded-lg px-4 py-3">
            <p className="text-sm text-gray-300">
              <span className="text-blue-400 font-semibold">Withdrawal Protection:</span>{" "}
              Max 25% of vault per 24-hour period — prevents flash-drain attacks.
            </p>
          </div>

          <h3 className="text-white font-semibold mt-8 mb-3">Options Market v5</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Max Listings" value="10,000" sub="per epoch" />
            <StatCard label="Batch Size" value="100" sub="per TX" />
            <StatCard label="Auto Premium" value="Direct" sub="to vault" />
            <StatCard label="Expiry" value="Auto" sub="cleanup" />
          </div>

          <h3 className="text-white font-semibold mt-8 mb-3">Upgradeable Architecture</h3>
          <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              <div className="flex-1 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-2">Data Layer (Permanent)</p>
                <p className="text-gray-400 text-xs font-mono leading-relaxed">
                  vault-data-v1<br />
                  user-shares, epochs<br />
                  total-sbtc, total-shares<br />
                  vault-paused, market-contract
                </p>
              </div>
              <div className="flex items-center justify-center text-gray-600 text-xl">
                <svg className="w-6 h-6 rotate-90 sm:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div className="flex-1 bg-gray-800/50 rounded-lg p-4 border border-orange-500/20">
                <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-2">Logic Layer (Upgradeable)</p>
                <p className="text-gray-400 text-xs font-mono leading-relaxed">
                  vault-logic-v2 (current)<br />
                  deposit(), withdraw()<br />
                  start-epoch(), settle()<br />
                  emergency-settle()
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Logic contract can be upgraded while preserving all user balances and epoch history
            </p>
          </div>

          <h3 className="text-white font-semibold mt-8 mb-3">Price Oracle</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gray-900/80 rounded-lg border border-gray-800 p-4 text-center">
              <p className="text-2xl mb-1">CoinGecko</p>
              <p className="text-xs text-gray-500">Source 1</p>
            </div>
            <div className="bg-gray-900/80 rounded-lg border border-gray-800 p-4 text-center">
              <p className="text-2xl mb-1">Binance</p>
              <p className="text-xs text-gray-500">Source 2</p>
            </div>
            <div className="bg-gray-900/80 rounded-lg border border-gray-800 p-4 text-center">
              <p className="text-2xl mb-1">Kraken</p>
              <p className="text-xs text-gray-500">Source 3</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Tolerance" value="2%" sub="max deviation" />
            <StatCard label="Staleness" value="12 blk" sub="~2 hours" />
            <StatCard label="Submitters" value="5" sub="capacity" />
            <StatCard label="Range" value="$1K-$1M" sub="valid" />
          </div>
        </Section>

        {/* 4. Pricing */}
        <Section id="pricing">
          <SectionTitle number="4">Pricing Model</SectionTitle>
          <h3 className="text-white font-semibold mt-6 mb-3">Black-Scholes Formula</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Option premiums are calculated using the industry-standard Black-Scholes pricing model:
          </p>
          <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5 font-mono text-sm">
            <p className="text-orange-400 text-lg mb-4">C = S &middot; N(d1) - K &middot; e<sup>-rT</sup> &middot; N(d2)</p>
            <div className="space-y-1.5 text-gray-400 text-xs">
              <p><span className="text-gray-300">S</span> = Spot price (BTC/USD)</p>
              <p><span className="text-gray-300">K</span> = Strike price (S &times; 1.05)</p>
              <p><span className="text-gray-300">T</span> = Time to expiry (blocks &rarr; years, 10 min/block)</p>
              <p><span className="text-gray-300">r</span> = Risk-free rate (5% annual)</p>
              <p><span className="text-gray-300">&sigma;</span> = Implied Volatility (80% default)</p>
              <p><span className="text-gray-300">N()</span> = Cumulative normal distribution (Abramowitz-Stegun approximation)</p>
            </div>
          </div>

          <h3 className="text-white font-semibold mt-8 mb-3">Example Calculation</h3>
          <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5">
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div className="text-gray-500">BTC Spot</div><div className="text-white font-mono">$84,000</div>
              <div className="text-gray-500">Strike</div><div className="text-white font-mono">$88,200 (5% OTM)</div>
              <div className="text-gray-500">Duration</div><div className="text-white font-mono">1008 blocks (~7 days)</div>
              <div className="text-gray-500">IV</div><div className="text-white font-mono">80%</div>
              <div className="text-gray-500">Risk-free</div><div className="text-white font-mono">5%</div>
            </div>
            <div className="border-t border-gray-800 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Premium per option</span>
                <span className="text-green-400 font-mono font-semibold">~1% collateral (~0.01 sBTC)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Annualized APY (if all sold)</span>
                <span className="text-green-400 font-mono font-semibold">~52% (52 weeks &times; 1%)</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * Actual APY depends on option sell-through rate and ITM/OTM outcomes.
          </p>
        </Section>

        {/* 5. Fees */}
        <Section id="fees">
          <SectionTitle number="5">Fee Structure</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5">
              <p className="text-3xl font-bold text-white">2%</p>
              <p className="text-orange-400 font-semibold text-sm mt-1">Management Fee</p>
              <p className="text-gray-500 text-xs mt-2">Per epoch, calculated on total collateral</p>
            </div>
            <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5">
              <p className="text-3xl font-bold text-white">10%</p>
              <p className="text-orange-400 font-semibold text-sm mt-1">Performance Fee</p>
              <p className="text-gray-500 text-xs mt-2">On earned premiums only</p>
            </div>
          </div>
          <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5 mt-4 font-mono text-xs">
            <p className="text-gray-500 mb-2">Example:</p>
            <p className="text-gray-300">Collateral: 1.55 sBTC | Premium earned: 0.03 sBTC</p>
            <p className="text-gray-400 mt-2">Management: 1.55 &times; 0.02 = <span className="text-white">0.031 sBTC</span></p>
            <p className="text-gray-400">Performance: 0.03 &times; 0.10 = <span className="text-white">0.003 sBTC</span></p>
            <p className="text-orange-400 mt-2">Total fees: 0.034 sBTC &rarr; Treasury</p>
          </div>
        </Section>

        {/* 6. Security */}
        <Section id="security">
          <SectionTitle number="6">Security</SectionTitle>

          <h3 className="text-white font-semibold mt-6 mb-3">Smart Contract Security</h3>
          <div className="space-y-2">
            <SecurityItem label="Withdrawal rate limiting" desc="Max 25% withdrawal per 24h period" />
            <SecurityItem label="Vault pause mechanism" desc="All operations can be halted in emergencies" />
            <SecurityItem label="Emergency settlement" desc="Stuck epochs can be force-settled (owner-only, paused)" />
            <SecurityItem label="Oracle staleness check" desc="Prices older than 12 blocks are rejected" />
            <SecurityItem label="Payout cap" desc="Payouts never exceed vault balance (underflow protection)" />
            <SecurityItem label="Admin multisig" desc="Multi-signature governance contract (deployed)" />
            <SecurityItem label="Zero-amount validation" desc="Zero deposits/withdrawals/premiums are rejected" />
          </div>

          <h3 className="text-white font-semibold mt-8 mb-3">Oracle Security</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Sources" value="3" sub="independent" />
            <StatCard label="Method" value="Median" sub="anti-manipulation" />
            <StatCard label="Tolerance" value="+/- 2%" sub="band" />
            <StatCard label="Submitters" value="5" sub="decentralization" />
          </div>
        </Section>

        {/* 7. User Guide */}
        <Section id="guide">
          <SectionTitle number="7">User Guide (Testnet)</SectionTitle>

          <div className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-xl border border-green-500/10 p-5 mt-4">
            <p className="text-green-400 font-semibold text-sm mb-2">Test Phase — Risk Free</p>
            <p className="text-gray-300 text-sm leading-relaxed">
              The protocol is currently in its <strong>testing phase</strong>. You can experience all features
              risk-free using mock sBTC tokens obtained from the faucet.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Launch App
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            <GuideStep step={1} title="Get sBTC from Faucet" items={[
              "Connect your Stacks wallet (Leather or Xverse)",
              'Click the "Faucet" button in the header',
              "1 mock sBTC will be minted to your wallet — completely free",
              "You can use it multiple times"
            ]} />
            <GuideStep step={2} title="Deposit to Vault" items={[
              'Go to the "Deposit" tab on the dashboard',
              "Enter the amount of sBTC you want to deposit",
              'Confirm the transaction with "Deposit"',
              "Receive vault shares in return — share value grows as premiums are earned"
            ]} />
            <GuideStep step={3} title="Buy an Option" items={[
              'Navigate to the "Options Market" page',
              "Browse available listings: Strike Price, Premium, Collateral, Expiry",
              '"Buy Option" — premium is paid from your wallet in sBTC',
              "Premium is automatically forwarded to the vault as yield"
            ]} />
            <GuideStep step={4} title="Settlement & Payout" items={[
              'If ITM (BTC > Strike): Click "Claim Payout" to collect your profit',
              "If OTM (BTC < Strike): Option expires, premium stays in vault",
            ]} />
          </div>
        </Section>

        {/* 8. Keeper */}
        <Section id="keeper">
          <SectionTitle number="8">Keeper Bot & Automation</SectionTitle>
          <p className="text-gray-300 leading-relaxed mt-4">
            The protocol runs 24/7 with 3 automated services:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <KeeperCard
              title="Price Oracle"
              interval="Every 10 min"
              items={["3-source BTC/USD fetch", "Median calculation", "On-chain update if >2% change"]}
            />
            <KeeperCard
              title="Epoch Manager"
              interval="Every 5 min"
              items={["Detect expired epochs", "Auto-settle with oracle", "Start new epoch + batch listings"]}
            />
            <KeeperCard
              title="Health Monitor"
              interval="Every 5 min"
              items={["TVL change alerts (>10%)", "Oracle staleness check", "Keeper wallet balance watch"]}
            />
          </div>
        </Section>

        {/* 9. Constants */}
        <Section id="constants">
          <SectionTitle number="9">Technical Constants</SectionTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Parameter</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Value</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium hidden sm:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {[
                  ["PRECISION", "10^8 (8 decimal)", "sBTC satoshi precision"],
                  ["PRICE-PRECISION", "10^6 (6 decimal)", "USD price precision"],
                  ["Strike OTM", "5%", "Above spot price"],
                  ["Epoch Duration", "1008 blocks", "~7 days (10 min/block)"],
                  ["Management Fee", "2% (200 BPS)", "On collateral"],
                  ["Performance Fee", "10% (1000 BPS)", "On premiums"],
                  ["Max Withdrawal", "25% / 24h", "Flash-drain protection"],
                  ["Staleness Limit", "12 blocks", "~2 hours"],
                  ["Oracle Tolerance", "2% (200 BPS)", "Max price deviation"],
                  ["Faucet Amount", "1 sBTC", "100,000,000 sats"],
                  ["Max Listings", "10,000 / epoch", "v5 contract limit"],
                  ["Batch Size", "100 listings / TX", "fold iteration"],
                  ["Default IV", "80%", "Implied volatility"],
                  ["Risk-free Rate", "5%", "Annual"],
                ].map(([param, value, desc]) => (
                  <tr key={param}>
                    <td className="py-2.5 px-4 font-mono text-orange-400 text-xs">{param}</td>
                    <td className="py-2.5 px-4 text-white font-mono text-xs">{value}</td>
                    <td className="py-2.5 px-4 text-gray-500 text-xs hidden sm:table-cell">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 10. Roadmap */}
        <Section id="roadmap">
          <SectionTitle number="10">Roadmap</SectionTitle>
          <div className="mt-4 space-y-6">
            <RoadmapPhase
              phase="Phase 1"
              status="completed"
              items={[
                "Core vault contract (deposit, withdraw, epoch management)",
                "Price oracle (3-source, staleness-controlled)",
                "Options marketplace (batch listing, buy, claim)",
                "Frontend (Next.js 16, Tailwind 4, wallet integration)",
                "Keeper bot (price, epoch, monitoring)",
                "22 unit tests + Stacks mainnet deployment"
              ]}
            />
            <RoadmapPhase
              phase="Phase 2"
              status="completed"
              items={[
                "Data-logic separation (upgradeable architecture)",
                "Withdrawal rate limiting + Emergency settlement",
                "Multi-submitter oracle + Batch listing (100/TX)",
                "Security hardening (CSP, rate limit, input validation)",
                "SEO optimization (OG image, Twitter card, sitemap)"
              ]}
            />
            <RoadmapPhase
              phase="Phase 3"
              status="in-progress"
              items={[
                "Real sBTC integration (replacing mock)",
                "Governance token (DAO management)",
                "Insurance fund (user protection)",
                "Multi-asset vault support",
                "Automatic IV calculation with real market data"
              ]}
            />
            <RoadmapPhase
              phase="Phase 4"
              status="planned"
              items={[
                "Cross-chain option bridges",
                "Exotic options (put, spread, straddle)",
                "DAO-governed strategy parameters",
                "Institutional-grade API",
                "Security audit (CertiK / Trail of Bits)"
              ]}
            />
          </div>
        </Section>

        {/* 11. Comparison */}
        <Section id="comparison">
          <SectionTitle number="11">Comparison</SectionTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">Feature</th>
                  <th className="text-left py-3 px-3 text-orange-400 font-medium">sBTC Vault</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">Ribbon</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">Friktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                <CompRow label="Blockchain" ours="Stacks (BTC L2)" ribbon="Ethereum" friktion="Solana" />
                <CompRow label="Asset" ours="sBTC (Bitcoin)" ribbon="ETH, wBTC" friktion="SOL, BTC" />
                <CompRow label="Strategy" ours="Covered Call" ribbon="CC + Put" friktion="CC + Crab" />
                <CompRow label="Settlement" ours="On-chain Oracle" ribbon="Opyn" friktion="Pyth" />
                <CompRow label="Epoch" ours="7 days" ribbon="7 days" friktion="7 days" />
                <CompRow label="Status" ours="Testnet (Live)" ribbon="Live -> Aeon" friktion="Closed" />
                <CompRow label="Fees" ours="2% + 10%" ribbon="2% + 10%" friktion="2% + 10%" />
              </tbody>
            </table>
          </div>
          <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg px-4 py-3 mt-4">
            <p className="text-sm text-gray-300">
              <span className="text-orange-400 font-semibold">Our Advantage:</span>{" "}
              Native yield in Bitcoin&apos;s own ecosystem (Stacks) via sBTC. No bridge risk, no wrapping, Bitcoin finality.
            </p>
          </div>
        </Section>

        {/* 12. Risks */}
        <Section id="risks">
          <SectionTitle number="12">Risk Disclosures</SectionTitle>
          <div className="mt-4 space-y-2">
            <RiskItem label="Smart contract risk" desc="Contracts have not yet undergone an independent audit" />
            <RiskItem label="Oracle risk" desc="Price sources could be manipulated (3 sources + tolerance mitigates)" />
            <RiskItem label="ITM risk" desc="BTC price increase causes payout deduction from vault collateral" />
            <RiskItem label="Test phase" desc="Currently using mock sBTC — no real BTC risk" />
            <RiskItem label="Network risks" desc="Stacks network outages, high transaction fees" />
            <RiskItem label="Liquidity risk" desc="Low participation may result in unsold options" />
          </div>

          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-5 mt-6">
            <p className="text-red-400 font-semibold text-sm mb-2">Important</p>
            <p className="text-gray-300 text-sm leading-relaxed">
              This is an experimental DeFi protocol. Only use amounts you can afford to lose.
              This is not investment advice.
            </p>
          </div>
        </Section>

        {/* Conclusion */}
        <Section>
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-white mb-4">Start Exploring</h2>
            <p className="text-gray-400 max-w-lg mx-auto mb-6 text-sm leading-relaxed">
              sBTC Options Vault brings trustless, on-chain, automated yield to the Bitcoin ecosystem.
              The covered call strategy — one of traditional finance&apos;s safest option strategies — is now
              accessible to everyone on Stacks.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
              >
                Launch App
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="https://github.com/serayd61/sbtcHacks"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </a>
            </div>
            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-gray-600">
              <span>Stacks Mainnet</span>
              <span>&middot;</span>
              <span>BUIDL BATTLE #2</span>
              <span>&middot;</span>
              <span>March 2026</span>
            </div>
          </div>
        </Section>
      </article>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20">
      {children}
    </section>
  );
}

function SectionTitle({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 text-orange-400 text-sm font-bold flex items-center justify-center border border-orange-500/20">
        {number}
      </span>
      <h2 className="text-xl sm:text-2xl font-bold text-white">{children}</h2>
    </div>
  );
}

function BulletItem({ children, icon, color }: { children: React.ReactNode; icon: "x" | "check"; color: "red" | "green" }) {
  const colorClasses = color === "red"
    ? "text-red-400 bg-red-500/10 border-red-500/20"
    : "text-green-400 bg-green-500/10 border-green-500/20";

  return (
    <li className="flex items-start gap-3">
      <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-xs border ${colorClasses}`}>
        {icon === "x" ? "\u2717" : "\u2713"}
      </span>
      <span className="text-gray-300 text-sm leading-relaxed">{children}</span>
    </li>
  );
}

function EpochStep({ phase, color, items }: { phase: string; color: string; items: string[] }) {
  const colors: Record<string, string> = {
    orange: "text-orange-400 bg-orange-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    green: "text-green-400 bg-green-500/10",
    purple: "text-purple-400 bg-purple-500/10",
  };
  const c = colors[color] || colors.orange;

  return (
    <div className="px-5 py-4">
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${c.split(" ")[0]}`}>
        <span className={`inline-block px-2 py-0.5 rounded ${c}`}>{phase}</span>
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
            <span className="text-gray-600 mt-1.5 w-1 h-1 rounded-full bg-gray-600 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MechanismCard({ title, formula, desc }: { title: string; formula: string; desc: string }) {
  return (
    <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-4">
      <p className="text-orange-400 font-semibold text-sm mb-2">{title}</p>
      <p className="font-mono text-xs text-white bg-gray-800/50 rounded-lg px-3 py-2 mb-2 break-all">{formula}</p>
      <p className="text-gray-500 text-xs">{desc}</p>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-gray-900/80 rounded-lg border border-gray-800 px-3 py-3 text-center">
      <p className="text-white font-bold text-lg">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-[10px] text-gray-600">{sub}</p>
    </div>
  );
}

function SecurityItem({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-800/50">
      <span className="w-5 h-5 rounded-md bg-green-500/10 text-green-400 flex items-center justify-center shrink-0 mt-0.5 text-xs border border-green-500/20">
        &#x2713;
      </span>
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}

function GuideStep({ step, title, items }: { step: number; title: string; items: string[] }) {
  return (
    <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 text-orange-400 text-sm font-bold flex items-center justify-center border border-orange-500/20">
          {step}
        </span>
        <h4 className="text-white font-semibold">{title}</h4>
      </div>
      <ul className="space-y-1.5 pl-10">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
            <span className="text-gray-600 mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-600 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeeperCard({ title, interval, items }: { title: string; interval: string; items: string[] }) {
  return (
    <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-4">
      <p className="text-white font-semibold text-sm">{title}</p>
      <p className="text-[10px] text-orange-400 font-mono mb-3">{interval}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-gray-600 mt-1 w-1 h-1 rounded-full bg-gray-600 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoadmapPhase({ phase, status, items }: { phase: string; status: "completed" | "in-progress" | "planned"; items: string[] }) {
  const statusConfig = {
    completed: { label: "Completed", color: "text-green-400 bg-green-500/10 border-green-500/20" },
    "in-progress": { label: "In Progress", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    planned: { label: "Planned", color: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
  };
  const cfg = statusConfig[status];

  return (
    <div className="bg-gray-900/80 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white font-semibold">{phase}</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
            {status === "completed" ? (
              <span className="text-green-400 shrink-0 mt-0.5">&#x2713;</span>
            ) : (
              <span className="text-gray-600 mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-600 shrink-0" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompRow({ label, ours, ribbon, friktion }: { label: string; ours: string; ribbon: string; friktion: string }) {
  return (
    <tr>
      <td className="py-2.5 px-3 text-gray-500 text-xs">{label}</td>
      <td className="py-2.5 px-3 text-orange-400 font-medium text-xs">{ours}</td>
      <td className="py-2.5 px-3 text-gray-400 text-xs">{ribbon}</td>
      <td className="py-2.5 px-3 text-gray-400 text-xs">{friktion}</td>
    </tr>
  );
}

function RiskItem({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 bg-gray-900/60 rounded-lg px-4 py-3 border border-gray-800/50">
      <span className="w-5 h-5 rounded-md bg-yellow-500/10 text-yellow-400 flex items-center justify-center shrink-0 mt-0.5 text-xs border border-yellow-500/20">
        !
      </span>
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
