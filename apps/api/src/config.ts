import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  api: z.object({
    port: z.coerce.number().default(3000),
    host: z.string().default('0.0.0.0'),
    corsOrigin: z.string()
      .default('http://localhost:3000')
      .refine((val) => {
        // Reject wildcard in production for security
        if (process.env.NODE_ENV === 'production' && val === '*') {
          throw new Error('CORS wildcard (*) not allowed in production. Please specify allowed origins.');
        }
        return true;
      }),
    rateLimit: z.coerce.number().default(100),
  }),
  auth: z.object({
    adminApiKey: z.string()
      .min(32, 'Admin API key must be at least 32 characters')
      .optional(),
    enabled: z.coerce.boolean().default(true),
  }),
  clickhouse: z.object({
    url: z.string().url(),
    database: z.string().default('dln'),
    username: z.string().default('default'),
    password: z.string().optional(),
  }),
  redis: z.object({
    url: z.string().url(),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
  }),
  metrics: z.object({
    enabled: z.coerce.boolean().default(true),
    port: z.coerce.number().default(9090),
  }),
});

export type Config = z.infer<typeof configSchema>;

export function getConfig(): Config {
  return configSchema.parse({
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
    api: {
      port: process.env.API_PORT,
      host: process.env.API_HOST,
      corsOrigin: process.env.API_CORS_ORIGIN,
      rateLimit: process.env.API_RATE_LIMIT,
    },
    auth: {
      adminApiKey: process.env.API_ADMIN_KEY,
      enabled: process.env.API_AUTH_ENABLED,
    },
    clickhouse: {
      url: process.env.CLICKHOUSE_URL,
      database: process.env.CLICKHOUSE_DATABASE,
      username: process.env.CLICKHOUSE_USERNAME,
      password: process.env.CLICKHOUSE_PASSWORD,
    },
    redis: {
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
    },
    metrics: {
      enabled: process.env.ENABLE_METRICS,
      port: process.env.METRICS_PORT,
    },
  });
}
