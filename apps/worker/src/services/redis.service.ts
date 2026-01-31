import type { RedisClientType } from 'redis';

/**
 * Redis Service
 * Handles all Redis operations for worker statistics and checkpoints
 */
export class RedisService {
  constructor(private redis: RedisClientType) {}

  /**
   * Increment processed transactions counter for a programId
   */
  async incrementProcessedCounter(programId: string, count: number = 1): Promise<void> {
    const key = `worker:stats:${programId}:processed_count`;
    await this.redis.incrBy(key, count);
  }

  /**
   * Get processed transactions count for a programId
   */
  async getProcessedCount(programId: string): Promise<number> {
    const key = `worker:stats:${programId}:processed_count`;
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }
}
