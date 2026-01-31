/**
 * Analytics DTOs with Zod validation
 * Shared between API and frontend
 */

import { z } from 'zod';

/**
 * Volume query filters schema
 * Note: Simplified schema doesn't support chain_id or token pair filtering
 */
export const volumeQueryFiltersSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  eventType: z.enum(['created', 'fulfilled']).optional(),
  programId: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional(),
});

export type VolumeQueryFiltersDto = z.infer<typeof volumeQueryFiltersSchema>;

/**
 * Daily volume result schema
 * Note: giveChainId and takeChainId are empty strings in simplified schema
 */
export const dailyVolumeResultSchema = z.object({
  date: z.string(),
  eventType: z.string(), // 'OrderCreated', 'OrderFulfilled', or 'unknown'
  giveChainId: z.string(), // Empty string in simplified schema
  takeChainId: z.string(), // Empty string in simplified schema
  totalVolumeUsd: z.string(),
  orderCount: z.number().int().nonnegative(),
  avgOrderUsd: z.string(),
  minOrderUsd: z.string(),
  maxOrderUsd: z.string(),
  uniqueMakers: z.number().int().nonnegative(),
  uniqueOrders: z.number().int().nonnegative(),
  lastUpdated: z.string(),
});

export type DailyVolumeResultDto = z.infer<typeof dailyVolumeResultSchema>;

/**
 * Volume stats result schema
 */
export const volumeStatsResultSchema = z.object({
  totalVolumeUsd: z.string(),
  orderCount: z.number().int().nonnegative(),
  avgOrderUsd: z.string(),
  minOrderUsd: z.string(),
  maxOrderUsd: z.string(),
  uniqueMakers: z.number().int().nonnegative(),
  uniqueOrders: z.number().int().nonnegative(),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
});

export type VolumeStatsResultDto = z.infer<typeof volumeStatsResultSchema>;

/**
 * Daily volume summary schema
 * Note: giveChainId and takeChainId are empty strings in simplified schema
 */
export const dailyVolumeSummaryResultSchema = z.object({
  date: z.string(),
  giveChainId: z.string(), // Empty string in simplified schema
  takeChainId: z.string(), // Empty string in simplified schema
  createdVolumeUsd: z.string(),
  createdCount: z.number().int().nonnegative(),
  createdAvgUsd: z.string(),
  fulfilledVolumeUsd: z.string(),
  fulfilledCount: z.number().int().nonnegative(),
  fulfilledAvgUsd: z.string(),
  fulfillmentRate: z.number().min(0).max(100), // Percentage 0-100
  totalVolumeUsd: z.string(),
  uniqueMakers: z.number().int().nonnegative(),
  lastUpdated: z.string(),
});

export type DailyVolumeSummaryResultDto = z.infer<typeof dailyVolumeSummaryResultSchema>;

/**
 * Volume comparison schema
 * Note: giveChainId and takeChainId are empty strings in simplified schema
 */
export const volumeComparisonResultSchema = z.object({
  date: z.string(),
  giveChainId: z.string(), // Empty string in simplified schema
  takeChainId: z.string(), // Empty string in simplified schema
  created: z.object({
    volumeUsd: z.string(),
    count: z.number().int().nonnegative(),
    avgUsd: z.string(),
  }),
  fulfilled: z.object({
    volumeUsd: z.string(),
    count: z.number().int().nonnegative(),
    avgUsd: z.string(),
  }),
  fulfillmentRate: z.number().min(0).max(100), // Percentage 0-100
  unfulfilled: z.object({
    volumeUsd: z.string(),
    count: z.number().int().nonnegative(),
  }),
});

export type VolumeComparisonResultDto = z.infer<typeof volumeComparisonResultSchema>;

/**
 * Volume time series point schema
 */
export const volumeTimeSeriesPointSchema = z.object({
  timestamp: z.string(),
  created: z.number().nonnegative(),
  fulfilled: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
});

export type VolumeTimeSeriesPointDto = z.infer<typeof volumeTimeSeriesPointSchema>;

/**
 * Top token pair schema
 * Note: Simplified schema has only single token_address (no give/take distinction)
 * giveTokenAddress and takeTokenAddress will be the same
 * giveChainId and takeChainId are empty strings
 */
export const topTokenPairByVolumeSchema = z.object({
  rank: z.number().int().positive(),
  giveTokenAddress: z.string(), // Same as takeTokenAddress in simplified schema
  takeTokenAddress: z.string(), // Same as giveTokenAddress in simplified schema
  giveChainId: z.string(), // Empty string in simplified schema
  takeChainId: z.string(), // Empty string in simplified schema
  totalVolumeUsd: z.string(),
  orderCount: z.number().int().nonnegative(),
  avgOrderUsd: z.string(),
  volumeShare: z.number().min(0).max(100),
});

export type TopTokenPairByVolumeDto = z.infer<typeof topTokenPairByVolumeSchema>;

/**
 * Volume by chain schema
 */
export const volumeByChainResultSchema = z.object({
  giveChainId: z.string(),
  takeChainId: z.string(),
  createdVolumeUsd: z.string(),
  fulfilledVolumeUsd: z.string(),
  orderCount: z.number().int().nonnegative(),
  volumeShare: z.number().min(0).max(100),
});

export type VolumeByChainResultDto = z.infer<typeof volumeByChainResultSchema>;

/**
 * Total stats schema (all time statistics)
 */
export const totalStatsResultSchema = z.object({
  created: z.object({
    totalVolumeUsd: z.string(),
    orderCount: z.number().int().nonnegative(),
    avgOrderUsd: z.string(),
  }),
  fulfilled: z.object({
    totalVolumeUsd: z.string(),
    orderCount: z.number().int().nonnegative(),
    avgOrderUsd: z.string(),
  }),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
});

export type TotalStatsResultDto = z.infer<typeof totalStatsResultSchema>;

/**
 * Health status schema
 */
export const healthStatusSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.string(),
  services: z.object({
    clickhouse: z.boolean(),
    redis: z.boolean(),
  }),
  version: z.string().optional(),
});

export type HealthStatusDto = z.infer<typeof healthStatusSchema>;

/**
 * Generic API response wrappers
 */
export const apiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    count: z.number().int().nonnegative().optional(),
    filters: z.record(z.any()).optional(),
    timestamp: z.string().optional(),
  });

export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  statusCode: z.number().int().optional(),
  timestamp: z.string().optional(),
});

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  count?: number;
  filters?: Record<string, any>;
  timestamp?: string;
};

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type DateRangeDto = z.infer<typeof dateRangeSchema>;
