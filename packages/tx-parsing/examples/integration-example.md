# Integration Example: DLN Parser with Worker

This document shows how to integrate the DLN event parser into the worker service.

## Step 1: Update Worker Dependencies

The worker already has access to `@incur-data/tx-parsing` through the workspace dependency.

## Step 2: Initialize Parser in Worker

```typescript
// apps/worker/src/index.ts

import { createDlnEventParser, type ParsedDlnEvent, DlnEventType } from '@incur-data/tx-parsing';
import { Connection } from '@solana/web3.js';

// ... existing imports

// Initialize parser (add near other initializations)
const dlnParser = createDlnEventParser(config.solana.dlnProgramId);
logger.info({ programId: config.solana.dlnProgramId }, 'DLN event parser initialized');
```

## Step 3: Parse Transactions in Message Handler

```typescript
async function processTxMessage(message: TxIngestMessage) {
  const signature = message.signature;
  
  try {
    logger.debug({ signature }, 'Processing transaction message');
    
    // Fetch transaction
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    
    if (!tx) {
      logger.warn({ signature }, 'Transaction not found');
      return;
    }
    
    // Parse DLN events
    const events = dlnParser.parseTransaction(signature, tx);
    
    if (events.length === 0) {
      logger.debug({ signature }, 'No DLN events found (orderId missing or not a DLN tx)');
      return;
    }
    
    logger.info({ signature, eventCount: events.length }, 'DLN events parsed');
    
    // Process each event
    for (const event of events) {
      await processEvent(event, tx);
    }
    
  } catch (error) {
    logger.error({ signature, error }, 'Failed to process transaction');
    throw error;
  }
}

async function processEvent(event: ParsedDlnEvent, tx: ParsedTransactionWithMeta) {
  logger.debug({ 
    eventType: event.eventType, 
    orderId: event.orderId 
  }, 'Processing DLN event');
  
  if (event.eventType === DlnEventType.OrderCreated) {
    await processOrderCreated(event);
  } else if (event.eventType === DlnEventType.OrderFulfilled) {
    await processOrderFulfilled(event);
  }
}

async function processOrderCreated(event: ParsedDlnEvent) {
  const data = event.data as OrderCreatedData;
  
  // Store raw event in ClickHouse
  await clickhouse.insert({
    table: 'raw_order_events',
    values: [{
      event_type: 'OrderCreated',
      order_id: event.orderId,
      signature: event.signature,
      slot: event.slot,
      block_time: new Date(event.blockTime * 1000),
      maker: data.maker,
      give_chain_id: data.giveChainId,
      take_chain_id: data.takeChainId,
      give_token: data.giveTokenAddress,
      take_token: data.takeTokenAddress,
      give_amount: data.giveAmount,
      take_amount: data.takeAmount,
      receiver: data.receiver,
      expiry_slot: data.expirySlot,
      affiliate_fee: data.affiliateFee,
      allowed_taker: data.allowedTaker,
      allowed_cancel_beneficiary: data.allowedCancelBeneficiary,
    }],
  });
  
  logger.info({ orderId: event.orderId }, 'OrderCreated event stored');
}

async function processOrderFulfilled(event: ParsedDlnEvent) {
  const data = event.data as OrderFulfilledData;
  
  // Store raw event in ClickHouse
  await clickhouse.insert({
    table: 'raw_order_events',
    values: [{
      event_type: 'OrderFulfilled',
      order_id: event.orderId,
      signature: event.signature,
      slot: event.slot,
      block_time: new Date(event.blockTime * 1000),
      fulfiller: data.fulfiller,
      give_amount: data.giveAmount,
      take_amount: data.takeAmount,
      order_beneficiary: data.orderBeneficiary,
      unlock_beneficiary: data.unlockBeneficiary,
    }],
  });
  
  logger.info({ orderId: event.orderId }, 'OrderFulfilled event stored');
}
```

## Step 4: Update ClickHouse Schema (Optional)

If you want to store raw events, consider adding a table:

```sql
-- migrations/005_raw_order_events.sql

CREATE TABLE IF NOT EXISTS raw_order_events (
  event_type String,
  order_id String,
  signature String,
  slot UInt64,
  block_time DateTime,
  
  -- OrderCreated fields
  maker Nullable(String),
  give_chain_id Nullable(String),
  take_chain_id Nullable(String),
  give_token Nullable(String),
  take_token Nullable(String),
  give_amount Nullable(String),
  take_amount Nullable(String),
  receiver Nullable(String),
  expiry_slot Nullable(UInt64),
  affiliate_fee Nullable(String),
  allowed_taker Nullable(String),
  allowed_cancel_beneficiary Nullable(String),
  
  -- OrderFulfilled fields
  fulfiller Nullable(String),
  order_beneficiary Nullable(String),
  unlock_beneficiary Nullable(String),
  
  created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (event_type, order_id, block_time)
PARTITION BY toYYYYMM(block_time);

-- Create an index on order_id for fast lookups
CREATE INDEX idx_order_id ON raw_order_events (order_id) TYPE bloom_filter(0.01) GRANULARITY 1;
```

## Step 5: Test the Integration

```bash
# Start the worker
cd apps/worker
pnpm build
pnpm start

# Monitor logs for DLN events
# You should see:
# - "DLN event parser initialized"
# - "Processing transaction message"
# - "DLN events parsed" (when events are found)
# - "OrderCreated event stored" or "OrderFulfilled event stored"
```

## Error Handling

The parser is designed to be resilient:

1. **Missing OrderId**: Returns empty array, worker logs and continues
2. **Invalid Transaction**: Returns empty array, worker logs and continues
3. **Parsing Errors**: Caught internally, logged, returns partial results
4. **Wrong Program**: Ignored automatically, returns empty array

## Monitoring

Add metrics to track parser performance:

```typescript
// Track events processed
let eventsProcessed = 0;
let eventsWithoutOrderId = 0;

function processTxMessage(message: TxIngestMessage) {
  // ... existing code
  
  const events = dlnParser.parseTransaction(signature, tx);
  
  if (events.length === 0) {
    eventsWithoutOrderId++;
  } else {
    eventsProcessed += events.length;
  }
  
  // Expose metrics via /metrics endpoint
}

// In health/metrics endpoint
fastify.get('/metrics', async () => ({
  eventsProcessed,
  eventsWithoutOrderId,
  successRate: eventsProcessed / (eventsProcessed + eventsWithoutOrderId),
}));
```

## Performance Considerations

1. **Transaction Fetching**: The RPC call is the bottleneck, not parsing
2. **Memory Usage**: Parser is stateless, safe for high-throughput
3. **CPU Usage**: Log scanning is fast (regex-based)
4. **Caching**: Consider caching parsed transactions if processing multiple times

## Debugging Tips

Enable debug logging to see what's happening:

```typescript
// Set LOG_LEVEL=debug in environment
logger.debug({
  signature,
  logs: tx.meta?.logMessages,
  instructions: tx.transaction.message.instructions.length,
}, 'Transaction details');
```

Common issues:
- **No events found**: Check if orderId is in logs (enable debug logging)
- **Wrong programId**: Verify DLN_PROGRAM_ID environment variable
- **Parsing errors**: Check if instruction format matches expected structure

## Next Steps

1. Deploy worker with DLN parser
2. Monitor logs and metrics
3. Verify events are stored correctly
4. Add dashboards for monitoring
5. Set up alerts for parsing failures
