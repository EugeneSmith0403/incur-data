import { Connection, PublicKey } from '@solana/web3.js';
import type { Logger } from 'pino';
import type { ClickHouseClient } from '@clickhouse/client';
import type { RabbitMQPublisher } from '@incur-data/rabbitmq';
import { createTxIngestMessage } from '@incur-data/dtos';
import type { Config } from '../config.js';
import type { RedisClientType } from 'redis';
import { getTransactionCount } from '../utils/transaction-count.js';

export interface BackfillStats {
  batchesProcessed: number;
  totalPublished: number;
  startTime: number;
  lastBatchTime: number;
  currentSlot: number;
  currentSignature: string;
}

type SignatureData = {
  signature: string;
  slot: number;
  blockTime?: number | null;
};

const PROGRESS_LOG_INTERVAL = 10;
const BATCH_DELAY_MS = 100;
const ERROR_RETRY_DELAY_MS = 5000;

/**
 * Backfill Indexer Service
 * Fetches historical transactions from Solana blockchain
 */
export class BackfillIndexerService {
  private readonly connection: Connection;
  private readonly programId: PublicKey;
  private readonly publisher: RabbitMQPublisher;
  private readonly queueName: string;
  private readonly clickhouse: ClickHouseClient;
  private readonly redis: RedisClientType;
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly stats: BackfillStats;
  private readonly untilSignature?: string; // Target signature to stop backfill

  constructor(
    connection: Connection,
    programId: string,
    publisher: RabbitMQPublisher,
    queueName: string,
    clickhouse: ClickHouseClient,
    redis: RedisClientType,
    config: Config,
    logger: Logger,
    untilSignature?: string
  ) {
    this.connection = connection;
    this.programId = new PublicKey(programId);
    this.publisher = publisher;
    this.queueName = queueName;
    this.clickhouse = clickhouse;
    this.redis = redis;
    this.config = config;
    this.logger = logger;
    this.untilSignature = untilSignature;

    this.stats = {
      batchesProcessed: 0,
      totalPublished: 0,
      startTime: Date.now(),
      lastBatchTime: Date.now(),
      currentSlot: 0,
      currentSignature: '',
    };
  }

  async start(): Promise<void> {
    this.logStart();
    let beforeSignature: string | undefined;

    while (true) {
      try {
        if (await this.shouldStop()) break;

        const signatures = await this.fetchBatch(beforeSignature);
        if (this.isEmptyBatch(signatures)) continue;

        // Check if we've reached the target signature (for gap filling)
        if (this.untilSignature && this.hasReachedTargetSignature(signatures)) {
          this.logger.info(
            { targetSignature: this.untilSignature },
            'Reached target signature, stopping backfill'
          );
          break;
        }

        await this.processBatch(signatures);
        beforeSignature = this.updateState(signatures);

        if (this.shouldLogProgress()) {
          this.logProgress();
        }

        await this.delay(BATCH_DELAY_MS);
      } catch (error) {
        this.logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            beforeSignature
          },
          'Error during backfill - retrying'
        );
        await this.delay(ERROR_RETRY_DELAY_MS);
      }
    }

    this.logFinalStats();
  }

  getStats(): BackfillStats {
    return { ...this.stats };
  }

  private async shouldStop(): Promise<boolean> {
    // Check every batch to ensure we don't overshoot the target
    // Note: getTransactionCountValue() has built-in caching to avoid excessive DB queries
    const count = await this.getTransactionCountValue();
    const target = this.config.indexer.targetTransactions;

    if (count >= target) {
      this.logger.info(
        {
          uniqueTransactionsInDB: count,
          target,
          totalPublished: this.stats.totalPublished
        },
        '🎯 Backfill target reached - stopping backfill phase'
      );
      return true;
    }
    return false;
  }

  private async fetchBatch(beforeSignature?: string): Promise<SignatureData[]> {
    const options: any = {
      before: beforeSignature,
      limit: this.config.indexer.batchSize,
    };

    // If we have an until signature, use it to limit the backfill
    if (this.untilSignature && !beforeSignature) {
      options.until = this.untilSignature;
    }

    const signatures = await this.connection.getSignaturesForAddress(this.programId, options);

    if (signatures.length > 0) {
      this.logger.info(
        { count: signatures.length, firstSlot: signatures[0]?.slot, hasUntil: !!this.untilSignature },
        'Fetched transaction batch from Solana'
      );
    }

    return signatures;
  }

  /**
   * Check if we've reached the target signature in the current batch
   */
  private hasReachedTargetSignature(signatures: SignatureData[]): boolean {
    if (!this.untilSignature) {
      return false;
    }

    return signatures.some((sig) => sig.signature === this.untilSignature);
  }

  private isEmptyBatch(signatures: SignatureData[]): boolean {
    if (signatures.length === 0) {
      this.logger.info(
        { totalPublished: this.stats.totalPublished },
        'Backfill completed - no more signatures'
      );
      return true;
    }
    return false;
  }

  private async processBatch(signatures: SignatureData[]): Promise<void> {
    for (const sig of signatures) {
      const success = await this.publishTransactionWithRetry(sig.signature, sig.slot, sig.blockTime || undefined);
      if (success) {
        this.stats.totalPublished++;
      }
    }

    this.stats.batchesProcessed++;
    this.stats.lastBatchTime = Date.now();
  }

  private async publishTransactionWithRetry(
    signature: string,
    slot: number,
    blockTime?: number,
    attempt: number = 0
  ): Promise<boolean> {
    try {
      await this.publishTransaction(signature, slot, blockTime);
      return true;
    } catch (error) {
      const maxRetries = 3;

      if (attempt < maxRetries) {
        this.logger.warn(
          { signature, slot, attempt, maxRetries, error: (error as Error).message },
          'Failed to publish transaction, retrying'
        );

        // Exponential backoff: 1s, 2s, 4s
        await this.delay(Math.min(1000 * Math.pow(2, attempt), 10000));

        return this.publishTransactionWithRetry(signature, slot, blockTime, attempt + 1);
      } else {
        this.logger.error(
          {
            signature,
            slot,
            attempts: maxRetries,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          },
          'Failed to publish transaction after max retries'
        );
        return false;
      }
    }
  }

  private updateState(signatures: SignatureData[]): string {
    const lastSig = signatures[signatures.length - 1];
    if (!lastSig) {
      this.logger.warn('Last signature is undefined, stopping backfill');
      return '';
    }

    this.stats.currentSignature = lastSig.signature;
    this.stats.currentSlot = lastSig.slot;
    return lastSig.signature;
  }

  private async publishTransaction(
    signature: string,
    slot: number,
    blockTime?: number
  ): Promise<void> {
    const message = createTxIngestMessage({
      signature,
      slot,
      blockTime,
      source: 'history',
      programId: this.programId.toBase58(),
    });

    await this.publisher.publishTxIngest(this.queueName, message);
    this.logger.info({ signature, slot, source: 'backfill' }, 'Transaction sent to queue');
  }

  private async getTransactionCountValue(): Promise<number> {
    return getTransactionCount(this.programId.toBase58(), {
      redis: this.redis,
      clickhouse: this.clickhouse,
      logger: this.logger,
      database: this.config.clickhouse.database,
    });
  }

  private shouldLogProgress(): boolean {
    return this.stats.batchesProcessed % PROGRESS_LOG_INTERVAL === 0;
  }

  private logStart(): void {
    this.logger.info(
      {
        programId: this.programId.toBase58(),
        batchSize: this.config.indexer.batchSize,
        targetTransactions: this.config.indexer.targetTransactions,
      },
      'Starting backfill indexer'
    );
  }

  private logProgress(): void {
    const elapsed = Date.now() - this.stats.startTime;
    const elapsedSeconds = elapsed / 1000;
    const txPerSecond = this.stats.totalPublished / elapsedSeconds;

    // Calculate ETA
    const remaining = this.config.indexer.targetTransactions - this.stats.totalPublished;
    const etaSeconds = txPerSecond > 0 ? remaining / txPerSecond : 0;
    const etaMinutes = etaSeconds / 60;

    // Progress percentage
    const progress = (this.stats.totalPublished / this.config.indexer.targetTransactions) * 100;

    this.logger.info(
      {
        batch: this.stats.batchesProcessed,
        totalPublished: this.stats.totalPublished,
        target: this.config.indexer.targetTransactions,
        progress: `${progress.toFixed(1)}%`,
        currentSlot: this.stats.currentSlot,
        txPerSecond: txPerSecond.toFixed(2),
        elapsedMinutes: (elapsedSeconds / 60).toFixed(2),
        etaMinutes: etaMinutes > 0 ? etaMinutes.toFixed(1) : 'N/A',
      },
      'Backfill progress'
    );
  }

  private logFinalStats(): void {
    const elapsed = Date.now() - this.stats.startTime;
    const elapsedMinutes = elapsed / (1000 * 60);
    const txPerMinute = this.stats.totalPublished / elapsedMinutes;

    this.logger.info(
      {
        batchesProcessed: this.stats.batchesProcessed,
        totalPublished: this.stats.totalPublished,
        elapsedMinutes: elapsedMinutes.toFixed(2),
        avgTxPerMinute: txPerMinute.toFixed(2),
        finalSlot: this.stats.currentSlot,
        finalSignature: this.stats.currentSignature,
      },
      'Backfill indexer completed'
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
