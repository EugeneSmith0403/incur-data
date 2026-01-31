import { z } from 'zod';

/**
 * Base timestamp fields for all entities
 */
export const timestampSchema = z.object({
  createdAt: z.date().or(z.string().datetime()),
  updatedAt: z.date().or(z.string().datetime()).optional(),
});

export type Timestamp = z.infer<typeof timestampSchema>;

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Paginated response wrapper
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  });

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Blockchain network identifiers
 */
export const chainIdSchema = z.union([
  z.literal('solana'),
  z.literal('ethereum'),
  z.literal('arbitrum'),
  z.literal('polygon'),
  z.literal('bsc'),
  z.string(), // Allow custom chain IDs
]);

export type ChainId = z.infer<typeof chainIdSchema>;

/**
 * Transaction status
 */
export const transactionStatusSchema = z.enum([
  'pending',
  'confirmed',
  'finalized',
  'failed',
  'cancelled',
]);

export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
