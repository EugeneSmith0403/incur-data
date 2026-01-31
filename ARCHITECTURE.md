# DLN Volume Analytics Dashboard Architecture

## Overview

DLN Volume Analytics Dashboard is a production-grade system for indexing and analyzing Solana DLN (deBridge Liquidity Network) transactions. The system provides real-time volume monitoring, historical analytics, and data visualization.

## Technology Stack

| Category | Technologies |
|----------|--------------|
| **Backend** | TypeScript, Node.js 20+ |
| **API** | Fastify 4.x |
| **Frontend** | Nuxt 3, Vue 3, ECharts |
| **Databases** | ClickHouse (OLAP), Redis (cache) |
| **Message Queue** | RabbitMQ |
| **Build Tools** | pnpm workspaces, Turborepo |
| **Deployment** | Docker Compose, Kubernetes |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOLANA BLOCKCHAIN                            │
│         DLN Programs: src5qy..., dst5MG...                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket + RPC
               ┌───────────┴───────────┐
               ▼                       ▼
      ┌────────────────┐      ┌────────────────┐
      │  Indexer-SRC   │      │  Indexer-DST   │
      │   Port 8081    │      │   Port 8082    │
      │  (Created tx)  │      │ (Fulfilled tx) │
      └───────┬────────┘      └───────┬────────┘
              │   TxIngestMessage     │
              └───────────┬───────────┘
                          ▼
                 ┌─────────────────┐
                 │    RabbitMQ     │
                 │  dln_exchange   │
                 │  dln_tx queue   │
                 │   Port 5672     │
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐         ┌──────────────┐
                 │     Worker      │────────►│  Jupiter API │
                 │   Port 9091     │  Prices │   (jup.ag)   │
                 │   (metrics)     │◄────────│              │
                 └────────┬────────┘         └──────────────┘
                          │ Batch INSERT
                          ▼
              ┌───────────────────────┐
              │      ClickHouse       │
              │    Database: dln      │
              │  Port 8123 (HTTP)     │
              │  Port 9000 (Native)   │
              └───────────┬───────────┘
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
      ┌─────────────┐           ┌─────────────┐
      │    Redis    │◄─────────►│     API     │
      │  Port 6379  │   Cache   │  Port 3000  │
      │   (cache)   │           │  /api/v1/*  │
      └─────────────┘           └──────┬──────┘
                                       │ REST
                                       ▼
                               ┌─────────────┐
                               │     Web     │
                               │  Port 3001  │
                               │  Dashboard  │
                               └─────────────┘
```

---

## Services

### 1. Indexer (apps/indexer/)

**Purpose:** Real-time monitoring and indexing of Solana DLN transactions.

**Entry Point:** `apps/indexer/src/index.ts`

**Two Instances:**
- **indexer-src** (port 8081) — program `src5qyZHqTqecJV4aY6Cb6zDZLMDzrDKKezs22MPHr4` (Created events)
- **indexer-dst** (port 8082) — program `dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo` (Fulfilled events)

**Operating Modes:**
1. **Backfill Phase** — historical backfill on startup (until reaching `targetTransactions`)
2. **Real-time Phase** — WebSocket monitoring for new transactions

**Key Services:**
```
ConnectionService       → Connection management (RPC, RabbitMQ, Redis, ClickHouse)
BackfillIndexerService  → Historical transaction backfilling
IndexerService          → Real-time monitoring via WebSocket
HealthService           → Health check endpoint
```

**Communication:** Publishes `TxIngestMessage` to RabbitMQ queue `dln_transactions`

---

### 2. Worker (apps/worker/)

**Purpose:** Process transactions from the queue, enrich with prices, save to ClickHouse.

**Entry Point:** `apps/worker/src/index.ts`

**Processing Flow:**
1. Listens to RabbitMQ queue (prefetch: 10)
2. Parses Solana instructions and DLN events
3. Fetches token prices from Jupiter API
4. Calculates volumes in USD
5. Batches operations (batch size: 100, interval: 5000ms)
6. Writes to ClickHouse

**Key Services:**
```
ConnectionManager       → Connection management
TransactionProcessor    → Transaction parsing and processing
JupiterPriceService     → Price fetching from Jupiter API v6
RedisService            → Price and state caching
```

**Configuration:**
| Parameter | Value |
|-----------|-------|
| Concurrency | 10 |
| Batch Size | 100 |
| Flush Interval | 5000ms |
| Prefetch Count | 10 |
| Metrics Port | 9091 |

---

### 3. API (apps/api/)

**Purpose:** REST API for retrieving analytics data.

**Entry Point:** `apps/api/src/index.ts`

**Port:** 3000

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics/daily-volume` | Daily volumes with filters |
| GET | `/api/v1/analytics/daily-volume-summary` | Created vs Fulfilled comparison |
| GET | `/api/v1/analytics/total-stats` | Global statistics |
| GET | `/health` | Service health check |
| GET | `/docs` | Swagger UI documentation |

**Query Filters:**
- `fromDate`, `toDate` — date range
- `eventType` — event type (Created/Fulfilled)
- `giveChainId`, `takeChainId` — chain filter

**Caching:** Redis (TTL: 300 seconds)

---

### 4. Web Dashboard (apps/web/)

**Purpose:** Interactive dashboard for analytics visualization.

**Framework:** Nuxt 3 (Vue 3)

**Port:** 3001

**Features:**
- Date and blockchain network filtering
- Volume charts (ECharts)
- Detailed data table
- Multi-language support (EN, RU, DE)

**Key Components:**
```
pages/index.vue        → Main dashboard page
components/
  DashboardFilters.vue → Filters
  VolumeChart.vue      → Volume chart
  VolumeTable.vue      → Data table
```

**Data Fetching:** TanStack Query with polling (30 second interval)

---

## Packages (packages/)

### packages/dtos/
Shared Data Transfer Objects for all services:
- `TxIngestMessage` — queue message
- `VolumeData`, `VolumeStats` — analytics types
- `OrderData`, `TokenInfo` — data structures

### packages/rabbitmq/
RabbitMQ utilities:
- `setupQueues()` — queue creation
- `createConsumer()` — consumer creation
- Retry logic (delay: 5s, max retries: 3)

### packages/tx-parsing/
Solana DLN transaction parsing:
- `dln-event-parser.ts` — DLN event parsing
- `instruction-parser.ts` — instruction parsing
- `account-parser.ts` — account parsing

### packages/olap-types/
Types for ClickHouse queries

### packages/ui/
Reusable Vue components

---

## Data Stores

### ClickHouse

**Purpose:** OLAP storage for transactions and analytics

**Ports:** 8123 (HTTP), 9000 (Native)

**Structure:**
```sql
Database: dln

Tables:
├── transactions              -- Main transactions table
└── Materialized Views:
    ├── daily_volume_mv       -- Daily aggregation
    └── total_stats_mv        -- Global statistics
```

**Migrations:** `migrations/`
- `000_init.sql` — database initialization
- `001_transactions.sql` — transactions table
- `002_volume_analytics_views.sql` — Materialized Views
- `003_total_stats_view.sql` — statistics

### Redis

**Purpose:** Caching and state management

**Port:** 6379

**Usage:**
| Key | TTL | Purpose |
|-----|-----|---------|
| Jupiter prices | 60s | Token price cache |
| Query results | 300s | API response cache |
| Indexer state | - | Backfill progress |

### RabbitMQ

**Purpose:** Message queue between Indexer and Worker

**Port:** 5672 (AMQP), 15672 (Management UI)

**Configuration:**
```
Exchange: dln_exchange (fanout)
Queue: dln_transactions
Retry Delay: 5000ms
Max Retries: 3
```

---

## Data Flows

### Transaction Lifecycle

```
1. DISCOVERY
   Indexer connects to Solana via WebSocket
   and discovers transactions for DLN programs

2. PUBLISHING
   Indexer creates TxIngestMessage and publishes to RabbitMQ:
   {
     signature: "...",
     blockTime: 1706...,
     slot: 234...,
     programId: "src5qy..."
   }

3. PROCESSING
   Worker receives message from queue:
   - Parses Solana instructions
   - Extracts order data (tokens, amounts, addresses)
   - Fetches prices from Jupiter API
   - Calculates volumes in USD

4. BATCHING
   Worker accumulates transactions until batch size (100)
   or flush interval (5 seconds)

5. STORAGE
   Batch INSERT into ClickHouse transactions table

6. AGGREGATION
   ClickHouse Materialized Views automatically
   update aggregated data

7. QUERYING
   API executes queries against ClickHouse
   with result caching in Redis

8. DISPLAY
   Web Dashboard displays data with polling every 30 seconds
```

---

## Configuration

### Environment Variables

```bash
# Solana
SOLANA_RPC_URL=https://...
SOLANA_WSS_URL=wss://...
DLN_PROGRAM_ID=src5qy... (or dst5MG...)

# ClickHouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DATABASE=dln

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://admin:password@localhost:5672
RABBITMQ_QUEUE_NAME=dln_transactions

# Jupiter API
JUPITER_API_URL=https://api.jup.ag
JUPITER_API_KEY=...

# Indexer
INDEXER_PORT=8080
INDEXER_TARGET_TRANSACTIONS=25000

# Worker
WORKER_BATCH_SIZE=100
WORKER_CONCURRENCY=10

# API
API_PORT=3000
API_CORS_ORIGIN=*

# Web
NUXT_PUBLIC_WEB_API_URL=http://localhost:3000
```

---

## Deployment

### Docker Compose

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

**Services in docker-compose:**
- rabbitmq
- redis
- clickhouse
- indexer-src
- indexer-dst
- worker
- api
- web

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Or via script
./scripts/deploy.sh kubernetes
```

**Manifests (k8s/):**
- `namespace.yaml`
- `configmap.yaml`, `secrets.example.yaml`
- `indexer.yaml`, `worker.yaml`, `api.yaml`, `web.yaml`
- `rabbitmq.yaml`, `redis.yaml`, `clickhouse.yaml`
- `ingress.yaml`

---

## Development

### Commands

```bash
# Install dependencies
pnpm install

# Start infrastructure
pnpm dev:start

# Development (all services)
pnpm dev

# Individual services
pnpm --filter @incur-data/indexer dev:src
pnpm --filter @incur-data/worker dev
pnpm --filter @incur-data/api dev
pnpm --filter @incur-data/web dev

# Migrations
pnpm migrate:up

# Tests
pnpm test
pnpm test:integration

# Build
pnpm build
```

---

## Scaling

### Horizontal Scaling

| Service | Scaling |
|---------|---------|
| Indexer | 2 instances (src + dst) |
| Worker | Horizontal (via K8s replicas) |
| API | Horizontal (stateless) |
| Web | Horizontal (stateless) |

### Performance

- **Worker batching:** Reduces ClickHouse load
- **Redis caching:** Reduces API request latency
- **ClickHouse Materialized Views:** Fast aggregation
- **RabbitMQ prefetch:** Worker load control

---

## Monitoring

### Health Checks

| Service | Endpoint |
|---------|----------|
| Indexer | `GET /health` (ports 8081, 8082) |
| Worker | Metrics on port 9091 |
| API | `GET /health` (port 3000) |

### Logging

All services use **Pino** for structured JSON logging.

---

## Architecture Highlights

1. **Hybrid indexing mode** — automatic switching from backfill to real-time
2. **Dual indexing** — separate indexers for different DLN programs
3. **Event-driven** — asynchronous processing via RabbitMQ
4. **Batching** — optimized writes to ClickHouse
5. **Type-safe** — TypeScript + Zod validation
6. **Multi-language** — i18n support for 3 languages
7. **Production-ready** — Docker, K8s, graceful shutdown
