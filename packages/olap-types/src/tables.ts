/**
 * ClickHouse table definitions (SQL DDL)
 * Simplified structure with single transactions table
 */

export const TABLE_DEFINITIONS = {
  transactions: `
    CREATE TABLE IF NOT EXISTS dln.transactions (
      signature String,
      slot UInt64,
      block_time DateTime,
      program_id String,
      account String,
      token_address String,
      amount String,
      amount_usd Decimal64(18, 8),
      status String,
      instruction_type String,
      event_type String DEFAULT '',
      order_id String DEFAULT '',
      created_at DateTime DEFAULT now(),
      updated_at DateTime DEFAULT now()
    )
    ENGINE = ReplacingMergeTree(updated_at)
    PARTITION BY toYYYYMM(block_time)
    PRIMARY KEY (signature, account, program_id)
    ORDER BY (signature, account, program_id, slot)
    SETTINGS index_granularity = 8192;
  `,

  daily_program_stats: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS dln.daily_program_stats
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(date)
    PRIMARY KEY (date, program_id)
    ORDER BY (date, program_id)
    AS SELECT
      toDate(block_time) AS date,
      program_id,
      count() AS tx_count,
      sum(amount_usd) AS total_volume_usd,
      uniq(account) AS unique_accounts,
      countIf(status = 'success') AS success_count,
      countIf(status = 'failed') AS failed_count
    FROM dln.transactions
    GROUP BY date, program_id;
  `,

  account_stats: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS dln.account_stats
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(date)
    PRIMARY KEY (date, account, program_id)
    ORDER BY (date, account, program_id)
    AS SELECT
      toDate(block_time) AS date,
      account,
      program_id,
      count() AS tx_count,
      sum(amount_usd) AS total_received_usd,
      uniq(token_address) AS unique_tokens
    FROM dln.transactions
    WHERE status = 'success'
    GROUP BY date, account, program_id;
  `,

  hourly_volume: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS dln.hourly_volume
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(hour)
    ORDER BY (hour, program_id, event_type)
    AS SELECT
      toStartOfHour(block_time) AS hour,
      program_id,
      event_type,
      sum(amount_usd) AS total_volume_usd,
      count() AS tx_count,
      avg(amount_usd) AS avg_volume_usd,
      min(amount_usd) AS min_volume_usd,
      max(amount_usd) AS max_volume_usd,
      uniq(account) AS unique_accounts,
      uniq(token_address) AS unique_tokens
    FROM dln.transactions
    WHERE amount_usd > 0 AND status = 'success'
    GROUP BY hour, program_id, event_type;
  `,

  daily_volume: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS dln.daily_volume
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(date)
    ORDER BY (date, program_id, event_type)
    AS SELECT
      toDate(block_time) AS date,
      program_id,
      event_type,
      sum(amount_usd) AS total_volume_usd,
      count() AS tx_count,
      avg(amount_usd) AS avg_volume_usd,
      min(amount_usd) AS min_volume_usd,
      max(amount_usd) AS max_volume_usd,
      uniq(account) AS unique_accounts,
      uniq(token_address) AS unique_tokens,
      countIf(status = 'success') AS success_count,
      countIf(status = 'failed') AS failed_count
    FROM dln.transactions
    WHERE amount_usd > 0
    GROUP BY date, program_id, event_type;
  `,

  hourly_token_volume: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS dln.hourly_token_volume
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(hour)
    ORDER BY (hour, token_address, program_id)
    AS SELECT
      toStartOfHour(block_time) AS hour,
      token_address,
      program_id,
      sum(amount_usd) AS total_volume_usd,
      count() AS tx_count,
      avg(amount_usd) AS avg_volume_usd,
      uniq(account) AS unique_accounts
    FROM dln.transactions
    WHERE amount_usd > 0 AND token_address != '' AND status = 'success'
    GROUP BY hour, token_address, program_id;
  `,

  daily_token_volume: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS dln.daily_token_volume
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(date)
    ORDER BY (date, token_address, program_id)
    AS SELECT
      toDate(block_time) AS date,
      token_address,
      program_id,
      sum(amount_usd) AS total_volume_usd,
      count() AS tx_count,
      avg(amount_usd) AS avg_volume_usd,
      uniq(account) AS unique_accounts
    FROM dln.transactions
    WHERE amount_usd > 0 AND token_address != '' AND status = 'success'
    GROUP BY date, token_address, program_id;
  `,

  daily_account_volume: `
    CREATE MATERIALIZED VIEW IF NOT EXISTS dln.daily_account_volume
    ENGINE = SummingMergeTree()
    PARTITION BY toYYYYMM(date)
    ORDER BY (date, account, program_id)
    AS SELECT
      toDate(block_time) AS date,
      account,
      program_id,
      sum(amount_usd) AS total_volume_usd,
      count() AS tx_count,
      avg(amount_usd) AS avg_volume_usd,
      uniq(token_address) AS unique_tokens
    FROM dln.transactions
    WHERE amount_usd > 0 AND status = 'success'
    GROUP BY date, account, program_id;
  `,
};

/**
 * TypeScript interface for transactions table
 */
export interface Transaction {
  signature: string;
  slot: number;
  block_time: Date;
  program_id: string;
  account: string;
  token_address: string;
  amount: string;
  amount_usd: number;
  status: 'success' | 'failed' | 'pending';
  instruction_type: string;
  event_type: string;
  order_id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Interface for daily program statistics
 */
export interface DailyProgramStats {
  date: Date;
  program_id: string;
  tx_count: number;
  total_volume_usd: number;
  unique_accounts: number;
  success_count: number;
  failed_count: number;
}

/**
 * Interface for account statistics
 */
export interface AccountStats {
  date: Date;
  account: string;
  program_id: string;
  tx_count: number;
  total_received_usd: number;
  unique_tokens: number;
}

/**
 * Interface for hourly volume
 */
export interface HourlyVolume {
  hour: Date;
  program_id: string;
  event_type: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  min_volume_usd: number;
  max_volume_usd: number;
  unique_accounts: number;
  unique_tokens: number;
}

/**
 * Interface for daily volume
 */
export interface DailyVolume {
  date: Date;
  program_id: string;
  event_type: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  min_volume_usd: number;
  max_volume_usd: number;
  unique_accounts: number;
  unique_tokens: number;
  success_count: number;
  failed_count: number;
}

/**
 * Interface for hourly token volume
 */
export interface HourlyTokenVolume {
  hour: Date;
  token_address: string;
  program_id: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  unique_accounts: number;
}

/**
 * Interface for daily token volume
 */
export interface DailyTokenVolume {
  date: Date;
  token_address: string;
  program_id: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  unique_accounts: number;
}

/**
 * Interface for daily account volume
 */
export interface DailyAccountVolume {
  date: Date;
  account: string;
  program_id: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  unique_tokens: number;
}

/**
 * Generate full schema SQL
 */
export function generateSchemaSQL(): string {
  return Object.values(TABLE_DEFINITIONS).join('\n\n');
}
