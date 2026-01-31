import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestServices, teardownTestServices, cleanTestData, type TestServices } from './setup.js';

describe('ClickHouse Integration Tests', () => {
  let services: TestServices;

  beforeAll(async () => {
    services = await setupTestServices();
  }, 30000); // 30 second timeout for service setup

  afterAll(async () => {
    await teardownTestServices(services);
  });

  beforeEach(async () => {
    await cleanTestData(services);
  });

  describe('connection', () => {
    it('should connect to ClickHouse successfully', async () => {
      const result = await services.clickhouse.ping();
      expect(result.success).toBe(true);
    });

    it('should create test database', async () => {
      const result = await services.clickhouse.query({
        query: 'SELECT currentDatabase()',
        format: 'JSONEachRow',
      });
      const data = await result.json();
      expect(data.length).toBeGreaterThan(0);
    });
  });

  describe('table operations', () => {
    it('should create a test table', async () => {
      await services.clickhouse.command({
        query: `
          CREATE TABLE IF NOT EXISTS test_orders (
            order_id String,
            signature String,
            maker String,
            give_amount String,
            take_amount String,
            status String,
            created_at DateTime64(3),
            created_slot UInt64
          ) ENGINE = MergeTree()
          ORDER BY (order_id, created_at)
        `,
      });

      const result = await services.clickhouse.query({
        query: 'SHOW TABLES',
        format: 'JSONEachRow',
      });
      const tables = await result.json<{ name: string }>();
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('test_orders');
    });

    it('should insert and query data', async () => {
      // Create table
      await services.clickhouse.command({
        query: `
          CREATE TABLE IF NOT EXISTS test_data (
            id String,
            value UInt32,
            created_at DateTime64(3)
          ) ENGINE = MergeTree()
          ORDER BY id
        `,
      });

      // Insert data
      await services.clickhouse.insert({
        table: 'test_data',
        values: [
          { id: 'test1', value: 100, created_at: new Date().toISOString() },
          { id: 'test2', value: 200, created_at: new Date().toISOString() },
        ],
        format: 'JSONEachRow',
      });

      // Query data
      const result = await services.clickhouse.query({
        query: 'SELECT * FROM test_data ORDER BY id',
        format: 'JSONEachRow',
      });
      const data = await result.json<{ id: string; value: number }>();
      
      expect(data).toHaveLength(2);
      expect(data[0].id).toBe('test1');
      expect(data[0].value).toBe(100);
      expect(data[1].id).toBe('test2');
      expect(data[1].value).toBe(200);
    });

    it('should perform aggregation queries', async () => {
      // Create table
      await services.clickhouse.command({
        query: `
          CREATE TABLE IF NOT EXISTS test_metrics (
            metric_name String,
            metric_value Float64,
            timestamp DateTime64(3)
          ) ENGINE = MergeTree()
          ORDER BY timestamp
        `,
      });

      // Insert data
      const now = new Date();
      await services.clickhouse.insert({
        table: 'test_metrics',
        values: [
          { metric_name: 'volume', metric_value: 100.5, timestamp: now.toISOString() },
          { metric_name: 'volume', metric_value: 200.75, timestamp: now.toISOString() },
          { metric_name: 'volume', metric_value: 150.25, timestamp: now.toISOString() },
        ],
        format: 'JSONEachRow',
      });

      // Aggregate query
      const result = await services.clickhouse.query({
        query: `
          SELECT 
            metric_name,
            sum(metric_value) as total,
            avg(metric_value) as average,
            count() as count
          FROM test_metrics
          GROUP BY metric_name
        `,
        format: 'JSONEachRow',
      });
      const data = await result.json<{ metric_name: string; total: number; average: number; count: number }>();
      
      expect(data).toHaveLength(1);
      expect(data[0].metric_name).toBe('volume');
      expect(data[0].total).toBeCloseTo(451.5, 1);
      expect(data[0].average).toBeCloseTo(150.5, 1);
      expect(data[0].count).toBe(3);
    });

    it('should handle transactions with OPTIMIZE', async () => {
      // Create table
      await services.clickhouse.command({
        query: `
          CREATE TABLE IF NOT EXISTS test_optimized (
            id String,
            data String
          ) ENGINE = MergeTree()
          ORDER BY id
        `,
      });

      // Insert data
      await services.clickhouse.insert({
        table: 'test_optimized',
        values: [
          { id: 'opt1', data: 'data1' },
          { id: 'opt2', data: 'data2' },
        ],
        format: 'JSONEachRow',
      });

      // Optimize table
      await services.clickhouse.command({
        query: 'OPTIMIZE TABLE test_optimized FINAL',
      });

      // Verify data
      const result = await services.clickhouse.query({
        query: 'SELECT count() as cnt FROM test_optimized',
        format: 'JSONEachRow',
      });
      const data = await result.json<{ cnt: number }>();
      expect(data[0].cnt).toBe(2);
    });
  });

  describe('data types', () => {
    it('should handle various data types correctly', async () => {
      await services.clickhouse.command({
        query: `
          CREATE TABLE IF NOT EXISTS test_types (
            str String,
            num UInt64,
            flt Float64,
            bool UInt8,
            dt DateTime64(3),
            arr Array(String)
          ) ENGINE = MergeTree()
          ORDER BY str
        `,
      });

      const testData = {
        str: 'test string',
        num: 9007199254740991, // Large number
        flt: 123.456789,
        bool: 1,
        dt: new Date().toISOString(),
        arr: ['item1', 'item2', 'item3'],
      };

      await services.clickhouse.insert({
        table: 'test_types',
        values: [testData],
        format: 'JSONEachRow',
      });

      const result = await services.clickhouse.query({
        query: 'SELECT * FROM test_types',
        format: 'JSONEachRow',
      });
      const data = await result.json();
      
      expect(data).toHaveLength(1);
      expect(data[0].str).toBe(testData.str);
      expect(data[0].num).toBe(testData.num.toString()); // ClickHouse returns as string for large numbers
      expect(data[0].arr).toEqual(testData.arr);
    });
  });

  describe('error handling', () => {
    it('should handle invalid queries gracefully', async () => {
      await expect(
        services.clickhouse.query({
          query: 'SELECT * FROM non_existent_table',
          format: 'JSONEachRow',
        })
      ).rejects.toThrow();
    });

    it('should handle syntax errors', async () => {
      await expect(
        services.clickhouse.command({
          query: 'CREATE INVALID SYNTAX',
        })
      ).rejects.toThrow();
    });

    it('should handle type mismatches', async () => {
      await services.clickhouse.command({
        query: `
          CREATE TABLE IF NOT EXISTS test_strict_types (
            id UInt32,
            value String
          ) ENGINE = MergeTree()
          ORDER BY id
        `,
      });

      // This should fail because we're trying to insert string into UInt32
      await expect(
        services.clickhouse.insert({
          table: 'test_strict_types',
          values: [{ id: 'not_a_number', value: 'test' }],
          format: 'JSONEachRow',
        })
      ).rejects.toThrow();
    });
  });
});
