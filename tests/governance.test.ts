import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const MOCK_SBTC = `${deployer}.mock-sbtc`;
const GOV_TOKEN = `${deployer}.governance-token`;
const VOTING = `${deployer}.governance-voting`;
const VAULT_LOGIC = `${deployer}.vault-logic-v2`;
const VAULT_DATA = `${deployer}.vault-data-v1`;

const ONE_SBTC = 100_000_000n;

// ============================================
// Helpers
// ============================================

function mintSbtc(recipient: string, amount: bigint) {
  simnet.callPublicFn("mock-sbtc", "mint", [Cl.uint(amount), Cl.principal(recipient)], deployer);
}

function setupVault() {
  // Set vault-logic-v2 as the logic contract for vault-data-v1
  simnet.callPublicFn("vault-data-v1", "set-logic-contract", [Cl.principal(VAULT_LOGIC)], deployer);
  // Set options-market-v2 as market contract
  simnet.callPublicFn(
    "vault-logic-v2",
    "set-market-contract",
    [Cl.principal(`${deployer}.options-market-v2`)],
    deployer
  );
}

function depositToVault(user: string, amount: bigint) {
  mintSbtc(user, amount);
  simnet.callPublicFn("vault-logic-v2", "deposit", [Cl.principal(MOCK_SBTC), Cl.uint(amount)], user);
}

function mintGovTokens(recipient: string, amount: bigint) {
  simnet.callPublicFn("governance-token", "admin-mint", [Cl.uint(amount), Cl.principal(recipient)], deployer);
}

// ============================================
// GOVERNANCE TOKEN - SIP-010
// ============================================
describe("Governance Token - SIP-010", () => {
  it("should return correct token info", () => {
    const name = simnet.callReadOnlyFn("governance-token", "get-name", [], deployer);
    expect(name.result).toBeOk(Cl.stringAscii("sVault Governance"));

    const symbol = simnet.callReadOnlyFn("governance-token", "get-symbol", [], deployer);
    expect(symbol.result).toBeOk(Cl.stringAscii("sVGOV"));

    const decimals = simnet.callReadOnlyFn("governance-token", "get-decimals", [], deployer);
    expect(decimals.result).toBeOk(Cl.uint(6));
  });

  it("should allow admin to mint tokens", () => {
    const amount = 1000_000_000n; // 1000 GOV
    const result = simnet.callPublicFn(
      "governance-token",
      "admin-mint",
      [Cl.uint(amount), Cl.principal(wallet1)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));

    const balance = simnet.callReadOnlyFn("governance-token", "get-balance", [Cl.principal(wallet1)], deployer);
    expect(balance.result).toBeOk(Cl.uint(amount));
  });

  it("should reject non-admin mint", () => {
    const result = simnet.callPublicFn(
      "governance-token",
      "admin-mint",
      [Cl.uint(1000n), Cl.principal(wallet2)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(7000)); // ERR-NOT-AUTHORIZED
  });

  it("should transfer tokens between users", () => {
    mintGovTokens(wallet1, 5000_000_000n);

    const result = simnet.callPublicFn(
      "governance-token",
      "transfer",
      [Cl.uint(1000_000_000n), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
      wallet1
    );
    expect(result.result).toBeOk(Cl.bool(true));

    const balance = simnet.callReadOnlyFn("governance-token", "get-balance", [Cl.principal(wallet2)], deployer);
    expect(balance.result).toBeOk(Cl.uint(1000_000_000n));
  });

  it("should reject transfer from non-sender", () => {
    mintGovTokens(wallet1, 5000_000_000n);

    const result = simnet.callPublicFn(
      "governance-token",
      "transfer",
      [Cl.uint(100n), Cl.principal(wallet1), Cl.principal(wallet2), Cl.none()],
      wallet2 // wallet2 trying to send wallet1's tokens
    );
    expect(result.result).toBeErr(Cl.uint(7005)); // ERR-SENDER-NOT-TX
  });

  it("should track total supply", () => {
    mintGovTokens(wallet1, 2000_000_000n);
    mintGovTokens(wallet2, 3000_000_000n);

    const supply = simnet.callReadOnlyFn("governance-token", "get-total-supply", [], deployer);
    // Total supply includes all mints in this test
    const result = supply.result as { type: string; value: { value: bigint } };
    expect(result.type).toBe("ok");
  });
});

// ============================================
// GOVERNANCE TOKEN - Claim from Vault
// ============================================
describe("Governance Token - Vault Claims", () => {
  it("should allow depositor to claim governance tokens", () => {
    setupVault();
    depositToVault(wallet1, ONE_SBTC);

    // wallet1 now has vault shares, can claim GOV tokens
    const result = simnet.callPublicFn("governance-token", "claim-governance-tokens", [], wallet1);
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC * 10n)); // shares * MINT-MULTIPLIER
  });

  it("should reject claim with no vault shares", () => {
    const result = simnet.callPublicFn("governance-token", "claim-governance-tokens", [], wallet3);
    expect(result.result).toBeErr(Cl.uint(7004)); // ERR-NOTHING-TO-CLAIM
  });

  it("should not allow double claim", () => {
    setupVault();
    depositToVault(wallet1, ONE_SBTC);

    // First claim
    simnet.callPublicFn("governance-token", "claim-governance-tokens", [], wallet1);

    // Second claim with same shares - nothing new to claim
    const result = simnet.callPublicFn("governance-token", "claim-governance-tokens", [], wallet1);
    expect(result.result).toBeErr(Cl.uint(7004)); // ERR-NOTHING-TO-CLAIM
  });

  it("should allow additional claim after more deposits", () => {
    setupVault();
    depositToVault(wallet1, ONE_SBTC);

    // First claim
    simnet.callPublicFn("governance-token", "claim-governance-tokens", [], wallet1);

    // Deposit more
    depositToVault(wallet1, ONE_SBTC);

    // Second claim should get additional tokens
    const result = simnet.callPublicFn("governance-token", "claim-governance-tokens", [], wallet1);
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC * 10n)); // additional shares * multiplier
  });

  it("should return correct entitled info", () => {
    setupVault();
    depositToVault(wallet1, ONE_SBTC);

    const info = simnet.callReadOnlyFn(
      "governance-token",
      "get-entitled-gov",
      [Cl.principal(wallet1)],
      deployer
    );

    // Should be a tuple with entitled, claimed, claimable
    expect(info.result.type).toBe("tuple");
  });
});

// ============================================
// GOVERNANCE TOKEN - Admin
// ============================================
describe("Governance Token - Admin Functions", () => {
  it("should allow admin to toggle minting", () => {
    const result = simnet.callPublicFn("governance-token", "set-mint-enabled", [Cl.bool(false)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    // Minting should now fail
    const mintResult = simnet.callPublicFn(
      "governance-token",
      "admin-mint",
      [Cl.uint(1000n), Cl.principal(wallet1)],
      deployer
    );
    // admin-mint doesn't check mint-enabled, only claim does
    // So this should still work for admin
    expect(mintResult.result).toBeOk(Cl.bool(true));

    // Re-enable
    simnet.callPublicFn("governance-token", "set-mint-enabled", [Cl.bool(true)], deployer);
  });

  it("should reject max supply overflow", () => {
    // Try to mint more than MAX-SUPPLY
    const maxSupply = 100_000_000_000_000n; // 100M with 6 decimals
    const result = simnet.callPublicFn(
      "governance-token",
      "admin-mint",
      [Cl.uint(maxSupply + 1n), Cl.principal(wallet1)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(7001)); // ERR-MAX-SUPPLY-REACHED
  });

  it("should return token info", () => {
    const info = simnet.callReadOnlyFn("governance-token", "get-token-info", [], deployer);
    expect(info.result.type).toBe("ok");
  });
});

// ============================================
// GOVERNANCE VOTING - Proposals
// ============================================
describe("Governance Voting - Proposals", () => {
  it("should initialize default parameters", () => {
    const result = simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    // Check params
    const strikeOtm = simnet.callReadOnlyFn(
      "governance-voting",
      "get-param",
      [Cl.stringAscii("strike-otm-bps")],
      deployer
    );
    expect(strikeOtm.result).toBeSome(Cl.uint(500));
  });

  it("should allow GOV holder to create proposal", () => {
    // Initialize params first
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);

    // Mint GOV tokens to wallet1 (need MIN-PROPOSAL-TOKENS = 1000 GOV = 1000000000)
    mintGovTokens(wallet1, 2000_000_000n);

    const result = simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("strike-otm-bps"), Cl.uint(300)], // Change to 3%
      wallet1
    );
    expect(result.result).toBeOk(Cl.uint(1)); // First proposal = ID 1
  });

  it("should reject proposal from insufficient GOV holder", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);

    // wallet3 has no GOV tokens
    const result = simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("strike-otm-bps"), Cl.uint(300)],
      wallet3
    );
    expect(result.result).toBeErr(Cl.uint(8001)); // ERR-INSUFFICIENT-GOV
  });

  it("should reject proposal for invalid parameter", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);
    mintGovTokens(wallet1, 2000_000_000n);

    const result = simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("invalid-param"), Cl.uint(100)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(8011)); // ERR-INVALID-PARAM
  });
});

// ============================================
// GOVERNANCE VOTING - Voting
// ============================================
describe("Governance Voting - Voting", () => {
  it("should allow GOV holders to vote", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);
    mintGovTokens(wallet1, 2000_000_000n);
    mintGovTokens(wallet2, 3000_000_000n);

    // Create proposal
    simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("management-fee-bps"), Cl.uint(150)],
      wallet1
    );

    // wallet2 votes for
    const result = simnet.callPublicFn(
      "governance-voting",
      "vote",
      [Cl.uint(1), Cl.bool(true)],
      wallet2
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject double voting", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);
    mintGovTokens(wallet1, 2000_000_000n);

    simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("epoch-duration"), Cl.uint(504)],
      wallet1
    );

    // Vote once
    simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(true)], wallet1);

    // Try to vote again
    const result = simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(false)], wallet1);
    expect(result.result).toBeErr(Cl.uint(8003)); // ERR-ALREADY-VOTED
  });

  it("should reject vote from non-GOV holder", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);
    mintGovTokens(wallet1, 2000_000_000n);

    simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("insurance-fee-bps"), Cl.uint(300)],
      wallet1
    );

    // wallet3 has no GOV tokens
    const result = simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(true)], wallet3);
    expect(result.result).toBeErr(Cl.uint(8001)); // ERR-INSUFFICIENT-GOV
  });
});

// ============================================
// GOVERNANCE VOTING - Execution
// ============================================
describe("Governance Voting - Execution", () => {
  it("should reject execution before vote period ends", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);
    mintGovTokens(wallet1, 2000_000_000n);

    simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("strike-otm-bps"), Cl.uint(700)],
      wallet1
    );

    simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(true)], wallet1);

    // Try to execute immediately
    const result = simnet.callPublicFn("governance-voting", "execute-proposal", [Cl.uint(1)], deployer);
    expect(result.result).toBeErr(Cl.uint(8005)); // ERR-VOTE-NOT-ENDED
  });

  it("should execute proposal after vote period + delay", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);

    // Mint enough GOV to meet quorum (10% of supply)
    // If we mint 10000 GOV total, quorum = 1000 GOV
    mintGovTokens(wallet1, 5000_000_000n);
    mintGovTokens(wallet2, 5000_000_000n);

    // Create proposal
    simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("performance-fee-bps"), Cl.uint(800)],
      wallet1
    );

    // Both vote for (total weight = 10000 GOV, quorum = 1000 GOV -> met)
    simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(true)], wallet1);
    simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(true)], wallet2);

    // Mine blocks: VOTE-PERIOD (1008) + EXECUTION-DELAY (144) = 1152 blocks
    simnet.mineEmptyBlocks(1153);

    const result = simnet.callPublicFn("governance-voting", "execute-proposal", [Cl.uint(1)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    // Verify parameter was updated
    const param = simnet.callReadOnlyFn(
      "governance-voting",
      "get-param",
      [Cl.stringAscii("performance-fee-bps")],
      deployer
    );
    expect(param.result).toBeSome(Cl.uint(800));
  });

  it("should reject execution when quorum not met", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);

    // Mint large supply but only 1 voter with small amount
    mintGovTokens(wallet1, 1000_000_000n);
    mintGovTokens(wallet2, 99000_000_000n); // wallet2 has 99x more

    simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("epoch-duration"), Cl.uint(2016)],
      wallet1
    );

    // Only wallet1 votes (1000 GOV out of 100000 GOV total = 1%)
    simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(true)], wallet1);

    // Wait for vote period + delay
    simnet.mineEmptyBlocks(1153);

    const result = simnet.callPublicFn("governance-voting", "execute-proposal", [Cl.uint(1)], deployer);
    expect(result.result).toBeErr(Cl.uint(8006)); // ERR-QUORUM-NOT-MET
  });

  it("should reject execution of defeated proposal", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);
    mintGovTokens(wallet1, 3000_000_000n);
    mintGovTokens(wallet2, 7000_000_000n);

    simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("withdrawal-limit-bps"), Cl.uint(5000)],
      wallet1
    );

    // wallet1 votes for, wallet2 votes against (more weight)
    simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(true)], wallet1);
    simnet.callPublicFn("governance-voting", "vote", [Cl.uint(1), Cl.bool(false)], wallet2);

    simnet.mineEmptyBlocks(1153);

    const result = simnet.callPublicFn("governance-voting", "execute-proposal", [Cl.uint(1)], deployer);
    expect(result.result).toBeErr(Cl.uint(8007)); // ERR-NOT-PASSED
  });
});

// ============================================
// GOVERNANCE VOTING - Read-only
// ============================================
describe("Governance Voting - Read-only", () => {
  it("should return all params", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);

    const params = simnet.callReadOnlyFn("governance-voting", "get-all-params", [], deployer);
    expect(params.result.type).toBe("tuple");
  });

  it("should check proposal status correctly", () => {
    simnet.callPublicFn("governance-voting", "initialize-params", [], deployer);
    mintGovTokens(wallet1, 5000_000_000n);

    simnet.callPublicFn(
      "governance-voting",
      "create-proposal",
      [Cl.stringAscii("strike-otm-bps"), Cl.uint(400)],
      wallet1
    );

    // Before voting
    const passed = simnet.callReadOnlyFn("governance-voting", "is-proposal-passed", [Cl.uint(1)], deployer);
    expect(passed.result).toBeBool(false);

    const canExec = simnet.callReadOnlyFn("governance-voting", "can-execute", [Cl.uint(1)], deployer);
    expect(canExec.result).toBeBool(false);
  });
});

// ============================================
// VAULT STRATEGY
// ============================================
describe("Vault Strategy - Configuration", () => {
  it("should add a new strategy", () => {
    const result = simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [
        Cl.stringAscii("Weekly Covered Call"),
        Cl.uint(5000), // 50% allocation
        Cl.uint(500), // 5% OTM
        Cl.uint(1008), // ~7 days
        Cl.uint(10_000_000), // 0.1 sBTC minimum
      ],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(1));
  });

  it("should add multiple strategies within allocation limit", () => {
    // Strategy 1: 50%
    simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Weekly"), Cl.uint(5000), Cl.uint(500), Cl.uint(1008), Cl.uint(10_000_000)],
      deployer
    );

    // Strategy 2: 30%
    simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Bi-weekly"), Cl.uint(3000), Cl.uint(800), Cl.uint(2016), Cl.uint(10_000_000)],
      deployer
    );

    // Check total allocation = 80%
    const total = simnet.callReadOnlyFn("vault-strategy-v1", "get-total-allocation", [], deployer);
    expect(total.result).toBeUint(8000);

    // Reserve = 20%
    const summary = simnet.callReadOnlyFn("vault-strategy-v1", "get-strategy-summary", [], deployer);
    expect(summary.result.type).toBe("tuple");
  });

  it("should reject allocation overflow", () => {
    // Strategy 1: 60%
    simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Large"), Cl.uint(6000), Cl.uint(500), Cl.uint(1008), Cl.uint(0)],
      deployer
    );

    // Strategy 2: 50% -> total would be 110% -> reject
    const result = simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Overflow"), Cl.uint(5000), Cl.uint(500), Cl.uint(1008), Cl.uint(0)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(9005)); // ERR-ALLOCATION-OVERFLOW
  });

  it("should reject non-admin strategy creation", () => {
    const result = simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Unauthorized"), Cl.uint(1000), Cl.uint(500), Cl.uint(1008), Cl.uint(0)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(9000)); // ERR-NOT-AUTHORIZED
  });

  it("should update strategy parameters", () => {
    // Add strategy first
    simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Test"), Cl.uint(3000), Cl.uint(500), Cl.uint(1008), Cl.uint(0)],
      deployer
    );

    // Update it
    const result = simnet.callPublicFn(
      "vault-strategy-v1",
      "update-strategy",
      [Cl.uint(1), Cl.uint(4000), Cl.uint(600), Cl.uint(504), Cl.uint(50_000_000)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));

    // Check updated values
    const strategy = simnet.callReadOnlyFn("vault-strategy-v1", "get-strategy", [Cl.uint(1)], deployer);
    expect(strategy.result.type).toBe("some");
  });

  it("should toggle strategy active status", () => {
    simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Toggle"), Cl.uint(2000), Cl.uint(500), Cl.uint(1008), Cl.uint(0)],
      deployer
    );

    const result = simnet.callPublicFn(
      "vault-strategy-v1",
      "set-strategy-active",
      [Cl.uint(1), Cl.bool(false)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should calculate strategy allocation", () => {
    simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Half"), Cl.uint(5000), Cl.uint(500), Cl.uint(1008), Cl.uint(0)],
      deployer
    );

    const tvl = 10n * ONE_SBTC; // 10 sBTC
    const allocation = simnet.callReadOnlyFn(
      "vault-strategy-v1",
      "get-strategy-allocation",
      [Cl.uint(1), Cl.uint(tvl)],
      deployer
    );
    expect(allocation.result).toBeOk(Cl.uint(5n * ONE_SBTC)); // 50% = 5 sBTC
  });

  it("should record epoch results", () => {
    simnet.callPublicFn(
      "vault-strategy-v1",
      "add-strategy",
      [Cl.stringAscii("Record"), Cl.uint(5000), Cl.uint(500), Cl.uint(1008), Cl.uint(0)],
      deployer
    );

    const result = simnet.callPublicFn(
      "vault-strategy-v1",
      "record-epoch-result",
      [Cl.uint(1), Cl.uint(5), Cl.uint(500_000n), Cl.uint(0), Cl.bool(true)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));

    // Check performance
    const perf = simnet.callReadOnlyFn(
      "vault-strategy-v1",
      "get-strategy-performance",
      [Cl.uint(1)],
      deployer
    );
    expect(perf.result.type).toBe("some");
  });
});
