/**
 * Example: Using the DLN Event Parser
 * 
 * This example demonstrates how to use the DLN Event Parser to extract
 * OrderCreated and OrderFulfilled events from Solana transactions.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { createDlnEventParser, DlnEventType } from '../src/dln-event-parser.js';

// Configuration
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const DLN_PROGRAM_ID = 'YourDlnProgramIdHere'; // Replace with actual DLN program ID

async function main() {
  // Initialize Solana connection
  const connection = new Connection(RPC_URL, 'confirmed');

  // Create DLN event parser
  const parser = createDlnEventParser(DLN_PROGRAM_ID);

  // Example transaction signature (replace with actual transaction)
  const signature = 'your_transaction_signature_here';

  console.log(`Fetching transaction: ${signature}`);

  // Fetch transaction
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    console.log('Transaction not found');
    return;
  }

  console.log('Transaction found, parsing...');

  // Parse transaction to extract DLN events
  const events = parser.parseTransaction(signature, tx);

  if (events.length === 0) {
    console.log('No DLN events found in this transaction');
    console.log('Possible reasons:');
    console.log('- OrderId not found in log messages');
    console.log('- Transaction is not a DLN order creation or fulfillment');
    console.log('- Wrong program ID specified');
    return;
  }

  console.log(`Found ${events.length} DLN event(s):`);
  console.log('');

  // Process each event
  for (const event of events) {
    console.log('─────────────────────────────────────────');
    console.log(`Event Type: ${event.eventType}`);
    console.log(`Order ID: ${event.orderId}`);
    console.log(`Signature: ${event.signature}`);
    console.log(`Slot: ${event.slot}`);
    console.log(`Block Time: ${new Date(event.blockTime * 1000).toISOString()}`);
    console.log('');

    if (event.eventType === DlnEventType.OrderCreated) {
      const data = event.data;
      console.log('Order Created Data:');
      console.log(`  Maker: ${data.maker}`);
      console.log(`  Give Chain: ${data.giveChainId}`);
      console.log(`  Take Chain: ${data.takeChainId}`);
      console.log(`  Give Token: ${data.giveTokenAddress}`);
      console.log(`  Take Token: ${data.takeTokenAddress}`);
      console.log(`  Give Amount: ${data.giveAmount}`);
      console.log(`  Take Amount: ${data.takeAmount}`);
      console.log(`  Receiver: ${data.receiver}`);
      
      if (data.expirySlot) {
        console.log(`  Expiry Slot: ${data.expirySlot}`);
      }
      if (data.affiliateFee) {
        console.log(`  Affiliate Fee: ${data.affiliateFee}`);
      }
      if (data.allowedTaker) {
        console.log(`  Allowed Taker: ${data.allowedTaker}`);
      }
      if (data.allowedCancelBeneficiary) {
        console.log(`  Allowed Cancel Beneficiary: ${data.allowedCancelBeneficiary}`);
      }
    } else if (event.eventType === DlnEventType.OrderFulfilled) {
      const data = event.data;
      console.log('Order Fulfilled Data:');
      console.log(`  Fulfiller: ${data.fulfiller}`);
      console.log(`  Give Amount: ${data.giveAmount}`);
      console.log(`  Take Amount: ${data.takeAmount}`);
      console.log(`  Order Beneficiary: ${data.orderBeneficiary}`);
      console.log(`  Unlock Beneficiary: ${data.unlockBeneficiary}`);
    }
    
    console.log('');
  }
}

// Example: Extract orderId from log messages
function demonstrateOrderIdExtraction() {
  console.log('═══════════════════════════════════════════════');
  console.log('OrderId Extraction Examples');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const { extractOrderIdFromLogs } = require('../src/dln-event-parser.js');

  // Example 1: Standard format
  const logs1 = [
    'Program log: Instruction: CreateOrder',
    'Program log: OrderId: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  ];
  console.log('Example 1 - Standard format:');
  console.log(`OrderId: ${extractOrderIdFromLogs(logs1)}`);
  console.log('');

  // Example 2: Order created format
  const logs2 = [
    'Program log: Order created: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  ];
  console.log('Example 2 - Order created format:');
  console.log(`OrderId: ${extractOrderIdFromLogs(logs2)}`);
  console.log('');

  // Example 3: No orderId found
  const logs3 = [
    'Program log: Some other log message',
  ];
  console.log('Example 3 - No orderId (returns null):');
  console.log(`OrderId: ${extractOrderIdFromLogs(logs3)}`);
  console.log('');
}

// Run examples
if (require.main === module) {
  // Uncomment to run the main example (requires valid transaction signature)
  // main().catch(console.error);

  // Run orderId extraction demonstration
  demonstrateOrderIdExtraction();
}

export { main, demonstrateOrderIdExtraction };
