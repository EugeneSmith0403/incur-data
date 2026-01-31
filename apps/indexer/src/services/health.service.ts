import Fastify, { type FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import type { IService } from './types.js';
import { formatError } from '../utils/error.js';

export interface HealthServiceConfig {
  port: number;
  mode: string;
  programId: string;
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
  targetCreated?: number;
  targetTransactions?: number;
}

/**
 * Health check and metrics service
 * Provides HTTP endpoints for monitoring
 */
export class HealthService implements IService {
  private fastify: FastifyInstance;
  private config: HealthServiceConfig;
  private logger: Logger;

  constructor(config: HealthServiceConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.fastify = Fastify({ logger: false });
    this.setupRoutes();
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.fastify.get('/health', async () => ({
      status: 'healthy',
      mode: this.config.mode,
      timestamp: new Date().toISOString(),
    }));

    // Metrics endpoint
    this.fastify.get('/metrics', async () => {
      return {
        mode: this.config.mode,
        programId: this.config.programId,
        timestamp: new Date().toISOString(),
        config: {
          batchSize: this.config.batchSize,
          concurrency: this.config.concurrency,
          retryAttempts: this.config.retryAttempts,
        },
        target: {
          transactions: this.config.targetTransactions || 0,
        },
      };
    });

    // Ready check endpoint (for Kubernetes)
    this.fastify.get('/ready', async () => ({
      ready: true,
      mode: this.config.mode,
    }));
  }

  /**
   * Start health check server
   */
  async start(): Promise<void> {
    try {
      await this.fastify.listen({ port: this.config.port, host: '0.0.0.0' });
      this.logger.info({ port: this.config.port }, 'Health check server started');
    } catch (error) {
      this.logger.error({ ...formatError(error) }, 'Failed to start health check server');
      throw error;
    }
  }

  /**
   * Stop health check server
   */
  async stop(): Promise<void> {
    try {
      await this.fastify.close();
      this.logger.info('Health check server stopped');
    } catch (error) {
      this.logger.error({ ...formatError(error) }, 'Failed to stop health check server');
      throw error;
    }
  }
}
