/**
 * Volume Aggregation Service
 * Provides daily USD volume metrics with Redis caching
 * Queries ClickHouse materialized views for production
 */

import { ClickHouseClient } from '@clickhouse/client';
import { RedisClientType } from 'redis';
import {
  DailyUsdVolumeResult,
  DailyUsdVolumeSummaryResult,
  VolumeQueryFilters,
} from '@incur-data/dtos';

export interface VolumeAggregationServiceConfig {
  clickhouse: ClickHouseClient;
  redis: RedisClientType;
  cacheTtlSeconds?: number;
  enableCache?: boolean;
}

export class VolumeAggregationService {
  private clickhouse: ClickHouseClient;
  private redis: RedisClientType;
  private cacheTtlSeconds: number;
  private enableCache: boolean;
  private readonly cachePrefix = 'dln:cache:volume';

  constructor(config: VolumeAggregationServiceConfig) {
    this.clickhouse = config.clickhouse;
    this.redis = config.redis;
    this.cacheTtlSeconds = config.cacheTtlSeconds ?? 300; // 5 minutes default
    this.enableCache = config.enableCache ?? true;
  }

  /**
   * Get daily USD volume with created vs fulfilled breakdown
   * Uses materialized view for production performance
   */
  async getDailyVolume(filters: VolumeQueryFilters = {}): Promise<DailyUsdVolumeResult[]> {
    const cacheKey = this.buildCacheKey('daily', filters);

    // Try cache first
    if (this.enableCache) {
      const cached = await this.getFromCache<DailyUsdVolumeResult[]>(cacheKey);
      if (cached) return cached;
    }

    // Build WHERE clause
    const whereClauses: string[] = ['1=1'];
    const whereParams: Record<string, any> = {};

    if (filters.fromDate) {
      whereClauses.push('date >= {fromDate:Date}');
      whereParams.fromDate = filters.fromDate;
    }
    if (filters.toDate) {
      whereClauses.push('date <= {toDate:Date}');
      whereParams.toDate = filters.toDate;
    }
    if (filters.eventType) {
      whereClauses.push('event_type = {eventType:String}');
      whereParams.eventType = filters.eventType;
    }
    if (filters.programId) {
      whereClauses.push('program_id = {programId:String}');
      whereParams.programId = filters.programId;
    }

    const limit = filters.limit ?? 100;

    const query = `
      SELECT
        date,
        program_id,
        event_type,
        sum(vol) AS total_volume_usd,
        sum(tc) AS order_count,
        avg(av) AS avg_order_usd,
        min(mn) AS min_order_usd,
        max(mx) AS max_order_usd,
        sum(ua) AS unique_makers,
        sum(tc) AS unique_orders,
        max(now()) AS last_updated
      FROM (
        SELECT
          date,
          program_id,
          event_type,
          total_volume_usd AS vol,
          tx_count AS tc,
          avg_volume_usd AS av,
          min_volume_usd AS mn,
          max_volume_usd AS mx,
          unique_accounts AS ua
        FROM dln.daily_volume
        WHERE ${whereClauses.join(' AND ')}
      ) sub
      GROUP BY date, program_id, event_type
      ORDER BY date DESC, event_type
      LIMIT {limit:UInt32}
    `;

    const result = await this.clickhouse.query({
      query,
      query_params: { ...whereParams, limit },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any[]>();

    const formatted = rows.map(row => ({
      date: row.date,
      eventType: row.event_type || 'unknown',
      giveChainId: '',
      takeChainId: '',
      totalVolumeUsd: row.total_volume_usd?.toString() || '0',
      orderCount: parseInt(row.order_count || '0'),
      avgOrderUsd: row.avg_order_usd?.toString() || '0',
      minOrderUsd: row.min_order_usd?.toString() || '0',
      maxOrderUsd: row.max_order_usd?.toString() || '0',
      uniqueMakers: parseInt(row.unique_makers || '0'),
      uniqueOrders: parseInt(row.unique_orders || '0'),
      lastUpdated: row.last_updated,
    }));

    // Cache the result
    if (this.enableCache) {
      await this.setCache(cacheKey, formatted);
    }

    return formatted;
  }

  /**
   * Get daily volume summary (created + fulfilled combined)
   * Provides fulfillment rate and comparison metrics
   */
  async getDailyVolumeSummary(filters: VolumeQueryFilters = {}): Promise<DailyUsdVolumeSummaryResult[]> {
    const cacheKey = this.buildCacheKey('summary', filters);

    if (this.enableCache) {
      const cached = await this.getFromCache<DailyUsdVolumeSummaryResult[]>(cacheKey);
      if (cached) return cached;
    }

    const whereClauses: string[] = ['1=1'];
    const whereParams: Record<string, any> = {};

    if (filters.fromDate) {
      whereClauses.push('date >= {fromDate:Date}');
      whereParams.fromDate = filters.fromDate;
    }
    if (filters.toDate) {
      whereClauses.push('date <= {toDate:Date}');
      whereParams.toDate = filters.toDate;
    }
    if (filters.programId) {
      whereClauses.push('program_id = {programId:String}');
      whereParams.programId = filters.programId;
    }

    const limit = filters.limit ?? 100;

    const query = `
      SELECT
        date,
        program_id,
        sumIf(vol, event_type = 'OrderCreated') AS created_volume_usd,
        sumIf(tc, event_type = 'OrderCreated') AS created_count,
        avgIf(av, event_type = 'OrderCreated') AS created_avg_usd,
        sumIf(vol, event_type = 'OrderFulfilled') AS fulfilled_volume_usd,
        sumIf(tc, event_type = 'OrderFulfilled') AS fulfilled_count,
        avgIf(av, event_type = 'OrderFulfilled') AS fulfilled_avg_usd,
        sum(vol) AS total_volume_usd,
        sum(ua) AS unique_makers,
        max(now()) AS last_updated
      FROM (
        SELECT
          date,
          program_id,
          event_type,
          total_volume_usd AS vol,
          tx_count AS tc,
          avg_volume_usd AS av,
          unique_accounts AS ua
        FROM dln.daily_volume
        WHERE ${whereClauses.join(' AND ')}
      ) sub
      GROUP BY date, program_id
      ORDER BY date DESC
      LIMIT {limit:UInt32}
    `;

    const result = await this.clickhouse.query({
      query,
      query_params: { ...whereParams, limit },
      format: 'JSONEachRow',
    });

    const rows = await result.json<any[]>();

    const formatted = rows.map(row => {
      const createdVol = parseFloat(row.created_volume_usd || '0');
      const fulfilledVol = parseFloat(row.fulfilled_volume_usd || '0');
      const fulfillmentRate = createdVol > 0 ? (fulfilledVol / createdVol) * 100 : 0;

      return {
        date: row.date,
        giveChainId: '',
        takeChainId: '',
        createdVolumeUsd: row.created_volume_usd?.toString() || '0',
        createdCount: parseInt(row.created_count || '0'),
        createdAvgUsd: row.created_avg_usd?.toString() || '0',
        fulfilledVolumeUsd: row.fulfilled_volume_usd?.toString() || '0',
        fulfilledCount: parseInt(row.fulfilled_count || '0'),
        fulfilledAvgUsd: row.fulfilled_avg_usd?.toString() || '0',
        fulfillmentRate: fulfillmentRate,
        totalVolumeUsd: row.total_volume_usd?.toString() || '0',
        uniqueMakers: parseInt(row.unique_makers || '0'),
        lastUpdated: row.last_updated,
      };
    });

    if (this.enableCache) {
      await this.setCache(cacheKey, formatted);
    }

    return formatted;
  }

  /**
   * Get total statistics for all time (created vs fulfilled)
   * Returns aggregated data for the entire database without date filtering
   *
   * Performance: Uses optimized materialized view (dln.total_stats_mv)
   */
  async getTotalStats(): Promise<{
    created: {
      totalVolumeUsd: string;
      orderCount: number;
      avgOrderUsd: string;
    };
    fulfilled: {
      totalVolumeUsd: string;
      orderCount: number;
      avgOrderUsd: string;
    };
    dateRange: {
      from: string;
      to: string;
    };
  }> {
    const cacheKey = `${this.cachePrefix}:total-stats`;

    if (this.enableCache) {
      const cached = await this.getFromCache<any>(cacheKey);
      if (cached) return cached;
    }

    // Try optimized query using materialized view
    try {
      const query = `
        SELECT
          event_type,
          sumMerge(total_volume_usd) AS volume,
          sumMerge(tx_count) AS count,
          avgMerge(avg_volume_usd) AS avg,
          minMerge(min_date) AS from_date,
          maxMerge(max_date) AS to_date
        FROM dln.total_stats_mv
        GROUP BY event_type
      `;

      const result = await this.clickhouse.query({
        query,
        format: 'JSONEachRow',
      });

      const rows = await result.json<any[]>();

      const createdRow = rows.find(r => r.event_type === 'OrderCreated');
      const fulfilledRow = rows.find(r => r.event_type === 'OrderFulfilled');

      // If MV is empty (no rows or no matching event types), fall through to fallback
      if (rows.length === 0 || (!createdRow && !fulfilledRow)) {
        throw new Error('Materialized view is empty, using fallback');
      }

      // Get date range from either row (they should have the same global min/max)
      const fromDate = createdRow?.from_date || fulfilledRow?.from_date;
      const toDate = createdRow?.to_date || fulfilledRow?.to_date;

      const stats = {
        created: {
          totalVolumeUsd: createdRow?.volume?.toString() || '0',
          orderCount: parseInt(createdRow?.count || '0'),
          avgOrderUsd: createdRow?.avg?.toString() || '0',
        },
        fulfilled: {
          totalVolumeUsd: fulfilledRow?.volume?.toString() || '0',
          orderCount: parseInt(fulfilledRow?.count || '0'),
          avgOrderUsd: fulfilledRow?.avg?.toString() || '0',
        },
        dateRange: {
          from: fromDate ? String(fromDate) : '',
          to: toDate ? String(toDate) : '',
        },
      };

      if (this.enableCache) {
        await this.setCache(cacheKey, stats);
      }

      return stats;
    } catch (error) {
      // Fallback to scanning transactions table directly if MV doesn't exist or is empty
      console.warn('total_stats_mv not found or empty, falling back to transactions scan:', error);

      const query = `
        SELECT
          sumIf(amount_usd, event_type = 'OrderCreated') AS created_volume_usd,
          countIf(event_type = 'OrderCreated') AS created_count,
          avgIf(amount_usd, event_type = 'OrderCreated') AS created_avg_usd,
          sumIf(amount_usd, event_type = 'OrderFulfilled') AS fulfilled_volume_usd,
          countIf(event_type = 'OrderFulfilled') AS fulfilled_count,
          avgIf(amount_usd, event_type = 'OrderFulfilled') AS fulfilled_avg_usd,
          min(toDate(block_time)) AS from_date,
          max(toDate(block_time)) AS to_date
        FROM dln.transactions
        WHERE status = 'success' AND amount_usd > 0 AND event_type != ''
      `;

      const result = await this.clickhouse.query({
        query,
        format: 'JSONEachRow',
      });

      const rows = await result.json<any[]>();
      const row = rows[0];

      const stats = {
        created: {
          totalVolumeUsd: row.created_volume_usd?.toString() || '0',
          orderCount: parseInt(row.created_count || '0'),
          avgOrderUsd: row.created_avg_usd?.toString() || '0',
        },
        fulfilled: {
          totalVolumeUsd: row.fulfilled_volume_usd?.toString() || '0',
          orderCount: parseInt(row.fulfilled_count || '0'),
          avgOrderUsd: row.fulfilled_avg_usd?.toString() || '0',
        },
        dateRange: {
          from: row.from_date ? String(row.from_date) : '',
          to: row.to_date ? String(row.to_date) : '',
        },
      };

      if (this.enableCache) {
        await this.setCache(cacheKey, stats);
      }

      return stats;
    }
  }

  /**
   * Build cache key from query type and filters
   */
  private buildCacheKey(queryType: string, filters: VolumeQueryFilters): string {
    const parts = [this.cachePrefix, queryType];

    if (filters.fromDate) parts.push(`from:${filters.fromDate}`);
    if (filters.toDate) parts.push(`to:${filters.toDate}`);
    if (filters.eventType) parts.push(`type:${filters.eventType}`);
    if (filters.limit) parts.push(`limit:${filters.limit}`);

    return parts.join(':');
  }

  /**
   * Get value from Redis cache
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached) as T;
    } catch (error) {
      console.error('Redis cache read error:', error);
      return null;
    }
  }

  /**
   * Set value in Redis cache
   */
  private async setCache<T>(key: string, value: T): Promise<void> {
    try {
      await this.redis.setEx(key, this.cacheTtlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis cache write error:', error);
    }
  }
}
