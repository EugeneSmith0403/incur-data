import type { Channel } from 'amqplib';
import type { Logger } from 'pino';
import { txIngestMessageSchema, type TxIngestMessage } from '@incur-data/dtos';
import type { PublishOptions } from './types.js';

/**
 * Publisher class for sending messages to RabbitMQ
 */
export class RabbitMQPublisher {
  private channel: Channel;
  private exchangeName: string;
  private logger: Logger;

  constructor(channel: Channel, exchangeName: string, logger: Logger) {
    this.channel = channel;
    this.exchangeName = exchangeName;
    this.logger = logger;
  }

  /**
   * Publishes a TxIngestMessage to the queue
   */
  async publishTxIngest(
    routingKey: string,
    message: TxIngestMessage,
    options: PublishOptions = {}
  ): Promise<boolean> {
    try {
      // Validate message before publishing
      const validatedMessage = txIngestMessageSchema.parse(message);

      const messageBuffer = Buffer.from(JSON.stringify(validatedMessage));

      const publishOptions = {
        persistent: options.persistent ?? true,
        contentType: 'application/json',
        contentEncoding: 'utf-8',
        timestamp: Date.now(),
        messageId: validatedMessage.signature,
        headers: {
          attempt: validatedMessage.attempt,
          source: validatedMessage.source,
          priority: validatedMessage.priority,
          ...options.headers,
        },
        ...(options.priority && { priority: options.priority }),
        ...(options.expiration && { expiration: options.expiration }),
      };

      const published = this.channel.publish(
        this.exchangeName,
        routingKey,
        messageBuffer,
        publishOptions
      );

      if (!published) {
        this.logger.warn(
          { signature: validatedMessage.signature, routingKey },
          'Message not published - channel buffer full'
        );
        return false;
      }

      this.logger.debug(
        {
          signature: validatedMessage.signature,
          slot: validatedMessage.slot,
          source: validatedMessage.source,
          routingKey,
        },
        'Message published'
      );

      return true;
    } catch (error) {
      this.logger.error(
        { message, routingKey, error },
        'Failed to publish message'
      );
      throw error;
    }
  }

  /**
   * Publishes multiple messages in batch
   */
  async publishBatch(
    routingKey: string,
    messages: TxIngestMessage[],
    options: PublishOptions = {}
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        const published = await this.publishTxIngest(routingKey, message, options);
        if (published) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        this.logger.error(
          { signature: message.signature, error },
          'Failed to publish message in batch'
        );
      }
    }

    this.logger.info(
      { success, failed, total: messages.length, routingKey },
      'Batch publish completed'
    );

    return { success, failed };
  }

  /**
   * Confirms that all published messages have been handled
   * Only available when using confirm channel
   */
  async waitForConfirms(): Promise<void> {
    if ('waitForConfirms' in this.channel && typeof this.channel.waitForConfirms === 'function') {
      await this.channel.waitForConfirms();
    }
  }

  /**
   * Closes the channel
   */
  async close(): Promise<void> {
    await this.channel.close();
    this.logger.info('Publisher channel closed');
  }
}

/**
 * Creates a publisher with confirm channel for reliable publishing
 */
export async function createPublisher(
  connection: any,
  exchangeName: string,
  logger: Logger
): Promise<RabbitMQPublisher> {
  const channel = await connection.createConfirmChannel();
  logger.info({ exchange: exchangeName }, 'Publisher channel created');
  return new RabbitMQPublisher(channel, exchangeName, logger);
}
