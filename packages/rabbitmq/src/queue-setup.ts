import type { Channel } from 'amqplib';
import type { Logger } from 'pino';
import type { QueueConfig } from './types.js';

/**
 * Sets up RabbitMQ queues with retry and DLQ support
 * 
 * This creates:
 * 1. Main exchange and queue
 * 2. Dead Letter Exchange (DLX) and Dead Letter Queue (DLQ)
 * 3. Retry mechanism using message TTL and DLX
 * 
 * Flow:
 * - Messages are published to main exchange -> main queue
 * - Failed messages go to DLX -> retry queue (with TTL)
 * - After TTL expires, messages return to main queue
 * - After max retries, messages go to DLQ for manual inspection
 */
export async function setupQueues(
  channel: Channel,
  config: QueueConfig,
  logger: Logger
): Promise<void> {
  const {
    queueName,
    dlqName,
    exchangeName,
    dlxName,
    retryDelay,
    durable = true,
    messageTtl,
  } = config;

  logger.info({ config }, 'Setting up RabbitMQ queues');

  // 1. Setup Dead Letter Exchange (DLX)
  await channel.assertExchange(dlxName, 'topic', {
    durable,
  });
  logger.debug({ exchange: dlxName }, 'DLX created');

  // 2. Setup Dead Letter Queue (DLQ) - final resting place for failed messages
  await channel.assertQueue(dlqName, {
    durable,
    arguments: {
      // No DLX for DLQ - messages stay here for manual intervention
    },
  });
  
  await channel.bindQueue(dlqName, dlxName, 'dlq.#');
  logger.debug({ queue: dlqName }, 'DLQ created and bound');

  // 3. Setup Main Exchange
  await channel.assertExchange(exchangeName, 'topic', {
    durable,
  });
  logger.debug({ exchange: exchangeName }, 'Main exchange created');

  // 4. Setup Retry Queue (messages wait here before being retried)
  const retryQueueName = `${queueName}.retry`;
  await channel.assertQueue(retryQueueName, {
    durable,
    arguments: {
      'x-dead-letter-exchange': exchangeName,
      'x-dead-letter-routing-key': queueName,
      'x-message-ttl': retryDelay, // After this time, message goes back to main queue
    },
  });
  
  await channel.bindQueue(retryQueueName, dlxName, 'retry.#');
  logger.debug({ queue: retryQueueName, ttl: retryDelay }, 'Retry queue created');

  // 5. Setup Main Queue
  const queueArgs: Record<string, any> = {
    'x-dead-letter-exchange': dlxName,
    'x-dead-letter-routing-key': 'retry.message',
  };

  if (messageTtl) {
    queueArgs['x-message-ttl'] = messageTtl;
  }

  await channel.assertQueue(queueName, {
    durable,
    arguments: queueArgs,
  });

  await channel.bindQueue(queueName, exchangeName, queueName);
  logger.debug({ queue: queueName }, 'Main queue created and bound');

  logger.info('RabbitMQ queue setup completed successfully');
}

/**
 * Creates a default queue configuration
 */
export function createQueueConfig(
  queueName: string,
  options: {
    retryDelay?: number;
    maxRetries?: number;
    messageTtl?: number;
  } = {}
): QueueConfig {
  return {
    queueName,
    dlqName: `${queueName}.dlq`,
    exchangeName: `${queueName}.exchange`,
    dlxName: `${queueName}.dlx`,
    retryDelay: options.retryDelay ?? 5000, // 5 seconds default
    maxRetries: options.maxRetries ?? 3,
    durable: true,
    messageTtl: options.messageTtl,
  };
}

/**
 * Purges all messages from a queue (useful for testing)
 */
export async function purgeQueue(
  channel: Channel,
  queueName: string,
  logger: Logger
): Promise<void> {
  try {
    const result = await channel.purgeQueue(queueName);
    logger.info({ queue: queueName, messageCount: result.messageCount }, 'Queue purged');
  } catch (error) {
    logger.error({ queue: queueName, error }, 'Failed to purge queue');
    throw error;
  }
}

/**
 * Deletes a queue and all its messages
 */
export async function deleteQueue(
  channel: Channel,
  queueName: string,
  logger: Logger
): Promise<void> {
  try {
    const result = await channel.deleteQueue(queueName);
    logger.info({ queue: queueName, messageCount: result.messageCount }, 'Queue deleted');
  } catch (error) {
    logger.error({ queue: queueName, error }, 'Failed to delete queue');
    throw error;
  }
}

/**
 * Gets queue statistics
 */
export async function getQueueStats(
  channel: Channel,
  queueName: string
): Promise<{
  queue: string;
  messageCount: number;
  consumerCount: number;
}> {
  const queueInfo = await channel.checkQueue(queueName);
  return {
    queue: queueName,
    messageCount: queueInfo.messageCount,
    consumerCount: queueInfo.consumerCount,
  };
}
