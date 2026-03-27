import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const CB = "circuit-breaker-v1";

// ============================================
// ACCESS CONTROL
// ============================================
describe("Circuit Breaker — Access Control", () => {
  it("should allow deployer to set governance contract", () => {
    const result = simnet.callPublicFn(
      CB, "set-governance",
      [Cl.principal(`${deployer}.governance-voting`)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject non-owner setting governance", () => {
    const result = simnet.callPublicFn(
      CB, "set-governance",
      [Cl.principal(`${wallet1}.governance-voting`)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(9000)); // ERR-NOT-AUTHORIZED
  });

  it("should allow deployer to authorize trigger address", () => {
    const result = simnet.callPublicFn(
      CB, "authorize-trigger",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject unauthorized trigger authorization", () => {
    const result = simnet.callPublicFn(
      CB, "authorize-trigger",
      [Cl.principal(wallet2)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(9000));
  });
});

// ============================================
// EMERGENCY TRIGGERS
// ============================================
describe("Circuit Breaker — Emergency Triggers", () => {
  it("should allow deployer to trigger emergency pause", () => {
    const result = simnet.callPublicFn(
      CB, "emergency-pause",
      [Cl.stringAscii("Critical vulnerability detected")],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should allow deployer to trigger partial pause", () => {
    const result = simnet.callPublicFn(
      CB, "partial-pause",
      [Cl.stringAscii("Unusual trading activity detected")],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject unauthorized emergency pause", () => {
    const result = simnet.callPublicFn(
      CB, "emergency-pause",
      [Cl.stringAscii("Hack attempt")],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(9000));
  });

  it("should reject unauthorized warning trigger", () => {
    const result = simnet.callPublicFn(
      CB, "trigger-warning",
      [Cl.stringAscii("Suspicious activity")],
      wallet2
    );
    expect(result.result).toBeErr(Cl.uint(9000));
  });
});

// ============================================
// TVL MONITORING
// ============================================
describe("Circuit Breaker — TVL Monitoring", () => {
  it("should reject threshold update from non-governance address", () => {
    // update-thresholds requires is-governance-call, deployer alone can't call
    const result = simnet.callPublicFn(
      CB, "update-thresholds",
      [Cl.uint(1500), Cl.uint(800), Cl.uint(10000)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(9000)); // ERR-NOT-AUTHORIZED (requires governance)
  });

  it("should reject threshold update from random wallet", () => {
    const result = simnet.callPublicFn(
      CB, "update-thresholds",
      [Cl.uint(1500), Cl.uint(800), Cl.uint(10000)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(9000));
  });
});

// ============================================
// FORCE RESUME
// ============================================
describe("Circuit Breaker — Force Resume", () => {
  it("should reject force resume from non-multisig address", () => {
    // force-resume requires is-multisig-call, deployer alone can't call
    simnet.callPublicFn(CB, "emergency-pause", [Cl.stringAscii("Test pause")], deployer);

    const result = simnet.callPublicFn(
      CB, "force-resume",
      [Cl.stringAscii("Issue resolved, resuming operations")],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(9000)); // ERR-NOT-AUTHORIZED (requires multisig)
  });
});
