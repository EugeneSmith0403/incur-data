# @incur-data/tx-parsing

Transaction parsing utilities for DLN (deSwap Liquidity Network) transactions on Solana.

## Features

- **DLN Event Parser**: Extracts and normalizes `OrderCreated` and `OrderFulfilled` events from Solana transactions
- **OrderId Extraction**: Strictly extracts `orderId` from transaction log messages
- **@debridge-finance/solana-transaction-parser Integration**: Uses DeBridge Finance's Solana transaction parser for robust instruction parsing
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Installation

This package is part of the `@incur-data` monorepo and uses workspace dependencies.

```bash
pnpm install
```

## Usage

### DLN Event Parser

The DLN Event Parser is the recommended way to parse DLN events from Solana transactions. It automatically extracts `orderId` from log messages and discards events where the `orderId` is missing.

```typescript
import { createDlnEventParser, type ParsedDlnEvent } from '@incur-data/tx-parsing';
import { Connection } from '@solana/web3.js';

// Initialize the parser with your DLN program ID
const parser = createDlnEventParser('YourDlnProgramIdHere');

// Fetch and parse a transaction
const connection = new Connection('https://api.mainnet-beta.solana.com');
const signature = 'your_transaction_signature';

const tx = await connection.getParsedTransaction(signature, {
  maxSupportedTransactionVersion: 0,
});

if (tx) {
  const events = parser.parseTransaction(signature, tx);
  
  for (const event of events) {
    console.log('Event Type:', event.eventType);
    console.log('Order ID:', event.orderId);
    console.log('Data:', event.data);
  }
}
```

### Event Types

#### ParsedDlnEvent

```typescript
interface ParsedDlnEvent {
  eventType: DlnEventType;  // 'OrderCreated' | 'OrderFulfilled'
  orderId: string;          // Extracted from log messages
  signature: string;
  slot: number;
  blockTime: number;
  data: OrderCreatedData | OrderFulfilledData;
}
```

#### OrderCreated Event Data

```typescript
interface OrderCreatedData {
  maker: string;
  giveChainId: string;
  takeChainId: string;
  giveTokenAddress: string;
  takeTokenAddress: string;
  giveAmount: string;
  takeAmount: string;
  receiver: string;
  expirySlot?: number;
  affiliateFee?: string;
  allowedTaker?: string;
  allowedCancelBeneficiary?: string;
}
```

#### OrderFulfilled Event Data

```typescript
interface OrderFulfilledData {
  fulfiller: string;
  giveAmount: string;
  takeAmount: string;
  orderBeneficiary: string;
  unlockBeneficiary: string;
}
```

### OrderId Extraction

The parser strictly extracts `orderId` from transaction log messages using multiple patterns:

```typescript
import { extractOrderIdFromLogs } from '@incur-data/tx-parsing';

const logMessages = [
  'Program log: OrderId: 0x1234567890abcdef...',
  'Program log: Instruction: CreateOrder',
];

const orderId = extractOrderIdFromLogs(logMessages);
// Returns: '1234567890abcdef...' or null if not found
```

**Supported Log Patterns:**
- `OrderId: 0x[hash]`
- `Order created: 0x[hash]`
- `Order fulfilled: 0x[hash]`
- `orderId: [hash]` (with various formatting)

**Important:** If `orderId` cannot be extracted from log messages, the event is discarded and not returned.

### Legacy Transaction Parser

For backward compatibility, the legacy transaction parser is still available:

```typescript
import { createParser } from '@incur-data/tx-parsing';
import { PublicKey } from '@solana/web3.js';

const parser = createParser({
  programId: new PublicKey('YourDlnProgramIdHere'),
  rpcEndpoint: 'https://api.mainnet-beta.solana.com',
});

const result = await parser.parseTransaction('signature');
if (result) {
  console.log('Transaction:', result.transaction);
  console.log('Orders:', result.orders);
  console.log('Instructions:', result.instructions);
}
```

## How It Works

### 1. OrderId Extraction
The parser first scans transaction log messages for orderId patterns. If no orderId is found, the transaction is ignored.

### 2. Instruction Parsing
Uses `solana-tx-parser-public` to parse transaction instructions and extract structured data.

### 3. Event Detection
Identifies DLN events by:
- Checking instruction names (createOrder, fulfillOrder, etc.)
- Analyzing log messages for event indicators

### 4. Data Normalization
Extracts and normalizes data into the `ParsedDlnEvent` structure with proper typing.

## Error Handling

The parser is designed to be resilient:
- Returns empty array if transaction has no metadata or blockTime
- Returns empty array if orderId cannot be extracted
- Catches and logs parsing errors without throwing
- Validates all required fields before returning events

## Development

### Building

```bash
pnpm build
```

### Watching for Changes

```bash
pnpm dev
```

### Type Checking

```bash
pnpm type-check
```

## Dependencies

- `@solana/web3.js`: Solana blockchain interaction
- `@debridge-finance/solana-transaction-parser`: DeBridge Finance's transaction parser
- `@coral-xyz/anchor`: Anchor framework for Solana program interaction
- `@incur-data/dtos`: Shared data transfer objects
- `zod`: Runtime type validation

## License

Private package for internal use.
