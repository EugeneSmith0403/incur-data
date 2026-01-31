import type { Logger } from 'pino';

/**
 * Queue configuration for RabbitMQ setup
 */
export interface QueueConfig {
  // Main queue name
  queueName: string;
  
  // Dead Letter Queue (DLQ) name
  dlqName: string;
  
  // Exchange names
  exchangeName: string;
  dlxName: string; // Dead Letter Exchange
  
  // Retry configuration
  retryDelay: number; // milliseconds
  maxRetries: number;
  
  // Queue options
  durable?: boolean;
  messageTtl?: number; // milliseconds
}

/**
 * Publisher options
 */
export interface PublishOptions {
  persistent?: boolean;
  priority?: number;
  expiration?: string; // milliseconds as string
  headers?: Record<string, any>;
}

/**
 * Consumer handler function
 */
export type MessageHandler<T = any> = (
  message: T,
  metadata: MessageMetadata
) => Promise<boolean | void>;

/**
 * Metadata about a message
 */
export interface MessageMetadata {
  deliveryTag: number;
  redelivered: boolean;
  exchange: string;
  routingKey: string;
  messageId?: string;
  timestamp?: number;
  headers?: Record<string, any>;
  attempt: number;
}

/**
 * Consumer configuration
 */
export interface ConsumerConfig {
  prefetchCount?: number;
  noAck?: boolean;
  exclusive?: boolean;
}

/**
 * RabbitMQ connection configuration
 */
export interface RabbitMQConfig {
  url: string;
  logger: Logger;
}
