import type { Connection } from '@solana/web3.js';
import type { RedisClientType } from 'redis';
import type { Logger } from 'pino';
import type { RabbitMQPublisher } from '@incur-data/rabbitmq';
import type { Config } from '../config.js';

/**
 * Service dependencies shared across all services
 */
export interface ServiceDependencies {
  connection: Connection;
  redis: RedisClientType;
  publisher: RabbitMQPublisher;
  config: Config;
  logger: Logger;
}

/**
 * Base service interface
 */
export interface IService {
  start?(): Promise<void>;
  stop?(): Promise<void>;
}

/**
 * Indexer mode types
 */
export type IndexerMode = 'history' | 'realtime' | 'backfill' | 'websocket';
