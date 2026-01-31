import { z } from 'zod';
import { timestampSchema, chainIdSchema } from './common.dto.js';

/**
 * DLN Order status
 */
export const orderStatusSchema = z.enum([
  'created',
  'fulfilled',
  'cancelled',
  'claimed',
  'expired',
]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

/**
 * DLN Order DTO
 */
export const orderDtoSchema = z.object({
  orderId: z.string().min(1),
  signature: z.string().min(1),
  maker: z.string().min(1),
  taker: z.string().optional(),
  giveChainId: chainIdSchema,
  takeChainId: chainIdSchema,
  giveTokenAddress: z.string().min(1),
  takeTokenAddress: z.string().min(1),
  giveAmount: z.string(), // Use string for precise decimal handling
  takeAmount: z.string(),
  giveAmountUsd: z.string().optional(),
  takeAmountUsd: z.string().optional(),
  status: orderStatusSchema,
  createdSlot: z.number().int().positive(),
  fulfilledSlot: z.number().int().positive().optional(),
  expirySlot: z.number().int().positive().optional(),
  affiliateFee: z.string().optional(),
  allowedTaker: z.string().optional(),
  allowedCancelBeneficiary: z.string().optional(),
  externalCall: z.string().optional(),
  ...timestampSchema.shape,
});

export type OrderDto = z.infer<typeof orderDtoSchema>;

/**
 * Order query filters
 */
export const orderFiltersSchema = z.object({
  orderId: z.string().optional(),
  maker: z.string().optional(),
  taker: z.string().optional(),
  status: orderStatusSchema.optional(),
  giveChainId: chainIdSchema.optional(),
  takeChainId: chainIdSchema.optional(),
  giveTokenAddress: z.string().optional(),
  takeTokenAddress: z.string().optional(),
  fromSlot: z.coerce.number().int().positive().optional(),
  toSlot: z.coerce.number().int().positive().optional(),
});

export type OrderFilters = z.infer<typeof orderFiltersSchema>;

/**
 * Order statistics
 */
export const orderStatsSchema = z.object({
  totalOrders: z.number().int().nonnegative(),
  activeOrders: z.number().int().nonnegative(),
  fulfilledOrders: z.number().int().nonnegative(),
  cancelledOrders: z.number().int().nonnegative(),
  totalVolume: z.string(),
  totalVolumeUsd: z.string(),
  avgFulfillmentTime: z.number().nonnegative(),
  uniqueMakers: z.number().int().nonnegative(),
  uniqueTakers: z.number().int().nonnegative(),
  period: z.object({
    from: z.date().or(z.string().datetime()),
    to: z.date().or(z.string().datetime()),
  }),
});

export type OrderStats = z.infer<typeof orderStatsSchema>;
