import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  solana: z.object({
    rpcUrl: z.string().url(),
    wssUrl: z.string().url().optional(),
    dlnProgramId: z.string().min(1, 'DLN_PROGRAM_ID is required'),
  }),
  rabbitmq: z.object({
    url: z.string().url(),
    queueName: z.string().default('dln_transactions'),
    retryDelay: z.coerce.number().default(5000), // 5 seconds
    maxRetries: z.coerce.number().default(3),
  }),
  redis: z.object({
    url: z.string().url(),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
  }),
  clickhouse: z.object({
    url: z.string().url(),
    database: z.string().default('dln'),
    username: z.string().default('default'),
    password: z.string().optional(),
  }),
  indexer: z.object({
    port: z.coerce.number().default(8080),
    batchSize: z.coerce.number().default(1000),
    // Target number of transactions before switching to realtime
    targetTransactions: z.coerce.number().default(25000),
    // Time gap in hours to trigger backfill (default: 2 hours)
    gapTimeHours: z.coerce.number().default(2),
    // Retry configuration
    retryAttempts: z.coerce.number().default(5),
    retryDelay: z.coerce.number().default(1000),
    retryBackoffMultiplier: z.coerce.number().default(2),
    maxRetryDelay: z.coerce.number().default(30000),
  }),
});

export type Config = z.infer<typeof configSchema>;

export function getConfig(): Config {
  // Debug: Log environment variable before parsing
  console.log('INDEXER_TARGET_TRANSACTIONS from env:', process.env.INDEXER_TARGET_TRANSACTIONS);

  const config = configSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    solana: {
      rpcUrl: process.env.SOLANA_RPC_URL,
      wssUrl: process.env.SOLANA_WSS_URL,
      dlnProgramId: process.env.DLN_PROGRAM_ID,
    },
    rabbitmq: {
      url: process.env.RABBITMQ_URL,
      queueName: process.env.RABBITMQ_QUEUE_NAME,
      retryDelay: process.env.RABBITMQ_RETRY_DELAY,
      maxRetries: process.env.RABBITMQ_MAX_RETRIES,
    },
    redis: {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
    },
    clickhouse: {
      url: process.env.CLICKHOUSE_URL,
      database: process.env.CLICKHOUSE_DATABASE,
      username: process.env.CLICKHOUSE_USERNAME,
      password: process.env.CLICKHOUSE_PASSWORD,
    },
    indexer: {
      port: process.env.INDEXER_PORT,
      batchSize: process.env.INDEXER_BATCH_SIZE,
      targetTransactions: process.env.INDEXER_TARGET_TRANSACTIONS,
      gapTimeHours: process.env.INDEXER_GAP_TIME_HOURS,
      retryAttempts: process.env.INDEXER_RETRY_ATTEMPTS,
      retryDelay: process.env.INDEXER_RETRY_DELAY,
      retryBackoffMultiplier: process.env.INDEXER_RETRY_BACKOFF_MULTIPLIER,
      maxRetryDelay: process.env.INDEXER_MAX_RETRY_DELAY,
    },
  });

  // Debug: Log parsed value
  console.log('targetTransactions after parsing:', config.indexer.targetTransactions);

  return config;
}
