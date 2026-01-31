import { z } from 'zod';
import { timestampSchema, chainIdSchema } from './common.dto.js';

/**
 * Token metadata DTO
 */
export const tokenDtoSchema = z.object({
  address: z.string().min(1),
  chainId: chainIdSchema,
  symbol: z.string().min(1),
  name: z.string().min(1),
  decimals: z.number().int().nonnegative(),
  logoUri: z.string().url().optional(),
  coingeckoId: z.string().optional(),
  isVerified: z.boolean().default(false),
  ...timestampSchema.shape,
});

export type TokenDto = z.infer<typeof tokenDtoSchema>;

/**
 * Token price DTO
 */
export const tokenPriceDtoSchema = z.object({
  address: z.string().min(1),
  chainId: chainIdSchema,
  priceUsd: z.string(), // Use string for precise decimal handling
  priceChange24h: z.number().optional(),
  volume24h: z.string().optional(),
  marketCap: z.string().optional(),
  lastUpdated: z.date().or(z.string().datetime()),
});

export type TokenPriceDto = z.infer<typeof tokenPriceDtoSchema>;

/**
 * Token pair statistics
 */
export const tokenPairStatsSchema = z.object({
  giveTokenAddress: z.string().min(1),
  takeTokenAddress: z.string().min(1),
  giveChainId: chainIdSchema,
  takeChainId: chainIdSchema,
  totalOrders: z.number().int().nonnegative(),
  totalVolume: z.string(),
  totalVolumeUsd: z.string(),
  avgPrice: z.string(),
  period: z.object({
    from: z.date().or(z.string().datetime()),
    to: z.date().or(z.string().datetime()),
  }),
});

export type TokenPairStats = z.infer<typeof tokenPairStatsSchema>;
