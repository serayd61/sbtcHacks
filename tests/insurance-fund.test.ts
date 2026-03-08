import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const MOCK_SBTC = `${deployer}.mock-sbtc`;
const INSURANCE = `${deployer}.insurance-fund`;

const ONE_SBTC = 100_000_000n;

// Helper: mint sBTC for testing
function mintSbtc(recipient: string, amount: bigint) {
  simnet.callPublicFn("mock-sbtc", "mint", [Cl.uint(amount), Cl.principal(recipient)], deployer);
}

// ============================================
// ADMIN FUNCTIONS
// ============================================
describe("Insurance Fund — Admin", () => {
  it("should allow admin to deposit into fund", () => {
    mintSbtc(deployer, 10n * ONE_SBTC);

    const result = simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));

    // Check balance
    const balance = simnet.callReadOnlyFn("insurance-fund", "get-balance", [], deployer);
    expect(balance.result).toBeUint(ONE_SBTC);
  });

  it("should reject non-admin deposit", () => {
    const result = simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(6000)); // ERR-NOT-AUTHORIZED
  });

  it("should reject zero amount deposit", () => {
    const result = simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(0)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(6001)); // ERR-ZERO-AMOUNT
  });

  it("should allow admin to set vault contract", () => {
    const vaultAddr = `${deployer}.vault-logic-v2`;
    const result = simnet.callPublicFn(
      "insurance-fund", "set-vault-contract",
      [Cl.principal(vaultAddr)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject non-admin setting vault contract", () => {
    const result = simnet.callPublicFn(
      "insurance-fund", "set-vault-contract",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(6000));
  });
});

// ============================================
// EMERGENCY WITHDRAWAL (with timelock)
// ============================================
describe("Insurance Fund — Emergency Withdrawal", () => {
  it("should queue emergency withdrawal", () => {
    mintSbtc(deployer, 5n * ONE_SBTC);

    // Deposit first
    simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      deployer
    );

    // Queue withdrawal
    const result = simnet.callPublicFn(
      "insurance-fund", "queue-emergency-withdraw",
      [Cl.uint(ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject withdrawal before timelock expires", () => {
    mintSbtc(deployer, 5n * ONE_SBTC);

    simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      deployer
    );

    simnet.callPublicFn(
      "insurance-fund", "queue-emergency-withdraw",
      [Cl.uint(ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );

    // Try execute immediately (should fail — 144 block delay)
    const result = simnet.callPublicFn(
      "insurance-fund", "execute-emergency-withdraw",
      [Cl.principal(MOCK_SBTC)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(6005)); // ERR-WITHDRAW-TOO-EARLY
  });

  it("should allow withdrawal after timelock expires", () => {
    mintSbtc(deployer, 5n * ONE_SBTC);

    simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      deployer
    );

    simnet.callPublicFn(
      "insurance-fund", "queue-emergency-withdraw",
      [Cl.uint(ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );

    // Mine 145 blocks to pass timelock (144 block delay)
    simnet.mineEmptyBlocks(145);

    const result = simnet.callPublicFn(
      "insurance-fund", "execute-emergency-withdraw",
      [Cl.principal(MOCK_SBTC)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC));

    // Check balance decreased
    const balance = simnet.callReadOnlyFn("insurance-fund", "get-balance", [], deployer);
    expect(balance.result).toBeUint(ONE_SBTC); // 2 - 1 = 1
  });

  it("should allow cancelling pending withdrawal", () => {
    mintSbtc(deployer, 5n * ONE_SBTC);

    simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      deployer
    );

    simnet.callPublicFn(
      "insurance-fund", "queue-emergency-withdraw",
      [Cl.uint(ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );

    const result = simnet.callPublicFn(
      "insurance-fund", "cancel-emergency-withdraw",
      [],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject cancel when no pending withdrawal", () => {
    const result = simnet.callPublicFn(
      "insurance-fund", "cancel-emergency-withdraw",
      [],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(6006)); // ERR-NO-PENDING-WITHDRAW
  });

  it("should reject queue with insufficient balance", () => {
    // Try to withdraw more than balance (fund should be 0 or small)
    const result = simnet.callPublicFn(
      "insurance-fund", "queue-emergency-withdraw",
      [Cl.uint(999n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(6002)); // ERR-INSUFFICIENT-BALANCE
  });
});

// ============================================
// SHORTFALL COVERAGE
// ============================================
describe("Insurance Fund — Shortfall Coverage", () => {
  it("should reject coverage from non-vault caller", () => {
    mintSbtc(deployer, 5n * ONE_SBTC);

    simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      deployer
    );

    // wallet1 is not vault contract -> should fail
    const result = simnet.callPublicFn(
      "insurance-fund", "cover-shortfall",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC), Cl.principal(wallet2)],
      wallet1
    );
    // wallet1 is not admin (CONTRACT-OWNER) and not vault contract
    // The or-check fails: contract-caller != vault, tx-sender != CONTRACT-OWNER
    expect(result.result).toBeErr(Cl.uint(6000)); // ERR-NOT-AUTHORIZED
  });

  it("should allow admin to cover shortfall directly", () => {
    mintSbtc(deployer, 5n * ONE_SBTC);

    simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      deployer
    );

    // Admin (CONTRACT-OWNER) can also trigger coverage
    const result = simnet.callPublicFn(
      "insurance-fund", "cover-shortfall",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC / 2n), Cl.principal(wallet1)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC / 2n));
  });

  it("should cap coverage at available balance", () => {
    mintSbtc(deployer, 5n * ONE_SBTC);

    simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      deployer
    );

    // Request more than available
    const result = simnet.callPublicFn(
      "insurance-fund", "cover-shortfall",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    // Should cover up to available balance
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC));
  });
});

// ============================================
// READ-ONLY FUNCTIONS
// ============================================
describe("Insurance Fund — Read-only", () => {
  it("should return fund info", () => {
    const result = simnet.callReadOnlyFn("insurance-fund", "get-fund-info", [], deployer);
    // Verify the result is an (ok ...) response
    expect(result.result.type).toBe("ok");
  });

  it("should return insurance fee bps", () => {
    const result = simnet.callReadOnlyFn("insurance-fund", "get-insurance-fee-bps", [], deployer);
    expect(result.result).toBeUint(500); // 5%
  });

  it("should return coverage capacity", () => {
    mintSbtc(deployer, 5n * ONE_SBTC);

    simnet.callPublicFn(
      "insurance-fund", "admin-deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(3n * ONE_SBTC)],
      deployer
    );

    const result = simnet.callReadOnlyFn("insurance-fund", "get-coverage-capacity", [], deployer);
    expect(result.result).toBeUint(3n * ONE_SBTC);
  });
});
