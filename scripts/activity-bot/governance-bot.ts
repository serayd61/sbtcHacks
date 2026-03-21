/**
 * Governance Voting Bot
 *
 * Activates governance on sBTC Options Vault by:
 * 1. Initializing governance parameters (one-time)
 * 2. Distributing sVGOV tokens to 500 wallets via admin-mint
 * 3. Creating proposals that toggle harmless parameters
 * 4. Voting with 170 wallets/day (3-day spread)
 * 5. Executing passed proposals
 *
 * Usage:
 *   MASTER_PRIVATE_KEY=<deployer-hex-key> npx tsx governance-bot.ts --step <step>
 *
 * Steps: init, distribute, propose, vote, execute, daily, status
 */

import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  uintCV,
  stringAsciiCV,
  trueCV,
  standardPrincipalCV,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import { BOT_CONFIG, DEPLOYER } from "./config.js";
import { loadWallets } from "./wallet-generator.js";
import {
  getNextNonce,
  broadcastContractCall,
  processBatch,
  sleep,
  getSTXBalance,
  resetNonceCache,
} from "./utils.js";
import type { WalletEntry } from "./wallet-generator.js";
import fs from "fs";
import path from "path";

const GOV_TOKEN = BOT_CONFIG.contracts.governanceToken;
const GOV_VOTING = BOT_CONFIG.contracts.governanceVoting;
const GOV_CONFIG = BOT_CONFIG.governance;

// ============================================
// State Management
// ============================================

interface GovernanceState {
  tokensDistributed: boolean;
  paramsInitialized: boolean;
  currentProposalId: number;
  lastProposalCreatedAt: string | null;
  votingProgress: {
    proposalId: number;
    nextWalletIndex: number;
    totalVoted: number;
  };
  paramToggleIndex: number;
  executedProposals: number[];
}

const DEFAULT_STATE: GovernanceState = {
  tokensDistributed: false,
  paramsInitialized: false,
  currentProposalId: 0,
  lastProposalCreatedAt: null,
  votingProgress: {
    proposalId: 0,
    nextWalletIndex: 0,
    totalVoted: 0,
  },
  paramToggleIndex: 0,
  executedProposals: [],
};

function loadState(): GovernanceState {
  const filePath = path.resolve(GOV_CONFIG.stateFile);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {}
  return { ...DEFAULT_STATE };
}

function saveState(state: GovernanceState): void {
  const filePath = path.resolve(GOV_CONFIG.stateFile);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
}

// ============================================
// Read-only Helpers
// ============================================

async function readContract(
  contractName: string,
  functionName: string,
  args: any[] = []
): Promise<any> {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName,
    functionName,
    functionArgs: args,
    senderAddress: DEPLOYER,
    network: STACKS_MAINNET,
  });
  return cvToJSON(result);
}

async function getTenureHeight(): Promise<number> {
  const res = await fetch(`${BOT_CONFIG.apiUrl}/v2/info`);
  const data = (await res.json()) as { tenure_height: number };
  return data.tenure_height;
}

async function getProposalCount(): Promise<number> {
  const result = await readContract(GOV_VOTING, "get-proposal-count");
  return Number(result.value);
}

async function getProposal(id: number): Promise<any | null> {
  const result = await readContract(GOV_VOTING, "get-proposal", [uintCV(id)]);
  if (!result.value) return null;
  // (some (tuple ...)) -> may be double-wrapped by cvToJSON
  let data = result.value;
  if (data.value && !data["start-block"]) {
    data = data.value;
  }
  return {
    proposer: data.proposer?.value,
    paramKey: data["param-key"]?.value,
    paramValue: Number(data["param-value"]?.value ?? 0),
    votesFor: BigInt(data["votes-for"]?.value ?? 0),
    votesAgainst: BigInt(data["votes-against"]?.value ?? 0),
    startBlock: Number(data["start-block"]?.value ?? 0),
    executed: data.executed?.value === true,
  };
}

async function getGovTotalSupply(): Promise<bigint> {
  const result = await readContract(GOV_TOKEN, "get-total-supply");
  // (ok uint) -> unwrap ok wrapper
  const val = result.value?.value ?? result.value;
  return BigInt(val);
}

async function getParamValue(key: string): Promise<number | null> {
  const result = await readContract(GOV_VOTING, "get-param", [
    stringAsciiCV(key),
  ]);
  if (!result.value) return null;
  // (some uint) -> unwrap some wrapper
  return Number(result.value?.value ?? result.value);
}

// ============================================
// Step: Initialize Params (one-time)
// ============================================

async function stepInit(privateKey: string): Promise<void> {
  console.log(`\n--- Governance: Initialize Parameters ---`);

  // Check if already initialized
  const existing = await getParamValue("strike-otm-bps");
  if (existing !== null) {
    console.log(`  Parameters already initialized (strike-otm-bps = ${existing})`);
    const state = loadState();
    state.paramsInitialized = true;
    saveState(state);
    return;
  }

  const nonce = await getNextNonce(DEPLOYER);
  const txId = await broadcastContractCall({
    contractAddress: DEPLOYER,
    contractName: GOV_VOTING,
    functionName: "initialize-params",
    functionArgs: [],
    senderKey: privateKey,
    nonce,
  });

  if (txId) {
    console.log(`  initialize-params TX: ${txId}`);
    const state = loadState();
    state.paramsInitialized = true;
    saveState(state);
  } else {
    console.error(`  Failed to broadcast initialize-params`);
  }
}

// ============================================
// Step: Distribute GOV Tokens (one-time)
// ============================================

async function stepDistribute(privateKey: string): Promise<void> {
  console.log(`\n--- Governance: Distribute sVGOV Tokens ---`);

  const wallets = loadWallets();
  if (!wallets) {
    console.error("  No wallets.json found!");
    return;
  }

  const totalSupply = await getGovTotalSupply();
  const mintPerWallet = GOV_CONFIG.mintAmountPerWallet;
  const expectedTotal = BigInt(wallets.wallets.length) * mintPerWallet;

  console.log(`  Total supply: ${totalSupply} raw (${Number(totalSupply) / 1_000_000} sVGOV)`);
  console.log(`  Expected: ${expectedTotal} raw (${Number(expectedTotal) / 1_000_000} sVGOV)`);

  if (totalSupply >= expectedTotal) {
    console.log(`  Distribution complete! All wallets have tokens.`);
    const state = loadState();
    state.tokensDistributed = true;
    saveState(state);
    return;
  }

  // Estimate start index from total supply
  const estimatedDistributed = Number(totalSupply / mintPerWallet);
  // Allow --start=N CLI override
  const startArg = process.argv.find((a) => a.startsWith("--start="));
  let startIdx = startArg ? parseInt(startArg.split("=")[1]) : estimatedDistributed;

  // Verify boundary: check wallet[startIdx] balance to find exact start
  console.log(`  Estimated ${estimatedDistributed} wallets already have tokens`);
  console.log(`  Verifying boundary around wallet[${startIdx}]...`);

  // Check a few wallets around the estimated start to find exact boundary
  for (let check = Math.max(0, startIdx - 3); check <= Math.min(wallets.wallets.length - 1, startIdx + 3); check++) {
    try {
      const bal = await readContract(GOV_TOKEN, "get-balance", [
        standardPrincipalCV(wallets.wallets[check].address),
      ]);
      const balVal = BigInt(bal.value?.value ?? bal.value);
      if (balVal === 0n && check < startIdx) {
        startIdx = check; // Found a wallet without tokens earlier
      }
      console.log(`    wallet[${check}]: ${balVal > 0n ? "HAS tokens" : "NO tokens"}`);
      await sleep(300);
    } catch {
      console.log(`    wallet[${check}]: check failed`);
    }
  }

  const remaining = wallets.wallets.length - startIdx;
  console.log(`\n  Starting from wallet[${startIdx}], minting to ${remaining} wallets`);

  // Fetch deployer nonce once, then increment manually
  const nonceRes = await fetch(
    `${BOT_CONFIG.apiUrl}/extended/v1/address/${DEPLOYER}/nonces`
  );
  const nonceData = (await nonceRes.json()) as { possible_next_nonce: number };
  let nonce = BigInt(nonceData.possible_next_nonce);
  console.log(`  Starting nonce: ${nonce}`);

  let successful = 0;
  let failed = 0;
  const batchSize = BOT_CONFIG.batchSize;
  const walletsToMint = wallets.wallets.slice(startIdx);
  const totalBatches = Math.ceil(walletsToMint.length / batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, walletsToMint.length);
    const globalStart = startIdx + start;
    const globalEnd = startIdx + end;
    console.log(`  [GOV-MINT] Batch ${batch + 1}/${totalBatches} (wallet[${globalStart}]-[${globalEnd - 1}])`);

    for (let i = start; i < end; i++) {
      const wallet = walletsToMint[i];
      try {
        const txId = await broadcastContractCall({
          contractAddress: DEPLOYER,
          contractName: GOV_TOKEN,
          functionName: "admin-mint",
          functionArgs: [
            uintCV(GOV_CONFIG.mintAmountPerWallet),
            standardPrincipalCV(wallet.address),
          ],
          senderKey: privateKey,
          nonce,
        });

        if (txId) {
          successful++;
        } else {
          failed++;
        }
        nonce++;
      } catch (e: any) {
        console.error(`    #${startIdx + i} error: ${e.message}`);
        failed++;
        nonce++;
      }

      // Small delay between TXs to avoid rate limits
      await sleep(200);
    }

    console.log(`    Batch result: OK=${successful}, Failed=${failed} (of ${end} processed)`);

    // Wait between batches (except last)
    if (batch < totalBatches - 1) {
      console.log(`    Waiting ${BOT_CONFIG.batchDelayMs / 1000}s before next batch...`);
      await sleep(BOT_CONFIG.batchDelayMs);
    }
  }

  console.log(`\n  Distribution complete: ${successful} OK, ${failed} failed`);
  console.log(`  New estimated total: ${Number(totalSupply) / 1_000_000 + successful * 2000} sVGOV`);

  if (successful > 0) {
    const state = loadState();
    state.tokensDistributed = true;
    saveState(state);
  }
}

// ============================================
// Step: Create Proposal
// ============================================

async function stepPropose(wallets: WalletEntry[]): Promise<number | null> {
  console.log(`\n--- Governance: Create Proposal ---`);

  const state = loadState();

  // Pick next parameter to toggle
  const paramConfig =
    GOV_CONFIG.safeParams[state.paramToggleIndex % GOV_CONFIG.safeParams.length];

  // Determine new value (toggle between the two values)
  const currentValue = await getParamValue(paramConfig.key);
  const newValue =
    currentValue === paramConfig.values[1]
      ? paramConfig.values[0]
      : paramConfig.values[1];

  console.log(`  Parameter: ${paramConfig.key}`);
  console.log(`  Current value: ${currentValue}, New value: ${newValue}`);

  // wallet[0] creates the proposal
  const wallet = wallets[0];
  resetNonceCache();
  const nonce = await getNextNonce(wallet.address);

  const txId = await broadcastContractCall({
    contractAddress: DEPLOYER,
    contractName: GOV_VOTING,
    functionName: "create-proposal",
    functionArgs: [stringAsciiCV(paramConfig.key), uintCV(newValue)],
    senderKey: wallet.privateKey,
    nonce,
  });

  if (txId) {
    console.log(`  create-proposal TX: ${txId}`);

    // Read new proposal count (may need to wait for confirmation)
    // For now, increment locally
    const proposalCount = await getProposalCount();
    const newProposalId = proposalCount + 1; // Will be this after TX confirms

    state.currentProposalId = newProposalId;
    state.lastProposalCreatedAt = new Date().toISOString();
    state.paramToggleIndex++;
    state.votingProgress = {
      proposalId: newProposalId,
      nextWalletIndex: 0,
      totalVoted: 0,
    };
    saveState(state);

    console.log(`  Expected proposal ID: ${newProposalId}`);
    return newProposalId;
  } else {
    console.error(`  Failed to create proposal`);
    return null;
  }
}

// ============================================
// Step: Vote
// ============================================

async function stepVote(wallets: WalletEntry[]): Promise<void> {
  console.log(`\n--- Governance: Vote on Proposal ---`);

  const state = loadState();

  // Allow --reset-votes flag to restart voting from wallet[0]
  if (process.argv.includes("--reset-votes")) {
    console.log(`  Resetting vote progress (--reset-votes flag)`);
    state.votingProgress.nextWalletIndex = 0;
    state.votingProgress.totalVoted = 0;
    saveState(state);
  }

  const proposalId = state.votingProgress.proposalId;

  if (proposalId === 0) {
    console.log(`  No active proposal to vote on. Run propose first.`);
    return;
  }

  // Check proposal exists on-chain
  const proposal = await getProposal(proposalId);
  if (!proposal) {
    console.log(`  Proposal #${proposalId} not found on-chain (may be pending confirmation)`);
    console.log(`  Retrying with proposal ID ${proposalId - 1}...`);

    // Try previous ID in case our expected ID was wrong
    const prevProposal = await getProposal(proposalId - 1);
    if (prevProposal && !prevProposal.executed) {
      console.log(`  Found proposal #${proposalId - 1}, using it instead`);
      state.votingProgress.proposalId = proposalId - 1;
      state.currentProposalId = proposalId - 1;
      saveState(state);
    } else {
      console.log(`  No votable proposal found. Wait for TX confirmation.`);
      return;
    }
  }

  const activeProposalId = state.votingProgress.proposalId;
  const activeProposal = await getProposal(activeProposalId);

  if (activeProposal?.executed) {
    console.log(`  Proposal #${activeProposalId} already executed, skipping`);
    return;
  }

  // Check if voting period is still active
  const tenureHeight = await getTenureHeight();
  const voteEndBlock = activeProposal!.startBlock + 1008;
  if (tenureHeight >= voteEndBlock) {
    console.log(`  Voting period ended for proposal #${activeProposalId}`);
    console.log(`  tenure_height=${tenureHeight}, vote_end=${voteEndBlock}`);
    return;
  }

  const startIdx = state.votingProgress.nextWalletIndex;
  const count = Math.min(GOV_CONFIG.votesPerDay, wallets.length - startIdx);

  if (count <= 0) {
    console.log(`  All wallets have voted on proposal #${activeProposalId}`);
    return;
  }

  console.log(`  Proposal #${activeProposalId}: ${activeProposal!.paramKey} -> ${activeProposal!.paramValue}`);
  console.log(`  Voting wallets[${startIdx}..${startIdx + count - 1}] (${count} votes)`);
  console.log(`  Remaining voting blocks: ${voteEndBlock - tenureHeight}`);

  // Pre-fetch nonces in batches to avoid rate limiting during vote loop
  const voteWallets = wallets.slice(startIdx, startIdx + count);
  const nonceMap = new Map<string, bigint>();
  console.log(`  Pre-fetching nonces for ${count} wallets...`);
  const NONCE_BATCH = 10;
  for (let b = 0; b < voteWallets.length; b += NONCE_BATCH) {
    const batch = voteWallets.slice(b, b + NONCE_BATCH);
    for (const w of batch) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(
            `${BOT_CONFIG.apiUrl}/extended/v1/address/${w.address}/nonces`
          );
          if (res.status === 429) {
            const backoff = (attempt + 1) * 10000;
            await sleep(backoff);
            continue;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { possible_next_nonce: number };
          nonceMap.set(w.address, BigInt(data.possible_next_nonce));
          break;
        } catch {
          if (attempt === 2) nonceMap.set(w.address, 0n); // fallback
        }
      }
      await sleep(300); // 300ms between individual fetches within batch
    }
    if (b + NONCE_BATCH < voteWallets.length) {
      console.log(`    Nonces fetched: ${Math.min(b + NONCE_BATCH, voteWallets.length)}/${count}`);
      await sleep(3000); // 3s between batches
    }
  }
  console.log(`  Nonces ready. Broadcasting votes...`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < count; i++) {
    const wallet = voteWallets[i];
    const nonce = nonceMap.get(wallet.address) ?? 0n;

    try {
      const txId = await broadcastContractCall({
        contractAddress: DEPLOYER,
        contractName: GOV_VOTING,
        functionName: "vote",
        functionArgs: [uintCV(activeProposalId), trueCV()],
        senderKey: wallet.privateKey,
        nonce,
      });

      if (txId) {
        successful++;
      } else {
        failed++;
      }
    } catch (e: any) {
      console.error(`    Wallet #${startIdx + i} error: ${e.message}`);
      failed++;
    }

    if ((i + 1) % 25 === 0) {
      console.log(`    Progress: ${i + 1}/${count} | OK: ${successful} | Failed: ${failed}`);
    }

    // Broadcast doesn't need heavy rate limiting (different endpoint)
    await sleep(300);
  }

  // Update state
  state.votingProgress.nextWalletIndex = startIdx + count;
  state.votingProgress.totalVoted += successful;
  saveState(state);

  console.log(`\n  Vote batch complete: ${successful} OK, ${failed} failed`);
  console.log(`  Total voted so far: ${state.votingProgress.totalVoted}/${wallets.length}`);
}

// ============================================
// Step: Execute Proposal
// ============================================

async function stepExecute(privateKey: string): Promise<boolean> {
  console.log(`\n--- Governance: Execute Proposal ---`);

  const state = loadState();
  const proposalId = state.currentProposalId;

  if (proposalId === 0) {
    console.log(`  No proposal to execute`);
    return false;
  }

  if (state.executedProposals.includes(proposalId)) {
    console.log(`  Proposal #${proposalId} already executed (in state)`);
    return false;
  }

  const proposal = await getProposal(proposalId);
  if (!proposal) {
    console.log(`  Proposal #${proposalId} not found on-chain`);
    return false;
  }

  if (proposal.executed) {
    console.log(`  Proposal #${proposalId} already executed on-chain`);
    state.executedProposals.push(proposalId);
    saveState(state);
    return false;
  }

  // Check execution conditions
  const tenureHeight = await getTenureHeight();
  const voteEndBlock = proposal.startBlock + 1008;
  const executableBlock = voteEndBlock + 144;

  if (tenureHeight < voteEndBlock) {
    console.log(`  Voting still active. Ends at block ${voteEndBlock}, current: ${tenureHeight}`);
    return false;
  }

  if (tenureHeight < executableBlock) {
    console.log(`  Execution delay not passed. Executable at ${executableBlock}, current: ${tenureHeight}`);
    return false;
  }

  console.log(`  Executing proposal #${proposalId}: ${proposal.paramKey} -> ${proposal.paramValue}`);
  console.log(`  Votes for: ${proposal.votesFor}, against: ${proposal.votesAgainst}`);

  resetNonceCache();
  const nonce = await getNextNonce(DEPLOYER);
  const txId = await broadcastContractCall({
    contractAddress: DEPLOYER,
    contractName: GOV_VOTING,
    functionName: "execute-proposal",
    functionArgs: [uintCV(proposalId)],
    senderKey: privateKey,
    nonce,
  });

  if (txId) {
    console.log(`  execute-proposal TX: ${txId}`);
    state.executedProposals.push(proposalId);
    saveState(state);
    return true;
  } else {
    console.error(`  Failed to execute proposal`);
    return false;
  }
}

// ============================================
// Step: Status
// ============================================

async function stepStatus(): Promise<void> {
  console.log(`\n--- Governance Status ---`);

  const state = loadState();
  const tenureHeight = await getTenureHeight();

  console.log(`  tenure_height: ${tenureHeight}`);
  console.log(`  State file: ${state.paramsInitialized ? "initialized" : "NOT initialized"}`);
  console.log(`  Tokens distributed: ${state.tokensDistributed}`);

  try {
    const totalSupply = await getGovTotalSupply();
    console.log(`  sVGOV total supply: ${totalSupply} raw (${Number(totalSupply) / 1_000_000} sVGOV)`);
  } catch (e: any) {
    console.log(`  sVGOV total supply: error (${e.message})`);
  }

  try {
    const proposalCount = await getProposalCount();
    console.log(`  Proposal count: ${proposalCount}`);

    if (proposalCount > 0) {
      const latest = await getProposal(proposalCount);
      if (latest) {
        const voteEnd = latest.startBlock + 1008;
        const execBlock = voteEnd + 144;
        const status = latest.executed
          ? "EXECUTED"
          : tenureHeight >= voteEnd
            ? tenureHeight >= execBlock
              ? "READY TO EXECUTE"
              : `EXECUTION DELAY (${execBlock - tenureHeight} blocks)`
            : `VOTING (${voteEnd - tenureHeight} blocks left)`;

        console.log(`  Latest proposal #${proposalCount}:`);
        console.log(`    Param: ${latest.paramKey} -> ${latest.paramValue}`);
        console.log(`    Votes: FOR=${latest.votesFor} / AGAINST=${latest.votesAgainst}`);
        console.log(`    Status: ${status}`);
      }
    }
  } catch {
    console.log(`  Proposals: contract not deployed`);
  }

  try {
    const params = await readContract(GOV_VOTING, "get-all-params");
    const p = params.value;
    console.log(`  Protocol params:`);
    console.log(`    strike-otm-bps: ${p["strike-otm-bps"]?.value}`);
    console.log(`    management-fee-bps: ${p["management-fee-bps"]?.value}`);
    console.log(`    performance-fee-bps: ${p["performance-fee-bps"]?.value}`);
    console.log(`    epoch-duration: ${p["epoch-duration"]?.value}`);
    console.log(`    insurance-fee-bps: ${p["insurance-fee-bps"]?.value}`);
    console.log(`    withdrawal-limit-bps: ${p["withdrawal-limit-bps"]?.value}`);
  } catch {
    console.log(`  Protocol params: not initialized or contract not deployed`);
  }

  console.log(`\n  Local state:`);
  console.log(`    Current proposal ID: ${state.currentProposalId}`);
  console.log(`    Voting progress: wallet[${state.votingProgress.nextWalletIndex}], total=${state.votingProgress.totalVoted}`);
  console.log(`    Param toggle index: ${state.paramToggleIndex}`);
  console.log(`    Executed proposals: [${state.executedProposals.join(", ")}]`);
}

// ============================================
// Daily Governance Cycle (exported for daily-runner)
// ============================================

export async function runDailyGovernance(privateKey: string): Promise<void> {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Governance Daily Cycle - ${new Date().toISOString()}`);
  console.log(`${"=".repeat(50)}`);

  const walletsData = loadWallets();
  if (!walletsData) {
    console.error("  No wallets.json found!");
    return;
  }

  const state = loadState();

  if (!state.paramsInitialized) {
    console.log("  Params not initialized. Run: npm run gov:init");
    return;
  }

  if (!state.tokensDistributed) {
    console.log("  Tokens not distributed. Run: npm run gov:distribute");
    return;
  }

  // 1. Try to execute any passed proposals
  await stepExecute(privateKey);

  // 2. Check if we need a new proposal
  const proposalCount = await getProposalCount();
  let needNewProposal = false;

  if (state.currentProposalId === 0) {
    needNewProposal = true;
  } else {
    const currentProposal = await getProposal(state.currentProposalId);
    if (!currentProposal) {
      needNewProposal = true;
    } else if (currentProposal.executed) {
      needNewProposal = true;
    } else {
      // Check if voting ended and all wallets have voted
      const tenureHeight = await getTenureHeight();
      const voteEnd = currentProposal.startBlock + 1008;
      if (tenureHeight >= voteEnd) {
        needNewProposal = true;
      }
    }
  }

  if (needNewProposal) {
    // Check cadence: don't create too frequently
    const now = Date.now();
    const lastCreated = state.lastProposalCreatedAt
      ? new Date(state.lastProposalCreatedAt).getTime()
      : 0;
    const daysSinceLastProposal = (now - lastCreated) / (1000 * 60 * 60 * 24);

    if (daysSinceLastProposal >= GOV_CONFIG.proposalCadenceDays || lastCreated === 0) {
      await stepPropose(walletsData.wallets);
      // Wait a bit for the TX to propagate before voting
      console.log("  Waiting 60s for proposal TX to propagate...");
      await sleep(60000);
    } else {
      console.log(`  Last proposal created ${daysSinceLastProposal.toFixed(1)} days ago, waiting for cadence (${GOV_CONFIG.proposalCadenceDays} days)`);
    }
  }

  // 3. Vote on active proposal
  resetNonceCache();
  await stepVote(walletsData.wallets);

  console.log(`\n  Governance daily cycle complete.`);
}

// ============================================
// CLI Entry Point
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const stepIdx = args.indexOf("--step");
  const step = stepIdx !== -1 ? args[stepIdx + 1] : "daily";

  const privateKey = process.env.MASTER_PRIVATE_KEY;

  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Governance Bot - Step: ${step}`);
  console.log(`${"=".repeat(50)}`);

  switch (step) {
    case "init": {
      if (!privateKey) {
        console.error("  MASTER_PRIVATE_KEY required for init");
        process.exit(1);
      }
      await stepInit(privateKey);
      break;
    }

    case "distribute": {
      if (!privateKey) {
        console.error("  MASTER_PRIVATE_KEY required for distribute");
        process.exit(1);
      }
      await stepDistribute(privateKey);
      break;
    }

    case "propose": {
      const walletsData = loadWallets();
      if (!walletsData) {
        console.error("  No wallets.json found!");
        process.exit(1);
      }
      await stepPropose(walletsData.wallets);
      break;
    }

    case "vote": {
      const walletsData = loadWallets();
      if (!walletsData) {
        console.error("  No wallets.json found!");
        process.exit(1);
      }
      resetNonceCache();
      await stepVote(walletsData.wallets);
      break;
    }

    case "execute": {
      if (!privateKey) {
        console.error("  MASTER_PRIVATE_KEY required for execute");
        process.exit(1);
      }
      await stepExecute(privateKey);
      break;
    }

    case "daily": {
      if (!privateKey) {
        console.error("  MASTER_PRIVATE_KEY required for daily");
        process.exit(1);
      }
      await runDailyGovernance(privateKey);
      break;
    }

    case "status": {
      await stepStatus();
      break;
    }

    default:
      console.error(`  Unknown step: ${step}`);
      console.error(`  Available: init, distribute, propose, vote, execute, daily, status`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
