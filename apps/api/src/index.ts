import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: join(__dirname, '../../../.env') });
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createClient } from '@clickhouse/client';
import { createClient as createRedisClient } from 'redis';
import { getConfig } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware.js';

const config = getConfig();

const fastify = Fastify({
  logger: {
    level: config.logLevel,
    transport: config.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
  },
});

// Register plugins
await fastify.register(cors, {
  origin: config.api.corsOrigin.includes(',')
    ? config.api.corsOrigin.split(',').map(s => s.trim())
    : config.api.corsOrigin,
});

await fastify.register(rateLimit, {
  max: config.api.rateLimit,
  timeWindow: '1 minute',
});

await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'DLN Indexer API',
      description: 'REST API for Solana DLN transaction data',
      version: '1.0.0',
    },
  },
});

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
});

// Register error handlers
fastify.setErrorHandler(errorHandler);
fastify.setNotFoundHandler(notFoundHandler);

// Initialize ClickHouse client
const clickhouse = createClient({
  host: config.clickhouse.url,
  database: config.clickhouse.database,
  username: config.clickhouse.username,
  password: config.clickhouse.password,
});

// Initialize Redis client
const redis = createRedisClient({
  url: config.redis.url,
  password: config.redis.password,
  database: config.redis.db,
});
await redis.connect();

// Initialize services
import { VolumeAggregationService } from './services/volume-aggregation.service.js';
import { registerAnalyticsRoutes } from './routes/analytics.routes.js';
import { healthResponseSchema } from './schemas/volume.schema.js';

const volumeService = new VolumeAggregationService({
  clickhouse,
  redis: redis as any, // Type cast to avoid Redis type conflicts
  cacheTtlSeconds: 300, // 5 minutes
  enableCache: true,
});

// Register routes
await registerAnalyticsRoutes(fastify, { volumeService });

// Health check endpoint with Zod validation
fastify.get('/health', {
  schema: {
    description: 'Health check endpoint for service monitoring',
    tags: ['System'],
    response: {
      200: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
          timestamp: { type: 'string' },
          services: {
            type: 'object',
            properties: {
              clickhouse: { type: 'boolean' },
              redis: { type: 'boolean' },
            },
          },
          version: { type: 'string' },
        },
      },
    },
  },
  handler: async (_request, reply) => {
    try {
      const clickhouseHealth = await clickhouse.ping();
      const redisHealth = redis.isOpen;

      const allHealthy = clickhouseHealth && redisHealth;
      const anyHealthy = clickhouseHealth || redisHealth;

      const status = allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy';

      const response = {
        status,
        timestamp: new Date().toISOString(),
        services: {
          clickhouse: clickhouseHealth,
          redis: redisHealth,
        },
        version: '1.0.0',
      };

      // Validate response with Zod
      const validated = healthResponseSchema.parse(response);

      // Set appropriate status code
      if (status === 'unhealthy') {
        reply.status(503);
      } else if (status === 'degraded') {
        reply.status(200); // Still return 200 for degraded
      }

      return validated;
    } catch (error) {
      fastify.log.error({ error }, 'Health check error');
      reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          clickhouse: false,
          redis: false,
        },
        version: '1.0.0',
      });
    }
  },
});

// Start server
try {
  await fastify.listen({
    port: config.api.port,
    host: config.api.host,
  });
  fastify.log.info(`API server listening on ${config.api.host}:${config.api.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// Graceful shutdown
const gracefulShutdown = async () => {
  fastify.log.info('Shutting down gracefully...');
  await redis.disconnect();
  await clickhouse.close();
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
