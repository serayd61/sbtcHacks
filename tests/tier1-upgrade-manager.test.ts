import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const UPGRADE_MGR = "upgrade-manager-v1";

// ============================================
// SETUP & REGISTRATION
// ============================================
describe("Upgrade Manager — Initial Registration", () => {
  it("should register initial implementation", () => {
    const result = simnet.callPublicFn(
      UPGRADE_MGR, "register-initial-implementation",
      [Cl.stringAscii("vault-logic"), Cl.principal(`${deployer}.vault-logic-v2`)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject duplicate registration", () => {
    simnet.callPublicFn(
      UPGRADE_MGR, "register-initial-implementation",
      [Cl.stringAscii("vault-logic"), Cl.principal(`${deployer}.vault-logic-v2`)],
      deployer
    );

    const result = simnet.callPublicFn(
      UPGRADE_MGR, "register-initial-implementation",
      [Cl.stringAscii("vault-logic"), Cl.principal(`${deployer}.vault-logic-v2`)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(8005)); // ERR-INVALID-CONTRACT
  });

  it("should reject registration from non-owner", () => {
    const result = simnet.callPublicFn(
      UPGRADE_MGR, "register-initial-implementation",
      [Cl.stringAscii("oracle"), Cl.principal(`${deployer}.price-oracle-v2`)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(8000)); // ERR-NOT-AUTHORIZED
  });
});

// ============================================
// PROPOSE UPGRADES
// ============================================
describe("Upgrade Manager — Propose Upgrades", () => {
  it("should allow deployer to propose upgrade", () => {
    simnet.callPublicFn(
      UPGRADE_MGR, "register-initial-implementation",
      [Cl.stringAscii("vault-logic"), Cl.principal(`${deployer}.vault-logic-v2`)],
      deployer
    );

    const result = simnet.callPublicFn(
      UPGRADE_MGR, "propose-upgrade",
      [
        Cl.stringAscii("vault-logic"),
        Cl.principal(`${deployer}.vault-logic-v2`),
        Cl.stringAscii("normal"),
        Cl.stringAscii("Upgrade vault to v3 with enhanced security")
      ],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1)); // First upgrade ID
  });

  it("should reject upgrade for unregistered contract", () => {
    const result = simnet.callPublicFn(
      UPGRADE_MGR, "propose-upgrade",
      [
        Cl.stringAscii("nonexistent"),
        Cl.principal(`${deployer}.vault-logic-v2`),
        Cl.stringAscii("normal"),
        Cl.stringAscii("Should fail")
      ],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(8005)); // ERR-INVALID-CONTRACT
  });
});

// ============================================
// CANCEL UPGRADE
// ============================================
describe("Upgrade Manager — Cancel Upgrade", () => {
  it("should allow deployer to cancel proposed upgrade", () => {
    simnet.callPublicFn(
      UPGRADE_MGR, "register-initial-implementation",
      [Cl.stringAscii("vault-logic"), Cl.principal(`${deployer}.vault-logic-v2`)],
      deployer
    );

    simnet.callPublicFn(
      UPGRADE_MGR, "propose-upgrade",
      [
        Cl.stringAscii("vault-logic"),
        Cl.principal(`${deployer}.vault-logic-v2`),
        Cl.stringAscii("normal"),
        Cl.stringAscii("Test upgrade")
      ],
      deployer
    );

    const result = simnet.callPublicFn(
      UPGRADE_MGR, "cancel-upgrade",
      [Cl.uint(1)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });
});

// ============================================
// GOVERNANCE CONFIG
// ============================================
describe("Upgrade Manager — Governance Config", () => {
  it("should set governance contract", () => {
    const result = simnet.callPublicFn(
      UPGRADE_MGR, "set-governance-contract",
      [Cl.principal(`${deployer}.governance-voting`)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject governance set from non-owner", () => {
    const result = simnet.callPublicFn(
      UPGRADE_MGR, "set-governance-contract",
      [Cl.principal(`${deployer}.governance-voting`)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(8000));
  });
});
