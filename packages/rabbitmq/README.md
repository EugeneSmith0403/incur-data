# @incur-data/rabbitmq

Shared RabbitMQ utilities for queue setup, message publishing, and consumption with built-in retry and Dead Letter Queue (DLQ) support.

## Features

- **Queue Setup**: Automatically creates main queues, retry queues, and DLQs
- **Retry Mechanism**: Configurable retry delays and max retry attempts
- **Dead Letter Queue**: Failed messages after max retries go to DLQ for manual inspection
- **Type-Safe Publishing**: Validates messages before publishing using Zod schemas
- **Consumer Management**: Easy-to-use consumer with automatic retry handling
- **Idempotency**: Built-in support for idempotent message processing

## Architecture

```
┌─────────────┐
│  Indexer    │──┐
└─────────────┘  │
                 │  Publishes TxIngestMessage
┌─────────────┐  │
│  Indexer    │──┤
└─────────────┘  ├──► ┌──────────────────┐      ┌──────────────┐
                 │    │  Main Exchange   │─────►│  Main Queue  │
┌─────────────┐  │    └──────────────────┘      └──────┬───────┘
│  Indexer    │──┘                                     │
└─────────────┘                                        │
                                                       │ Failed?
                                                       ▼
                                              ┌─────────────────┐
                                              │   DLX (Dead     │
                                              │ Letter Exchange)│
                                              └────────┬────────┘
                                                       │
                                    ┌──────────────────┴──────────────┐
                                    │                                 │
                            Max Retries?                         Max Retries?
                               NO │                                  │ YES
                                  ▼                                  ▼
                          ┌───────────────┐                  ┌──────────────┐
                          │  Retry Queue  │                  │     DLQ      │
                          │  (with TTL)   │                  │   (Manual    │
                          └───────┬───────┘                  │ Inspection)  │
                                  │                          └──────────────┘
                       After TTL expires
                                  │
                                  └──► Back to Main Queue

┌─────────────┐
│   Worker    │──┐
└─────────────┘  │
                 │  Consumes from Main Queue
┌─────────────┐  │  Writes to ClickHouse only
│   Worker    │──┤
└─────────────┘  │
                 │
┌─────────────┐  │
│   Worker    │──┘
└─────────────┘
```

## Queue Flow

1. **Main Queue**: Receives all new messages from indexers
2. **Processing**: Workers consume messages and process them
3. **Success**: Message is acknowledged and removed from queue
4. **Failure**: Message is sent to DLX with retry routing key
5. **Retry Queue**: Message waits for TTL to expire (e.g., 5 seconds)
6. **Retry**: After TTL, message returns to main queue with incremented attempt counter
7. **Max Retries**: If max retries exceeded, message goes to DLQ for manual inspection

## Usage

### Setting Up Queues

```typescript
import { setupQueues, createQueueConfig } from '@incur-data/rabbitmq';
import amqp from 'amqplib';
import pino from 'pino';

const logger = pino();
const connection = await amqp.connect('amqp://localhost:5672');
const channel = await connection.createChannel();

const queueConfig = createQueueConfig('dln_transactions', {
  retryDelay: 5000,    // 5 seconds between retries
  maxRetries: 3,       // Maximum 3 retry attempts
});

await setupQueues(channel, queueConfig, logger);
```

This creates:
- `dln_transactions` - Main queue
- `dln_transactions.retry` - Retry queue with TTL
- `dln_transactions.dlq` - Dead Letter Queue
- `dln_exchange` - Main exchange
- `dln_dlx` - Dead Letter Exchange

### Publishing Messages (Indexer)

```typescript
import { createPublisher } from '@incur-data/rabbitmq';
import { createTxIngestMessage } from '@incur-data/dtos';

const publisher = await createPublisher(
  connection,
  'dln_exchange',
  logger
);

const message = createTxIngestMessage({
  signature: 'tx_signature_here',
  slot: 123456,
  blockTime: 1234567890,
  source: 'history',
  programId: 'program_id_here',
});

await publisher.publishTxIngest('dln_transactions', message);
```

### Consuming Messages (Worker)

```typescript
import { createConsumer } from '@incur-data/rabbitmq';
import { type TxIngestMessage } from '@incur-data/dtos';

const consumer = await createConsumer(
  connection,
  'dln_transactions',
  queueConfig,
  logger
);

async function processMessage(
  message: TxIngestMessage,
  metadata: MessageMetadata
): Promise<boolean> {
  try {
    // Process the message
    console.log('Processing:', message.signature);
    
    // Write to ClickHouse
    await clickhouse.insert({...});
    
    // Return true to acknowledge
    return true;
  } catch (error) {
    console.error('Error:', error);
    // Return false to retry
    return false;
  }
}

await consumer.consume(processMessage, {
  prefetchCount: 10,
});
```

## Message Format

### TxIngestMessage

```typescript
{
  signature: string;        // Transaction signature
  slot: number;            // Slot number
  blockTime?: number;      // Block timestamp (optional)
  source: 'history' | 'realtime';  // Indexer source
  programId: string;       // Program ID
  enqueuedAt: string;      // ISO timestamp when enqueued
  attempt: number;         // Retry attempt (0-based)
  priority: 'low' | 'normal' | 'high';  // Priority level
}
```

## Configuration

### Queue Configuration

```typescript
interface QueueConfig {
  queueName: string;      // Main queue name
  dlqName: string;        // Dead Letter Queue name
  exchangeName: string;   // Main exchange name
  dlxName: string;        // Dead Letter Exchange name
  retryDelay: number;     // Milliseconds between retries
  maxRetries: number;     // Maximum retry attempts
  durable?: boolean;      // Queue durability (default: true)
  messageTtl?: number;    // Message TTL in milliseconds (optional)
}
```

### Consumer Configuration

```typescript
interface ConsumerConfig {
  prefetchCount?: number;  // Number of messages to prefetch (default: 10)
  noAck?: boolean;        // Auto-acknowledge (default: false)
  exclusive?: boolean;    // Exclusive consumer (default: false)
}
```

## Error Handling

### Automatic Retry

Messages are automatically retried on failure:
- Worker returns `false` from handler
- Worker throws an error
- Network/temporary errors

### Dead Letter Queue

Messages go to DLQ when:
- Max retries exceeded
- Unrecoverable errors
- Manual rejection

### Monitoring DLQ

Check DLQ for failed messages:

```bash
# Using RabbitMQ Management UI
http://localhost:15672

# Using rabbitmqadmin
rabbitmqadmin list queues name messages
```

## Best Practices

1. **Idempotency**: Always check if message was already processed
2. **Timeouts**: Set appropriate timeouts for external API calls
3. **Logging**: Log all message processing attempts with signature
4. **Monitoring**: Monitor DLQ for messages requiring manual intervention
5. **Error Classification**: Return `false` for retryable errors, `true` for non-retryable

## Environment Variables

```bash
# RabbitMQ
RABBITMQ_URL=amqp://admin:password@localhost:5672
RABBITMQ_QUEUE_NAME=dln_transactions
RABBITMQ_EXCHANGE_NAME=dln_exchange
RABBITMQ_RETRY_DELAY=5000
RABBITMQ_MAX_RETRIES=3
RABBITMQ_PREFETCH_COUNT=10
```

## Testing

### Purge Queue

```typescript
import { purgeQueue } from '@incur-data/rabbitmq';

await purgeQueue(channel, 'dln_transactions', logger);
```

### Get Queue Stats

```typescript
import { getQueueStats } from '@incur-data/rabbitmq';

const stats = await getQueueStats(channel, 'dln_transactions');
console.log(stats);
// { queue: 'dln_transactions', messageCount: 42, consumerCount: 2 }
```

## License

Private - Internal use only
