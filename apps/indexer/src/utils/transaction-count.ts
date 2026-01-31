import type { ClickHouseClient } from '@clickhouse/client';
import type { RedisClientType } from 'redis';
import type { Logger } from 'pino';
import { formatError } from './error.js';

export interface TransactionCountResult {
  programId: string;
  count: number;
}

export interface TransactionCountDeps {
  redis: RedisClientType;
  clickhouse: ClickHouseClient;
  logger: Logger;
  database: string;
}

/**
 * Get transaction count for a program_id (Redis first, fallback to ClickHouse)
 * @param programId - The program ID to get count for
 * @param deps - Dependencies (redis, clickhouse, logger, database)
 * @returns Transaction count for the program
 */
export async function getTransactionCount(
  programId: string,
  deps: TransactionCountDeps
): Promise<number> {
  const { redis, clickhouse, logger, database } = deps;
  const redisKey = `worker:stats:${programId}:processed_count`;

  try {
    const isExistKey = Boolean(await redis.exists(redisKey));

    if (isExistKey) {
      const redisCount = (await redis.get(redisKey)) ?? '0';
      const count = parseInt(redisCount, 10);
      logger.debug(
        { programId, count, source: 'redis' },
        'Got transaction count from Redis'
      );
      return count;
    }

    logger.debug({ programId }, 'Redis key not found, querying ClickHouse');

    const result = await clickhouse.query({
      query: `SELECT count(DISTINCT signature) as count FROM ${database}.transactions WHERE program_id = {programId:String}`,
      query_params: { programId },
      format: 'JSONEachRow',
    });

    const data = await result.json<Array<{ count: string }>>();
    const count = data.length > 0 && data[0] ? parseInt(data[0].count, 10) : 0;

    logger.debug(
      { programId, count, source: 'clickhouse' },
      'Got transaction count from ClickHouse'
    );

    return count;
  } catch (error) {
    logger.error({ ...formatError(error) }, 'Failed to get transaction count');
    return 0;
  }
}

/**
 * Get transaction counts grouped by program_id (Redis first, fallback to ClickHouse)
 * @param programId - The program ID to check
 * @param deps - Dependencies (redis, clickhouse, logger, database)
 * @returns Array of transaction counts by program_id
 */
export async function getTransactionCountsByProgramId(
  programId: string,
  deps: TransactionCountDeps
): Promise<TransactionCountResult[]> {
  const { redis, clickhouse, logger, database } = deps;
  const redisKey = `worker:stats:${programId}:processed_count`;

  try {
    const isExistKey = Boolean(await redis.exists(redisKey));

    if (isExistKey) {
      const redisCount = (await redis.get(redisKey)) ?? '0';
      const count = parseInt(redisCount, 10);
      logger.debug(
        { programId, count, source: 'redis' },
        'Got transaction count from Redis'
      );
      return [{ programId, count }];
    }

    logger.debug({ programId }, 'Redis key not found, querying ClickHouse');

    const result = await clickhouse.query({
      query: `SELECT program_id as programId, count(*) as count
              FROM ${database}.transactions
              GROUP BY program_id
              ORDER BY count DESC`,
      format: 'JSONEachRow',
    });

    const data = await result.json<Array<{ programId: string; count: string }>>();

    return data.map((row) => ({
      programId: row.programId,
      count: Number(row.count),
    }));
  } catch (error) {
    logger.error({ ...formatError(error) }, 'Failed to get transaction count by program_id');
    return [];
  }
}
