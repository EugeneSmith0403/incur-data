# Indexer Service

Solana DLN Program transaction indexer with multiple operational modes.

## 📁 Project Structure

```
apps/indexer/
├── src/
│   ├── index.ts                    # Main application coordinator
│   ├── config.ts                   # Configuration management
│   ├── services/                   # Service layer
│   │   ├── connection.service.ts         # Connection management
│   │   ├── checkpoint.service.ts         # Simple checkpointing
│   │   ├── transaction-publisher.service.ts  # RabbitMQ publishing
│   │   ├── history-indexer.service.ts    # Historical indexing
│   │   ├── realtime-indexer.service.ts   # Real-time indexing
│   │   ├── backfill-checkpoint.service.ts    # Backfill checkpoints
│   │   ├── backfill-indexer.service.ts   # Backfill indexing
│   │   ├── websocket-listener.service.ts # WebSocket listener
│   │   ├── health.service.ts             # Health checks & metrics
│   │   └── types.ts                      # Shared types
│   └── utils/
│       └── retry.ts                # Retry utilities
├── ARCHITECTURE.md               # Detailed architecture documentation
├── REFACTORING_SUMMARY.md       # Refactoring changes summary
├── SERVICE_DIAGRAM.md           # Service interaction diagrams
└── README.md                    # This file
```

## 🚀 Quick Start

### Installation

```bash
cd apps/indexer
pnpm install
```

### Configuration

Create `.env` file or set environment variables:

```bash
# Mode selection
INDEXER_MODE=history|realtime|backfill|websocket

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WSS_URL=wss://api.mainnet-beta.solana.com
DLN_PROGRAM_ID=<your_program_id>

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE_NAME=dln_transactions
RABBITMQ_EXCHANGE_NAME=dln_exchange

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Indexer settings
INDEXER_PORT=8080
INDEXER_BATCH_SIZE=1000
INDEXER_CONCURRENCY=10

# Backfill mode settings (optional)
INDEXER_TARGET_CREATED=10000
INDEXER_TARGET_FULFILLED=5000

# WebSocket mode settings (optional)
WS_DEDUP_TTL_SECONDS=3600
WS_MAX_RECONNECT_ATTEMPTS=10
```

### Running

```bash
# Development
pnpm dev

# Production build
pnpm build
pnpm start
```

## 📖 Operating Modes

### History Mode
Indexes historical transactions from newest to oldest using `getSignaturesForAddress`.

**Use case**: Initial historical data collection

```bash
INDEXER_MODE=history
```

### Realtime Mode
Listens for new transactions in real-time using `onLogs` WebSocket subscription.

**Use case**: Continuous monitoring of new transactions

```bash
INDEXER_MODE=realtime
```

### Backfill Mode
Historical indexing with target-based stopping. Stops when specified number of created/fulfilled events are reached.

**Use case**: Controlled historical backfilling with progress tracking

```bash
INDEXER_MODE=backfill
INDEXER_TARGET_CREATED=10000
INDEXER_TARGET_FULFILLED=5000
```

### WebSocket Mode
Real-time listening with Redis-based deduplication and automatic reconnection.

**Use case**: Production real-time monitoring with advanced resilience

```bash
INDEXER_MODE=websocket
WS_DEDUP_TTL_SECONDS=3600
```

## 🏗️ Architecture

The indexer follows a **service-oriented architecture**:

### Core Services

- **ConnectionService** - Manages Solana, Redis, and RabbitMQ connections
- **HealthService** - HTTP endpoints for health checks and metrics
- **CheckpointService** - Simple checkpoint management
- **TransactionPublisherService** - RabbitMQ message publishing

### Mode-Specific Services

- **HistoryIndexerService** - Historical transaction indexing
- **RealtimeIndexerService** - Real-time transaction monitoring
- **BackfillIndexer** - Backfilling with progress tracking
- **WebSocketListener** - WebSocket-based listening with deduplication

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## 🔄 Indexer-Worker Flow

```
Indexer → RabbitMQ Queue → Worker → ClickHouse
```

1. **Indexer** collects transaction signatures from Solana
2. **RabbitMQ** queues transactions for processing
3. **Worker** fetches transaction details, parses events, stores in database
4. **Worker** updates Redis counters (backfill mode)

Each indexer has a corresponding worker that processes the transactions it discovers.

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "mode": "history",
  "timestamp": "2026-01-27T12:00:00.000Z"
}
```

### Metrics

```bash
curl http://localhost:8080/metrics
```

Response includes:
- Current mode
- Checkpoint information
- Backfill progress (if applicable)
- WebSocket status (if applicable)
- Configuration details

### Ready Check (Kubernetes)

```bash
curl http://localhost:8080/ready
```

## 🐳 Docker

### Development

```bash
docker-compose up indexer
```

### Production

```bash
docker build -f Dockerfile.prod -t indexer:latest .
docker run -p 8080:8080 --env-file .env indexer:latest
```

## 🧪 Testing

### WebSocket Listener Test

```bash
pnpm tsx src/test-websocket.ts
```

## 📝 Configuration Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `INDEXER_MODE` | Yes | `history` | Operating mode |
| `SOLANA_RPC_URL` | Yes | - | Solana RPC endpoint |
| `SOLANA_WSS_URL` | No | - | Solana WebSocket endpoint |
| `DLN_PROGRAM_ID` | Yes | - | Program to monitor |
| `RABBITMQ_URL` | Yes | - | RabbitMQ connection string |
| `RABBITMQ_QUEUE_NAME` | No | `dln_transactions` | Queue name |
| `REDIS_URL` | Yes | - | Redis connection string |
| `INDEXER_PORT` | No | `8080` | HTTP server port |
| `INDEXER_BATCH_SIZE` | No | `1000` | Signatures per batch |
| `INDEXER_TARGET_CREATED` | No | - | Backfill created target |
| `INDEXER_TARGET_FULFILLED` | No | - | Backfill fulfilled target |
| `WS_DEDUP_TTL_SECONDS` | No | `3600` | Dedup key TTL |

## 🔧 Development

### Adding a New Service

1. Create service file in `src/services/`
2. Implement `IService` interface (optional)
3. Export from `src/services/index.ts`
4. Use in `src/index.ts`

Example:
```typescript
// src/services/my-service.service.ts
import type { Logger } from 'pino';
import type { IService } from './types.js';

export class MyService implements IService {
  constructor(private logger: Logger) {}

  async start(): Promise<void> {
    this.logger.info('Starting MyService');
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping MyService');
  }
}
```

### Type Safety

All services use strong TypeScript typing:
- No `any` types (except for legacy compatibility)
- Interfaces for all service dependencies
- Type exports from `services/types.ts`

## 📚 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture
- [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) - Refactoring changes
- [SERVICE_DIAGRAM.md](./SERVICE_DIAGRAM.md) - Service interaction diagrams
- [BACKFILL_QUICKSTART.md](./BACKFILL_QUICKSTART.md) - Backfill mode guide

## 🤝 Contributing

When contributing:
1. Follow existing service patterns
2. Add JSDoc comments
3. Update tests if needed
4. Update documentation

## 📄 License

See root LICENSE file.
