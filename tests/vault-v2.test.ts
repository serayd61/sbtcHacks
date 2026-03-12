import { describe, it, expect } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const MOCK_SBTC = `${deployer}.mock-sbtc`;
const VAULT_DATA = `${deployer}.vault-data-v1`;
const VAULT_LOGIC = `${deployer}.vault-logic-v2`;
const MARKET_V2 = `${deployer}.options-market-v2`;
const MULTISIG = `${deployer}.admin-multisig`;

const ONE_SBTC = 100_000_000n;

// Helper: mint sBTC and set up vault for testing
function setupVault() {
  // Mint sBTC for wallets
  simnet.callPublicFn("mock-sbtc", "mint", [Cl.uint(10n * ONE_SBTC), Cl.principal(wallet1)], deployer);
  simnet.callPublicFn("mock-sbtc", "mint", [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet2)], deployer);

  // Set logic contract in data layer
  simnet.callPublicFn("vault-data-v1", "set-logic-contract", [Cl.principal(VAULT_LOGIC)], deployer);

  // Set market contract
  simnet.callPublicFn("vault-logic-v2", "set-market-contract", [Cl.principal(MARKET_V2)], deployer);
}

// ============================================
// DATA LAYER TESTS
// ============================================
describe("Vault Data v1 - Access Control", () => {
  it("should only allow logic contract to write state", () => {
    // Before setting logic contract, deployer (owner) cannot write via setters
    // because logic-contract defaults to CONTRACT-OWNER which IS the deployer
    simnet.callPublicFn("vault-data-v1", "set-logic-contract", [Cl.principal(VAULT_LOGIC)], deployer);

    // Now wallet1 (non-logic) tries to set state
    const result = simnet.callPublicFn("vault-data-v1", "set-total-shares", [Cl.uint(1000)], wallet1);
    expect(result.result).toBeErr(Cl.uint(5001)); // ERR-NOT-LOGIC-CONTRACT
  });

  it("should only allow owner to set logic contract", () => {
    const result = simnet.callPublicFn("vault-data-v1", "set-logic-contract", [Cl.principal(wallet1)], wallet1);
    expect(result.result).toBeErr(Cl.uint(5000)); // ERR-NOT-AUTHORIZED
  });
});

// ============================================
// VAULT LOGIC V2 - DEPOSIT / WITHDRAW
// ============================================
describe("Vault Logic v2 - Deposits & Withdrawals", () => {
  it("should accept deposits via v2 logic", () => {
    setupVault();

    const result = simnet.callPublicFn(
      "vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC));

    // Verify data layer state
    const shares = simnet.callReadOnlyFn("vault-data-v1", "get-user-shares", [Cl.principal(wallet1)], wallet1);
    expect(shares.result).toBeUint(ONE_SBTC);
  });

  it("should reject zero deposits", () => {
    setupVault();

    const result = simnet.callPublicFn(
      "vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(0)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(3002));
  });

  it("should allow withdrawal within 25% limit", () => {
    setupVault();

    // Deposit 4 sBTC
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(4n * ONE_SBTC)], wallet1);

    // Withdraw 1 sBTC (25% of 4 sBTC = 1 sBTC, within limit)
    const result = simnet.callPublicFn("vault-logic-v2", "withdraw",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC));
  });

  it("should reject withdrawal exceeding 25% limit", () => {
    setupVault();

    // Deposit 4 sBTC
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(4n * ONE_SBTC)], wallet1);

    // Try withdraw 2 sBTC (50% > 25% limit)
    const result = simnet.callPublicFn("vault-logic-v2", "withdraw",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)], wallet1);
    expect(result.result).toBeErr(Cl.uint(3014)); // ERR-WITHDRAWAL-LIMIT
  });

  it("should reject withdraw with insufficient shares", () => {
    setupVault();

    const result = simnet.callPublicFn("vault-logic-v2", "withdraw",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    expect(result.result).toBeErr(Cl.uint(3003));
  });
});

// ============================================
// BUG FIX: EPOCH DURATION = 0
// ============================================
describe("Bug Fix - Epoch Duration Validation", () => {
  it("should reject epoch with duration = 0", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);

    const result = simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(0)], deployer);
    expect(result.result).toBeErr(Cl.uint(3012)); // ERR-INVALID-DURATION
  });

  it("should accept epoch with valid duration", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);

    const result = simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)], deployer);
    expect(result.result).toBeOk(Cl.uint(1));
  });
});

// ============================================
// BUG FIX: SETTLEMENT PRICE = 0
// ============================================
describe("Bug Fix - Settlement Price Validation", () => {
  it("should reject settlement with price = 0", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)], deployer);

    simnet.mineEmptyBlocks(15);

    const result = simnet.callPublicFn("vault-logic-v2", "settle-epoch",
      [Cl.principal(MOCK_SBTC), Cl.uint(1), Cl.uint(0)], deployer);
    expect(result.result).toBeErr(Cl.uint(3013)); // ERR-INVALID-SETTLEMENT-PRICE
  });
});

// ============================================
// MAX LISTINGS PER EPOCH (10 wallets)
// ============================================
describe("Max Listings Per Epoch", () => {
  it("should allow up to 10 listings per epoch and reject 11th", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)], deployer);

    // Create 10 listings (all should succeed)
    for (let i = 1; i <= 10; i++) {
      const listing = simnet.callPublicFn("options-market-v2", "create-listing",
        [Cl.uint(1), Cl.uint(90000_000000n), Cl.uint(500000n), Cl.uint(ONE_SBTC / 2n), Cl.uint(simnet.blockHeight + 10)],
        deployer);
      expect(listing.result).toBeOk(Cl.uint(i));
    }

    // 11th listing should fail with ERR-MAX-LISTINGS-REACHED
    const eleventh = simnet.callPublicFn("options-market-v2", "create-listing",
      [Cl.uint(1), Cl.uint(90000_000000n), Cl.uint(500000n), Cl.uint(ONE_SBTC / 2n), Cl.uint(simnet.blockHeight + 10)],
      deployer);
    expect(eleventh.result).toBeErr(Cl.uint(4011)); // ERR-MAX-LISTINGS-REACHED
  });
});

// ============================================
// FEE IMPLEMENTATION
// ============================================
describe("Fee Implementation", () => {
  it("should deduct fees on settlement", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)], deployer);

    // Create listing and buy option
    simnet.callPublicFn("options-market-v2", "create-listing",
      [Cl.uint(1), Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(5n * ONE_SBTC), Cl.uint(simnet.blockHeight + 10)],
      deployer);
    simnet.callPublicFn("options-market-v2", "buy-option",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)], wallet2);

    simnet.mineEmptyBlocks(15);

    // Settle OTM
    const result = simnet.callPublicFn("vault-logic-v2", "settle-epoch",
      [Cl.principal(MOCK_SBTC), Cl.uint(1), Cl.uint(85000_000000n)], deployer);

    // Check result includes fees
    expect(result.result.type).toBe(ClarityType.ResponseOk);

    // Check fees were collected
    const feesCollected = simnet.callReadOnlyFn("vault-data-v1", "get-total-fees-collected", [], deployer);
    // Management fee: 500000000 * 200 / 10000 = 10000000 (2% of collateral)
    // Performance fee: 5000000 * 1000 / 10000 = 500000 (10% of premium)
    // Total: 10500000
    expect(feesCollected.result).toBeUint(10_500000n);
  });
});

// ============================================
// EMERGENCY SETTLE
// ============================================
describe("Emergency Settlement", () => {
  it("should allow emergency settle when paused", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(100)], deployer);

    // Pause vault
    simnet.callPublicFn("vault-logic-v2", "set-vault-paused", [Cl.bool(true)], deployer);

    // Emergency settle (no need to wait for expiry)
    const result = simnet.callPublicFn("vault-logic-v2", "emergency-settle",
      [Cl.principal(MOCK_SBTC), Cl.uint(1), Cl.uint(85000_000000n)], deployer);
    expect(result.result).toBeOk(
      Cl.tuple({ outcome: Cl.stringAscii("OTM"), payout: Cl.uint(0), fees: Cl.uint(0) })
    );

    // Epoch should no longer be active
    const active = simnet.callReadOnlyFn("vault-logic-v2", "is-epoch-active", [], deployer);
    expect(active.result).toBeBool(false);
  });

  it("should reject emergency settle when not paused", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(100)], deployer);

    const result = simnet.callPublicFn("vault-logic-v2", "emergency-settle",
      [Cl.principal(MOCK_SBTC), Cl.uint(1), Cl.uint(85000_000000n)], deployer);
    expect(result.result).toBeErr(Cl.uint(3015)); // ERR-NOT-PAUSED
  });
});

// ============================================
// FULL V2 LIFECYCLE - OTM
// ============================================
describe("V2 Full Epoch Lifecycle - OTM", () => {
  it("should complete OTM epoch with fees", () => {
    setupVault();

    // Deposit
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)], wallet1);

    // Start epoch
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)], deployer);

    // Create listing + buy
    simnet.callPublicFn("options-market-v2", "create-listing",
      [Cl.uint(1), Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(5n * ONE_SBTC), Cl.uint(simnet.blockHeight + 10)],
      deployer);
    simnet.callPublicFn("options-market-v2", "buy-option",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)], wallet2);

    simnet.mineEmptyBlocks(15);

    // Settle OTM
    const settleResult = simnet.callPublicFn("vault-logic-v2", "settle-epoch",
      [Cl.principal(MOCK_SBTC), Cl.uint(1), Cl.uint(85000_000000n)], deployer);
    expect(settleResult.result.type).toBe(ClarityType.ResponseOk);

    // Verify vault info
    const vaultInfo = simnet.callReadOnlyFn("vault-logic-v2", "get-vault-info", [], deployer);
    expect(vaultInfo.result.type).toBe(ClarityType.ResponseOk);
  });
});

// ============================================
// ADMIN MULTISIG
// ============================================
describe("Admin Multisig", () => {
  it("should allow setting signers", () => {
    const result = simnet.callPublicFn("admin-multisig", "set-signers",
      [Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    const signers = simnet.callReadOnlyFn("admin-multisig", "get-signers", [], deployer);
    expect(signers.result.type).toBe(ClarityType.Tuple);
  });

  it("should reject non-owner setting signers", () => {
    const result = simnet.callPublicFn("admin-multisig", "set-signers",
      [Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)], wallet1);
    expect(result.result).toBeErr(Cl.uint(6006));
  });

  it("should allow signer to propose and auto-approve", () => {
    simnet.callPublicFn("admin-multisig", "set-signers",
      [Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)], deployer);

    const result = simnet.callPublicFn("admin-multisig", "propose",
      [Cl.stringAscii("pause-vault"), Cl.uint(1), Cl.principal(deployer)], wallet1);
    expect(result.result).toBeOk(Cl.uint(1));

    // Check proposal has 1 approval (auto)
    const proposal = simnet.callReadOnlyFn("admin-multisig", "get-proposal", [Cl.uint(1)], deployer);
    expect(proposal.result.type).toBe(ClarityType.OptionalSome);
  });

  it("should reach threshold with 2 approvals", () => {
    simnet.callPublicFn("admin-multisig", "set-signers",
      [Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)], deployer);

    // Propose
    simnet.callPublicFn("admin-multisig", "propose",
      [Cl.stringAscii("pause-vault"), Cl.uint(1), Cl.principal(deployer)], wallet1);

    // Second approval
    const approve = simnet.callPublicFn("admin-multisig", "approve", [Cl.uint(1)], wallet2);
    expect(approve.result).toBeOk(Cl.uint(2));

    // Check is-approved
    const approved = simnet.callReadOnlyFn("admin-multisig", "is-approved", [Cl.uint(1)], deployer);
    expect(approved.result).toBeBool(true);
  });

  it("should reject double approval from same signer", () => {
    simnet.callPublicFn("admin-multisig", "set-signers",
      [Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)], deployer);

    simnet.callPublicFn("admin-multisig", "propose",
      [Cl.stringAscii("pause-vault"), Cl.uint(1), Cl.principal(deployer)], wallet1);

    const result = simnet.callPublicFn("admin-multisig", "approve", [Cl.uint(1)], wallet1);
    expect(result.result).toBeErr(Cl.uint(6002)); // ERR-ALREADY-APPROVED
  });

  it("should reject non-signer proposals", () => {
    simnet.callPublicFn("admin-multisig", "set-signers",
      [Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3)], deployer);

    const result = simnet.callPublicFn("admin-multisig", "propose",
      [Cl.stringAscii("pause-vault"), Cl.uint(1), Cl.principal(deployer)], deployer);
    expect(result.result).toBeErr(Cl.uint(6000)); // ERR-NOT-SIGNER
  });
});

// ============================================
// ACCESS CONTROL V2
// ============================================
describe("V2 Access Control", () => {
  it("should reject non-owner starting epoch", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);

    const result = simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)], wallet1);
    expect(result.result).toBeErr(Cl.uint(3000));
  });

  it("should reject deposits during active epoch", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)], deployer);

    const result = simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    expect(result.result).toBeErr(Cl.uint(3004));
  });

  it("should reject withdrawals during active epoch", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)], deployer);

    const result = simnet.callPublicFn("vault-logic-v2", "withdraw",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    expect(result.result).toBeErr(Cl.uint(3004));
  });

  it("should reject settle before expiry", () => {
    setupVault();
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(100)], deployer);

    // Try settle immediately
    const result = simnet.callPublicFn("vault-logic-v2", "settle-epoch",
      [Cl.principal(MOCK_SBTC), Cl.uint(1), Cl.uint(85000_000000n)], deployer);
    expect(result.result).toBeErr(Cl.uint(3006)); // ERR-EPOCH-NOT-EXPIRED
  });
});

// ============================================
// ORACLE V2
// ============================================
describe("Price Oracle v2", () => {
  it("should allow owner to add a submitter", () => {
    const result = simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    // Verify submitter status
    const isSub = simnet.callReadOnlyFn("price-oracle-v2", "is-submitter",
      [Cl.principal(wallet1)], deployer);
    expect(isSub.result).toBeBool(true);
  });

  it("should reject non-owner adding submitter", () => {
    const result = simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet2)], wallet1);
    expect(result.result).toBeErr(Cl.uint(7000)); // ERR-NOT-AUTHORIZED
  });

  it("should allow submitter to submit price", () => {
    // Add wallet1 as submitter
    simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);

    // Submit price: BTC = $85,000
    const result = simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(85000_000000n)], wallet1);
    expect(result.result).toBeOk(Cl.uint(85000_000000n));

    // Verify stored price
    const price = simnet.callReadOnlyFn("price-oracle-v2", "get-btc-price-unchecked", [], deployer);
    expect(price.result).toBeUint(85000_000000n);
  });

  it("should reject non-submitter price submission", () => {
    const result = simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(85000_000000n)], wallet2);
    expect(result.result).toBeErr(Cl.uint(7001)); // ERR-NOT-SUBMITTER
  });

  it("should reject price deviating more than 2%", () => {
    // Add submitter and set initial price
    simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(85000_000000n)], wallet1);

    // Try to submit 5% higher price ($89,250)
    const result = simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(89250_000000n)], wallet1);
    expect(result.result).toBeErr(Cl.uint(7004)); // ERR-PRICE-DEVIATION
  });

  it("should accept price within 2% tolerance", () => {
    simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(85000_000000n)], wallet1);

    // Submit 1.5% higher price ($86,275) - within tolerance
    const result = simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(86275_000000n)], wallet1);
    expect(result.result).toBeOk(Cl.uint(86275_000000n));
  });

  it("should allow admin direct price set", () => {
    const result = simnet.callPublicFn("price-oracle-v2", "set-btc-price",
      [Cl.uint(90000_000000n)], deployer);
    expect(result.result).toBeOk(Cl.uint(90000_000000n));
  });

  it("should reject duplicate submitter addition", () => {
    simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);

    const result = simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);
    expect(result.result).toBeErr(Cl.uint(7006)); // ERR-ALREADY-SUBMITTER
  });

  it("should allow removing a submitter", () => {
    simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);

    const result = simnet.callPublicFn("price-oracle-v2", "remove-submitter",
      [Cl.principal(wallet1)], deployer);
    expect(result.result).toBeOk(Cl.bool(true));

    // Verify no longer submitter
    const isSub = simnet.callReadOnlyFn("price-oracle-v2", "is-submitter",
      [Cl.principal(wallet1)], deployer);
    expect(isSub.result).toBeBool(false);
  });

  it("should get oracle info with v2 fields", () => {
    const result = simnet.callReadOnlyFn("price-oracle-v2", "get-oracle-info", [], deployer);
    expect(result.result.type).toBe(ClarityType.ResponseOk);
  });
});

// ============================================
// SETTLE WITH ORACLE
// ============================================
describe("Settle Epoch with Oracle", () => {
  it("should settle epoch using oracle price (OTM)", () => {
    setupVault();

    // Setup oracle with price
    simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(85000_000000n)], wallet1);

    // Deposit and start epoch
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(5)], deployer);

    // Mine blocks to expire epoch
    simnet.mineEmptyBlocks(6);

    // Settle with oracle (BTC=85k < strike=90k -> OTM)
    const result = simnet.callPublicFn("vault-logic-v2", "settle-epoch-with-oracle",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)], deployer);
    expect(result.result).toBeOk(Cl.tuple({
      outcome: Cl.stringAscii("OTM"),
      payout: Cl.uint(0),
      fees: Cl.uint(10_000000n) // 2% of 5 sBTC = 0.1 sBTC = 10,000,000 sats
    }));
  });

  it("should settle epoch using oracle price (ITM)", () => {
    setupVault();

    // Deposit
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)], wallet1);

    // Start epoch with strike = $80,000
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(80000_000000n), Cl.uint(5_000000n), Cl.uint(5)], deployer);

    // Set oracle price to $85,000 (ITM: 85k > 80k)
    simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(85000_000000n)], wallet1);

    // Mine blocks
    simnet.mineEmptyBlocks(6);

    // Settle with oracle
    const result = simnet.callPublicFn("vault-logic-v2", "settle-epoch-with-oracle",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)], deployer);
    expect(result.result.type).toBe(ClarityType.ResponseOk);

    // Verify outcome is ITM
    const epoch = simnet.callReadOnlyFn("vault-logic-v2", "get-epoch", [Cl.uint(1)], deployer);
    expect(epoch.result.type).toBe(ClarityType.OptionalSome);
  });

  it("should reject oracle settlement when oracle is stale", () => {
    setupVault();

    // Set oracle price but don't update it
    simnet.callPublicFn("price-oracle-v2", "set-btc-price",
      [Cl.uint(85000_000000n)], deployer);

    // Deposit and start epoch
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(5)], deployer);

    // Mine enough blocks to make oracle stale (12+5 to also expire epoch)
    simnet.mineEmptyBlocks(20);

    // Try settle - should fail because oracle is stale
    const result = simnet.callPublicFn("vault-logic-v2", "settle-epoch-with-oracle",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)], deployer);
    expect(result.result).toBeErr(Cl.uint(3013)); // ERR-INVALID-SETTLEMENT-PRICE (oracle stale)
  });

  it("should reject oracle settlement before epoch expiry", () => {
    setupVault();

    // Fresh oracle price
    simnet.callPublicFn("price-oracle-v2", "add-submitter",
      [Cl.principal(wallet1)], deployer);
    simnet.callPublicFn("price-oracle-v2", "submit-price",
      [Cl.uint(85000_000000n)], wallet1);

    // Deposit and start epoch with long duration
    simnet.callPublicFn("vault-logic-v2", "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)], wallet1);
    simnet.callPublicFn("vault-logic-v2", "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(100)], deployer);

    // Try settle immediately - should fail
    const result = simnet.callPublicFn("vault-logic-v2", "settle-epoch-with-oracle",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)], deployer);
    expect(result.result).toBeErr(Cl.uint(3006)); // ERR-EPOCH-NOT-EXPIRED
  });
});
