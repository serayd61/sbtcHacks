// keeper/key-utils.ts
// Resolves private key from either hex string or mnemonic (seed phrase)

import { generateWallet } from "@stacks/wallet-sdk";
import { getAddressFromPrivateKey } from "@stacks/transactions";
import { STACKS_MAINNET, STACKS_TESTNET } from "@stacks/network";
import { KEEPER_CONFIG } from "./config";

/**
 * Resolve private key from environment variable
 * Supports:
 *   - 64-char hex string (raw private key)
 *   - 66-char hex string (compressed key with 01 suffix)
 *   - 12/24-word mnemonic (Hiro Wallet "Secret Key")
 *   - hex with 0x prefix
 */
export async function resolvePrivateKey(): Promise<string | null> {
  const raw = process.env.KEEPER_PRIVATE_KEY?.trim();
  if (!raw) return null;

  const network =
    KEEPER_CONFIG.network === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

  // Check if it looks like a mnemonic (has spaces = multiple words)
  if (raw.includes(" ")) {
    const words = raw.split(/\s+/);
    if (words.length >= 12) {
      console.log(`  Deriving private key from ${words.length}-word mnemonic...`);
      try {
        const wallet = await generateWallet({
          secretKey: raw,
          password: "",
        });
        const account = wallet.accounts[0];
        const key = account.stxPrivateKey;
        const address = getAddressFromPrivateKey(key, network);
        console.log(`  Derived address: ${address}`);
        return key;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  Failed to derive key from mnemonic: ${msg}`);
        return null;
      }
    }
  }

  // Strip 0x prefix
  let hex = raw.startsWith("0x") ? raw.slice(2) : raw;

  // Validate hex
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    console.error("  Invalid private key format — must be hex or mnemonic phrase");
    return null;
  }

  // Validate key length (64 raw or 66 compressed)
  if (hex.length !== 64 && hex.length !== 66) {
    console.error(`  Invalid private key length: ${hex.length} (expected 64 or 66 hex chars)`);
    return null;
  }

  // Ensure compression flag is present for correct address derivation
  const fullKey = hex.length === 64 ? hex + "01" : hex;

  // Show derived address for verification
  try {
    const address = getAddressFromPrivateKey(fullKey, network);
    console.log(`  Wallet address: ${address}`);
  } catch {}

  hex = fullKey;

  return hex;
}
