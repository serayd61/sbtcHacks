import { getAddressFromPrivateKey } from "@stacks/transactions";
import { BOT_CONFIG } from "./config.js";
import {
  getNextNonce,
  broadcastSTXTransfer,
  processBatch,
  getSTXBalance,
  type BatchResult,
} from "./utils.js";
import type { WalletEntry } from "./wallet-generator.js";

/**
 * Distribute STX from master wallet to all generated wallets.
 * Each wallet receives BOT_CONFIG.stxPerWallet (0.1 STX = 100,000 microSTX).
 *
 * Nonce strategy: All TXs come from the same master address.
 * We fetch the nonce once, then increment locally for each TX.
 * TXs are broadcast in batches of 25 with 60s delay between batches.
 */
export async function distributeSTX(
  masterPrivateKey: string,
  wallets: WalletEntry[]
): Promise<BatchResult> {
  const masterAddress = getAddressFromPrivateKey(
    masterPrivateKey,
    BOT_CONFIG.network
  );

  console.log(`\n  Master wallet: ${masterAddress}`);

  // Check master balance
  const balance = await getSTXBalance(masterAddress);
  const totalNeeded =
    BigInt(wallets.length) * (BOT_CONFIG.stxPerWallet + BOT_CONFIG.defaultFee);
  const balanceSTX = Number(balance) / 1_000_000;
  const neededSTX = Number(totalNeeded) / 1_000_000;

  console.log(`  Balance: ${balanceSTX.toFixed(2)} STX`);
  console.log(`  Needed:  ${neededSTX.toFixed(2)} STX (${wallets.length} wallets x ${Number(BOT_CONFIG.stxPerWallet) / 1_000_000} STX + gas)`);

  if (balance < totalNeeded) {
    console.error(
      `  INSUFFICIENT BALANCE! Need ${neededSTX.toFixed(2)} STX but have ${balanceSTX.toFixed(2)} STX`
    );
    return { successful: 0, failed: wallets.length, txIds: [], failedIndices: wallets.map((_, i) => i) };
  }

  // Fetch initial nonce for master address
  const startNonce = await getNextNonce(masterAddress);
  console.log(`  Starting nonce: ${startNonce}`);

  // Pre-calculate all nonces
  let currentNonce = startNonce;

  const result = await processBatch(
    wallets,
    BOT_CONFIG.batchSize,
    async (wallet: WalletEntry, index: number) => {
      const nonce = startNonce + BigInt(index);

      const txId = await broadcastSTXTransfer({
        recipientAddress: wallet.address,
        amount: BOT_CONFIG.stxPerWallet,
        senderKey: masterPrivateKey,
        nonce,
        fee: BOT_CONFIG.defaultFee,
      });

      if (txId) {
        console.log(
          `    #${index}: ${wallet.address.slice(0, 10)}... -> ${txId.slice(0, 12)}...`
        );
      }

      return txId;
    },
    BOT_CONFIG.batchDelayMs,
    "STX Distribute"
  );

  console.log(
    `\n  STX Distribution complete: ${result.successful} OK, ${result.failed} failed`
  );

  return result;
}

/**
 * Check which wallets already have sufficient STX balance.
 * Returns indices of wallets that DON'T need STX.
 */
export async function checkExistingBalances(
  wallets: WalletEntry[]
): Promise<Set<number>> {
  const funded = new Set<number>();
  const sampleSize = Math.min(10, wallets.length);

  console.log(`  Checking STX balances for ${sampleSize} sample wallets...`);

  for (let i = 0; i < sampleSize; i++) {
    try {
      const balance = await getSTXBalance(wallets[i].address);
      if (balance >= BOT_CONFIG.stxPerWallet) {
        funded.add(i);
      }
    } catch {
      // Skip on error
    }
  }

  if (funded.size > 0) {
    console.log(
      `  ${funded.size}/${sampleSize} sample wallets already funded`
    );
  }

  return funded;
}
