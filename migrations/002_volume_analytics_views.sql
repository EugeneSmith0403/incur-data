-- Migration 002: Volume Analytics Materialized Views
-- Creates optimized materialized views for USD volume aggregation by time periods
-- All aggregations are based on block_time and amount_usd from transactions table
-- NOTE: Only successful transactions (status = 'success') are included

-- ==================================================================
-- View 1: Hourly Volume Aggregation
-- Aggregates USD volume by hour for detailed short-term analytics
-- Use case: Charts for last 24h-7d, hourly volume trends
-- ==================================================================
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

-- ==================================================================
-- View 2: Daily Volume Aggregation
-- Aggregates USD volume by day for medium-term analytics
-- Use case: Charts for last 30d-365d, daily volume trends, comparisons
-- ==================================================================
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

-- ==================================================================
-- View 3: Hourly Volume by Token
-- Aggregates USD volume by token and hour for token-specific analytics
-- Use case: Top tokens by volume, token performance tracking
-- ==================================================================
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
WHERE amount_usd > 0
  AND token_address != ''
  AND status = 'success'
GROUP BY hour, token_address, program_id;

-- ==================================================================
-- View 4: Daily Volume by Token
-- Aggregates USD volume by token and day for token analytics
-- Use case: Top tokens by volume over longer periods, token trends
-- ==================================================================
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
WHERE amount_usd > 0
  AND token_address != ''
  AND status = 'success'
GROUP BY date, token_address, program_id;

-- ==================================================================
-- View 5: Daily Volume by Account
-- Aggregates USD volume by account and day for user analytics
-- Use case: Top users by volume, user activity tracking
-- ==================================================================
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

-- ==================================================================
-- Performance Notes:
-- ==================================================================
-- 1. All views use SummingMergeTree for efficient aggregation
-- 2. Partitioned by month (toYYYYMM) for fast data access and management
-- 3. Ordered by time + dimensions for optimal query performance
-- 4. Only successful transactions with amount_usd > 0 are included
-- 5. Views are automatically updated on new data insert
--
-- Query Performance:
-- - Hourly views: Use for ranges < 7 days
-- - Daily views: Use for ranges >= 7 days
-- - Token/Account views: Use for top-N queries and specific entity analytics
--
-- Example Queries:
--
-- Total volume for last 24 hours:
--   SELECT sum(total_volume_usd) FROM dln.hourly_volume
--   WHERE hour >= now() - INTERVAL 24 HOUR;
--
-- Daily volume for date range:
--   SELECT date, sum(total_volume_usd) FROM dln.daily_volume
--   WHERE date BETWEEN '2024-01-01' AND '2024-01-31'
--   GROUP BY date ORDER BY date;
--
-- Top 10 tokens by volume for last 7 days:
--   SELECT token_address, sum(total_volume_usd) as volume
--   FROM dln.daily_token_volume
--   WHERE date >= today() - INTERVAL 7 DAY
--   GROUP BY token_address
--   ORDER BY volume DESC LIMIT 10;
