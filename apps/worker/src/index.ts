import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: join(__dirname, '../../../.env') });

import Fastify from 'fastify';
import { pino } from 'pino';
import type { Connection as AmqpConnection } from 'amqplib';
import { type TxIngestMessage } from '@incur-data/dtos';
import { setupQueues, createQueueConfig, createConsumer, type MessageMetadata, type RabbitMQConsumer } from '@incur-data/rabbitmq';
import { getConfig, type Config } from './config.js';
import { ConnectionManager } from './services/connection-manager.service.js';
import { JupiterPriceService } from './services/jupiter-price.service.js';
import { TransactionProcessor } from './services/transaction-processor.service.js';
import { RedisService } from './services/redis.service.js';

// Create logger first for error reporting
const tempLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

let config: Config;
try {
  config = getConfig();
} catch (error) {
  tempLogger.error({ error }, 'Failed to load configuration. Check your .env file.');
  tempLogger.error('Required environment variables:');
  tempLogger.error('  - RABBITMQ_URL');
  tempLogger.error('  - RABBITMQ_QUEUE_NAME');
  tempLogger.error('  - REDIS_URL');
  tempLogger.error('  - CLICKHOUSE_URL');
  tempLogger.error('  - SOLANA_RPC_URL');
  process.exit(1);
}

const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
});

logger.info('🚀 Worker starting...');
logger.info({
  nodeEnv: config.nodeEnv,
  logLevel: config.logLevel,
  queueName: config.rabbitmq.queueName,
}, 'Worker configuration loaded');

/**
 * Worker - processes Solana transactions and stores in single table
 */
class Worker {
  private connectionManager: ConnectionManager;
  private jupiterPriceService!: JupiterPriceService;
  private transactionProcessor!: TransactionProcessor;
  private fastify!: ReturnType<typeof Fastify>;

  constructor() {
    this.connectionManager = new ConnectionManager(config, logger);
  }

  /**
   * Initialize services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing worker services...');

    // Initialize connections
    await this.connectionManager.initialize();

    // Initialize Jupiter price service
    this.jupiterPriceService = new JupiterPriceService(
      config.jupiter,
      this.connectionManager.getRedis() as any,
      logger
    );
    logger.info('Jupiter price service initialized');

    // Initialize Redis service
    const redisService = new RedisService(this.connectionManager.getRedis() as any);

    // Initialize transaction processor
    this.transactionProcessor = new TransactionProcessor(
      this.connectionManager.getClickHouse(),
      this.connectionManager.getSolana(),
      this.jupiterPriceService,
      redisService,
      logger
    );
    logger.info('Transaction processor initialized');
  }

  /**
   * Start metrics/health check server
   */
  async startMetricsServer(): Promise<void> {
    this.fastify = Fastify({ logger: false });

    this.fastify.get('/health', async () => ({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }));

    this.fastify.get('/metrics', async () => ({
      timestamp: new Date().toISOString(),
    }));

    const metricsPort = config.worker.metricsPort || 9090;
    await this.fastify.listen({ port: metricsPort, host: '0.0.0.0' });
    logger.info({ port: metricsPort }, 'Metrics server started');
  }

  /**
   * Start consuming messages
   */
  async startConsumer(): Promise<void> {
    // Connect to RabbitMQ
    await this.connectionManager.initializeRabbitMQ();
    const rabbitmq: AmqpConnection = this.connectionManager.getRabbitMQ() as unknown as AmqpConnection;

    // Setup queues
    // @ts-expect-error - TypeScript incorrectly infers Connection from Solana
    const channel = await rabbitmq.createChannel();
    const queueConfig = createQueueConfig(config.rabbitmq.queueName, {
      retryDelay: config.rabbitmq.retryDelay,
      maxRetries: config.rabbitmq.maxRetries,
    });

    await setupQueues(channel, queueConfig, logger);
    await channel.close();

    // Create consumer
    const consumer = await createConsumer(
      rabbitmq,
      config.rabbitmq.queueName,
      queueConfig,
      logger
    );

    // Start consuming
    await consumer.consume(
      (message: TxIngestMessage, metadata: MessageMetadata) =>
        this.transactionProcessor.processTransaction(message, metadata),
      {
        prefetchCount: config.worker.prefetchCount,
      }
    );

    logger.info(
      {
        queue: config.rabbitmq.queueName,
        prefetch: config.worker.prefetchCount,
      },
      'Worker started and waiting for messages'
    );

    // Setup graceful shutdown
    this.setupGracefulShutdown(consumer);
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(consumer: RabbitMQConsumer): void {
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...');

      try {
        // Stop consuming
        await consumer.close();

        // Flush remaining batches
        await this.transactionProcessor.shutdown();

        // Close connections
        await this.connectionManager.closeAll();

        // Close metrics server
        if (this.fastify) {
          await this.fastify.close();
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      gracefulShutdown();
    });
    process.on('unhandledRejection', (reason) => {
      logger.error({ reason }, 'Unhandled rejection');
      gracefulShutdown();
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    await this.initialize();
    await this.startMetricsServer();
    await this.startConsumer();
  }
}

// Start the worker
logger.info('⚙️  Initializing worker instance...');
const worker = new Worker();
worker.start().catch((error) => {
  logger.error({ error }, '❌ Failed to start worker');
  logger.error('Check your .env file and ensure all required services (RabbitMQ, Redis, ClickHouse) are running.');
  process.exit(1);
});
