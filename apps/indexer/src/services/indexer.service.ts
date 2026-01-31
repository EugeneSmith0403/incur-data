import { Connection, PublicKey } from '@solana/web3.js';
import type { Logger } from 'pino';
import type { RabbitMQPublisher } from '@incur-data/rabbitmq';
import { createTxIngestMessage } from '@incur-data/dtos';
import type { RedisClientType } from 'redis';
import { formatError } from '../utils/error.js';

/**
 * Indexer Service
 * Listens for new transactions on a Solana program and publishes them to RabbitMQ
 */
export class IndexerService {
  private connection: Connection;
  private programId: PublicKey;
  private publisher: RabbitMQPublisher;
  private queueName: string;
  private redis: RedisClientType;
  private logger: Logger;

  private subscriptionId: number | null = null;
  private isRunning = false;
  private lastProcessedSlot = 0;

  constructor(
    connection: Connection,
    programId: string,
    publisher: RabbitMQPublisher,
    queueName: string,
    redis: RedisClientType,
    logger: Logger
  ) {
    this.connection = connection;
    this.programId = new PublicKey(programId);
    this.publisher = publisher;
    this.queueName = queueName;
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * Load last processed slot from Redis
   */
  private async loadLastProcessedSlot(): Promise<void> {
    const key = `indexer:last_slot:${this.programId.toBase58()}`;
    const slot = await this.redis.get(key);
    if (slot) {
      this.lastProcessedSlot = parseInt(slot, 10);
      this.logger.info({ slot: this.lastProcessedSlot }, 'Loaded last processed slot');
    }
  }

  /**
   * Save last processed slot to Redis
   */
  private async saveLastProcessedSlot(slot: number): Promise<void> {
    if (slot > this.lastProcessedSlot) {
      const key = `indexer:last_slot:${this.programId.toBase58()}`;
      await this.redis.set(key, slot.toString());
      this.lastProcessedSlot = slot;
    }
  }

  /**
   * Check if transaction was already indexed
   */
  private async isAlreadyIndexed(signature: string): Promise<boolean> {
    const key = `tx:indexed:${signature}`;
    const exists = await this.redis.exists(key);
    return Boolean(exists);
  }

  /**
   * Mark transaction as indexed
   */
  private async markAsIndexed(signature: string): Promise<void> {
    const key = `tx:indexed:${signature}`;
    await this.redis.set(key, '1', { EX: 86400 * 7 }); // 7 days TTL
  }

  /**
   * Publish transaction to RabbitMQ
   */
  private async publishTransaction(
    signature: string,
    slot: number,
    blockTime: number
  ): Promise<void> {
    const message = createTxIngestMessage({
      signature,
      slot,
      blockTime,
      source: 'realtime',
      programId: this.programId.toBase58(),
    });

    await this.publisher.publishTxIngest(this.queueName, message);
    this.logger.info({ signature, slot, source: 'realtime' }, 'Transaction sent to queue');
  }

  /**
   * Start real-time indexing
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Indexer already running');
      return;
    }

    this.isRunning = true;
    await this.loadLastProcessedSlot();

    this.logger.info(
      { 
        programId: this.programId.toBase58(),
        lastProcessedSlot: this.lastProcessedSlot 
      },
      'Starting real-time indexer'
    );

    try {
      // Subscribe to program logs
      this.subscriptionId = this.connection.onLogs(
        this.programId,
        async (logs, ctx) => {
          const { signature } = logs;
          const slot = ctx.slot;

          try {
            // Check if already indexed
            if (await this.isAlreadyIndexed(signature)) {
              return;
            }

            this.logger.info({ signature, slot }, 'New transaction detected');

            // Fetch real block time from block
            let blockTime: number;
            try {
              const blockInfo = await this.connection.getBlock(slot, {
                maxSupportedTransactionVersion: 0,
              });
              blockTime = blockInfo?.blockTime || Math.floor(Date.now() / 1000);
            } catch (error) {
              this.logger.warn(
                { slot, error: (error as Error).message },
                'Failed to fetch block time, using current time'
              );
              blockTime = Math.floor(Date.now() / 1000);
            }

            // Publish to RabbitMQ
            await this.publishTransaction(signature, slot, blockTime);

            // Mark as indexed
            await this.markAsIndexed(signature);

            // Save checkpoint
            await this.saveLastProcessedSlot(slot);
          } catch (error) {
            this.logger.error(
              { signature, slot, error: (error as Error).message },
              'Failed to index transaction'
            );
          }
        },
        'confirmed'
      );

      this.logger.info(
        { subscriptionId: this.subscriptionId },
        'Listening for new transactions'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if error is about WebSocket not being supported
      if (errorMessage.includes('logsSubscribe') || errorMessage.includes('Method') || errorMessage.includes('not found')) {
        this.logger.warn(
          'Real-time monitoring via WebSocket is not available with this RPC provider. Indexer will only work in backfill mode.'
        );
        this.isRunning = false;
        return; // Don't throw, just return
      }

      this.logger.error({ ...formatError(error) }, 'Failed to start indexer');
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop indexer
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping indexer');

    if (this.subscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.subscriptionId);
        this.logger.info('Unsubscribed from logs');
      } catch (error) {
        this.logger.error({ error }, 'Failed to unsubscribe');
      }
      this.subscriptionId = null;
    }

    this.isRunning = false;
    this.logger.info('Indexer stopped');
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      subscriptionId: this.subscriptionId,
      lastProcessedSlot: this.lastProcessedSlot,
    };
  }
}
