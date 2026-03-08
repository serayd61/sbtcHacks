// keeper/clarity-parser.ts
// Parse Clarity hex responses from Stacks API read-only calls
//
// The Stacks API returns Clarity values as hex-encoded strings.
// This module decodes them into JavaScript types.

// ============================================
// Clarity Type Prefixes (first byte)
// ============================================
const CLARITY_INT = 0x00;
const CLARITY_UINT = 0x01;
const CLARITY_BUFFER = 0x02;
const CLARITY_BOOL_TRUE = 0x03;
const CLARITY_BOOL_FALSE = 0x04;
const CLARITY_PRINCIPAL_STANDARD = 0x05;
const CLARITY_PRINCIPAL_CONTRACT = 0x06;
const CLARITY_OK = 0x07;
const CLARITY_ERR = 0x08;
const CLARITY_NONE = 0x09;
const CLARITY_SOME = 0x0a;
const CLARITY_LIST = 0x0b;
const CLARITY_TUPLE = 0x0c;
const CLARITY_STRING_ASCII = 0x0d;
const CLARITY_STRING_UTF8 = 0x0e;

/**
 * Parse a Clarity hex result string into a JS value
 */
export function parseClarityHex(hex: string): any {
  // Strip 0x prefix
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = Buffer.from(clean, "hex");
  const { value } = parseValue(bytes, 0);
  return value;
}

function parseValue(bytes: Buffer, offset: number): { value: any; nextOffset: number } {
  const type = bytes[offset];
  offset++;

  switch (type) {
    case CLARITY_UINT: {
      // 16 bytes big-endian unsigned integer
      let val = 0n;
      for (let i = 0; i < 16; i++) {
        val = (val << 8n) | BigInt(bytes[offset + i]);
      }
      return { value: val, nextOffset: offset + 16 };
    }

    case CLARITY_INT: {
      // 16 bytes big-endian signed integer
      let val = 0n;
      for (let i = 0; i < 16; i++) {
        val = (val << 8n) | BigInt(bytes[offset + i]);
      }
      // Handle sign (two's complement for 128-bit)
      if (val >= 1n << 127n) {
        val -= 1n << 128n;
      }
      return { value: val, nextOffset: offset + 16 };
    }

    case CLARITY_BOOL_TRUE:
      return { value: true, nextOffset: offset };

    case CLARITY_BOOL_FALSE:
      return { value: false, nextOffset: offset };

    case CLARITY_NONE:
      return { value: null, nextOffset: offset };

    case CLARITY_SOME: {
      const inner = parseValue(bytes, offset);
      return { value: inner.value, nextOffset: inner.nextOffset };
    }

    case CLARITY_OK: {
      const inner = parseValue(bytes, offset);
      return { value: inner.value, nextOffset: inner.nextOffset };
    }

    case CLARITY_ERR: {
      const inner = parseValue(bytes, offset);
      return { value: { error: inner.value }, nextOffset: inner.nextOffset };
    }

    case CLARITY_STRING_ASCII: {
      // 4-byte length prefix (big-endian)
      const len = bytes.readUInt32BE(offset);
      offset += 4;
      const str = bytes.toString("ascii", offset, offset + len);
      return { value: str, nextOffset: offset + len };
    }

    case CLARITY_STRING_UTF8: {
      const len = bytes.readUInt32BE(offset);
      offset += 4;
      const str = bytes.toString("utf8", offset, offset + len);
      return { value: str, nextOffset: offset + len };
    }

    case CLARITY_BUFFER: {
      const len = bytes.readUInt32BE(offset);
      offset += 4;
      const buf = bytes.slice(offset, offset + len);
      return { value: `0x${buf.toString("hex")}`, nextOffset: offset + len };
    }

    case CLARITY_TUPLE: {
      // 4-byte field count
      const fieldCount = bytes.readUInt32BE(offset);
      offset += 4;

      const result: Record<string, any> = {};
      for (let i = 0; i < fieldCount; i++) {
        // Field name: 1-byte length + name bytes
        const nameLen = bytes[offset];
        offset++;
        const name = bytes.toString("ascii", offset, offset + nameLen);
        offset += nameLen;

        const fieldValue = parseValue(bytes, offset);
        result[name] = fieldValue.value;
        offset = fieldValue.nextOffset;
      }

      return { value: result, nextOffset: offset };
    }

    case CLARITY_LIST: {
      // 4-byte element count
      const count = bytes.readUInt32BE(offset);
      offset += 4;

      const items: any[] = [];
      for (let i = 0; i < count; i++) {
        const item = parseValue(bytes, offset);
        items.push(item.value);
        offset = item.nextOffset;
      }

      return { value: items, nextOffset: offset };
    }

    case CLARITY_PRINCIPAL_STANDARD: {
      // 1 byte version + 20 bytes hash160
      const version = bytes[offset];
      const hash = bytes.slice(offset + 1, offset + 21);
      const principal = encodeC32Address(version, hash);
      return { value: principal, nextOffset: offset + 21 };
    }

    case CLARITY_PRINCIPAL_CONTRACT: {
      // Standard principal + 1-byte contract name length + name
      const version = bytes[offset];
      const hash = bytes.slice(offset + 1, offset + 21);
      offset += 21;
      const contractNameLen = bytes[offset];
      offset++;
      const contractName = bytes.toString("ascii", offset, offset + contractNameLen);
      offset += contractNameLen;
      const principal = encodeC32Address(version, hash);
      return { value: `${principal}.${contractName}`, nextOffset: offset };
    }

    default:
      throw new Error(`Unknown Clarity type: 0x${type.toString(16)} at offset ${offset - 1}`);
  }
}

// ============================================
// C32 Address Encoding (simplified)
// ============================================

const C32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeC32Address(version: number, hash160: Buffer): string {
  // Simplified c32 encoding for Stacks addresses
  const data = Buffer.concat([Buffer.from([version]), hash160]);

  // Convert to c32
  let hex = data.toString("hex");
  let bigInt = BigInt("0x" + hex);
  let c32 = "";

  while (bigInt > 0n) {
    const remainder = Number(bigInt % 32n);
    c32 = C32_ALPHABET[remainder] + c32;
    bigInt = bigInt / 32n;
  }

  // Determine prefix based on version
  const prefix = version === 22 || version === 20 ? "SP" : "ST";

  return prefix + c32;
}

// ============================================
// Typed Parsers for Vault Contracts
// ============================================

export interface ParsedVaultInfo {
  totalShares: bigint;
  totalSbtcDeposited: bigint;
  currentEpochId: bigint;
  activeEpoch: boolean;
  vaultPaused: boolean;
  sharePrice: bigint;
  totalPremiumsEarned: bigint;
  totalEpochsCompleted: bigint;
  totalFeesCollected: bigint;
}

export function parseVaultInfo(hex: string): ParsedVaultInfo {
  const data = parseClarityHex(hex);
  return {
    totalShares: BigInt(data["total-shares"] ?? 0),
    totalSbtcDeposited: BigInt(data["total-sbtc-deposited"] ?? 0),
    currentEpochId: BigInt(data["current-epoch-id"] ?? 0),
    activeEpoch: Boolean(data["active-epoch"]),
    vaultPaused: Boolean(data["vault-paused"]),
    sharePrice: BigInt(data["share-price"] ?? 0),
    totalPremiumsEarned: BigInt(data["total-premiums-earned"] ?? 0),
    totalEpochsCompleted: BigInt(data["total-epochs-completed"] ?? 0),
    totalFeesCollected: BigInt(data["total-fees-collected"] ?? 0),
  };
}

export interface ParsedEpochInfo {
  strikePrice: bigint;
  premium: bigint;
  collateral: bigint;
  startBlock: bigint;
  expiryBlock: bigint;
  settled: boolean;
  settlementPrice: bigint;
  premiumEarned: bigint;
  payout: bigint;
  outcome: string;
}

export function parseEpochInfo(hex: string): ParsedEpochInfo | null {
  const data = parseClarityHex(hex);
  if (data === null) return null; // none response

  return {
    strikePrice: BigInt(data["strike-price"] ?? 0),
    premium: BigInt(data["premium"] ?? 0),
    collateral: BigInt(data["collateral"] ?? 0),
    startBlock: BigInt(data["start-block"] ?? 0),
    expiryBlock: BigInt(data["expiry-block"] ?? 0),
    settled: Boolean(data["settled"]),
    settlementPrice: BigInt(data["settlement-price"] ?? 0),
    premiumEarned: BigInt(data["premium-earned"] ?? 0),
    payout: BigInt(data["payout"] ?? 0),
    outcome: String(data["outcome"] ?? "N/A"),
  };
}

export interface ParsedOracleInfo {
  price: bigint;
  currentRound: bigint;
  lastUpdateBlock: bigint;
  submitterCount: bigint;
  toleranceBps: bigint;
  isStale: boolean;
}

export function parseOracleInfo(hex: string): ParsedOracleInfo {
  const data = parseClarityHex(hex);
  return {
    price: BigInt(data["price"] ?? 0),
    currentRound: BigInt(data["current-round"] ?? 0),
    lastUpdateBlock: BigInt(data["last-update-block"] ?? 0),
    submitterCount: BigInt(data["submitter-count"] ?? 0),
    toleranceBps: BigInt(data["tolerance-bps"] ?? 0),
    isStale: Boolean(data["is-stale"]),
  };
}
