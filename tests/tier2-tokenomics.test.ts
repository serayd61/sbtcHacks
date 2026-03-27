import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const GOV_TOKEN = "enhanced-governance-token-v2";
const YIELD_FARM = "yield-farming-pools-v1";
const MOCK_SBTC = `${deployer}.mock-sbtc`;
const ONE_SBTC = 100_000_000n;
const ONE_TOKEN = 100_000_000n;

// ============================================
// GOVERNANCE TOKEN — MINTING
// ============================================
describe("Enhanced Governance Token — Minting", () => {
  it("should mint tokens as deployer", () => {
    const result = simnet.callPublicFn(
      GOV_TOKEN, "mint",
      [Cl.principal(wallet1), Cl.uint(1000n * ONE_TOKEN)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1000n * ONE_TOKEN));
  });

  it("should reject mint from non-owner", () => {
    const result = simnet.callPublicFn(
      GOV_TOKEN, "mint",
      [Cl.principal(wallet1), Cl.uint(ONE_TOKEN)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(8000)); // ERR-NOT-AUTHORIZED
  });

  it("should respect max supply cap", () => {
    // Try to mint more than 1B max supply
    const result = simnet.callPublicFn(
      GOV_TOKEN, "mint",
      [Cl.principal(wallet1), Cl.uint(1_100_000_000n * ONE_TOKEN)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(8009)); // ERR-MAX-SUPPLY-EXCEEDED
  });
});

// ============================================
// GOVERNANCE TOKEN — SIP-010
// ============================================
describe("Enhanced Governance Token — SIP-010", () => {
  it("should return token name and symbol", () => {
    const name = simnet.callReadOnlyFn(GOV_TOKEN, "get-name", [], deployer);
    expect(name.result).toBeOk(Cl.stringAscii("sBTC Options Vault Token"));

    const symbol = simnet.callReadOnlyFn(GOV_TOKEN, "get-symbol", [], deployer);
    expect(symbol.result).toBeOk(Cl.stringAscii("SOVT"));

    const decimals = simnet.callReadOnlyFn(GOV_TOKEN, "get-decimals", [], deployer);
    expect(decimals.result).toBeOk(Cl.uint(8));
  });

  it("should transfer tokens between accounts", () => {
    simnet.callPublicFn(GOV_TOKEN, "mint", [Cl.principal(wallet1), Cl.uint(100n * ONE_TOKEN)], deployer);

    const result = simnet.callPublicFn(
      GOV_TOKEN, "transfer",
      [Cl.uint(50n * ONE_TOKEN), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
      wallet1
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject transfer with insufficient balance", () => {
    const result = simnet.callPublicFn(
      GOV_TOKEN, "transfer",
      [Cl.uint(999999n * ONE_TOKEN), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(8001)); // ERR-INSUFFICIENT-BALANCE
  });
});

// ============================================
// GOVERNANCE TOKEN — STAKING
// ============================================
describe("Enhanced Governance Token — Staking", () => {
  it("should stake tokens with lock period", () => {
    simnet.callPublicFn(GOV_TOKEN, "mint", [Cl.principal(wallet1), Cl.uint(1000n * ONE_TOKEN)], deployer);

    const result = simnet.callPublicFn(
      GOV_TOKEN, "stake",
      [Cl.uint(100n * ONE_TOKEN), Cl.uint(1008)], // 1008 blocks (~7 days, MIN_STAKE_PERIOD)
      wallet1
    );
    // Returns ve-tokens amount
    expect(result.result).toBeOk(expect.anything());
  });

  it("should reject stake below minimum amount", () => {
    simnet.callPublicFn(GOV_TOKEN, "mint", [Cl.principal(wallet2), Cl.uint(ONE_TOKEN)], deployer);

    const result = simnet.callPublicFn(
      GOV_TOKEN, "stake",
      [Cl.uint(1000n), Cl.uint(1008)], // Less than 1 token (min 100_000_000)
      wallet2
    );
    expect(result.result).toBeErr(Cl.uint(8002)); // ERR-INVALID-AMOUNT
  });

  it("should reject stake with too short lock period", () => {
    simnet.callPublicFn(GOV_TOKEN, "mint", [Cl.principal(wallet2), Cl.uint(10n * ONE_TOKEN)], deployer);

    const result = simnet.callPublicFn(
      GOV_TOKEN, "stake",
      [Cl.uint(ONE_TOKEN), Cl.uint(100)], // Below MIN_STAKE_PERIOD (1008)
      wallet2
    );
    expect(result.result).toBeErr(Cl.uint(8004)); // ERR-STAKE-TOO-SHORT
  });
});

// ============================================
// YIELD FARMING POOLS
// ============================================
describe("Yield Farming Pools — Pool Management", () => {
  it("should create a new farming pool", () => {
    const result = simnet.callPublicFn(
      YIELD_FARM, "create-pool",
      [
        Cl.stringAscii("sBTC-SOVT"),          // name
        Cl.principal(MOCK_SBTC),              // stake-token
        Cl.principal(MOCK_SBTC),              // reward-token
        Cl.stringAscii("SINGLE"),             // pool-type
        Cl.uint(1000),                        // allocation-points
        Cl.uint(100),                         // deposit-fee-bps
        Cl.uint(100),                         // withdrawal-fee-bps
        Cl.uint(144)                          // lock-period
      ],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1)); // Pool ID 1
  });

  it("should reject pool creation from non-owner", () => {
    const result = simnet.callPublicFn(
      YIELD_FARM, "create-pool",
      [
        Cl.stringAscii("Fake Pool"),
        Cl.principal(MOCK_SBTC),
        Cl.principal(MOCK_SBTC),
        Cl.stringAscii("SINGLE"),
        Cl.uint(1000),
        Cl.uint(100),
        Cl.uint(100),
        Cl.uint(144)
      ],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(9000)); // ERR-NOT-AUTHORIZED
  });

  it("should update pool allocation points", () => {
    simnet.callPublicFn(
      YIELD_FARM, "create-pool",
      [Cl.stringAscii("Test Pool"), Cl.principal(MOCK_SBTC), Cl.principal(MOCK_SBTC), Cl.stringAscii("SINGLE"), Cl.uint(500), Cl.uint(100), Cl.uint(100), Cl.uint(144)],
      deployer
    );

    const result = simnet.callPublicFn(
      YIELD_FARM, "update-pool-allocation",
      [Cl.uint(1), Cl.uint(2000)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject allocation update from non-owner", () => {
    simnet.callPublicFn(
      YIELD_FARM, "create-pool",
      [Cl.stringAscii("Pool"), Cl.principal(MOCK_SBTC), Cl.principal(MOCK_SBTC), Cl.stringAscii("SINGLE"), Cl.uint(500), Cl.uint(100), Cl.uint(100), Cl.uint(144)],
      deployer
    );

    const result = simnet.callPublicFn(
      YIELD_FARM, "update-pool-allocation",
      [Cl.uint(1), Cl.uint(2000)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(9000));
  });
});
