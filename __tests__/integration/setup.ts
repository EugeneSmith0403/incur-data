import { createClient } from '@clickhouse/client';
import Redis from 'ioredis';
import { connect as amqpConnect, Connection, Channel } from 'amqplib';

export interface TestServices {
  clickhouse: ReturnType<typeof createClient>;
  redis: Redis;
  rabbitmq: {
    connection: Connection;
    channel: Channel;
  };
}

/**
 * Configuration for test services
 */
export const TEST_CONFIG = {
  clickhouse: {
    host: process.env.TEST_CLICKHOUSE_HOST || 'http://localhost:8124',
    database: process.env.TEST_CLICKHOUSE_DB || 'test_db',
    username: process.env.TEST_CLICKHOUSE_USER || 'test_user',
    password: process.env.TEST_CLICKHOUSE_PASSWORD || 'test_password',
  },
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
    password: process.env.TEST_REDIS_PASSWORD || 'test_redis_password',
  },
  rabbitmq: {
    url: process.env.TEST_RABBITMQ_URL || 'amqp://test_user:test_password@localhost:5673/test_vhost',
  },
};

/**
 * Setup test services (ClickHouse, Redis, RabbitMQ)
 */
export async function setupTestServices(): Promise<TestServices> {
  // Setup ClickHouse
  const clickhouse = createClient({
    host: TEST_CONFIG.clickhouse.host,
    database: TEST_CONFIG.clickhouse.database,
    username: TEST_CONFIG.clickhouse.username,
    password: TEST_CONFIG.clickhouse.password,
  });

  // Setup Redis
  const redis = new Redis({
    host: TEST_CONFIG.redis.host,
    port: TEST_CONFIG.redis.port,
    password: TEST_CONFIG.redis.password,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });

  // Setup RabbitMQ
  const rabbitmqConnection = await amqpConnect(TEST_CONFIG.rabbitmq.url);
  const rabbitmqChannel = await rabbitmqConnection.createChannel();

  return {
    clickhouse,
    redis,
    rabbitmq: {
      connection: rabbitmqConnection,
      channel: rabbitmqChannel,
    },
  };
}

/**
 * Teardown test services
 */
export async function teardownTestServices(services: TestServices): Promise<void> {
  // Close RabbitMQ
  try {
    await services.rabbitmq.channel.close();
    await services.rabbitmq.connection.close();
  } catch (error) {
    console.error('Error closing RabbitMQ:', error);
  }

  // Close Redis
  try {
    services.redis.disconnect();
  } catch (error) {
    console.error('Error closing Redis:', error);
  }

  // Close ClickHouse
  try {
    await services.clickhouse.close();
  } catch (error) {
    console.error('Error closing ClickHouse:', error);
  }
}

/**
 * Wait for services to be ready
 */
export async function waitForServices(maxAttempts = 30, interval = 1000): Promise<void> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      // Try ClickHouse
      const ch = createClient({
        host: TEST_CONFIG.clickhouse.host,
        username: TEST_CONFIG.clickhouse.username,
        password: TEST_CONFIG.clickhouse.password,
      });
      await ch.ping();
      await ch.close();

      // Try Redis
      const redis = new Redis({
        host: TEST_CONFIG.redis.host,
        port: TEST_CONFIG.redis.port,
        password: TEST_CONFIG.redis.password,
      });
      await redis.ping();
      redis.disconnect();

      // Try RabbitMQ
      const conn = await amqpConnect(TEST_CONFIG.rabbitmq.url);
      await conn.close();

      console.log('All test services are ready!');
      return;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error(`Services not ready after ${maxAttempts} attempts: ${error}`);
      }
      console.log(`Waiting for services... (attempt ${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

/**
 * Clean test data from all services
 */
export async function cleanTestData(services: TestServices): Promise<void> {
  // Clean ClickHouse
  try {
    const tables = ['raw_events', 'enriched_orders', 'daily_aggregates', 'daily_usd_volume_aggregates'];
    for (const table of tables) {
      try {
        await services.clickhouse.command({
          query: `TRUNCATE TABLE IF EXISTS ${table}`,
        });
      } catch (error) {
        // Table might not exist, ignore
      }
    }
  } catch (error) {
    console.error('Error cleaning ClickHouse:', error);
  }

  // Clean Redis
  try {
    await services.redis.flushdb();
  } catch (error) {
    console.error('Error cleaning Redis:', error);
  }

  // Clean RabbitMQ
  try {
    // Delete and recreate queues
    const queues = ['tx_ingest', 'tx_processing', 'tx_results'];
    for (const queue of queues) {
      try {
        await services.rabbitmq.channel.deleteQueue(queue);
      } catch (error) {
        // Queue might not exist, ignore
      }
    }
  } catch (error) {
    console.error('Error cleaning RabbitMQ:', error);
  }
}
