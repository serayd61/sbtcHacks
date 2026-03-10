# Smart Contract Security Issues — V3 Deployment Required

These security issues exist in the **deployed contracts** and cannot be fixed without deploying new contract versions.

## CRITICAL — Must Fix in V3

### C-1: Arbitrary Token Parameter in Deposit/Withdraw
**Contracts:** `sbtc-options-vault.clar`, `vault-logic-v2.clar`
**Impact:** VAULT DRAIN — attacker mints shares for free with a fake token

The `deposit` and `withdraw` functions accept an arbitrary `<sip-010-token>` trait parameter.
An attacker can pass a custom token that always returns `(ok true)` without transferring anything,
minting vault shares for free and withdrawing real sBTC.

**Fix:** Hardcode the expected sBTC token contract address. Do not accept it as a parameter.

### C-2: transfer-payout Allows Unrestricted Admin Fund Transfer
**Contracts:** `sbtc-options-vault.clar`, `vault-logic-v2.clar`
**Impact:** RUG PULL — deployer can transfer all vault funds to any address

The `transfer-payout` function only checks `tx-sender == CONTRACT-OWNER` with no cap on amount
and no verification that it corresponds to a legitimate payout.

**Fix:** Only allow the market contract to call this. Track pending payouts per epoch.

### C-3: Manual settle-epoch Accepts Arbitrary Settlement Price
**Contracts:** `sbtc-options-vault.clar`, `vault-logic-v2.clar`
**Impact:** Admin can manipulate epoch outcomes

**Fix:** Remove manual `settle-epoch`. Only allow `settle-epoch-with-oracle`.

### C-6: Emergency Settle Always Forces OTM (Zero Payout)
**Contract:** `vault-logic-v2.clar`
**Impact:** ITM option buyers lose their rightful payout

**Fix:** Compute actual payout in emergency settlements, or add timelock requirement.

## HIGH — Should Fix in V3

### H-1: Multisig Has No Execute Function
**Contract:** `admin-multisig.clar`
**Impact:** Multisig is purely cosmetic — all admin power is in single deployer key

**Fix:** Implement `execute` function that dispatches approved proposals.

### H-3: Oracle Price Walking (Gradual Manipulation)
**Contract:** `price-oracle-v2.clar`
**Impact:** 2% tolerance can be bypassed over multiple submissions

**Fix:** Add cumulative deviation check within a time window.

### H-4: Admin set-btc-price Bypasses Tolerance Check
**Contract:** `price-oracle-v2.clar`
**Impact:** Admin can set any price before settling

**Fix:** Require multisig + timelock for direct price setting.

### H-5: No Median — Single Submitter Price Accepted
**Contract:** `price-oracle-v2.clar`
**Impact:** Single compromised key manipulates oracle

**Fix:** Implement actual median calculation from multiple submitters.

### H-7: Division-by-Zero in Deposit When State Is Inconsistent
**Contracts:** `sbtc-options-vault.clar`, `vault-logic-v2.clar`
**Impact:** Vault permanently unable to accept deposits

**Fix:** Add guard for `total-sbtc == 0 && total-shares > 0`.

### H-8: Withdrawal Underflow for Last Withdrawer
**Contracts:** `sbtc-options-vault.clar`, `vault-logic-v2.clar`
**Impact:** Last user's withdrawal fails, trapping dust

**Fix:** Give last withdrawer entire remaining balance.

## MEDIUM

### M-1: Mock sBTC Faucet Has No Rate Limiting on Mainnet
### M-5: Governance Voting Susceptible to Flash-Loan Style Attacks
### M-7: initialize-params Can Be Called Repeatedly
### M-9: expire-unsold Has No Access Control (minor griefing)
### M-10: Claim Payout Uses Epoch-Level Payout (fragile)

---

**Action:** Deploy V3 contracts with these fixes before significant TVL growth.
**Priority:** C-1 and C-2 are immediate fund-at-risk issues.
