# Indexer Services

This directory contains all the services used by the Indexer application. Each service is responsible for a specific part of the indexer functionality.

## Service Categories

### Core Infrastructure Services

- **ConnectionService** - Manages all external connections (Solana, Redis, RabbitMQ)
- **HealthService** - Provides HTTP endpoints for health checks and metrics
- **CheckpointService** - Simple checkpoint management for history/realtime modes
- **TransactionPublisherService** - Publishes transactions to RabbitMQ with retry logic

### Indexing Services

- **HistoryIndexerService** - Historical transaction indexing
- **RealtimeIndexerService** - Real-time transaction listening
- **BackfillIndexer** - Historical backfilling with progress tracking
- **WebSocketListener** - WebSocket-based listening with deduplication

### Supporting Services

- **BackfillCheckpointManager** - Advanced checkpoint management for backfill mode

## Usage

All services are exported from `index.ts` for convenient importing:

```typescript
import {
  ConnectionService,
  HealthService,
  CheckpointService,
  // ... other services
} from './services/index.js';
```

## Service Lifecycle

Most services implement the `IService` interface which defines optional `start()` and `stop()` methods:

```typescript
interface IService {
  start?(): Promise<void>;
  stop?(): Promise<void>;
}
```

## Service Dependencies

Services receive their dependencies through constructor injection:

```typescript
const connectionService = new ConnectionService(config, logger);
await connectionService.start();

const publisherService = new TransactionPublisherService(
  connectionService.publisher,
  config.rabbitmq.queueName,
  logger
);
```

## Adding a New Service

1. Create a new file in this directory: `your-service.service.ts`
2. Define your service class
3. Optionally implement `IService` interface
4. Export it from `index.ts`
5. Use it in the main `index.ts` coordinator

Example:

```typescript
// your-service.service.ts
import type { Logger } from 'pino';
import type { IService } from './types.js';

export class YourService implements IService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async start(): Promise<void> {
    this.logger.info('Starting your service');
    // Implementation
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping your service');
    // Cleanup
  }
}
```

## Best Practices

1. **Single Responsibility**: Each service should do one thing well
2. **Dependency Injection**: Pass dependencies through constructor
3. **Error Handling**: Handle errors within the service and log appropriately
4. **Graceful Shutdown**: Implement `stop()` method to cleanup resources
5. **Type Safety**: Use TypeScript types and interfaces
6. **Logging**: Use structured logging with appropriate log levels
7. **Testing**: Write unit tests for each service

## Service Communication

Services communicate through:
- **Direct method calls**: For synchronous operations
- **RabbitMQ**: For asynchronous message passing to workers
- **Redis**: For shared state (checkpoints, counters, deduplication)

## Monitoring

All services should:
- Log important events at appropriate levels
- Expose metrics through HealthService when applicable
- Handle errors gracefully and log them
