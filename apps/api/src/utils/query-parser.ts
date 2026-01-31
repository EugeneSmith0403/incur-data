/**
 * Query Parameter Parsing Utilities
 * Shared utilities for parsing and transforming API query parameters
 */

/**
 * Volume query filters (from DTO)
 */
export interface VolumeQueryFilters {
  fromDate?: string;
  toDate?: string;
  eventType?: 'created' | 'fulfilled';
  programId?: string;
  giveChainId?: string;
  takeChainId?: string;
  giveTokenAddress?: string;
  takeTokenAddress?: string;
  limit?: number;
}

/**
 * Volume query parameters (camelCase from API)
 */
export interface VolumeQueryParams {
  fromDate?: string;
  toDate?: string;
  eventType?: 'created' | 'fulfilled';
  programId?: string;
  giveChainId?: string;
  takeChainId?: string;
  giveTokenAddress?: string;
  takeTokenAddress?: string;
  limit?: string | number;
}

/**
 * Parse query parameters into typed filter object
 * Normalizes parameters and parses string numbers
 *
 * @param query - Query parameters from request
 * @returns Typed volume query filters
 */
export function parseQueryFilters(query: VolumeQueryParams): VolumeQueryFilters {
  const filters: VolumeQueryFilters = {};

  if (query.fromDate) {
    filters.fromDate = query.fromDate;
  }

  if (query.toDate) {
    filters.toDate = query.toDate;
  }

  if (query.eventType) {
    filters.eventType = query.eventType;
  }

  if (query.programId) {
    filters.programId = query.programId;
  }

  if (query.giveChainId) {
    filters.giveChainId = query.giveChainId;
  }

  if (query.takeChainId) {
    filters.takeChainId = query.takeChainId;
  }

  if (query.giveTokenAddress) {
    filters.giveTokenAddress = query.giveTokenAddress;
  }

  if (query.takeTokenAddress) {
    filters.takeTokenAddress = query.takeTokenAddress;
  }

  if (query.limit) {
    filters.limit = typeof query.limit === 'string'
      ? parseInt(query.limit, 10)
      : query.limit;
  }

  return filters;
}
