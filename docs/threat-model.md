# sBTC Options Vault - Threat Model

**Version**: 1.0
**Date**: March 2026
**Scope**: All on-chain contracts, keeper bot, and indexer

---

## 1. Trust Boundaries

### On-chain Trust Zones

```
+------------------------------------------+
|           Zone 1: Admin (Owner)          |
|  - Deploy contracts                      |
|  - Set logic contract                    |
|  - Pause/unpause vault                   |
|  - Start/settle epochs                   |
|  - Emergency settle                      |
+------------------------------------------+
         |
         v
+------------------------------------------+
|        Zone 2: Authorized Contracts      |
|  - vault-logic-v2 writes to vault-data   |
|  - options-market-v2 records sales       |
|  - insurance-fund covers shortfalls      |
+------------------------------------------+
         |
         v
+------------------------------------------+
|           Zone 3: Public Users           |
|  - Deposit/withdraw sBTC                 |
|  - Buy options                           |
|  - Claim governance tokens               |
|  - Vote on proposals                     |
+------------------------------------------+
```

### Off-chain Trust Zones

```
+------------------------------------------+
|        Zone A: Keeper Bot (Server)       |
|  - Holds private key for tx signing      |
|  - Submits oracle prices                 |
|  - Manages epoch lifecycle               |
+------------------------------------------+
         |
         v
+------------------------------------------+
|      Zone B: External Price Sources      |
|  - CoinGecko API                         |
|  - Binance API                           |
|  - Kraken API                            |
+------------------------------------------+
```

---

## 2. Threat Categories

### T1: Admin Key Compromise

**Risk**: HIGH
**Impact**: Total loss of vault funds

**Attack Vector**:
- Attacker obtains deployer private key
- Can pause vault, settle epochs at arbitrary prices
- Can upgrade logic contract to drain funds
- Can set treasury to attacker address

**Mitigations**:
- [ ] 2-of-3 multisig via `admin-multisig.clar` (implemented, not yet enforced as sole admin)
- [ ] 144-block timelock on critical operations
- [ ] Hardware wallet for deployer key
- [ ] Transition to multisig-only admin access

**Residual Risk**: Multisig not yet enforced as mandatory; single admin key still active.

### T2: Oracle Manipulation

**Risk**: HIGH
**Impact**: Incorrect settlements, vault losses

**Attack Vectors**:
1. **Price feed manipulation**: Attacker compromises price source API
2. **Flash loan + settle**: Not applicable (Stacks doesn't have flash loans, but future risk)
3. **Stale price exploitation**: Using outdated price for favorable settlement
4. **Single source failure**: If one price source goes down

**Mitigations**:
- [x] Multi-source oracle with median calculation (3 sources)
- [x] Tolerance band: 2% max deviation from existing price
- [x] Staleness check: 12-block maximum age
- [ ] TWAP (Time-Weighted Average Price) not implemented
- [ ] Chainlink/Pyth integration for institutional-grade feeds

**Residual Risk**: All 3 sources (CoinGecko, Binance, Kraken) could be simultaneously compromised during extreme market conditions.

### T3: Economic Attacks

**Risk**: MEDIUM
**Impact**: Depositor losses, protocol insolvency

**Attack Vectors**:
1. **Bank run**: Mass withdrawals during ITM epoch
2. **Premium underpayment**: Options sold below fair value
3. **MEV/front-running**: Depositing right before premium, withdrawing after
4. **Insurance fund depletion**: Multiple ITM epochs draining insurance

**Mitigations**:
- [x] Withdrawal queue: max 25% TVL per 24h period
- [x] Deposits blocked during active epochs
- [x] Withdrawals blocked during active epochs
- [x] Insurance fund covers shortfalls
- [ ] Dynamic premium pricing based on market conditions (keeper calculates, but on-chain price is admin-set)

**Residual Risk**: Deep ITM scenarios where payout exceeds vault + insurance fund balance.

### T4: Smart Contract Bugs

**Risk**: MEDIUM
**Impact**: Locked funds, incorrect state

**Attack Vectors**:
1. **Reentrancy**: Clarity prevents reentrancy by design (no dynamic dispatch)
2. **Integer overflow**: Clarity uses safe math (panics on overflow)
3. **Logic errors**: Incorrect settlement calculation, share price manipulation
4. **State inconsistency**: Data-logic desync during upgrade

**Mitigations**:
- [x] Clarity's built-in safety (no reentrancy, safe math)
- [x] Settlement price validation (> 0)
- [x] Epoch duration validation (> 0)
- [x] Payout cap at vault balance
- [x] 97 unit tests covering edge cases
- [ ] Formal verification
- [ ] External audit

**Residual Risk**: Logic errors in complex settlement calculations; untested edge cases.

### T5: Keeper Bot Compromise

**Risk**: MEDIUM
**Impact**: Incorrect oracle prices, missed settlements

**Attack Vectors**:
1. **Private key theft**: Attacker submits wrong prices
2. **Code injection**: Malicious dependency in keeper bot
3. **DoS**: Keeper goes offline, epochs not settled
4. **Configuration tampering**: Wrong strike/premium parameters

**Mitigations**:
- [x] Keeper runs in dry-run mode without private key
- [x] Oracle tolerance band prevents extreme price deviations
- [x] Monitor alerts for keeper health
- [x] Manual settlement fallback (admin can settle directly)
- [ ] Keeper key rotation mechanism
- [ ] Separate keeper for oracle vs epoch management
- [ ] Rate limiting on oracle submissions

**Residual Risk**: Single keeper key has both oracle and epoch management authority.

### T6: Governance Attacks

**Risk**: LOW (governance is new, limited supply)
**Impact**: Protocol parameter changes

**Attack Vectors**:
1. **Vote buying**: Acquiring GOV tokens to pass malicious proposals
2. **Flash governance**: Buying tokens, voting, selling
3. **Quorum manipulation**: Low participation enabling minority control
4. **Parameter griefing**: Setting fees to 0% or extreme values

**Mitigations**:
- [x] 10% quorum requirement
- [x] 7-day voting period (prevents flash attacks)
- [x] 24-hour execution delay
- [x] 14-day proposal expiry
- [x] 1000 GOV minimum to create proposal
- [ ] Voting power snapshot at proposal creation (not implemented - uses live balance)
- [ ] Parameter bounds validation (e.g., fee cannot exceed 50%)

**Residual Risk**: No voting snapshot means tokens can be transferred between votes; no parameter bounds.

### T7: Indexer/Frontend Attacks

**Risk**: LOW
**Impact**: Misleading data, phishing

**Attack Vectors**:
1. **Chainhook payload injection**: Fake events via webhook
2. **Frontend data manipulation**: Showing wrong TVL/prices
3. **Phishing**: Fake frontend mimicking official site

**Mitigations**:
- [x] Indexer validates contract identifiers
- [x] Frontend reads directly from chain for critical data
- [ ] Webhook authentication for Chainhook
- [ ] Content Security Policy headers
- [ ] Subresource Integrity for CDN assets

**Residual Risk**: Indexer webhook endpoint is unauthenticated.

---

## 3. Attack Scenarios

### Scenario A: Malicious Settlement

**Steps**:
1. Attacker compromises admin key
2. Starts epoch with very low strike price
3. Buys option themselves at minimal premium
4. Settles epoch at very high price -> maximum payout
5. Claims payout, draining vault

**Detection**: TVL monitoring alerts on sudden drop
**Prevention**: Multisig + timelock for settlement
**Recovery**: Insurance fund + emergency pause

### Scenario B: Oracle Price Manipulation

**Steps**:
1. Attacker manipulates price source API response
2. Keeper submits manipulated price
3. Epoch settled at wrong price -> incorrect payout

**Detection**: Tolerance band rejects extreme deviations
**Prevention**: Multi-source median, staleness check
**Recovery**: Emergency settle at correct price (admin)

### Scenario C: Withdrawal Queue Bypass

**Steps**:
1. Attacker creates multiple wallets
2. Deposits sBTC from all wallets
3. Withdraws 25% from each wallet simultaneously

**Detection**: Total withdrawal monitoring
**Prevention**: Per-vault (not per-user) withdrawal limit
**Recovery**: N/A (design is correct - limit is vault-wide)

---

## 4. Severity Rating

| Threat | Likelihood | Impact | Severity | Status |
|--------|-----------|--------|----------|--------|
| T1: Admin Key | Low | Critical | HIGH | Mitigated (multisig) |
| T2: Oracle | Medium | High | HIGH | Partially Mitigated |
| T3: Economic | Medium | High | MEDIUM | Mitigated (queue + insurance) |
| T4: Contract Bugs | Low | High | MEDIUM | Testing in place |
| T5: Keeper | Low | Medium | MEDIUM | Partially Mitigated |
| T6: Governance | Low | Medium | LOW | Basic protections |
| T7: Indexer | Low | Low | LOW | Minimal risk |

---

## 5. Recommendations for Audit

### Priority 1 (Critical)
- [ ] Formal audit of settlement calculation in `vault-logic-v2.clar`
- [ ] Review share price manipulation vectors
- [ ] Validate withdrawal queue cannot be bypassed
- [ ] Review data-logic separation for state consistency during upgrades

### Priority 2 (High)
- [ ] Oracle price feed reliability under network congestion
- [ ] Insurance fund solvency modeling under extreme scenarios
- [ ] Governance voting power snapshot mechanism
- [ ] Fee calculation edge cases (zero TVL, zero shares)

### Priority 3 (Medium)
- [ ] Keeper bot security review (dependency audit)
- [ ] Chainhook webhook authentication
- [ ] Frontend security headers and CSP
- [ ] Parameter bounds validation in governance voting

### Recommended Auditors
- CoinFabrik (Clarity expertise)
- Least Authority (cryptographic security)
- Consensys Diligence (DeFi protocol experience)

---

## 6. Incident Response Plan

### Detection
1. Monitor alerts on TVL drop > 10%
2. Oracle staleness alerts (> 8 blocks)
3. Keeper health monitoring (wallet balance, uptime)
4. Community reporting via Discord

### Response
1. **Assess**: Determine scope and nature of incident
2. **Pause**: Call `set-vault-paused(true)` if necessary
3. **Emergency Settle**: Settle any active epoch at fair price
4. **Communicate**: Notify community via official channels
5. **Remediate**: Deploy fixes, update logic contract
6. **Post-mortem**: Publish detailed incident report

### Recovery
1. Verify vault state consistency
2. Unpause vault
3. Resume normal operations
4. Compensate affected users if applicable (insurance fund)
