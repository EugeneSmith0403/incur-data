/**
 * Zod schemas for volume analytics API validation
 */

import { z } from 'zod';

/**
 * Query parameters schema for volume endpoints
 */
export const volumeQuerySchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe('Start date in YYYY-MM-DD format'),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe('End date in YYYY-MM-DD format'),
  eventType: z.enum(['created', 'fulfilled']).optional()
    .describe('Filter by event type'),
  giveChainId: z.string().optional()
    .describe('Filter by source chain ID'),
  takeChainId: z.string().optional()
    .describe('Filter by destination chain ID'),
  limit: z.coerce.number().int().positive().max(1000).default(100)
    .describe('Maximum number of results'),
});

export type VolumeQueryParams = z.infer<typeof volumeQuerySchema>;

/**
 * Daily volume response schema
 */
export const dailyVolumeResponseSchema = z.object({
  date: z.string(),
  eventType: z.enum(['created', 'fulfilled']),
  giveChainId: z.string(),
  takeChainId: z.string(),
  totalVolumeUsd: z.string(),
  orderCount: z.number().int(),
  avgOrderUsd: z.string(),
  minOrderUsd: z.string(),
  maxOrderUsd: z.string(),
  uniqueMakers: z.number().int(),
  uniqueOrders: z.number().int(),
  lastUpdated: z.string(),
});

export type DailyVolumeResponse = z.infer<typeof dailyVolumeResponseSchema>;

/**
 * Volume stats response schema
 */
export const volumeStatsResponseSchema = z.object({
  totalVolumeUsd: z.string(),
  orderCount: z.number().int(),
  avgOrderUsd: z.string(),
  minOrderUsd: z.string(),
  maxOrderUsd: z.string(),
  uniqueMakers: z.number().int(),
  uniqueOrders: z.number().int(),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
});

export type VolumeStatsResponse = z.infer<typeof volumeStatsResponseSchema>;

/**
 * Health check response schema
 */
export const healthResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string(),
  services: z.object({
    clickhouse: z.boolean(),
    redis: z.boolean(),
  }),
  version: z.string().optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Generic success response wrapper
 */
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    count: z.number().int().optional(),
    filters: z.record(z.any()).optional(),
  });

/**
 * Generic error response schema
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  statusCode: z.number().int().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Daily volume summary response schema
 */
export const dailyVolumeSummarySchema = z.object({
  date: z.string(),
  giveChainId: z.string(),
  takeChainId: z.string(),
  createdVolumeUsd: z.string(),
  createdCount: z.number().int(),
  createdAvgUsd: z.string(),
  fulfilledVolumeUsd: z.string(),
  fulfilledCount: z.number().int(),
  fulfilledAvgUsd: z.string(),
  fulfillmentRate: z.number(),
  totalVolumeUsd: z.string(),
  uniqueMakers: z.number().int(),
  lastUpdated: z.string(),
});

export type DailyVolumeSummary = z.infer<typeof dailyVolumeSummarySchema>;

/**
 * Volume comparison schema
 */
export const volumeComparisonSchema = z.object({
  date: z.string(),
  giveChainId: z.string(),
  takeChainId: z.string(),
  created: z.object({
    volumeUsd: z.string(),
    count: z.number().int(),
    avgUsd: z.string(),
  }),
  fulfilled: z.object({
    volumeUsd: z.string(),
    count: z.number().int(),
    avgUsd: z.string(),
  }),
  fulfillmentRate: z.number(),
  unfulfilled: z.object({
    volumeUsd: z.string(),
    count: z.number().int(),
  }),
});

export type VolumeComparison = z.infer<typeof volumeComparisonSchema>;

/**
 * Top token pair schema
 */
export const topTokenPairSchema = z.object({
  rank: z.number().int(),
  giveTokenAddress: z.string(),
  takeTokenAddress: z.string(),
  giveChainId: z.string(),
  takeChainId: z.string(),
  totalVolumeUsd: z.string(),
  orderCount: z.number().int(),
  avgOrderUsd: z.string(),
  volumeShare: z.number(),
});

export type TopTokenPair = z.infer<typeof topTokenPairSchema>;
