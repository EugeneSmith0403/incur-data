import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  rabbitmq: z.object({
    url: z.string().url(),
    queueName: z.string().min(1), // Required, must be unique per worker
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
  jupiter: z.object({
    apiUrl: z.string().url().default('https://api.jup.ag'),
    apiKey: z.string().optional(), // Made optional as Jupiter Price API v2 may not always require it
    priceEndpoint: z.string().default('/price/v3'),
    timeout: z.coerce.number().default(10000), // Increased to 10 seconds
    retryAttempts: z.coerce.number().default(3),
    cacheTtl: z.coerce.number().default(300), // 5 minutes (300 seconds)
    rateLimit: z.coerce.number().default(1000), // Minimum delay between requests in ms (1 RPS = 1000ms)
  }),
  worker: z.object({
    concurrency: z.coerce.number().default(10),
    batchSize: z.coerce.number().default(100),
    retryAttempts: z.coerce.number().default(3),
    retryDelay: z.coerce.number().default(1000),
    retryBackoffMultiplier: z.coerce.number().default(2),
    maxRetryDelay: z.coerce.number().default(30000), // 30 seconds
    prefetchCount: z.coerce.number().default(10),
    batchFlushInterval: z.coerce.number().default(5000), // 5 seconds
    metricsPort: z.coerce.number().default(9090),
  }),
  solana: z.object({
    rpcUrl: z.string().url(),
    commitment: z.enum(['processed', 'confirmed', 'finalized']).default('confirmed'),
  }),
});

export type Config = z.infer<typeof configSchema>;

export function getConfig(): Config {
  return configSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
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
    jupiter: {
      apiUrl: process.env.JUPITER_API_URL,
      apiKey: process.env.JUPITER_API_KEY,
      priceEndpoint: process.env.JUPITER_PRICE_ENDPOINT,
      timeout: process.env.JUPITER_TIMEOUT,
      retryAttempts: process.env.JUPITER_RETRY_ATTEMPTS,
      cacheTtl: process.env.JUPITER_CACHE_TTL,
      rateLimit: process.env.JUPITER_RATE_LIMIT,
    },
    worker: {
      concurrency: process.env.WORKER_CONCURRENCY,
      batchSize: process.env.WORKER_BATCH_SIZE,
      retryAttempts: process.env.WORKER_RETRY_ATTEMPTS,
      retryDelay: process.env.WORKER_RETRY_DELAY,
      retryBackoffMultiplier: process.env.WORKER_RETRY_BACKOFF_MULTIPLIER,
      maxRetryDelay: process.env.WORKER_MAX_RETRY_DELAY,
      prefetchCount: process.env.RABBITMQ_PREFETCH_COUNT,
      batchFlushInterval: process.env.WORKER_BATCH_FLUSH_INTERVAL,
      metricsPort: process.env.WORKER_METRICS_PORT,
    },
    solana: {
      rpcUrl: process.env.SOLANA_RPC_URL,
      commitment: process.env.SOLANA_COMMITMENT as any,
    },
  });
}
