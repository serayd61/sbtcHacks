import { describe, it, expect, beforeEach } from "vitest";
import { Cl, ClarityType } from "@stacks/transactions";

// Globals provided by clarinet-sdk vitest environment
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const MOCK_SBTC = `${deployer}.mock-sbtc`;
const VAULT = `${deployer}.sbtc-options-vault`;
const MARKET = `${deployer}.options-market`;
const ORACLE = `${deployer}.price-oracle`;

const ONE_SBTC = 100_000_000n; // 1 sBTC = 10^8 sats

describe("Mock sBTC Token", () => {
  it("should allow faucet mint of 1 sBTC", () => {
    const result = simnet.callPublicFn("mock-sbtc", "faucet", [], wallet1);
    expect(result.result).toBeOk(Cl.bool(true));

    const balance = simnet.callReadOnlyFn(
      "mock-sbtc",
      "get-balance",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect(balance.result).toBeOk(Cl.uint(ONE_SBTC));
  });

  it("should return correct token metadata", () => {
    const name = simnet.callReadOnlyFn("mock-sbtc", "get-name", [], wallet1);
    expect(name.result).toBeOk(Cl.stringAscii("Mock sBTC"));

    const symbol = simnet.callReadOnlyFn(
      "mock-sbtc",
      "get-symbol",
      [],
      wallet1
    );
    expect(symbol.result).toBeOk(Cl.stringAscii("sBTC"));

    const decimals = simnet.callReadOnlyFn(
      "mock-sbtc",
      "get-decimals",
      [],
      wallet1
    );
    expect(decimals.result).toBeOk(Cl.uint(8));
  });

  it("should allow admin to mint tokens", () => {
    const result = simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("should reject non-admin mint", () => {
    const result = simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(ONE_SBTC), Cl.principal(wallet2)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(1000));
  });
});

describe("Price Oracle", () => {
  it("should allow admin to set price", () => {
    const btcPrice = 85000_000000n; // $85,000 with 6 decimals
    const result = simnet.callPublicFn(
      "price-oracle",
      "set-btc-price",
      [Cl.uint(btcPrice)],
      deployer
    );
    expect(result.result).toBeOk(Cl.uint(btcPrice));
  });

  it("should return set price", () => {
    const btcPrice = 85000_000000n;
    simnet.callPublicFn(
      "price-oracle",
      "set-btc-price",
      [Cl.uint(btcPrice)],
      deployer
    );

    const price = simnet.callReadOnlyFn(
      "price-oracle",
      "get-btc-price-unchecked",
      [],
      wallet1
    );
    expect(price.result).toBeUint(btcPrice);
  });

  it("should reject non-admin set price", () => {
    const result = simnet.callPublicFn(
      "price-oracle",
      "set-btc-price",
      [Cl.uint(85000_000000n)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(2000));
  });

  it("should reject zero price", () => {
    const result = simnet.callPublicFn(
      "price-oracle",
      "set-btc-price",
      [Cl.uint(0)],
      deployer
    );
    expect(result.result).toBeErr(Cl.uint(2002));
  });
});

describe("sBTC Options Vault - Deposits & Withdrawals", () => {
  it("should accept deposits and mint shares", () => {
    // Mint sBTC for wallet1
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );

    // Deposit 1 sBTC
    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC)); // First deposit: 1:1 shares

    // Check vault info
    const vaultInfo = simnet.callReadOnlyFn(
      "sbtc-options-vault",
      "get-vault-info",
      [],
      wallet1
    );
    const info = vaultInfo.result;
    expect(info.type).toBe(ClarityType.ResponseOk);
  });

  it("should calculate correct share price for second depositor", () => {
    // Mint for both wallets
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet2)],
      deployer
    );

    // Wallet1 deposits 2 sBTC
    simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      wallet1
    );

    // Wallet2 deposits 1 sBTC
    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet2
    );
    // Should get proportional shares: 1 * 200000000 / 200000000 = 100000000
    expect(result.result).toBeOk(Cl.uint(ONE_SBTC));
  });

  it("should allow withdrawal and return correct sBTC", () => {
    // Mint and deposit
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      wallet1
    );

    // Withdraw all shares
    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "withdraw",
      [Cl.principal(MOCK_SBTC), Cl.uint(2n * ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeOk(Cl.uint(2n * ONE_SBTC));
  });

  it("should reject zero deposit", () => {
    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(0)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(3002));
  });

  it("should reject withdraw with insufficient shares", () => {
    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "withdraw",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(3003));
  });
});

describe("Full Epoch Lifecycle - OTM (Out of the Money)", () => {
  it("should complete a full OTM epoch: deposit -> epoch -> buy -> settle -> withdraw with profit", () => {
    // Setup: mint sBTC
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(10n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet2)],
      deployer
    );

    // Step 1: Wallet1 deposits 5 sBTC
    const depositResult = simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)],
      wallet1
    );
    expect(depositResult.result).toBeOk(Cl.uint(5n * ONE_SBTC));

    // Step 2: Set market contract
    simnet.callPublicFn(
      "sbtc-options-vault",
      "set-market-contract",
      [Cl.principal(MARKET)],
      deployer
    );

    // Step 3: Start epoch - strike $90k, premium 0.05 sBTC, 10 blocks duration
    const strikePrice = 90000_000000n;
    const premium = 5_000000n; // 0.05 sBTC
    const epochResult = simnet.callPublicFn(
      "sbtc-options-vault",
      "start-epoch",
      [Cl.uint(strikePrice), Cl.uint(premium), Cl.uint(10)],
      deployer
    );
    expect(epochResult.result).toBeOk(Cl.uint(1));

    // Step 4: Create listing on market
    const listingResult = simnet.callPublicFn(
      "options-market",
      "create-listing",
      [
        Cl.uint(1), // epoch-id
        Cl.uint(strikePrice),
        Cl.uint(premium),
        Cl.uint(5n * ONE_SBTC), // collateral
        Cl.uint(simnet.blockHeight + 10), // expiry
      ],
      deployer
    );
    expect(listingResult.result).toBeOk(Cl.uint(1));

    // Step 5: Wallet2 buys the option
    const buyResult = simnet.callPublicFn(
      "options-market",
      "buy-option",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)],
      wallet2
    );
    expect(buyResult.result).toBeOk(Cl.bool(true));

    // Step 6: Mine blocks to pass expiry
    simnet.mineEmptyBlocks(15);

    // Step 7: Settle OTM (price $85k < strike $90k)
    const settlementPrice = 85000_000000n;
    const settleResult = simnet.callPublicFn(
      "sbtc-options-vault",
      "settle-epoch",
      [
        Cl.principal(MOCK_SBTC),
        Cl.uint(1),
        Cl.uint(settlementPrice),
      ],
      deployer
    );
    expect(settleResult.result).toBeOk(
      Cl.tuple({ outcome: Cl.stringAscii("OTM"), payout: Cl.uint(0) })
    );

    // Step 8: Wallet1 withdraws - should get more than deposited (premium earned)
    const withdrawResult = simnet.callPublicFn(
      "sbtc-options-vault",
      "withdraw",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)],
      wallet1
    );
    // Should get 5 sBTC + premium (5_000000 sats)
    expect(withdrawResult.result).toBeOk(Cl.uint(5n * ONE_SBTC + premium));
  });
});

describe("Full Epoch Lifecycle - ITM (In the Money)", () => {
  it("should complete a full ITM epoch with buyer payout", () => {
    // Setup
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(10n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet2)],
      deployer
    );

    // Deposit
    simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)],
      wallet1
    );

    // Set market contract
    simnet.callPublicFn(
      "sbtc-options-vault",
      "set-market-contract",
      [Cl.principal(MARKET)],
      deployer
    );

    // Start epoch
    const strikePrice = 90000_000000n;
    const premium = 5_000000n;
    simnet.callPublicFn(
      "sbtc-options-vault",
      "start-epoch",
      [Cl.uint(strikePrice), Cl.uint(premium), Cl.uint(10)],
      deployer
    );

    // Create listing
    simnet.callPublicFn(
      "options-market",
      "create-listing",
      [
        Cl.uint(1),
        Cl.uint(strikePrice),
        Cl.uint(premium),
        Cl.uint(5n * ONE_SBTC),
        Cl.uint(simnet.blockHeight + 10),
      ],
      deployer
    );

    // Buy option
    simnet.callPublicFn(
      "options-market",
      "buy-option",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)],
      wallet2
    );

    // Mine blocks
    simnet.mineEmptyBlocks(15);

    // Settle ITM (price $95k > strike $90k)
    const settlementPrice = 95000_000000n;
    const settleResult = simnet.callPublicFn(
      "sbtc-options-vault",
      "settle-epoch",
      [
        Cl.principal(MOCK_SBTC),
        Cl.uint(1),
        Cl.uint(settlementPrice),
      ],
      deployer
    );

    // Payout = collateral * (95k - 90k) / 95k
    // = 500000000 * 5000000000 / 95000000000
    // = 26315789 sats (~0.263 sBTC)
    const expectedPayout = (5n * ONE_SBTC * 5000_000000n) / 95000_000000n;
    expect(settleResult.result).toBeOk(
      Cl.tuple({
        outcome: Cl.stringAscii("ITM"),
        payout: Cl.uint(expectedPayout),
      })
    );
  });
});

describe("Access Control", () => {
  it("should reject non-owner starting epoch", () => {
    // Need deposits first
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );

    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(3000));
  });

  it("should reject non-owner settling epoch", () => {
    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "settle-epoch",
      [Cl.principal(MOCK_SBTC), Cl.uint(1), Cl.uint(85000_000000n)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(3000));
  });

  it("should reject deposits during active epoch", () => {
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );

    // Start epoch
    simnet.callPublicFn(
      "sbtc-options-vault",
      "set-market-contract",
      [Cl.principal(MARKET)],
      deployer
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)],
      deployer
    );

    // Try to deposit during epoch
    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(3004));
  });

  it("should reject withdrawals during active epoch", () => {
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "set-market-contract",
      [Cl.principal(MARKET)],
      deployer
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(10)],
      deployer
    );

    const result = simnet.callPublicFn(
      "sbtc-options-vault",
      "withdraw",
      [Cl.principal(MOCK_SBTC), Cl.uint(ONE_SBTC)],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(3004));
  });
});

describe("Options Market", () => {
  it("should compute suggested premium", () => {
    const result = simnet.callReadOnlyFn(
      "options-market",
      "compute-suggested-premium",
      [
        Cl.uint(5n * ONE_SBTC), // collateral
        Cl.uint(90000_000000n), // strike
        Cl.uint(85000_000000n), // current price (OTM)
      ],
      wallet1
    );
    // OTM: just base premium = 1% of collateral = 5000000
    expect(result.result).toBeOk(Cl.uint(5_000000n));
  });

  it("should reject non-admin creating listing", () => {
    const result = simnet.callPublicFn(
      "options-market",
      "create-listing",
      [
        Cl.uint(1),
        Cl.uint(90000_000000n),
        Cl.uint(5_000000n),
        Cl.uint(5n * ONE_SBTC),
        Cl.uint(100),
      ],
      wallet1
    );
    expect(result.result).toBeErr(Cl.uint(4000));
  });

  it("should reject buying sold option", () => {
    // Setup full flow first
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(10n * ONE_SBTC), Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet2)],
      deployer
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "deposit",
      [Cl.principal(MOCK_SBTC), Cl.uint(5n * ONE_SBTC)],
      wallet1
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "set-market-contract",
      [Cl.principal(MARKET)],
      deployer
    );
    simnet.callPublicFn(
      "sbtc-options-vault",
      "start-epoch",
      [Cl.uint(90000_000000n), Cl.uint(5_000000n), Cl.uint(100)],
      deployer
    );
    simnet.callPublicFn(
      "options-market",
      "create-listing",
      [
        Cl.uint(1),
        Cl.uint(90000_000000n),
        Cl.uint(5_000000n),
        Cl.uint(5n * ONE_SBTC),
        Cl.uint(simnet.blockHeight + 100),
      ],
      deployer
    );

    // First buy succeeds
    simnet.callPublicFn(
      "options-market",
      "buy-option",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)],
      wallet2
    );

    // Mint more for wallet2 and try to buy again
    simnet.callPublicFn(
      "mock-sbtc",
      "mint",
      [Cl.uint(5n * ONE_SBTC), Cl.principal(wallet2)],
      deployer
    );
    const result = simnet.callPublicFn(
      "options-market",
      "buy-option",
      [Cl.principal(MOCK_SBTC), Cl.uint(1)],
      wallet2
    );
    expect(result.result).toBeErr(Cl.uint(4002));
  });
});
