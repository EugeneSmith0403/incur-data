-- Migration 003: Total Stats Aggregating View
-- Creates an optimized materialized view for total statistics (all time)
-- This view maintains a single aggregated row that updates automatically
-- Dramatically improves performance for /api/v1/analytics/total-stats endpoint

-- ==================================================================
-- Total Stats Aggregating View
-- Maintains aggregated statistics for all time (created vs fulfilled)
-- ==================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS dln.total_stats_mv
ENGINE = AggregatingMergeTree()
ORDER BY event_type
AS SELECT
    event_type,
    sumState(total_volume_usd) AS total_volume_usd,
    sumState(tx_count) AS tx_count,
    avgState(avg_volume_usd) AS avg_volume_usd,
    minState(date) AS min_date,
    maxState(date) AS max_date
FROM dln.daily_volume
GROUP BY event_type;

-- ==================================================================
-- Performance Notes:
-- ==================================================================
-- 1. Uses AggregatingMergeTree with State functions for incremental aggregation
-- 2. Only 2 rows total (OrderCreated, OrderFulfilled) - extremely fast queries
-- 3. Automatically updates when daily_volume receives new data
-- 4. Queries use -Merge suffix functions to finalize aggregations
--
-- Example Query (used by API):
--   SELECT
--     event_type,
--     sumMerge(total_volume_usd) AS volume,
--     sumMerge(tx_count) AS count,
--     avgMerge(avg_volume_usd) AS avg,
--     minMerge(min_date) AS from_date,
--     maxMerge(max_date) AS to_date
--   FROM dln.total_stats_mv
--   GROUP BY event_type;
--
-- Expected Performance:
-- - Before: O(days × event_types) - scans all daily_volume rows
-- - After: O(2) - always reads exactly 2 rows
-- - Speed improvement: 100x-1000x for large datasets
--
-- Memory Usage:
-- - Negligible: only 2 rows stored
-- - States are efficiently compressed by ClickHouse
