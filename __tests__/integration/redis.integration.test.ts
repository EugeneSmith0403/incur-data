import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestServices, teardownTestServices, cleanTestData, type TestServices } from './setup.js';

describe('Redis Integration Tests', () => {
  let services: TestServices;

  beforeAll(async () => {
    services = await setupTestServices();
  }, 30000);

  afterAll(async () => {
    await teardownTestServices(services);
  });

  beforeEach(async () => {
    await cleanTestData(services);
  });

  describe('connection', () => {
    it('should connect to Redis successfully', async () => {
      const result = await services.redis.ping();
      expect(result).toBe('PONG');
    });

    it('should authenticate with password', async () => {
      // Already authenticated during setup
      const result = await services.redis.set('test_key', 'test_value');
      expect(result).toBe('OK');
    });
  });

  describe('basic operations', () => {
    it('should set and get a string value', async () => {
      await services.redis.set('test:string', 'hello world');
      const value = await services.redis.get('test:string');
      expect(value).toBe('hello world');
    });

    it('should handle non-existent keys', async () => {
      const value = await services.redis.get('non:existent:key');
      expect(value).toBeNull();
    });

    it('should delete keys', async () => {
      await services.redis.set('test:delete', 'value');
      const deleted = await services.redis.del('test:delete');
      expect(deleted).toBe(1);
      
      const value = await services.redis.get('test:delete');
      expect(value).toBeNull();
    });

    it('should check key existence', async () => {
      await services.redis.set('test:exists', 'value');
      const exists = await services.redis.exists('test:exists');
      expect(exists).toBe(1);
      
      const notExists = await services.redis.exists('test:not:exists');
      expect(notExists).toBe(0);
    });

    it('should set expiration on keys', async () => {
      await services.redis.set('test:expire', 'value', 'EX', 1);
      
      let value = await services.redis.get('test:expire');
      expect(value).toBe('value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      value = await services.redis.get('test:expire');
      expect(value).toBeNull();
    });
  });

  describe('hash operations', () => {
    it('should set and get hash fields', async () => {
      await services.redis.hset('test:hash', 'field1', 'value1');
      await services.redis.hset('test:hash', 'field2', 'value2');
      
      const value1 = await services.redis.hget('test:hash', 'field1');
      const value2 = await services.redis.hget('test:hash', 'field2');
      
      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
    });

    it('should get all hash fields', async () => {
      await services.redis.hmset('test:hash:all', {
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
      });
      
      const all = await services.redis.hgetall('test:hash:all');
      expect(all).toEqual({
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
      });
    });

    it('should increment hash field', async () => {
      await services.redis.hset('test:counter', 'count', '0');
      await services.redis.hincrby('test:counter', 'count', 1);
      await services.redis.hincrby('test:counter', 'count', 5);
      
      const count = await services.redis.hget('test:counter', 'count');
      expect(count).toBe('6');
    });

    it('should delete hash fields', async () => {
      await services.redis.hmset('test:hash:del', {
        keep: 'value1',
        delete: 'value2',
      });
      
      await services.redis.hdel('test:hash:del', 'delete');
      
      const all = await services.redis.hgetall('test:hash:del');
      expect(all).toEqual({ keep: 'value1' });
    });
  });

  describe('list operations', () => {
    it('should push and pop from list', async () => {
      await services.redis.rpush('test:list', 'item1', 'item2', 'item3');
      
      const item = await services.redis.lpop('test:list');
      expect(item).toBe('item1');
      
      const length = await services.redis.llen('test:list');
      expect(length).toBe(2);
    });

    it('should get list range', async () => {
      await services.redis.rpush('test:range', 'a', 'b', 'c', 'd', 'e');
      
      const range = await services.redis.lrange('test:range', 0, 2);
      expect(range).toEqual(['a', 'b', 'c']);
    });

    it('should get entire list', async () => {
      await services.redis.rpush('test:all', 'x', 'y', 'z');
      
      const all = await services.redis.lrange('test:all', 0, -1);
      expect(all).toEqual(['x', 'y', 'z']);
    });
  });

  describe('set operations', () => {
    it('should add and check members in set', async () => {
      await services.redis.sadd('test:set', 'member1', 'member2', 'member3');
      
      const isMember = await services.redis.sismember('test:set', 'member1');
      expect(isMember).toBe(1);
      
      const notMember = await services.redis.sismember('test:set', 'member999');
      expect(notMember).toBe(0);
    });

    it('should get all set members', async () => {
      await services.redis.sadd('test:set:all', 'a', 'b', 'c');
      
      const members = await services.redis.smembers('test:set:all');
      expect(members.sort()).toEqual(['a', 'b', 'c']);
    });

    it('should remove members from set', async () => {
      await services.redis.sadd('test:set:rem', 'keep', 'remove');
      await services.redis.srem('test:set:rem', 'remove');
      
      const members = await services.redis.smembers('test:set:rem');
      expect(members).toEqual(['keep']);
    });

    it('should get set cardinality', async () => {
      await services.redis.sadd('test:set:card', 'a', 'b', 'c', 'd');
      
      const count = await services.redis.scard('test:set:card');
      expect(count).toBe(4);
    });
  });

  describe('sorted set operations', () => {
    it('should add and retrieve sorted set members', async () => {
      await services.redis.zadd('test:zset', 1, 'one', 2, 'two', 3, 'three');
      
      const members = await services.redis.zrange('test:zset', 0, -1);
      expect(members).toEqual(['one', 'two', 'three']);
    });

    it('should get sorted set with scores', async () => {
      await services.redis.zadd('test:zset:scores', 100, 'item1', 200, 'item2', 150, 'item3');
      
      const withScores = await services.redis.zrange('test:zset:scores', 0, -1, 'WITHSCORES');
      expect(withScores).toEqual(['item1', '100', 'item3', '150', 'item2', '200']);
    });

    it('should get sorted set by score range', async () => {
      await services.redis.zadd('test:zset:range', 1, 'a', 2, 'b', 3, 'c', 4, 'd', 5, 'e');
      
      const range = await services.redis.zrangebyscore('test:zset:range', 2, 4);
      expect(range).toEqual(['b', 'c', 'd']);
    });

    it('should increment sorted set score', async () => {
      await services.redis.zadd('test:zset:incr', 10, 'item');
      await services.redis.zincrby('test:zset:incr', 5, 'item');
      
      const score = await services.redis.zscore('test:zset:incr', 'item');
      expect(score).toBe('15');
    });
  });

  describe('JSON operations (if RedisJSON module available)', () => {
    it('should handle missing JSON module gracefully', async () => {
      try {
        // Try to use JSON.SET
        await services.redis.call('JSON.SET', 'test:json', '$', JSON.stringify({ key: 'value' }));
        
        // If it works, test retrieval
        const value = await services.redis.call('JSON.GET', 'test:json', '$');
        expect(value).toBeDefined();
      } catch (error: any) {
        // If JSON module is not available, expect specific error
        expect(error.message).toContain('unknown command');
      }
    });
  });

  describe('pipeline operations', () => {
    it('should execute commands in pipeline', async () => {
      const pipeline = services.redis.pipeline();
      
      pipeline.set('test:pipe:1', 'value1');
      pipeline.set('test:pipe:2', 'value2');
      pipeline.get('test:pipe:1');
      pipeline.get('test:pipe:2');
      
      const results = await pipeline.exec();
      
      expect(results).toHaveLength(4);
      expect(results![0][1]).toBe('OK');
      expect(results![1][1]).toBe('OK');
      expect(results![2][1]).toBe('value1');
      expect(results![3][1]).toBe('value2');
    });

    it('should handle pipeline with errors', async () => {
      const pipeline = services.redis.pipeline();
      
      pipeline.set('test:pipe:ok', 'value');
      pipeline.get('test:pipe:ok');
      // Invalid command
      pipeline.set('test:pipe:invalid');
      
      const results = await pipeline.exec();
      
      expect(results).toHaveLength(3);
      expect(results![0][0]).toBeNull(); // No error
      expect(results![1][0]).toBeNull(); // No error
      expect(results![2][0]).toBeDefined(); // Error
    });
  });

  describe('caching patterns', () => {
    it('should implement cache-aside pattern', async () => {
      const cacheKey = 'cache:user:123';
      
      // Cache miss
      let cached = await services.redis.get(cacheKey);
      expect(cached).toBeNull();
      
      // Simulate fetching from database
      const userData = JSON.stringify({ id: 123, name: 'Test User' });
      await services.redis.setex(cacheKey, 60, userData);
      
      // Cache hit
      cached = await services.redis.get(cacheKey);
      expect(cached).toBe(userData);
      expect(JSON.parse(cached!)).toEqual({ id: 123, name: 'Test User' });
    });

    it('should implement rate limiting with expiring keys', async () => {
      const rateLimitKey = 'ratelimit:user:456';
      
      // First request
      const current = await services.redis.incr(rateLimitKey);
      await services.redis.expire(rateLimitKey, 60);
      expect(current).toBe(1);
      
      // Second request
      const count2 = await services.redis.incr(rateLimitKey);
      expect(count2).toBe(2);
      
      // Check if under limit (e.g., 10 requests per minute)
      expect(count2).toBeLessThan(10);
    });

    it('should implement distributed lock pattern', async () => {
      const lockKey = 'lock:resource:789';
      const lockValue = 'unique-lock-id-' + Date.now();
      
      // Acquire lock
      const acquired = await services.redis.set(lockKey, lockValue, 'NX', 'EX', 10);
      expect(acquired).toBe('OK');
      
      // Try to acquire again (should fail)
      const acquiredAgain = await services.redis.set(lockKey, 'another-id', 'NX', 'EX', 10);
      expect(acquiredAgain).toBeNull();
      
      // Release lock
      const currentValue = await services.redis.get(lockKey);
      if (currentValue === lockValue) {
        await services.redis.del(lockKey);
      }
      
      // Verify lock is released
      const exists = await services.redis.exists(lockKey);
      expect(exists).toBe(0);
    });
  });

  describe('pub/sub (basic)', () => {
    it('should publish messages', async () => {
      const channel = 'test:channel';
      const message = 'Hello, Redis!';
      
      const subscribers = await services.redis.publish(channel, message);
      // No subscribers, so count should be 0
      expect(subscribers).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid commands', async () => {
      await expect(
        services.redis.call('INVALID_COMMAND', 'arg1', 'arg2')
      ).rejects.toThrow();
    });

    it('should handle type errors', async () => {
      await services.redis.set('test:string:type', 'string value');
      
      // Try to use string key as list
      await expect(
        services.redis.lpush('test:string:type', 'item')
      ).rejects.toThrow();
    });
  });
});
