/**
 * Jupiter Price Service
 * Fetches token prices from Jupiter API with Redis caching
 */

import axios, { AxiosInstance } from 'axios';
import type { RedisClientType } from 'redis';
import type { Logger } from 'pino';
import { type TransactionInsert } from '@incur-data/olap-types';
import { withRetry, isRetryableError } from '../utils/retry.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import type {
  JupiterPriceConfig,
  JupiterPriceResponse
} from '../types/jupiter-price.types.js';

/**
 * Transfer data for building transaction rows
 */
export interface TokenTransfer {
  account: string;
  tokenAddress: string;
  amount: string;
  instructionType: string;
}

/**
 * Base transaction context for building rows
 */
export interface TransactionContext {
  signature: string;
  slot: number;
  blockTimeFormatted: string;
  programId: string;
  status: 'success' | 'failed' | 'pending';
  eventType: string;
  orderId: string;
}

/**
 * Jupiter Price Service
 * Handles token price fetching with caching
 */
export class JupiterPriceService {
  private readonly axios: AxiosInstance;
  private readonly redis: RedisClientType;
  private readonly logger: Logger;
  private readonly config: JupiterPriceConfig;
  private readonly cacheTtl: number;
  private readonly rateLimiter: RateLimiter;

  constructor(
    config: JupiterPriceConfig,
    redis: RedisClientType,
    logger: Logger
  ) {
    this.config = config;
    this.redis = redis;
    this.logger = logger;
    this.cacheTtl = config.cacheTtl;
    
    // Initialize rate limiter (default 1 RPS = 1000ms between requests)
    this.rateLimiter = new RateLimiter(config.rateLimit);
    
    this.logger.info(
      { 
        cacheTtl: this.cacheTtl, 
        cacheTtlMinutes: Math.round(this.cacheTtl / 60),
        rateLimit: config.rateLimit,
        rateLimitRPS: 1000 / config.rateLimit 
      },
      'Jupiter Price Service initialized with caching and rate limiting'
    );

    // Initialize axios client with Jupiter API settings
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Only add API key if provided
    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey;
    }

    this.axios = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
      headers,
    });
  }

  /**
   * Get price for a single token (with caching)
   */
  async getPrice(tokenAddress: string): Promise<number | null> {
    const prices = await this.getPrices([tokenAddress]);
    return prices[tokenAddress] || null;
  }

  /**
   * Get prices for multiple tokens (with caching and batching)
   */
  async getPrices(tokenAddresses: string[]): Promise<Record<string, number>> {
    if (tokenAddresses.length === 0) {
      return {};
    }

    const results: Record<string, number> = {};
    const uncachedTokens: string[] = [];

    // Check cache first
    for (const address of tokenAddresses) {
      const cachedPrice = await this.getCachedPrice(address);
      if (cachedPrice !== null) {
        results[address] = cachedPrice;
        this.logger.debug({ address, price: cachedPrice }, 'Price from cache');
      } else {
        uncachedTokens.push(address);
      }
    }

    // If all prices were cached, return early
    if (uncachedTokens.length === 0) {
      return results;
    }

    // Fetch uncached prices from Jupiter API
    try {
      const fetchedPrices = await this.fetchPricesFromJupiter(uncachedTokens);

      // Cache and add to results
      for (const [address, price] of Object.entries(fetchedPrices)) {
        await this.cachePrice(address, price);
        results[address] = price;
      }

      this.logger.info(
        { 
          total: tokenAddresses.length,
          cached: tokenAddresses.length - uncachedTokens.length,
          fetched: uncachedTokens.length 
        },
        'Token prices fetched'
      );
    } catch (error) {
      this.logger.error(
        { error, tokenAddresses: uncachedTokens },
        'Failed to fetch prices from Jupiter'
      );
      // Return whatever we have from cache
    }

    return results;
  }

  /**
   * Fetch prices from Jupiter API with retry logic and rate limiting
   */
  private async fetchPricesFromJupiter(
    tokenAddresses: string[]
  ): Promise<Record<string, number>> {
    // Wrap the entire fetch operation with rate limiter
    return this.rateLimiter.execute(async () => {
      const queueSize = this.rateLimiter.getQueueSize();
      if (queueSize > 0) {
        this.logger.debug(
          { queueSize },
          'Rate limiter queue has pending requests'
        );
      }

      return withRetry(
        async () => {
          const ids = tokenAddresses.join(',');
          const url = `${this.config.priceEndpoint}?ids=${ids}`;

          this.logger.debug({ url, count: tokenAddresses.length }, 'Fetching prices from Jupiter');

          const requestHeaders: Record<string, string> = {};
          if (this.config.apiKey) {
            requestHeaders['x-api-key'] = this.config.apiKey;
          }

          const response = await this.axios.get<JupiterPriceResponse>(url, {
            headers: requestHeaders,
          });

          if (!response.data) {
            throw new Error('Invalid response from Jupiter API');
          }

          const prices: Record<string, number> = {};
          
          // API v3 returns data directly at root level with usdPrice field
          for (const [address, priceData] of Object.entries(response.data)) {
            if (priceData && typeof priceData === 'object' && 'usdPrice' in priceData) {
              const price = priceData.usdPrice;
              if (!isNaN(price) && price > 0) {
                prices[address] = price;
              }
            }
          }

          this.logger.debug(
            { 
              requested: tokenAddresses.length,
              received: Object.keys(prices).length
            },
            'Prices fetched from Jupiter'
          );

          return prices;
        },
        {
          maxAttempts: this.config.retryAttempts,
          initialDelay: 1000,
          backoffMultiplier: 2,
          maxDelay: 10000,
          shouldRetry: isRetryableError,
          onRetry: (error, attempt, delay) => {
            this.logger.warn(
              { error: error.message, attempt, delay },
              'Retrying Jupiter API request'
            );
          },
        }
      );
    });
  }

  /**
   * Get cached price from Redis
   */
  private async getCachedPrice(tokenAddress: string): Promise<number | null> {
    try {
      const key = this.getPriceCacheKey(tokenAddress);
      const cached = await this.redis.get(key);
      
      if (cached) {
        const price = parseFloat(cached);
        return isNaN(price) ? null : price;
      }
    } catch (error) {
      this.logger.warn({ error, tokenAddress }, 'Failed to get cached price');
    }
    
    return null;
  }

  /**
   * Cache price in Redis
   */
  private async cachePrice(tokenAddress: string, price: number): Promise<void> {
    try {
      const key = this.getPriceCacheKey(tokenAddress);
      await this.redis.set(key, price.toString(), {
        EX: this.cacheTtl,
      });
    } catch (error) {
      this.logger.warn({ error, tokenAddress, price }, 'Failed to cache price');
    }
  }

  /**
   * Generate cache key for token price
   */
  private getPriceCacheKey(tokenAddress: string): string {
    return `price:jupiter:${tokenAddress}`;
  }

  /**
   * Clear cache for specific token
   */
  async clearCache(tokenAddress: string): Promise<void> {
    try {
      const key = this.getPriceCacheKey(tokenAddress);
      await this.redis.del(key);
    } catch (error) {
      this.logger.warn({ error, tokenAddress }, 'Failed to clear price cache');
    }
  }

  /**
   * Clear all price caches
   */
  async clearAllCaches(): Promise<void> {
    try {
      const pattern = 'price:jupiter:*';
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
        this.logger.info({ count: keys.length }, 'Cleared all price caches');
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to clear all price caches');
    }
  }

  /**
   * Build transaction rows with USD amounts from transfers
   * Fetches prices and calculates USD values for each transfer
   */
  async buildTransactionRows(
    ctx: TransactionContext,
    transfers: TokenTransfer[],
    tokenMints: string[]
  ): Promise<TransactionInsert[]> {
    // Fetch prices for all tokens
    let tokenPrices: Record<string, number> = {};
    if (tokenMints.length > 0) {
      try {
        tokenPrices = await this.getPrices(tokenMints);
        this.logger.debug(
          { mints: tokenMints, prices: Object.keys(tokenPrices).length },
          'Fetched prices for tokens'
        );
      } catch (error) {
        this.logger.warn(
          { error: (error as Error).message, mints: tokenMints },
          'Failed to fetch token prices, will use 0 for USD amounts'
        );
      }
    }

    const rows: TransactionInsert[] = [];

    if (transfers.length === 0) {
      // No transfers, save a simple record
      rows.push({
        signature: ctx.signature,
        slot: ctx.slot,
        block_time: ctx.blockTimeFormatted as any,
        program_id: ctx.programId,
        account: '',
        token_address: '',
        amount: '0',
        amount_usd: 0,
        status: ctx.status,
        instruction_type: 'unknown',
        event_type: ctx.eventType,
        order_id: ctx.orderId,
      });
    } else {
      // Process each transfer using cached prices
      for (const transfer of transfers) {
        const priceUSD = tokenPrices[transfer.tokenAddress] || 0;
        const amountNum = Number(transfer.amount);
        const amountAbs = Math.abs(amountNum);
        const decimals = 9; // Default to 9, but could be extracted from meta
        const amountUSD = (amountAbs * priceUSD) / Math.pow(10, decimals);

        rows.push({
          signature: ctx.signature,
          slot: ctx.slot,
          block_time: ctx.blockTimeFormatted as any,
          program_id: ctx.programId,
          account: transfer.account,
          token_address: transfer.tokenAddress,
          amount: amountAbs.toString(),
          amount_usd: amountUSD,
          status: ctx.status,
          instruction_type: transfer.instructionType,
          event_type: ctx.eventType,
          order_id: ctx.orderId,
        });
      }
    }

    return rows;
  }
}
