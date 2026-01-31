import { createClient as createRedisClient, type RedisClientType } from 'redis';
import { createClient as createClickHouseClient, type ClickHouseClient } from '@clickhouse/client';
import { Connection as SolanaConnection } from '@solana/web3.js';
import { connect as amqpConnect, type Connection as AmqpConnection } from 'amqplib';
import type { Logger } from 'pino';
import type { Config } from '../config.js';

/**
 * ConnectionManager - centralized service for managing all external connections
 * 
 * Responsibilities:
 * - Initialize and manage Redis connection
 * - Initialize and manage ClickHouse connection
 * - Initialize and manage Solana RPC connection
 * - Initialize and manage RabbitMQ connection
 * - Provide graceful shutdown for all connections
 */
export class ConnectionManager {
  private redis!: RedisClientType;
  private clickhouse!: ClickHouseClient;
  private solana!: SolanaConnection;
  private rabbitmq?: AmqpConnection;

  constructor(
    private config: Config,
    private logger: Logger
  ) {}

  /**
   * Initialize all connections
   */
  async initialize(): Promise<void> {
    await this.initializeRedis();
    await this.initializeClickHouse();
    await this.initializeSolana();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    this.redis = createRedisClient({
      url: this.config.redis.url,
      password: this.config.redis.password,
      database: this.config.redis.db,
    });

    await this.redis.connect();
    this.logger.info('Connected to Redis');
  }

  /**
   * Initialize ClickHouse connection
   */
  private async initializeClickHouse(): Promise<void> {
    this.clickhouse = createClickHouseClient({
      host: this.config.clickhouse.url,
      database: this.config.clickhouse.database,
      username: this.config.clickhouse.username,
      password: this.config.clickhouse.password,
    });

    await this.clickhouse.ping();
    this.logger.info('Connected to ClickHouse');
  }

  /**
   * Initialize Solana connection
   */
  private initializeSolana(): void {
    this.solana = new SolanaConnection(
      this.config.solana.rpcUrl,
      {
        commitment: this.config.solana.commitment,
      }
    );
    this.logger.info('Solana connection initialized');
  }

  /**
   * Initialize RabbitMQ connection
   */
  async initializeRabbitMQ(): Promise<AmqpConnection> {
    const connection = await amqpConnect(this.config.rabbitmq.url);
    this.rabbitmq = connection as unknown as AmqpConnection;
    this.logger.info('Connected to RabbitMQ');
    return this.rabbitmq;
  }

  /**
   * Get Redis client
   */
  getRedis(): RedisClientType {
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }
    return this.redis;
  }

  /**
   * Get ClickHouse client
   */
  getClickHouse(): ClickHouseClient {
    if (!this.clickhouse) {
      throw new Error('ClickHouse not initialized');
    }
    return this.clickhouse;
  }

  /**
   * Get Solana connection
   */
  getSolana(): SolanaConnection {
    if (!this.solana) {
      throw new Error('Solana not initialized');
    }
    return this.solana;
  }

  /**
   * Get RabbitMQ connection
   */
  getRabbitMQ(): AmqpConnection {
    if (!this.rabbitmq) {
      throw new Error('RabbitMQ not initialized');
    }
    return this.rabbitmq as AmqpConnection;
  }

  /**
   * Gracefully close all connections
   */
  async closeAll(): Promise<void> {
    const errors: Error[] = [];

    // Close RabbitMQ
    if (this.rabbitmq) {
      try {
        // @ts-expect-error - TypeScript incorrectly infers Connection from Solana instead of amqplib
        await (this.rabbitmq as AmqpConnection).close();
        this.logger.info('RabbitMQ connection closed');
      } catch (error) {
        errors.push(error as Error);
        this.logger.error({ error }, 'Error closing RabbitMQ');
      }
    }

    // Close Redis
    if (this.redis) {
      try {
        await this.redis.disconnect();
        this.logger.info('Redis connection closed');
      } catch (error) {
        errors.push(error as Error);
        this.logger.error({ error }, 'Error closing Redis');
      }
    }

    // Close ClickHouse
    if (this.clickhouse) {
      try {
        await this.clickhouse.close();
        this.logger.info('ClickHouse connection closed');
      } catch (error) {
        errors.push(error as Error);
        this.logger.error({ error }, 'Error closing ClickHouse');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to close some connections: ${errors.map(e => e.message).join(', ')}`);
    }
  }
}
