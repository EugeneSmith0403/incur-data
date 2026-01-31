-- Migration 000: Initial Database Setup
-- Creates the database and migration tracking table

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS dln;

-- Use the database
USE dln;

-- Migration tracking table
CREATE TABLE IF NOT EXISTS dln.schema_migrations (
    version UInt32,                     -- Migration version number
    name String,                        -- Migration name
    applied_at DateTime DEFAULT now(),  -- When was this migration applied
    checksum String,                    -- SHA256 checksum of migration file
    execution_time_ms UInt32,           -- How long did it take to apply
    status String DEFAULT 'success'     -- 'success', 'failed', 'rolled_back'
)
ENGINE = MergeTree()
ORDER BY (version, applied_at)
SETTINGS index_granularity = 8192;
