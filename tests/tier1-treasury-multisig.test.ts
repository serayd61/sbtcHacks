import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;

const MULTISIG = "treasury-multisig-v2";

// ============================================
// INITIALIZATION
// ============================================
describe("Treasury Multisig — Initialization", () => {
  it("should initialize with 3 signers", () => {
    const result = simnet.callPublicFn(
      MULTISIG, "initialize-signers",
      [Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)])],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject initialization with less than 3 signers", () => {
    const result = simnet.callPublicFn(
      MULTISIG, "initialize-signers",
      [Cl.list([Cl.principal(wallet1), Cl.principal(wallet2)])],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(7008)); // ERR-INVALID-SIGNER-COUNT
  });

  it("should reject initialization from non-owner", () => {
    const result = simnet.callPublicFn(
      MULTISIG, "initialize-signers",
      [Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)])],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(7006)); // ERR-NOT-AUTHORIZED
  });
});

// ============================================
// PROPOSAL FLOW
// ============================================
describe("Treasury Multisig — Proposals", () => {
  it("should allow signer to create a proposal", () => {
    // First init signers
    simnet.callPublicFn(
      MULTISIG, "initialize-signers",
      [Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)])],
      deployer
    );

    const result = simnet.callPublicFn(
      MULTISIG, "propose-action",
      [
        Cl.stringAscii("pause-vault"),
        Cl.some(Cl.principal(`${deployer}.vault-logic-v2`)),
        Cl.uint(0),
        Cl.uint(0),
        Cl.none(),
        Cl.stringAscii("Emergency pause needed")
      ],
      wallet1
    );
    expect(result.result).toBeOk(Cl.uint(1)); // First proposal ID
  });

  it("should reject proposal from non-signer", () => {
    simnet.callPublicFn(
      MULTISIG, "initialize-signers",
      [Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)])],
      deployer
    );

    const result = simnet.callPublicFn(
      MULTISIG, "propose-action",
      [
        Cl.stringAscii("pause-vault"),
        Cl.none(),
        Cl.uint(0),
        Cl.uint(0),
        Cl.none(),
        Cl.stringAscii("Unauthorized proposal")
      ],
      wallet4
    );
    expect(result.result).toBeErr(Cl.uint(7000)); // ERR-NOT-SIGNER
  });

  it("should reject invalid action type", () => {
    simnet.callPublicFn(
      MULTISIG, "initialize-signers",
      [Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)])],
      deployer
    );

    const result = simnet.callPublicFn(
      MULTISIG, "propose-action",
      [
        Cl.stringAscii("invalid-action"),
        Cl.none(),
        Cl.uint(0),
        Cl.uint(0),
        Cl.none(),
        Cl.stringAscii("Bad action")
      ],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(7011)); // ERR-INVALID-ACTION
  });
});

// ============================================
// APPROVAL FLOW
// ============================================
describe("Treasury Multisig — Approvals", () => {
  it("should allow second signer to approve", () => {
    simnet.callPublicFn(
      MULTISIG, "initialize-signers",
      [Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)])],
      deployer
    );

    // Create proposal
    simnet.callPublicFn(
      MULTISIG, "propose-action",
      [
        Cl.stringAscii("pause-vault"),
        Cl.some(Cl.principal(`${deployer}.vault-logic-v2`)),
        Cl.uint(0),
        Cl.uint(0),
        Cl.none(),
        Cl.stringAscii("Emergency pause")
      ],
      wallet1
    );

    // Second signer approves
    const result = simnet.callPublicFn(
      MULTISIG, "approve",
      [Cl.uint(1)],
      wallet2
    );
    expect(result.result).toBeOk(Cl.uint(2)); // 2 approvals total
  });

  it("should reject double approval from same signer", () => {
    simnet.callPublicFn(
      MULTISIG, "initialize-signers",
      [Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)])],
      deployer
    );

    simnet.callPublicFn(
      MULTISIG, "propose-action",
      [
        Cl.stringAscii("pause-vault"),
        Cl.none(),
        Cl.uint(0),
        Cl.uint(0),
        Cl.none(),
        Cl.stringAscii("Test")
      ],
      wallet1
    );

    // wallet1 already auto-approved via propose, try again
    const result = simnet.callPublicFn(
      MULTISIG, "approve",
      [Cl.uint(1)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(7002)); // ERR-ALREADY-APPROVED
  });
});
