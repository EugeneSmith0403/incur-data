import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../../.env');

const result = dotenvConfig({ path: envPath });
if (result.error) {
  console.error('Failed to load .env file:', result.error);
} else {
  console.log('.env file loaded successfully');
}

import { pino } from 'pino';
import { getConfig } from './config.js';
import { ConnectionService, HealthService } from './services/index.js';
import { IndexerService } from './services/indexer.service.js';
import { BackfillIndexerService } from './services/backfill-indexer.service.js';
import { getTransactionCountsByProgramId } from './utils/transaction-count.js';
import { formatError } from './utils/error.js';

/**
 * Indexer Application
 * Hybrid mode: backfill historical transactions, then switch to real-time
 */
class IndexerApp {
  private config = getConfig();
  private logger = pino({
    level: this.config.logLevel,
    transport: this.config.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
  });

  private connectionService!: ConnectionService;
  private healthService!: HealthService;
  private indexerService!: IndexerService;
  private backfillIndexerService!: BackfillIndexerService;
  private isShuttingDown = false;

  /**
   * Initialize services (connections should already be initialized)
   */
  private async initializeServices(untilSignature?: string): Promise<void> {
    this.logger.info(
      {
        programId: this.config.solana.dlnProgramId,
        targetTransactions: this.config.indexer.targetTransactions,
        untilSignature,
      },
      'Initializing indexer services'
    );

    // Initialize backfill indexer with optional until signature for gap filling
    this.backfillIndexerService = new BackfillIndexerService(
      this.connectionService.solanaConnection,
      this.config.solana.dlnProgramId,
      this.connectionService.publisher,
      this.config.rabbitmq.queueName,
      this.connectionService.clickhouseClient,
      this.connectionService.redisClient as any,
      this.config,
      this.logger,
      untilSignature
    );

    // Initialize real-time indexer
    this.indexerService = new IndexerService(
      this.connectionService.solanaConnection,
      this.config.solana.dlnProgramId,
      this.connectionService.publisher,
      this.config.rabbitmq.queueName,
      this.connectionService.redisClient as any,
      this.logger
    );

    // Initialize health service
    this.healthService = new HealthService(
      {
        port: this.config.indexer.port,
        mode: 'auto', // Auto-switching mode
        programId: this.config.solana.dlnProgramId,
        batchSize: this.config.indexer.batchSize,
        concurrency: 1,
        retryAttempts: this.config.indexer.retryAttempts,
        targetTransactions: this.config.indexer.targetTransactions,
      },
      this.logger
    );

    this.logger.info('All services initialized');
  }

  /**
   * Get transaction count for program_id (Redis first, fallback to ClickHouse)
   */
  private async getTransactionCountByProgramId(): Promise<Array<{ programId: string; count: number }>> {
    return getTransactionCountsByProgramId(this.config.solana.dlnProgramId, {
      redis: this.connectionService.redisClient as any,
      clickhouse: this.connectionService.clickhouseClient,
      logger: this.logger,
      database: this.config.clickhouse.database,
    });
  }

  /**
   * Check if we need to run backfill based on transaction count
   */
  private async shouldRunBackfill(): Promise<{ needsBackfill: boolean }> {
    const targetTransactions = this.config.indexer.targetTransactions;
    const programId = this.config.solana.dlnProgramId;

    // Get transaction counts grouped by programId
    const countsByProgramId = await this.getTransactionCountByProgramId();

    // Find count for our programId
    const programCount = countsByProgramId.find((item) => item.programId === programId);
    const currentCount = programCount?.count ?? 0;

    if (currentCount >= targetTransactions) {
      return { needsBackfill: false };
    }

    if (currentCount === 0) {
      this.logger.info('No transactions in database for this program, will run full backfill');
      return { needsBackfill: true };
    }

    return { needsBackfill: true };
  }

  /**
   * Run backfill phase
   */
  private async runBackfillPhase(): Promise<void> {
    this.logger.info(
      { target: this.config.indexer.targetTransactions },
      'Starting backfill phase'
    );

    await this.backfillIndexerService.start();

    this.logger.info('Backfill phase completed');
  }

  /**
   * Run real-time monitoring phase
   */
  private async runRealtimePhase(): Promise<void> {
    this.logger.info('Starting real-time monitoring phase');
    await this.indexerService.start();
    
    this.logger.info('Real-time monitoring started, listening for new transactions');
  }

  /**
   * Gracefully shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down gracefully...');

    try {
      // Stop real-time indexer
      if (this.indexerService) {
        await this.indexerService.stop();
      }

      // Stop health service
      if (this.healthService) {
        await this.healthService.stop();
      }

      // Stop connections
      if (this.connectionService) {
        await this.connectionService.stop();
      }

      this.logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      this.logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  }

  /**
   * Main application entry point with automatic phase switching
   */
  async run(): Promise<void> {
    try {
      // Setup graceful shutdown early
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('SIGINT', () => this.gracefulShutdown());

      // Initialize connections first (needed for database checks)
      this.connectionService = new ConnectionService(this.config, this.logger);
      await this.connectionService.start();

      // Check if we need to run backfill based on transaction count
      const { needsBackfill } = await this.shouldRunBackfill();

      // Initialize remaining services
      await this.initializeServices();

      // Start health check server
      await this.healthService.start();

      if (needsBackfill) {
        // Run backfill phase to catch up missing transactions
        await this.runBackfillPhase();

        // After backfill completes, switch to real-time
        if (!this.isShuttingDown) {
          this.logger.info(
            {
              programId: this.config.solana.dlnProgramId,
              targetReached: this.config.indexer.targetTransactions
            },
            '🔄 Switching to real-time monitoring after backfill completion'
          );
          await this.runRealtimePhase();
        }
      } else {
        // No gap detected, start directly in real-time mode
        this.logger.info(
          { programId: this.config.solana.dlnProgramId },
          '🚀 Starting directly in real-time mode (no backfill needed)'
        );
        await this.runRealtimePhase();
      }
    } catch (error) {
      this.logger.error({ ...formatError(error) }, 'Failed to start indexer');
      process.exit(1);
    }
  }
}

// Start the application
const app = new IndexerApp();
app.run();
