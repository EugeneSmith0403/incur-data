# Redis Schema and Key Patterns

Redis is used exclusively for **hot data**, **checkpoints**, and **caches**. All persistent data lives in ClickHouse.

## Key Naming Convention

All keys follow the pattern: `dln:{category}:{subcategory}:{identifier}`

## Checkpoint Keys

### Indexer Checkpoint
**Purpose:** Track last processed slot for idempotent indexing

```
Key: dln:checkpoint:indexer:latest
Type: Hash
TTL: None (persistent)
Fields:
  - slot: UInt64 (last processed slot)
  - signature: String (last processed signature)
  - block_time: UInt64 (unix timestamp)
  - updated_at: ISO8601 timestamp
  - events_processed: UInt64 (counter)
```

Example:
```redis
HSET dln:checkpoint:indexer:latest slot 123456789
HSET dln:checkpoint:indexer:latest signature "5Jq..."
HSET dln:checkpoint:indexer:latest block_time 1706284800
HSET dln:checkpoint:indexer:latest updated_at "2026-01-26T10:00:00Z"
```

### Service-Specific Checkpoints
```
Key: dln:checkpoint:{service_name}:latest
Type: Hash
TTL: None
```

Services: `indexer`, `worker`, `event-processor`, `aggregator`

## Cache Keys

### Token Metadata Cache
**Purpose:** Cache token information to reduce database queries

```
Key: dln:cache:token:{chain_id}:{address}
Type: Hash
TTL: 3600 seconds (1 hour)
Fields:
  - symbol: String
  - name: String
  - decimals: UInt8
  - logo_uri: String
  - coingecko_id: String
  - is_verified: Boolean
```

### Token Price Cache
**Purpose:** Cache latest token prices for USD conversion

```
Key: dln:cache:price:{chain_id}:{address}
Type: Hash
TTL: 60 seconds (1 minute)
Fields:
  - price_usd: String (decimal)
  - price_change_24h: Float
  - volume_24h: String
  - updated_at: ISO8601 timestamp
```

### Order Cache (Hot Orders)
**Purpose:** Cache active orders for quick lookup

```
Key: dln:cache:order:{order_id}
Type: Hash
TTL: 3600 seconds (1 hour)
Fields: All order fields as JSON string
```

### Account Cache
**Purpose:** Cache account metadata and statistics

```
Key: dln:cache:account:{address}
Type: Hash
TTL: 300 seconds (5 minutes)
Fields:
  - total_orders: UInt64
  - fulfilled_orders: UInt64
  - total_volume_usd: String
  - last_activity: ISO8601 timestamp
```

### Volume Aggregation Cache
**Purpose:** Cache daily USD volume query results for performance

```
Key: dln:cache:volume:{query_type}:{filters}
Type: String (JSON)
TTL: 300 seconds (5 minutes)
Value: JSON-serialized query result
```

Query types:
- `daily` - Daily volume breakdown by event type
- `summary` - Daily volume summary with fulfillment metrics
- `comparison` - Created vs fulfilled comparison
- `timeseries` - Time series data points
- `top-tokens` - Top token pairs by volume
- `by-chain` - Volume distribution by chain
- `stats` - Aggregated statistics

Filter components (optional):
- `from:YYYY-MM-DD` - Start date
- `to:YYYY-MM-DD` - End date
- `type:created|fulfilled` - Event type filter
- `give:CHAIN_ID` - Source chain filter
- `take:CHAIN_ID` - Destination chain filter
- `limit:N` - Result limit

Example keys:
```redis
# Daily volume for last 7 days
dln:cache:volume:daily:from:2026-01-20:to:2026-01-26

# Summary for Solana chain
dln:cache:volume:summary:give:solana-mainnet

# Top 10 token pairs (created orders)
dln:cache:volume:top-tokens:type:created:limit:10

# Stats for all chains
dln:cache:volume:stats:from:2026-01-01:to:2026-01-26
```

## Rate Limiting Keys

### API Rate Limit
**Purpose:** Track API request rates per client

```
Key: dln:ratelimit:api:{client_id}:{window}
Type: String (counter)
TTL: 60 seconds (sliding window)
Value: Request count
```

Example:
```redis
INCR dln:ratelimit:api:client123:1706284800
EXPIRE dln:ratelimit:api:client123:1706284800 60
```

### Indexer Rate Limit
**Purpose:** Prevent overwhelming RPC endpoints

```
Key: dln:ratelimit:rpc:{endpoint}:{window}
Type: String (counter)
TTL: 1 second
Value: Request count
```

## Lock Keys

### Processing Lock
**Purpose:** Ensure only one indexer processes a slot

```
Key: dln:lock:indexer:slot:{slot}
Type: String
TTL: 30 seconds (auto-release if process crashes)
Value: {instance_id}:{timestamp}
```

Example:
```redis
SET dln:lock:indexer:slot:123456789 "indexer-1:1706284800" NX EX 30
```

### Migration Lock
**Purpose:** Ensure only one migration runs at a time

```
Key: dln:lock:migration
Type: String
TTL: 300 seconds (5 minutes)
Value: {migration_version}:{instance_id}
```

## Temporary Data Keys

### Event Processing Queue
**Purpose:** Queue events for async processing

```
Key: dln:queue:events
Type: List (LPUSH/RPOP)
TTL: None (drained by workers)
Value: JSON-encoded event data
```

### Failed Events Queue
**Purpose:** Track events that failed processing for retry

```
Key: dln:queue:failed:events
Type: List
TTL: 86400 seconds (24 hours)
Value: JSON with event + error info
```

## Metrics Keys

### Real-time Counters
**Purpose:** Track system metrics

```
Key: dln:metrics:counter:{metric_name}:{window}
Type: String (counter)
TTL: 3600 seconds
Value: Count
```

Examples:
- `dln:metrics:counter:events_processed:1706284800` - Events processed in this hour
- `dln:metrics:counter:orders_created:1706284800` - Orders created in this hour

### Real-time Gauges
**Purpose:** Track current system state

```
Key: dln:metrics:gauge:{metric_name}
Type: String
TTL: 60 seconds
Value: Current value
```

Examples:
- `dln:metrics:gauge:active_orders` - Current active orders count
- `dln:metrics:gauge:indexer_lag_slots` - How far behind indexer is

## Session Keys (for Web App)

### User Session
**Purpose:** Store user session data

```
Key: dln:session:{session_id}
Type: Hash
TTL: 86400 seconds (24 hours)
Fields:
  - user_id: String
  - wallet_address: String
  - created_at: ISO8601 timestamp
  - last_seen: ISO8601 timestamp
```

## Key Expiration Strategy

| Key Type | TTL | Rationale |
|----------|-----|-----------|
| Checkpoints | None | Must persist until backed up to ClickHouse |
| Token metadata | 1 hour | Changes infrequently |
| Token prices | 1 minute | Needs to be fresh |
| Order cache | 1 hour | Active orders change frequently |
| Volume aggregates | 5 minutes | Balances freshness with query performance |
| Rate limits | 1-60 sec | Sliding window |
| Locks | 30 sec | Auto-release on crash |
| Sessions | 24 hours | Standard session timeout |

## Redis Configuration

### Recommended Settings

```yaml
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
```

### Connection Pooling

```typescript
{
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  enableReadyCheck: true,
  enableOfflineQueue: true,
}
```

## Best Practices

1. **Always set TTL** - Except for checkpoints, all keys should have expiration
2. **Use atomic operations** - Use WATCH/MULTI/EXEC for critical updates
3. **Namespace consistently** - Always use `dln:` prefix
4. **Compress large values** - Use msgpack or JSON compression for large objects
5. **Monitor memory** - Track Redis memory usage and eviction rate
6. **Backup checkpoints** - Periodically save checkpoints to ClickHouse
7. **Use pipelining** - Batch multiple commands for better performance

## Monitoring Queries

```redis
# Check memory usage
INFO memory

# List all DLN keys
KEYS dln:*

# Get checkpoint status
HGETALL dln:checkpoint:indexer:latest

# Check cache hit rate
INFO stats | grep keyspace

# Monitor command latency
SLOWLOG GET 10
```

## Migration from Redis to ClickHouse

Checkpoints should be periodically backed up to ClickHouse:

```typescript
// Every 1000 blocks or 5 minutes
async function backupCheckpoint() {
  const checkpoint = await redis.hgetall('dln:checkpoint:indexer:latest');
  await clickhouse.insert('dln.checkpoints', {
    checkpoint_id: uuidv4(),
    service_name: 'indexer',
    checkpoint_type: 'slot',
    ...checkpoint,
  });
}
```

This ensures checkpoints survive Redis restarts and provides audit trail.
