import { Connection as SolanaConnection } from '@solana/web3.js';
import { connect as amqpConnect, type Connection as AmqpConnection } from 'amqplib';
import { createClient as createRedisClient, type RedisClientType } from 'redis';
import { createClient as createClickHouseClient, type ClickHouseClient } from '@clickhouse/client';
import type { Logger } from 'pino';
import { setupQueues, createQueueConfig, createPublisher, type RabbitMQPublisher } from '@incur-data/rabbitmq';
import type { Config } from '../config.js';
import type { IService } from './types.js';

/**
 * Service for managing all external connections
 * Handles Solana, Redis, and RabbitMQ connections
 */
export class ConnectionService implements IService {
  private config: Config;
  private logger: Logger;

  // Connections
  public solanaConnection!: SolanaConnection;
  public redisClient!: RedisClientType;
  public clickhouseClient!: ClickHouseClient;
  public rabbitConnection!: AmqpConnection;
  public publisher!: RabbitMQPublisher;

  private isConnected = false;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize Solana connection
   */
  private initializeSolanaConnection(): SolanaConnection {
    this.logger.info({ rpcUrl: this.config.solana.rpcUrl }, 'Initializing Solana connection');
    
    // Suppress logsSubscribe errors from RPC providers that don't support it
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const message = args[0];
      // Ignore logsSubscribe errors
      if (typeof message === 'string' && message.includes('logsSubscribe')) {
        return;
      }
      originalConsoleError.apply(console, args);
    };
    
    return new SolanaConnection(this.config.solana.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: this.config.solana.wssUrl,
    });
  }

  /**
   * Initialize Redis client
   */
  private initializeRedisClient(): RedisClientType {
    this.logger.info({ url: this.config.redis.url }, 'Initializing Redis client');
    
    return createRedisClient({
      url: this.config.redis.url,
      password: this.config.redis.password,
      database: this.config.redis.db,
    }) as RedisClientType;
  }

  /**
   * Initialize ClickHouse client
   */
  private initializeClickHouseClient(): ClickHouseClient {
    this.logger.info({ url: this.config.clickhouse.url }, 'Initializing ClickHouse client');
    
    return createClickHouseClient({
      host: this.config.clickhouse.url,
      database: this.config.clickhouse.database,
      username: this.config.clickhouse.username,
      password: this.config.clickhouse.password,
    });
  }

  /**
   * Connect to all services
   */
  async start(): Promise<void> {
    if (this.isConnected) {
      this.logger.warn('Already connected to services');
      return;
    }

    try {
      // Initialize Solana connection
      this.solanaConnection = this.initializeSolanaConnection();
      this.logger.info('Solana connection initialized');

      // Initialize and connect Redis
      this.redisClient = this.initializeRedisClient();
      await this.redisClient.connect();
      this.logger.info('Connected to Redis');

      // Initialize and connect ClickHouse
      this.clickhouseClient = this.initializeClickHouseClient();
      await this.clickhouseClient.ping();
      this.logger.info('Connected to ClickHouse');

      // Connect to RabbitMQ
      const connection = await amqpConnect(this.config.rabbitmq.url);
      this.rabbitConnection = connection as unknown as AmqpConnection;
      this.logger.info('Connected to RabbitMQ');

      // Setup RabbitMQ queues
      const channel = await connection.createChannel();
      const queueConfig = createQueueConfig(this.config.rabbitmq.queueName, {
        retryDelay: this.config.rabbitmq.retryDelay,
        maxRetries: this.config.rabbitmq.maxRetries,
      });
      
      await setupQueues(channel, queueConfig, this.logger);
      await channel.close();
      this.logger.info('RabbitMQ queues configured');

      // Create publisher with confirm channel (use the exchange name from queueConfig)
      this.publisher = await createPublisher(
        this.rabbitConnection,
        queueConfig.exchangeName,
        this.logger
      );
      this.logger.info('RabbitMQ publisher ready');

      this.isConnected = true;
      this.logger.info('All connections established successfully');
    } catch (error) {
      this.logger.error({ error }, 'Failed to establish connections');
      await this.stop();
      throw error;
    }
  }

  /**
   * Close all connections
   */
  async stop(): Promise<void> {
    this.logger.info('Closing all connections');

    try {
      if (this.publisher) {
        await this.publisher.close();
        this.logger.info('RabbitMQ publisher closed');
      }

      if (this.rabbitConnection) {
        await (this.rabbitConnection as any).close();
        this.logger.info('RabbitMQ connection closed');
      }

      if (this.redisClient) {
        await this.redisClient.disconnect();
        this.logger.info('Redis connection closed');
      }

      if (this.clickhouseClient) {
        await this.clickhouseClient.close();
        this.logger.info('ClickHouse connection closed');
      }

      this.isConnected = false;
      this.logger.info('All connections closed');
    } catch (error) {
      this.logger.error({ error }, 'Error while closing connections');
      throw error;
    }
  }

  /**
   * Check if all connections are active
   */
  isHealthy(): boolean {
    return this.isConnected && 
           this.redisClient?.isOpen === true &&
           this.rabbitConnection !== null;
  }

  /**
   * Get Solana connection (recreate if needed for WebSocket mode)
   */
  createFreshSolanaConnection(): SolanaConnection {
    return new SolanaConnection(this.config.solana.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: this.config.solana.wssUrl,
    });
  }
}
