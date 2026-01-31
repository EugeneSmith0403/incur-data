# DLN Transaction Worker

A robust worker service that consumes transaction messages from RabbitMQ, fetches and parses DLN events, enriches them with USD prices via Jupiter API, and batch inserts into ClickHouse.

> 📘 **Running Multiple Workers?** See the [Multi-Program Setup Guide](./MULTI_PROGRAM_GUIDE.md) for detailed instructions on running multiple workers with different DLN program IDs.

## Features

### 🚀 Core Functionality

- **RabbitMQ Consumer**: Consumes `TxIngestMessage` from RabbitMQ with configurable prefetch and retry logic
- **Transaction Fetching**: Fetches Solana transactions with exponential backoff retry
- **DLN Event Parsing**: Parses DLN order events (OrderCreated, OrderFulfilled) from transactions
- **Price Enrichment**: Fetches USD prices from Jupiter API with API key authentication
- **Redis Caching**: Caches token prices to reduce API calls
- **Batch Processing**: Buffers events and batch inserts into ClickHouse for efficiency
- **Reliable Processing**: Ensures at-least-once delivery via RabbitMQ ACK and ClickHouse deduplication
- **Graceful Shutdown**: Flushes all batches before shutdown

### 🔧 Retry & Resilience

- **Exponential Backoff**: Configurable retry with backoff for transaction fetching
- **Network Error Handling**: Automatically retries on network/timeout errors
- **Rate Limit Handling**: Respects Jupiter API rate limits with retry logic
- **Message Acknowledgment**: Only ACKs messages after successful ClickHouse writes

### 📊 Observability

- **Structured Logging**: JSON logs with pino (pretty-printed in development)
- **Health Checks**: Periodic health check logs with batch status
- **Counter Tracking**: Redis counters for backfill progress tracking
- **Performance Metrics**: Duration tracking for all operations

## Architecture

```
RabbitMQ Queue → Worker → Solana RPC → DLN Parser → Jupiter API → Redis Cache → ClickHouse
                    ↓                                                              ↓
              Idempotency Check                                          Batch Processor
```

## Environment Variables

### Required

```bash
# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
DLN_PROGRAM_ID=your-dln-program-id

# Jupiter API (REQUIRED for price enrichment)
JUPITER_API_KEY=your-jupiter-api-key-here

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Redis
REDIS_URL=redis://localhost:6379

# ClickHouse
CLICKHOUSE_URL=http://localhost:8123
```

### Optional (with defaults)

```bash
# Application
NODE_ENV=development
LOG_LEVEL=info

# RabbitMQ
RABBITMQ_QUEUE_NAME=dln_transactions
RABBITMQ_EXCHANGE_NAME=dln_exchange
RABBITMQ_RETRY_DELAY=5000
RABBITMQ_MAX_RETRIES=3
RABBITMQ_PREFETCH_COUNT=10

# Redis
REDIS_PASSWORD=
REDIS_DB=0

# ClickHouse
CLICKHOUSE_DATABASE=dln
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=

# Solana
SOLANA_COMMITMENT=confirmed

# Jupiter API
JUPITER_API_URL=https://api.jup.ag
JUPITER_PRICE_ENDPOINT=/price/v3
JUPITER_TIMEOUT=5000
JUPITER_RETRY_ATTEMPTS=3
JUPITER_CACHE_TTL=60

# Worker Configuration
WORKER_CONCURRENCY=10
WORKER_BATCH_SIZE=100
WORKER_RETRY_ATTEMPTS=3
WORKER_RETRY_DELAY=1000
WORKER_RETRY_BACKOFF_MULTIPLIER=2
WORKER_MAX_RETRY_DELAY=30000
WORKER_BATCH_FLUSH_INTERVAL=5000
```

## Getting Started

### Prerequisites

- Node.js 18+
- RabbitMQ running
- Redis running
- ClickHouse running with migrations applied
- Jupiter API key

### Installation

```bash
# Install dependencies (from project root)
pnpm install

# Build the worker
cd apps/worker
pnpm build
```

### Database Setup

Run the ClickHouse migration to create the `enriched_orders` table:

```bash
# From project root
pnpm --filter @incur-data/worker db:migrate

# Or manually apply the migration
clickhouse-client --queries-file migrations/005_enriched_orders.sql
```

### Running

#### Single Worker (Single DLN Program)

For a single DLN program, use the standard environment configuration:

```bash
# Development (with hot reload)
pnpm dev

# Production
pnpm start
```

#### Multiple Workers (Multiple DLN Programs)

To run multiple workers for different DLN programs simultaneously:

**Step 1: Configure Environment Files**

Create separate configuration files for each program:

```bash
# Copy example configs
cp env.worker.program1.example .env.worker.program1
cp env.worker.program2.example .env.worker.program2

# Edit each file with appropriate values:
# - DLN_PROGRAM_ID (must be different)
# - RABBITMQ_QUEUE_NAME (must be different)
# - WORKER_ID (must be different)
# - WORKER_METRICS_PORT (must be different)
```

**Critical Configuration Differences:**

| Setting | Program 1 | Program 2 |
|---------|-----------|-----------|
| `WORKER_ID` | `worker-program1` | `worker-program2` |
| `DLN_PROGRAM_ID` | Your first program ID | Your second program ID |
| `RABBITMQ_QUEUE_NAME` | `dln_transactions` | `dln_transactions_program2` |
| `WORKER_METRICS_PORT` | `9091` | `9092` |

**Step 2: Start Workers**

```bash
# Terminal 1: Start worker for program 1
NODE_ENV=production node --env-file=.env.worker.program1 dist/index.js

# Terminal 2: Start worker for program 2
NODE_ENV=production node --env-file=.env.worker.program2 dist/index.js

# Or use PM2 for process management
pm2 start dist/index.js --name worker-program1 --env-file .env.worker.program1
pm2 start dist/index.js --name worker-program2 --env-file .env.worker.program2
```

**Step 3: Configure Corresponding Indexers**

Each worker needs a corresponding indexer publishing to its queue:

```bash
# Copy indexer configs
cp env.indexer.program1.example .env.indexer.program1
cp env.indexer.program2.example .env.indexer.program2

# Start indexers (from apps/indexer)
cd apps/indexer
node --env-file=../../.env.indexer.program1 dist/index.js
node --env-file=../../.env.indexer.program2 dist/index.js
```

**Step 4: Monitor Workers**

```bash
# Check metrics for program 1
curl http://localhost:9091/metrics

# Check metrics for program 2
curl http://localhost:9092/metrics

# Check health
curl http://localhost:9091/health
curl http://localhost:9092/health
```

#### Using Docker Compose

**For Single Program (default):**

```bash
docker-compose up worker-program1
```

**For Multiple Programs:**

```bash
# Start all services including both workers
docker-compose --profile multi-program up

# Or start specific workers
docker-compose up worker-program1 worker-program2
```

Make sure to set environment variables in `.env` file:

```bash
# Required for both programs
JUPITER_API_KEY=your-key

# Program 1
DLN_PROGRAM_ID=your-first-program-id

# Program 2 (for multi-program setup)
DLN_PROGRAM_ID_PROGRAM2=your-second-program-id
```

## Data Flow

### 1. Message Consumption

Worker consumes `TxIngestMessage` from RabbitMQ:

```typescript
interface TxIngestMessage {
  signature: string;
  slot: number;
  blockTime: number;
  source: string;
  programId: string;
}
```

### 2. Transaction Fetching

Fetches transaction from Solana RPC with retry:

- Initial delay: 1000ms (configurable)
- Backoff multiplier: 2x (configurable)
- Max delay: 30000ms (configurable)
- Max attempts: 3 (configurable)

### 3. Event Parsing

Parses DLN events using `@incur-data/tx-parsing`:

- OrderCreated events
- OrderFulfilled events

### 4. Price Enrichment

Fetches token prices from Jupiter API:

- Batches multiple token addresses in single request
- Caches prices in Redis (60s TTL by default)
- Calculates USD amounts for give/take tokens
- Handles API errors gracefully (continues without prices)

### 5. Batch Insertion

Buffers events and batch inserts to ClickHouse:

- **raw_events**: Raw transaction data
- **enriched_orders**: Parsed events with USD prices

Batch triggers:
- Size threshold reached (default: 100 items)
- Time interval elapsed (default: 5 seconds)
- Graceful shutdown initiated

### 6. Message Acknowledgment

Only ACKs message after successful ClickHouse writes to ensure at-least-once delivery.

## Multi-Program Architecture

### How It Works

When running multiple workers for different DLN programs:

1. **Isolated Queues**: Each program has its own RabbitMQ queue to prevent cross-contamination
2. **Shared Infrastructure**: All workers share Redis, ClickHouse, and Jupiter API
3. **Independent Processing**: Each worker processes only transactions from its program
4. **Separate Metrics**: Each worker exposes metrics on a different port

### Data Isolation

**Redis Keys Include Program ID:**
- Worker checkpoints: `checkpoint:worker:{programId}` (last processed tx info)
- Backfill counters: `dln:counters:backfill:{programId}`
- Indexer checkpoints: `checkpoint:{mode}:{programId}`

**ClickHouse Tables Store Program ID:**
- All events include `program_id` column for filtering
- Queries can filter by program: `WHERE program_id = 'xxx'`

### Scaling Considerations

**Horizontal Scaling (Multiple Instances per Program):**
```bash
# Run 2 workers for program 1
docker-compose up --scale worker-program1=2

# Each instance will:
# - Share the same queue (load balanced by RabbitMQ)
# - Share batch processing load
# - ClickHouse ReplacingMergeTree handles any duplicate writes automatically
```

**Resource Allocation:**
- Each worker: ~200-500 MB RAM
- Shared Redis: ~100-200 MB RAM
- Shared ClickHouse: Depends on data volume

### Troubleshooting Multi-Program Setup

**Workers Not Receiving Messages:**
1. Verify queue names match between indexer and worker
2. Check RabbitMQ queues exist: `rabbitmqctl list_queues`
3. Verify indexer is publishing to correct queue

**Duplicate Processing:**
1. Small number of duplicates is normal with at-least-once delivery
2. ClickHouse ReplacingMergeTree automatically deduplicates based on PRIMARY KEY
3. Verify queue names don't overlap between different programs

**Port Conflicts:**
1. Ensure WORKER_METRICS_PORT is unique per worker
2. Ensure INDEXER_PORT is unique per indexer
3. Check ports with: `lsof -i :9091` or `netstat -an | grep 9091`

## Monitoring

### Health Checks

The worker logs health status every 30 seconds:

```json
{
  "level": "debug",
  "msg": "Worker health check - running",
  "batchStatus": {
    "raw_events": { "bufferSize": 45, "isEmpty": false },
    "enriched_orders": { "bufferSize": 12, "isEmpty": false }
  }
}
```

### Backfill Counters

Redis counters track processing progress:

```bash
# View counters
redis-cli HGETALL "dln:counters:backfill:{programId}"

# Output:
# created: 1234
# fulfilled: 567
```

### Processing Checkpoints

Redis stores the last successfully processed transaction per program:

```bash
# View checkpoint for a program
redis-cli GET "checkpoint:worker:{programId}"

# Output (JSON):
# {"signature":"xxx","slot":123456,"timestamp":1706000000000}
```

## Performance Tuning

### High Throughput

For high message rates:

```bash
RABBITMQ_PREFETCH_COUNT=50
WORKER_BATCH_SIZE=500
WORKER_BATCH_FLUSH_INTERVAL=10000
JUPITER_CACHE_TTL=300
```

### Low Latency

For low latency requirements:

```bash
RABBITMQ_PREFETCH_COUNT=5
WORKER_BATCH_SIZE=10
WORKER_BATCH_FLUSH_INTERVAL=1000
```

### Resource Constrained

For limited resources:

```bash
RABBITMQ_PREFETCH_COUNT=5
WORKER_BATCH_SIZE=50
WORKER_CONCURRENCY=5
```

## Error Handling

### Retryable Errors

The worker automatically retries on:

- Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
- HTTP 5xx errors
- HTTP 429 (rate limit)
- Transaction not found (might not be indexed yet)

### Non-Retryable Errors

Immediately fails (and moves to DLQ) on:

- Invalid message format
- Max retries exceeded
- Parse errors (stores raw data only)

### Dead Letter Queue

Failed messages after max retries go to DLQ:

```bash
# View DLQ messages
RABBITMQ_QUEUE_NAME=dln_transactions_dlq
```

## Graceful Shutdown

The worker handles shutdown signals (SIGTERM, SIGINT):

1. Stops consuming new messages
2. Flushes all batches to ClickHouse
3. Closes RabbitMQ connection
4. Disconnects Redis
5. Closes ClickHouse client
6. Exits with appropriate code

```bash
# Graceful shutdown
kill -SIGTERM <pid>
```

## Development

### Project Structure

```
apps/worker/
├── src/
│   ├── index.ts                    # Main worker entry point
│   ├── config.ts                   # Configuration schema
│   ├── services/
│   │   ├── jupiter-price.service.ts  # Jupiter API integration
│   │   └── batch-processor.service.ts # ClickHouse batch processor
│   ├── types/
│   │   └── enriched-order.types.ts   # Type definitions
│   └── utils/
│       └── retry.ts                  # Retry utility with backoff
├── package.json
├── tsconfig.json
└── README.md
```

### Testing

```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Build
pnpm build
```

### Debugging

Enable debug logs:

```bash
LOG_LEVEL=debug pnpm dev
```

## Troubleshooting

### Worker not consuming messages

1. Check RabbitMQ connection: `RABBITMQ_URL`
2. Verify queue exists: `rabbitmqctl list_queues`
3. Check worker logs for errors

### Transactions not found

1. Check Solana RPC health
2. Increase retry attempts: `WORKER_RETRY_ATTEMPTS`
3. Increase max retry delay: `WORKER_MAX_RETRY_DELAY`

### Jupiter API errors

1. Verify API key: `JUPITER_API_KEY`
2. Check API status: https://status.jup.ag
3. Review rate limits and increase `JUPITER_CACHE_TTL`

### ClickHouse write errors

1. Verify connection: `CLICKHOUSE_URL`
2. Check table exists: Run migration 005
3. Review batch size: `WORKER_BATCH_SIZE`

### Redis connection issues

1. Check Redis is running: `redis-cli ping`
2. Verify URL: `REDIS_URL`
3. Check password if required: `REDIS_PASSWORD`

## License

MIT
