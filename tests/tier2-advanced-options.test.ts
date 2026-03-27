import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const ADV_MARKET = "advanced-options-market-v7";
const MOCK_SBTC = `${deployer}.mock-sbtc`;
const ONE_SBTC = 100_000_000n;

// Helper: setup vault and market
function setupMarket() {
  simnet.callPublicFn("mock-sbtc", "mint", [Cl.uint(10n * ONE_SBTC), Cl.principal(wallet1)], deployer);
  simnet.callPublicFn("mock-sbtc", "mint", [Cl.uint(10n * ONE_SBTC), Cl.principal(wallet2)], deployer);
}

// ============================================
// STRIKE LADDER CREATION
// ============================================
describe("Advanced Options Market — Strike Ladder", () => {
  it("should create strike ladder for epoch", () => {
    setupMarket();

    // All strikes above spot to avoid ArithmeticUnderflow in distance calc
    const strikesConfig = Cl.list([
      Cl.tuple({
        "strike-price": Cl.uint(90000_000000),
        "call-premium": Cl.uint(500_000),
        "put-premium": Cl.uint(300_000)
      }),
      Cl.tuple({
        "strike-price": Cl.uint(92000_000000),
        "call-premium": Cl.uint(400_000),
        "put-premium": Cl.uint(400_000)
      }),
      Cl.tuple({
        "strike-price": Cl.uint(95000_000000),
        "call-premium": Cl.uint(300_000),
        "put-premium": Cl.uint(500_000)
      })
    ]);

    const result = simnet.callPublicFn(
      ADV_MARKET, "create-strike-ladder",
      [Cl.uint(1), Cl.uint(87000_000000), Cl.uint(8000), strikesConfig],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1));
  });

  it("should reject strike ladder from non-owner", () => {
    const strikesConfig = Cl.list([
      Cl.tuple({
        "strike-price": Cl.uint(85000_000000),
        "call-premium": Cl.uint(500_000),
        "put-premium": Cl.uint(300_000)
      })
    ]);

    const result = simnet.callPublicFn(
      ADV_MARKET, "create-strike-ladder",
      [Cl.uint(1), Cl.uint(87000_000000), Cl.uint(8000), strikesConfig],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(5000)); // ERR-NOT-AUTHORIZED
  });
});

// ============================================
// IRON CONDOR STRATEGY
// ============================================
describe("Advanced Options Market — Iron Condor", () => {
  it("should create iron condor strategy", () => {
    setupMarket();

    const result = simnet.callPublicFn(
      ADV_MARKET, "create-iron-condor",
      [
        Cl.uint(1),                    // epoch-id
        Cl.uint(90000_000000),         // call-strike-low (short call)
        Cl.uint(95000_000000),         // call-strike-high (long call)
        Cl.uint(85000_000000),         // put-strike-low (long put) - must be < put-strike-high
        Cl.uint(80000_000000),         // put-strike-high (short put) - lower value = further OTM
        Cl.uint(ONE_SBTC)             // quantity
      ],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1));
  });
});

// ============================================
// STRADDLE STRATEGY
// ============================================
describe("Advanced Options Market — Straddle", () => {
  it("should create straddle at ATM strike", () => {
    setupMarket();

    const result = simnet.callPublicFn(
      ADV_MARKET, "create-straddle",
      [
        Cl.uint(1),                    // epoch-id
        Cl.uint(87000_000000),         // strike-price (ATM)
        Cl.uint(ONE_SBTC),            // quantity
        Cl.bool(true)                  // is-long
      ],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1));
  });
});

// ============================================
// ACCESS CONTROL
// ============================================
describe("Advanced Options Market — Access Control", () => {
  it("should reject iron condor from non-owner", () => {
    const result = simnet.callPublicFn(
      ADV_MARKET, "create-iron-condor",
      [Cl.uint(1), Cl.uint(90000_000000), Cl.uint(95000_000000), Cl.uint(85000_000000), Cl.uint(80000_000000), Cl.uint(ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(5000));
  });

  it("should reject straddle from non-owner", () => {
    const result = simnet.callPublicFn(
      ADV_MARKET, "create-straddle",
      [Cl.uint(1), Cl.uint(87000_000000), Cl.uint(ONE_SBTC), Cl.bool(true)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(5000));
  });

  it("should reject collar from non-owner", () => {
    // create-collar: epoch-id, call-strike, put-strike, underlying-amount
    const result = simnet.callPublicFn(
      ADV_MARKET, "create-collar",
      [Cl.uint(1), Cl.uint(95000_000000), Cl.uint(80000_000000), Cl.uint(ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(5000));
  });
});
