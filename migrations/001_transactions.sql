-- Migration 001: Simplified Transactions Table
-- Single table to store all Solana blockchain transactions with USD amounts

CREATE TABLE IF NOT EXISTS dln.transactions (
    -- Transaction identification
    signature String,              -- Transaction signature (unique ID)
    slot UInt64,                   -- Block slot number
    block_time DateTime,           -- Block timestamp
    
    -- Program and account info
    program_id String,             -- Program ID that processed transaction
    account String,                -- Account that received/sent funds
    
    -- Token and amount info
    token_address String,          -- Token address (mint)
    amount String,                 -- Amount in tokens (as string for precision)
    amount_usd Decimal64(8),       -- Amount in USD (mandatory field)
    
    -- Transaction metadata
    status String,                      -- Transaction status: 'success', 'failed', 'pending'
    instruction_type String,            -- Type of instruction: 'transfer', 'swap', 'order', etc.
    event_type String DEFAULT '',       -- Event type: 'OrderCreated', 'OrderFulfilled', etc.
    order_id String DEFAULT '',         -- DLN order ID (hex string; empty if not applicable)
    
    -- Timestamps
    created_at DateTime DEFAULT now(),  -- When record was created
    updated_at DateTime DEFAULT now()   -- When record was last updated
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(block_time)
PRIMARY KEY (signature, account, program_id)
ORDER BY (signature, account, program_id, slot)
SETTINGS index_granularity = 8192;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tx_program_id ON dln.transactions(program_id) TYPE bloom_filter(0.01) GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_tx_account ON dln.transactions(account) TYPE bloom_filter(0.01) GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_tx_token ON dln.transactions(token_address) TYPE bloom_filter(0.01) GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_tx_status ON dln.transactions(status) TYPE set(10) GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_tx_event_type ON dln.transactions(event_type) TYPE set(10) GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_tx_block_time ON dln.transactions(block_time) TYPE minmax GRANULARITY 1;
CREATE INDEX IF NOT EXISTS idx_tx_slot ON dln.transactions(slot) TYPE minmax GRANULARITY 1;

-- Materialized view for daily statistics by program_id
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

-- Materialized view for account statistics
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
