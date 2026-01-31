/**
 * Format timestamp for ClickHouse DateTime format
 * @param timestamp - Unix timestamp in seconds (or null/undefined for current time)
 * @returns Date string in 'YYYY-MM-DD HH:mm:ss' format
 */
export const formatBlockTime = (timestamp: number | null | undefined): string => {
  const date = new Date((timestamp || Date.now() / 1000) * 1000);
  return date.toISOString().replace('T', ' ').substring(0, 19);
};
