import {
  contractPrincipalCV,
  uintCV,
  cvToJSON,
  fetchCallReadOnlyFunction,
} from "@stacks/transactions";
import { BOT_CONFIG, DEPLOYER } from "./config.js";
import {
  broadcastContractCall,
  processBatch,
  type BatchResult,
} from "./utils.js";
import type { WalletEntry } from "./wallet-generator.js";

/**
 * Get the current listing count from the market contract.
 * This tells us the highest listing ID that exists.
 */
export async function getListingCount(): Promise<number> {
  const result = await fetchCallReadOnlyFunction({
    contractAddress: DEPLOYER,
    contractName: BOT_CONFIG.contracts.optionsMarket,
    functionName: "get-listing-count",
    functionArgs: [],
    senderAddress: DEPLOYER,
    network: BOT_CONFIG.network,
  });

  const json = cvToJSON(result);
  return Number(json.value);
}

/**
 * Get a specific listing to check if it's available (not sold).
 */
export async function getListingInfo(
  listingId: number
): Promise<{ sold: boolean; premium: bigint; epochId: number } | null> {
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: DEPLOYER,
      contractName: BOT_CONFIG.contracts.optionsMarket,
      functionName: "get-listing",
      functionArgs: [uintCV(listingId)],
      senderAddress: DEPLOYER,
      network: BOT_CONFIG.network,
    });

    const json = cvToJSON(result);
    if (!json.value) return null;

    const listing = json.value;
    return {
      sold: listing.sold?.value ?? listing.sold ?? false,
      premium: BigInt(listing.premium?.value ?? listing.premium ?? "0"),
      epochId: Number(listing.epoch_id?.value ?? listing["epoch-id"]?.value ?? listing.epoch_id ?? listing["epoch-id"] ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Find available (unsold) listings starting from a given ID.
 * Returns an array of available listing IDs.
 */
export async function findAvailableListings(
  startId: number,
  count: number
): Promise<number[]> {
  const available: number[] = [];
  const totalListings = await getListingCount();

  console.log(`  Total listings on market: ${totalListings}`);
  console.log(`  Looking for ${count} available listings starting from ID ${startId}...`);

  for (let id = startId; id <= totalListings && available.length < count; id++) {
    const info = await getListingInfo(id);
    if (info && !info.sold) {
      available.push(id);
    }

    // Progress log every 100 checks
    if ((id - startId + 1) % 100 === 0) {
      console.log(`    Checked ${id - startId + 1} listings, found ${available.length} available`);
    }
  }

  console.log(`  Found ${available.length} available listings`);
  return available;
}

/**
 * Buy options for each wallet.
 * Each wallet buys a different listing.
 *
 * Nonce: Each wallet's second TX (after faucet), so nonce = 1.
 * Premium is paid in sBTC (from faucet).
 */
export async function buyOptions(
  wallets: WalletEntry[],
  listingIds: number[]
): Promise<BatchResult> {
  if (listingIds.length < wallets.length) {
    console.error(
      `  Not enough listings! Have ${listingIds.length} but need ${wallets.length}`
    );
    return {
      successful: 0,
      failed: wallets.length,
      txIds: [],
      failedIndices: wallets.map((_, i) => i),
    };
  }

  console.log(`\n  Buying options for ${wallets.length} wallets...`);
  console.log(`  Listing IDs: ${listingIds[0]} to ${listingIds[listingIds.length - 1]}`);

  const result = await processBatch(
    wallets,
    BOT_CONFIG.batchSize,
    async (wallet: WalletEntry, index: number) => {
      const listingId = listingIds[index];
      // Each wallet's second outgoing TX = nonce 1
      const nonce = 1n;

      const txId = await broadcastContractCall({
        contractAddress: DEPLOYER,
        contractName: BOT_CONFIG.contracts.optionsMarket,
        functionName: "buy-option",
        functionArgs: [
          contractPrincipalCV(DEPLOYER, BOT_CONFIG.contracts.mockSbtc),
          uintCV(listingId),
        ],
        senderKey: wallet.privateKey,
        nonce,
        fee: BOT_CONFIG.defaultFee,
      });

      if (txId) {
        console.log(
          `    #${index}: ${wallet.address.slice(0, 10)}... bought listing #${listingId} -> ${txId.slice(0, 12)}...`
        );
      }

      return txId;
    },
    BOT_CONFIG.batchDelayMs,
    "Buy Options"
  );

  console.log(
    `\n  Option purchases complete: ${result.successful} OK, ${result.failed} failed`
  );

  return result;
}
