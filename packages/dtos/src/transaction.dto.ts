import { z } from 'zod';
import { timestampSchema, transactionStatusSchema } from './common.dto.js';

/**
 * DLN Transaction DTO
 */
export const transactionDtoSchema = z.object({
  signature: z.string().min(1),
  slot: z.number().int().positive(),
  blockTime: z.number().int().positive(),
  status: transactionStatusSchema,
  fee: z.string(), // Use string for precise decimal handling
  programId: z.string().min(1),
  accounts: z.array(z.string()),
  instructions: z.array(
    z.object({
      programId: z.string(),
      accounts: z.array(z.string()),
      data: z.string(),
    }),
  ),
  logs: z.array(z.string()).optional(),
  error: z.string().optional(),
  processedAt: z.date().or(z.string().datetime()).optional(),
  ...timestampSchema.shape,
});

export type TransactionDto = z.infer<typeof transactionDtoSchema>;

/**
 * Transaction query filters
 */
export const transactionFiltersSchema = z.object({
  signature: z.string().optional(),
  programId: z.string().optional(),
  status: transactionStatusSchema.optional(),
  fromSlot: z.coerce.number().int().positive().optional(),
  toSlot: z.coerce.number().int().positive().optional(),
  fromBlockTime: z.coerce.number().int().positive().optional(),
  toBlockTime: z.coerce.number().int().positive().optional(),
  account: z.string().optional(),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

/**
 * Transaction statistics
 */
export const transactionStatsSchema = z.object({
  totalTransactions: z.number().int().nonnegative(),
  confirmedTransactions: z.number().int().nonnegative(),
  failedTransactions: z.number().int().nonnegative(),
  totalFees: z.string(),
  avgProcessingTime: z.number().nonnegative(),
  transactionsPerSecond: z.number().nonnegative(),
  period: z.object({
    from: z.date().or(z.string().datetime()),
    to: z.date().or(z.string().datetime()),
  }),
});

export type TransactionStats = z.infer<typeof transactionStatsSchema>;

/**
 * Transaction Ingestion Message
 * Message format sent from indexers to workers via RabbitMQ
 */
export const txIngestMessageSchema = z.object({
  // Core transaction identifier
  signature: z.string().min(1).max(128),
  
  // Metadata for processing
  slot: z.number().int().positive(),
  blockTime: z.number().int().positive().optional(),
  
  // Source tracking
  source: z.enum(['history', 'realtime']).describe('Indexer mode that discovered this tx'),
  programId: z.string().min(1).max(64),
  
  // Processing metadata
  enqueuedAt: z.string().datetime(),
  attempt: z.number().int().nonnegative().default(0),
  
  // Optional priority for future use
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export type TxIngestMessage = z.infer<typeof txIngestMessageSchema>;

/**
 * Helper to create a TxIngestMessage
 */
export function createTxIngestMessage(
  params: Omit<TxIngestMessage, 'enqueuedAt' | 'attempt' | 'priority'> & {
    priority?: 'low' | 'normal' | 'high';
  }
): TxIngestMessage {
  return txIngestMessageSchema.parse({
    ...params,
    enqueuedAt: new Date().toISOString(),
    attempt: 0,
    priority: params.priority ?? 'normal',
  });
}
