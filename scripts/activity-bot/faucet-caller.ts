import { contractPrincipalCV } from "@stacks/transactions";
import { BOT_CONFIG, DEPLOYER } from "./config.js";
import {
  broadcastContractCall,
  processBatch,
  type BatchResult,
} from "./utils.js";
import type { WalletEntry } from "./wallet-generator.js";

/**
 * Call mock-sbtc faucet for each wallet to get 1 sBTC.
 *
 * Each wallet signs its own TX with its own private key.
 * The faucet() function mints 1 sBTC (100,000,000 sats) to tx-sender.
 * No arguments needed, no cooldown, no limits.
 *
 * Nonce: Each wallet's first TX, so nonce = 0 for all.
 * (If STX distribution TX is already confirmed, nonce is still 0
 * because receive doesn't increment sender's nonce)
 */
export async function callFaucets(
  wallets: WalletEntry[]
): Promise<BatchResult> {
  console.log(`\n  Calling faucet for ${wallets.length} wallets...`);
  console.log(`  Each wallet will receive 1 sBTC (100,000,000 sats)`);

  const result = await processBatch(
    wallets,
    BOT_CONFIG.batchSize,
    async (wallet: WalletEntry, index: number) => {
      // Each wallet's first outgoing TX = nonce 0
      const nonce = 0n;

      const txId = await broadcastContractCall({
        contractAddress: DEPLOYER,
        contractName: BOT_CONFIG.contracts.mockSbtc,
        functionName: "faucet",
        functionArgs: [],
        senderKey: wallet.privateKey,
        nonce,
        fee: BOT_CONFIG.defaultFee,
      });

      if (txId) {
        console.log(
          `    #${index}: ${wallet.address.slice(0, 10)}... faucet -> ${txId.slice(0, 12)}...`
        );
      }

      return txId;
    },
    BOT_CONFIG.batchDelayMs,
    "Faucet"
  );

  console.log(
    `\n  Faucet calls complete: ${result.successful} OK, ${result.failed} failed`
  );

  return result;
}
