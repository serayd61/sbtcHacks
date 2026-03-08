// keeper/pricing.ts
// Black-Scholes option pricing for covered call premium calculation
//
// Used by epoch-manager to determine fair premium for new epochs

import { KEEPER_CONFIG } from "./config";

// ============================================
// Black-Scholes Model
// ============================================

/**
 * Cumulative normal distribution function (approximation)
 * Abramowitz and Stegun approximation (error < 1.5e-7)
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Black-Scholes call option price
 *
 * @param S - Current spot price (USD)
 * @param K - Strike price (USD)
 * @param T - Time to expiry (years)
 * @param r - Risk-free rate (annual, e.g., 0.05 for 5%)
 * @param sigma - Implied volatility (annual, e.g., 0.8 for 80%)
 * @returns Call option price in USD
 */
function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0) return Math.max(0, S - K); // At expiry, intrinsic value only
  if (S <= 0 || K <= 0) return 0;

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const callPrice = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  return Math.max(0, callPrice);
}

// ============================================
// Premium Calculation for Vault
// ============================================

/**
 * Calculate fair premium for a covered call option
 *
 * @param spotPriceUsd - Current BTC/USD price
 * @param strikePriceUsd - Strike price in USD
 * @param durationBlocks - Epoch duration in Stacks blocks
 * @param collateralSats - Collateral amount in satoshis
 * @param iv - Implied volatility (optional, uses default)
 * @returns Premium in satoshis
 */
export function calculateCallPremium(
  spotPriceUsd: number,
  strikePriceUsd: number,
  durationBlocks: number,
  collateralSats: bigint,
  iv?: number
): bigint {
  // Convert blocks to years (~10 min per block)
  const minutesPerBlock = 10;
  const minutesTotal = durationBlocks * minutesPerBlock;
  const T = minutesTotal / (365.25 * 24 * 60);

  const sigma = iv ?? KEEPER_CONFIG.pricing.defaultIV;
  const r = KEEPER_CONFIG.pricing.riskFreeRate;

  // Black-Scholes call price (USD per 1 BTC)
  const callPriceUsd = blackScholesCall(spotPriceUsd, strikePriceUsd, T, r, sigma);

  // Premium as percentage of spot
  const premiumPercent = callPriceUsd / spotPriceUsd;

  // Apply to collateral (in sats)
  const premiumSats = BigInt(Math.round(Number(collateralSats) * premiumPercent));

  // Minimum premium: 0.1% of collateral
  const minPremium = collateralSats / 1000n;
  return premiumSats > minPremium ? premiumSats : minPremium;
}

/**
 * Format pricing info for logging
 */
export function formatPricingInfo(
  spotPriceUsd: number,
  strikePriceUsd: number,
  durationBlocks: number,
  collateralSats: bigint,
  premiumSats: bigint
): string {
  const premiumBtc = Number(premiumSats) / 100_000_000;
  const collateralBtc = Number(collateralSats) / 100_000_000;
  const premiumPercent = (Number(premiumSats) / Number(collateralSats)) * 100;
  const durationDays = (durationBlocks * 10) / (60 * 24);

  return [
    `--- Option Pricing ---`,
    `Spot:       $${spotPriceUsd.toLocaleString()}`,
    `Strike:     $${strikePriceUsd.toLocaleString()} (${((strikePriceUsd / spotPriceUsd - 1) * 100).toFixed(1)}% OTM)`,
    `Duration:   ${durationBlocks} blocks (~${durationDays.toFixed(1)} days)`,
    `Collateral: ${collateralBtc.toFixed(8)} BTC`,
    `Premium:    ${premiumBtc.toFixed(8)} BTC (${premiumPercent.toFixed(2)}%)`,
    `IV:         ${(KEEPER_CONFIG.pricing.defaultIV * 100).toFixed(0)}%`,
    `---`,
  ].join("\n");
}

// ============================================
// Exports for Testing
// ============================================
export { blackScholesCall, normalCDF };
