/**
 * Validates that blockTime is a valid positive number
 * Returns true if blockTime is a finite positive number
 */
export function isValidBlockTime(blockTime: number | null | undefined): blockTime is number {
  return blockTime != null && Number.isFinite(blockTime) && blockTime > 0;
}

/**
 * Safely formats a Unix timestamp to ISO string
 * Returns 'Invalid date' if the timestamp is invalid
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return isNaN(date.getTime()) ? 'Invalid date' : date.toISOString();
}
