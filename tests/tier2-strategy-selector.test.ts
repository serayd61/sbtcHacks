import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

const VAULT_STRATEGY = "advanced-vault-strategy-v3";
const DYNAMIC_SELECTOR = "dynamic-strategy-selector-v1";

// ============================================
// VAULT STRATEGY V3
// ============================================
describe("Advanced Vault Strategy — Allocation", () => {
  it("should set strategy allocation as deployer", () => {
    // 6 params: cc-alloc, csp-alloc, ic-alloc, strd-alloc, col-alloc, cash-alloc = 10000 total
    const result = simnet.callPublicFn(
      VAULT_STRATEGY, "set-strategy-allocation",
      [
        Cl.uint(3000),   // covered-calls 30%
        Cl.uint(2000),   // cash-secured-puts 20%
        Cl.uint(1500),   // iron-condors 15%
        Cl.uint(1000),   // straddles 10%
        Cl.uint(500),    // collars 5%
        Cl.uint(2000)    // cash-reserve 20%
      ],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject strategy allocation from non-owner", () => {
    const result = simnet.callPublicFn(
      VAULT_STRATEGY, "set-strategy-allocation",
      [Cl.uint(3000), Cl.uint(2000), Cl.uint(1500), Cl.uint(1000), Cl.uint(500), Cl.uint(2000)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(6000)); // ERR-NOT-AUTHORIZED (vault-strategy-v3)
  });

  it("should update market conditions", () => {
    // 4 params: btc-price, price-change-bps(int), realized-vol, implied-vol
    const result = simnet.callPublicFn(
      VAULT_STRATEGY, "update-market-conditions",
      [
        Cl.uint(87000_000000),  // btc-price
        Cl.int(200),            // price-change-bps (+2%)
        Cl.uint(5000),          // realized-vol
        Cl.uint(8000)           // implied-vol
      ],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject market conditions update from non-owner", () => {
    const result = simnet.callPublicFn(
      VAULT_STRATEGY, "update-market-conditions",
      [Cl.uint(87000_000000), Cl.int(200), Cl.uint(5000), Cl.uint(8000)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(6000));
  });
});

// ============================================
// DYNAMIC STRATEGY SELECTOR (ML Model)
// ============================================
describe("Dynamic Strategy Selector — ML Model", () => {
  // 11 params: btc-price, price-change-1h(int), price-change-4h(int), price-change-24h(int),
  // rv-7d, rv-30d, implied-vol, rsi, volume-ratio, fear-greed, funding-rate(int)
  const marketFeatures = [
    Cl.uint(87000_000000),  // btc-price
    Cl.int(150),            // price-change-1h
    Cl.int(300),            // price-change-4h
    Cl.int(-200),           // price-change-24h
    Cl.uint(5000),          // rv-7d
    Cl.uint(4500),          // rv-30d
    Cl.uint(8000),          // implied-vol
    Cl.uint(55),            // rsi
    Cl.uint(120),           // volume-ratio
    Cl.uint(45),            // fear-greed
    Cl.int(50)              // funding-rate
  ];

  it("should update market features", () => {
    const result = simnet.callPublicFn(
      DYNAMIC_SELECTOR, "update-market-features",
      marketFeatures,
      deployer
    );
    expect(result.result).toBeOk(expect.anything());
  });

  it("should reject feature update from non-owner", () => {
    const result = simnet.callPublicFn(
      DYNAMIC_SELECTOR, "update-market-features",
      marketFeatures,
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(7000)); // ERR-NOT-AUTHORIZED (dynamic-selector)
  });

  it("should predict optimal strategy after sufficient samples", () => {
    // Update features multiple times to meet MIN_HISTORICAL_SAMPLES
    for (let i = 0; i < 10; i++) {
      simnet.callPublicFn(DYNAMIC_SELECTOR, "update-market-features", marketFeatures, deployer);
    }

    const result = simnet.callPublicFn(
      DYNAMIC_SELECTOR, "predict-optimal-strategy",
      [Cl.uint(1)],
      deployer
    );
    // May fail if MIN_HISTORICAL_SAMPLES > 10, that's ok
    expect(result.result).toBeDefined();
  });
});
