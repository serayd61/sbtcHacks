/**
 * Block-to-time estimation utilities for Stacks Nakamoto.
 *
 * After the Nakamoto upgrade, Stacks has two block concepts:
 * - tenure_height (= block-height in Clarity): ~10 min per tenure (follows Bitcoin blocks)
 * - stacks_tip_height: fast Stacks blocks (~5-10 seconds)
 *
 * Smart contracts use tenure_height for expiry. We estimate time using
 * ~10 minutes per tenure block (Bitcoin block time average).
 */

const TENURE_BLOCK_TIME_MINUTES = 10; // Average Bitcoin block time

/**
 * Estimate remaining time from current block to target block.
 * Returns a human-readable string like "~2 days 5 hours" or "~45 minutes".
 */
export function estimateBlocksRemaining(
  currentBlock: number,
  targetBlock: number
): string {
  if (targetBlock <= currentBlock) return "Expired";

  const blocksRemaining = targetBlock - currentBlock;
  const minutesRemaining = blocksRemaining * TENURE_BLOCK_TIME_MINUTES;

  return formatDuration(minutesRemaining);
}

/**
 * Estimate an approximate date/time for a future block.
 */
export function estimateBlockDate(
  currentBlock: number,
  targetBlock: number
): Date {
  const blocksRemaining = targetBlock - currentBlock;
  const minutesRemaining = blocksRemaining * TENURE_BLOCK_TIME_MINUTES;
  return new Date(Date.now() + minutesRemaining * 60 * 1000);
}

/**
 * Format a duration in minutes to a human-readable string.
 */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `~${Math.round(totalMinutes)} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  if (hours < 24) {
    return minutes > 0 ? `~${hours}h ${minutes}m` : `~${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days < 7) {
    return remainingHours > 0 ? `~${days}d ${remainingHours}h` : `~${days}d`;
  }

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  return remainingDays > 0 ? `~${weeks}w ${remainingDays}d` : `~${weeks}w`;
}

/**
 * Format block number with estimated date for display.
 * Example: "Block #235,345 (~Mar 15)"
 */
export function formatBlockWithEstimate(
  targetBlock: number,
  currentBlock: number | null
): string {
  if (!currentBlock) return `Block #${targetBlock.toLocaleString()}`;

  const blockStr = `#${targetBlock.toLocaleString()}`;

  if (targetBlock <= currentBlock) {
    return `${blockStr} (Expired)`;
  }

  const estimate = estimateBlockDate(currentBlock, targetBlock);
  const dateStr = estimate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const timeRemaining = estimateBlocksRemaining(currentBlock, targetBlock);

  return `${blockStr} (~${dateStr}, ${timeRemaining})`;
}
