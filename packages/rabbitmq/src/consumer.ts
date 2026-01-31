import type { Channel, ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';
import { txIngestMessageSchema, type TxIngestMessage } from '@incur-data/dtos';
import type { MessageHandler, MessageMetadata, ConsumerConfig, QueueConfig } from './types.js';

/**
 * Consumer class for receiving and processing messages from RabbitMQ
 */
export class RabbitMQConsumer {
  private channel: Channel;
  private queueName: string;
  private queueConfig: QueueConfig;
  private logger: Logger;
  private consumerTag?: string;

  constructor(
    channel: Channel,
    queueName: string,
    queueConfig: QueueConfig,
    logger: Logger
  ) {
    this.channel = channel;
    this.queueName = queueName;
    this.queueConfig = queueConfig;
    this.logger = logger;
  }

  /**
   * Starts consuming messages from the queue
   */
  async consume(
    handler: MessageHandler<TxIngestMessage>,
    config: ConsumerConfig = {}
  ): Promise<void> {
    const { prefetchCount = 10, noAck = false, exclusive = false } = config;

    // Set prefetch count to control concurrent processing
    await this.channel.prefetch(prefetchCount);
    this.logger.info({ prefetchCount }, 'Prefetch count set');

    // Start consuming
    const consumeResult = await this.channel.consume(
      this.queueName,
      async (msg) => {
        if (!msg) return;

        await this.handleMessage(msg, handler);
      },
      { noAck, exclusive }
    );

    this.consumerTag = consumeResult.consumerTag;
    this.logger.info(
      {
        queue: this.queueName,
        consumerTag: this.consumerTag,
        prefetch: prefetchCount,
      },
      'Consumer started'
    );
  }

  /**
   * Handles an individual message
   */
  private async handleMessage(
    msg: ConsumeMessage,
    handler: MessageHandler<TxIngestMessage>
  ): Promise<void> {
   //  const startTime = Date.now();

    try {
      // Parse message
      const messageContent = msg.content.toString();
      const parsedMessage = JSON.parse(messageContent);

      // Validate message structure
      const txMessage = txIngestMessageSchema.parse(parsedMessage);

      // Extract metadata
      const metadata = this.extractMetadata(msg);

      // this.logger.debug(
      //   {
      //     signature: txMessage.signature,
      //     attempt: metadata.attempt,
      //     redelivered: metadata.redelivered,
      //   },
      //   'Processing message'
      // );

      // Check if max retries exceeded
      if (metadata.attempt >= this.queueConfig.maxRetries) {
        this.logger.error(
          {
            signature: txMessage.signature,
            attempt: metadata.attempt,
            maxRetries: this.queueConfig.maxRetries,
          },
          'Max retries exceeded, sending to DLQ'
        );
        
        // Send to DLQ by rejecting without requeue
        this.channel.nack(msg, false, false);
        return;
      }

      // Call handler
      const result = await handler(txMessage, metadata);

      // Acknowledge message if handler succeeds
      if (result !== false) {
        this.channel.ack(msg);
        
       //  const duration = Date.now() - startTime;
        // this.logger.info(
        //   {
        //     signature: txMessage.signature,
        //     duration,
        //     attempt: metadata.attempt,
        //   },
        //   'Message processed successfully'
        // );
      } else {
        // Handler explicitly returned false - retry
        await this.retryMessage(msg, metadata, txMessage);
      }
    } catch (error) {
      // Handler threw an error - retry
      const signature = this.tryExtractSignature(msg);
      this.logger.error(
        { signature, error },
        'Error processing message'
      );

      const metadata = this.extractMetadata(msg);
      await this.retryMessage(msg, metadata);
    }
  }

  /**
   * Retries a message by incrementing attempt counter and rejecting
   */
  private async retryMessage(
    msg: ConsumeMessage,
    metadata: MessageMetadata,
    txMessage?: TxIngestMessage
  ): Promise<void> {
    const newAttempt = metadata.attempt + 1;

    if (newAttempt >= this.queueConfig.maxRetries) {
      this.logger.error(
        {
          signature: txMessage?.signature,
          attempt: newAttempt,
          maxRetries: this.queueConfig.maxRetries,
        },
        'Max retries reached, sending to DLQ'
      );

      // Send to DLQ
      this.channel.nack(msg, false, false);
      return;
    }

    this.logger.warn(
      {
        signature: txMessage?.signature,
        attempt: newAttempt,
        maxRetries: this.queueConfig.maxRetries,
      },
      'Retrying message'
    );

    // Update message with new attempt count
    if (txMessage) {
      const updatedMessage = { ...txMessage, attempt: newAttempt };
      const messageBuffer = Buffer.from(JSON.stringify(updatedMessage));

      // Publish to retry queue via DLX
      this.channel.publish(
        this.queueConfig.dlxName,
        'retry.message',
        messageBuffer,
        {
          persistent: true,
          headers: {
            ...msg.properties.headers,
            attempt: newAttempt,
            'x-retry-count': newAttempt,
            'x-first-death-reason': msg.properties.headers?.['x-first-death-reason'] || 'processing_failed',
            'x-first-death-queue': this.queueName,
          },
        }
      );
    }

    // Acknowledge original message (it's been republished to retry queue)
    this.channel.ack(msg);
  }

  /**
   * Extracts metadata from RabbitMQ message
   */
  private extractMetadata(msg: ConsumeMessage): MessageMetadata {
    const attempt = (msg.properties.headers?.attempt as number) || 0;
    const xRetryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;

    return {
      deliveryTag: msg.fields.deliveryTag,
      redelivered: msg.fields.redelivered,
      exchange: msg.fields.exchange,
      routingKey: msg.fields.routingKey,
      messageId: msg.properties.messageId,
      timestamp: msg.properties.timestamp,
      headers: msg.properties.headers,
      attempt: Math.max(attempt, xRetryCount),
    };
  }

  /**
   * Tries to extract signature from message for logging
   */
  private tryExtractSignature(msg: ConsumeMessage): string | undefined {
    try {
      const messageContent = msg.content.toString();
      const parsedMessage = JSON.parse(messageContent);
      return parsedMessage.signature;
    } catch {
      return msg.properties.messageId;
    }
  }

  /**
   * Stops consuming messages
   */
  async stop(): Promise<void> {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
      this.logger.info({ consumerTag: this.consumerTag }, 'Consumer stopped');
    }
  }

  /**
   * Closes the channel
   */
  async close(): Promise<void> {
    await this.stop();
    await this.channel.close();
    this.logger.info('Consumer channel closed');
  }
}

/**
 * Creates a consumer
 */
export async function createConsumer(
  connection: any,
  queueName: string,
  queueConfig: QueueConfig,
  logger: Logger
): Promise<RabbitMQConsumer> {
  const channel = await connection.createChannel();
  logger.info({ queue: queueName }, 'Consumer channel created');
  return new RabbitMQConsumer(channel, queueName, queueConfig, logger);
}
