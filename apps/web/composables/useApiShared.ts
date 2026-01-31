/**
 * Shared types and utilities for API composables
 */
import type { Ref } from 'vue';

export interface UseApiOptions {
  immediate?: boolean;
  /** Polling interval in milliseconds. Set to enable automatic refetching. */
  refetchInterval?: number;
  /** Only refetch when the window is focused (default: true) */
  refetchIntervalInBackground?: boolean;
}

export interface ApiState<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  execute: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Helper to get date presets
 */
export function getDatePresets() {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  return [
    {
      label: 'Last 7 Days',
      fromDate: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      toDate: formatDate(today),
      from_date: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      to_date: formatDate(today),
    },
    {
      label: 'Last 30 Days',
      fromDate: formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
      toDate: formatDate(today),
      from_date: formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
      to_date: formatDate(today),
    },
    {
      label: 'Last 90 Days',
      fromDate: formatDate(new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)),
      toDate: formatDate(today),
      from_date: formatDate(new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)),
      to_date: formatDate(today),
    },
    {
      label: 'This Month',
      fromDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      toDate: formatDate(today),
      from_date: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      to_date: formatDate(today),
    },
    {
      label: 'Last Month',
      fromDate: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      toDate: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      from_date: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to_date: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)),
    },
  ];
}

/**
 * Format USD amount
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format large numbers
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Truncate address
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
