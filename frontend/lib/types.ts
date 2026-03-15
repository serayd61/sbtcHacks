export interface VaultInfo {
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

export interface UserInfo {
  shares: bigint;
  sbtcValue: bigint;
  sharePrice: bigint;
}

export interface Epoch {
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

export interface Listing {
  epochId: bigint;
  strikePrice: bigint;
  premium: bigint;
  collateral: bigint;
  expiryBlock: bigint;
  sold: boolean;
  buyer: string | null;
  createdBlock: bigint;
  claimed: boolean;
}

export interface MarketInfo {
  totalListings: bigint;
  totalOptionsSold: bigint;
  totalVolume: bigint;
}

export interface GovernanceTokenInfo {
  name: string;
  symbol: string;
  decimals: bigint;
  totalSupply: bigint;
  maxSupply: bigint;
  mintEnabled: boolean;
}

export interface GovEntitlement {
  entitled: bigint;
  claimed: bigint;
  claimable: bigint;
}

export interface Proposal {
  id: number;
  proposer: string;
  paramKey: string;
  paramValue: bigint;
  votesFor: bigint;
  votesAgainst: bigint;
  startBlock: bigint;
  executed: boolean;
}

export interface ProtocolParams {
  strikeOtmBps: bigint;
  managementFeeBps: bigint;
  performanceFeeBps: bigint;
  epochDuration: bigint;
  insuranceFeeBps: bigint;
  withdrawalLimitBps: bigint;
}

export interface OracleInfo {
  price: bigint;
  lastUpdateBlock: bigint;
  currentRound: bigint;
  currentBlock: bigint;
  isStale: boolean;
  submitterCount: bigint;
  oraclePaused: boolean;
  stalenessLimit: bigint;
  toleranceBps: bigint;
}
