import { generateWallet, generateNewAccount } from "@stacks/wallet-sdk";
import { getAddressFromPrivateKey } from "@stacks/transactions";
import { BOT_CONFIG } from "./config.js";
import fs from "fs";
import path from "path";

export interface WalletEntry {
  index: number;
  address: string;
  privateKey: string;
}

export interface WalletsData {
  mnemonic: string;
  generatedAt: string;
  count: number;
  wallets: WalletEntry[];
}

/**
 * Generate N HD wallets from a single mnemonic.
 * Uses @stacks/wallet-sdk which derives accounts via BIP44 m/44'/5757'/0'/0/i
 */
export async function generateWallets(
  count: number,
  mnemonic?: string
): Promise<WalletsData> {
  // Generate random mnemonic if not provided
  const secretKey =
    mnemonic ?? (await generateRandomMnemonic());

  console.log(`  Generating ${count} wallets from mnemonic...`);
  console.log(`  Mnemonic (SAVE THIS!): ${secretKey}`);

  // Create initial wallet with first account
  let wallet = await generateWallet({
    secretKey,
    password: "",
  });

  // Generate additional accounts (wallet starts with 1 account)
  for (let i = 1; i < count; i++) {
    wallet = generateNewAccount(wallet);
    if (i % 100 === 0) {
      console.log(`    Generated ${i}/${count} accounts...`);
    }
  }

  console.log(`    Generated ${count}/${count} accounts.`);

  // Extract address and private key for each account
  const wallets: WalletEntry[] = wallet.accounts.map((account, index) => {
    const privateKey = account.stxPrivateKey;
    const address = getAddressFromPrivateKey(
      privateKey,
      BOT_CONFIG.network
    );

    return {
      index,
      address,
      privateKey,
    };
  });

  // Verify all addresses are unique
  const uniqueAddresses = new Set(wallets.map((w) => w.address));
  if (uniqueAddresses.size !== count) {
    throw new Error(
      `Address collision detected! ${uniqueAddresses.size} unique out of ${count}`
    );
  }

  return {
    mnemonic: secretKey,
    generatedAt: new Date().toISOString(),
    count,
    wallets,
  };
}

/**
 * Load existing wallets from file
 */
export function loadWallets(): WalletsData | null {
  const filePath = path.resolve(BOT_CONFIG.walletsFile);
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    console.log(
      `  Loaded ${data.wallets.length} wallets from ${BOT_CONFIG.walletsFile}`
    );
    return data;
  } catch {
    return null;
  }
}

/**
 * Save wallets to file
 */
export function saveWallets(data: WalletsData): void {
  const filePath = path.resolve(BOT_CONFIG.walletsFile);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  Saved ${data.wallets.length} wallets to ${BOT_CONFIG.walletsFile}`);
}

/**
 * Generate a random 24-word BIP39 mnemonic
 */
async function generateRandomMnemonic(): Promise<string> {
  const { generateMnemonic } = await import("@scure/bip39");
  const { wordlist } = await import("@scure/bip39/wordlists/english");
  return generateMnemonic(wordlist, 256); // 256 bits = 24 words
}
