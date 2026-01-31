import { ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import { SolanaParser, ParsedInstruction } from '@debridge-finance/solana-transaction-parser';
import type { Idl } from '@coral-xyz/anchor';
import {
  DlnEventType,
  type ParsedDlnEvent,
  type OrderCreatedData,
  type OrderFulfilledData,
} from './types.js';
import { customDlnParser } from './custom-dln-parser.js';

// Re-export types for convenience
export { DlnEventType } from './types.js';
export type { ParsedDlnEvent, OrderCreatedData, OrderFulfilledData } from './types.js';

/**
 * Extract orderId from transaction log messages
 * OrderIds can be in log messages or in Program data (base64 encoded)
 */
export function extractOrderIdFromLogs(logMessages: string[]): string | null {
  // Common patterns for orderId in DLN logs:
  // "Program log: OrderId: 0x..."
  // "Program log: Order created: 0x..."
  // "Program log: Order fulfilled: 0x..."
  // "OrderId: 0x..."
  // "Program log: Order Id: 1234567890..."
  // "Order Id: 1234567890..."
  const orderIdPatterns = [
    /OrderId:\s*(?:0x)?([a-fA-F0-9]{64})/i,
    /Order\s+created:\s*(?:0x)?([a-fA-F0-9]{64})/i,
    /Order\s+fulfilled:\s*(?:0x)?([a-fA-F0-9]{64})/i,
    /orderId["\s:=]+(?:0x)?([a-fA-F0-9]{64})/i,
    // Decimal order id format used in some DLN deployments
    /Order\s+Id:\s*([0-9]{10,})/i,
    /order\s*id["\s:=]+([0-9]{10,})/i,
  ];

  for (const logMessage of logMessages) {
    // Try text-based patterns first
    for (const pattern of orderIdPatterns) {
      const match = logMessage.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }

    // Try to extract from Program data (base64 encoded event data)
    // Format: "Program data: <base64>"
    if (logMessage.startsWith('Program data:')) {
      try {
        const base64Data = logMessage.substring('Program data:'.length).trim();
        // Decode base64 to get raw bytes
        const buffer = Buffer.from(base64Data, 'base64');

        // For CreateOrderWithNonce events, the event data structure includes orderId
        // Try to extract orderId from the decoded data
        // The orderId is typically 32 bytes and appears after the discriminator
        const orderId = extractOrderIdFromProgramData(buffer);
        if (orderId) {
          return orderId;
        }
      } catch (error) {
        // Skip invalid base64 or parsing errors
        continue;
      }
    }
  }

  return null;
}

/**
 * Extract orderId from Program data buffer
 * Attempts to find a 32-byte orderId in the event data
 */
function extractOrderIdFromProgramData(buffer: Buffer): string | null {
  // DLN events typically have:
  // - 8 bytes: discriminator
  // - 32 bytes: orderId
  // We look for patterns that could be orderIds

  // Skip if buffer is too small
  if (buffer.length < 40) {
    return null;
  }

  // Try to extract orderId starting from byte 8 (after discriminator)
  // OrderId is 32 bytes
  const orderIdBuffer = buffer.slice(8, 40);

  // Convert to hex string
  const orderIdHex = orderIdBuffer.toString('hex');

  // Check if it looks like a valid orderId (not all zeros, not all FFs)
  const allZeros = orderIdHex === '0'.repeat(64);
  const allFFs = orderIdHex === 'f'.repeat(64);

  if (!allZeros && !allFFs && orderIdHex.length === 64) {
    return orderIdHex;
  }

  return null;
}

/**
 * DLN Event Parser class using @debridge-finance/solana-transaction-parser
 */
export class DlnEventParser {
  private readonly parser: SolanaParser;
  private readonly programIds: Set<string>;

  constructor(programId: string | string[], idl?: Idl) {
    // Support both single programId and array of programIds
    const programIdArray = Array.isArray(programId) ? programId : [programId];
    if (programIdArray.length === 0) {
      throw new Error('At least one programId is required');
    }
    this.programIds = new Set(programIdArray);

    // Initialize parser with empty program infos
    // We'll add custom parser for DLN program
    // firstProgramId is guaranteed to be defined after the length check above
    const firstProgramId = programIdArray[0]!;
    this.parser = new SolanaParser(idl ? [{ programId: firstProgramId, idl }] : []);

    // Add custom DLN parser for each programId
    // This allows us to parse DLN instructions even without IDL
    for (const pid of this.programIds) {
      try {
        this.parser.addParser(new PublicKey(pid), customDlnParser);
      } catch (error) {
        // If programId is invalid, log warning but continue
        // The parser will still work with IDL if provided
        console.warn(`Failed to add custom DLN parser for ${pid}:`, error);
      }
    }
  }

  /**
   * Parse a transaction and extract DLN events
   * Returns empty array if orderId cannot be extracted or if it's not a DLN event
   */
  parseTransaction(
    signature: string,
    tx: ParsedTransactionWithMeta,
  ): ParsedDlnEvent[] {
    const events: ParsedDlnEvent[] = [];

    // Validate transaction has metadata and blockTime
    if (!tx.meta || !tx.blockTime) {
      return events;
    }

    // Extract orderId from log messages
    const logMessages = tx.meta.logMessages || [];
    const orderId = extractOrderIdFromLogs(logMessages);

    // Discard event if orderId is missing
    if (!orderId) {
      // Log debug info when orderId is not found
      if (typeof console !== 'undefined' && console.debug) {
        console.debug(
          `[DlnEventParser] No orderId found in transaction ${signature}. ` +
          `Log messages: ${JSON.stringify(logMessages.slice(0, 5))}`
        );
      }
      return events;
    }

    // Parse transaction using @debridge-finance/solana-transaction-parser
    try {
      // Validate message structure before parsing
      if (!tx.transaction?.message) {
        return events;
      }

      // Use parseTransactionParsedData for ParsedTransactionWithMeta
      // Note: parseTransactionParsedData works with ParsedMessage which may already have parsed instructions
      // Custom parser works with TransactionInstruction, so it may not be called for already-parsed instructions
      // Wrap in try-catch to handle cases where some instructions have invalid data
      let parsedInstructions: any[] = [];
      try {
        const result = this.parser.parseTransactionParsedData(
          tx.transaction.message
        );
        parsedInstructions = Array.isArray(result) ? result : [];
      } catch (parseError) {
        // Some transactions may have instructions with data that can't be decoded
        // This is expected for certain transaction types - fallback to log-based detection
        // Don't return here - let fallback logic handle it
        parsedInstructions = [];
      }
      
      // Look for DLN program instructions
      if (parsedInstructions && parsedInstructions.length > 0) {
        for (const instruction of parsedInstructions) {
          try {
            // Validate instruction structure
            if (!instruction?.programId) {
              continue;
            }

            // Check if this is a DLN program instruction
            const instructionProgramId = typeof instruction.programId === 'string'
              ? instruction.programId
              : instruction.programId.toBase58?.() || String(instruction.programId);

            // Check if instruction programId is in our set of supported programIds
            if (!this.programIds.has(instructionProgramId)) {
              continue;
            }

            // Custom parser (customDlnParser) should have set instruction.name to:
            // 'createOrder', 'fulfillOrder', 'cancelOrder', or 'claimOrder'
            // This will be used by detectEventType to identify the event type
            const event = this.parseInstruction(
              instruction,
              orderId,
              signature,
              tx.slot,
              tx.blockTime,
              logMessages,
            );

            if (event) {
              events.push(event);
            }
          } catch (instructionError) {
            // Skip invalid instructions, continue with others
            // This handles cases where individual instructions have parsing issues
            continue;
          }
        }
      }

      // Fallback: if no events found from parsed instructions, try to detect from log messages
      // This handles cases where instructions can't be parsed but logs contain instruction info
      // This is critical because parseTransactionParsedData may not use custom parser for already-parsed instructions
      if (events.length === 0) {
        const eventTypeFromLogs = this.detectEventTypeFromLogs(logMessages);
        if (eventTypeFromLogs) {
          const event = this.createEventFromLogs(
            eventTypeFromLogs,
            orderId,
            signature,
            tx.slot,
            tx.blockTime,
          );
          if (event) {
            events.push(event);
          }
        }
      }
    } catch (error) {
      // Log error but don't throw - return empty events array
      // This allows the transaction to be processed even if parsing fails
      // The error is expected for some transaction types with non-standard instruction formats
      return events;
    }

    return events;
  }

  /**
   * Parse a single instruction and create a DLN event
   */
  private parseInstruction(
    instruction: ParsedInstruction<Idl, string>,
    orderId: string,
    signature: string,
    slot: number,
    blockTime: number,
    logMessages: string[],
  ): ParsedDlnEvent | null {
    // Detect event type from instruction name or log messages
    const eventType = this.detectEventType(instruction, logMessages);

    if (!eventType) {
      // Log debug info when event type cannot be determined
      if (typeof console !== 'undefined' && console.debug) {
        console.debug(
          `[DlnEventParser] Could not detect event type for instruction. ` +
          `Name: ${instruction.name || 'unknown'}, OrderId: ${orderId}`
        );
      }
      return null;
    }

    // Parse based on event type
    try {
      if (eventType === DlnEventType.OrderCreated) {
        const data = this.parseOrderCreatedData(instruction);
        if (!data) return null;

        return {
          eventType,
          orderId,
          signature,
          slot,
          blockTime,
          data,
        };
      } else if (eventType === DlnEventType.OrderFulfilled) {
        const data = this.parseOrderFulfilledData(instruction);
        if (!data) return null;

        return {
          eventType,
          orderId,
          signature,
          slot,
          blockTime,
          data,
        };
      }
    } catch (error) {
      console.error('Failed to parse instruction data:', error);
    }

    return null;
  }

  /**
   * Detect DLN event type from instruction
   */
  private detectEventType(instruction: ParsedInstruction<Idl, string>, logMessages: string[]): DlnEventType | null {
    // Check instruction name
    // Custom parser returns: 'createOrder', 'createOrderWithNonce', 'fulfillOrder', 'cancelOrder', 'claimOrder'
    // IDL parser might return: 'createOrder', 'create_order', 'fulfillOrder', 'fulfill_order', etc.
    const instructionName = instruction.name || '';
    const nameLower = instructionName.toLowerCase();

    // Match various naming conventions
    if (
      nameLower === 'createorder' ||
      nameLower === 'create_order' ||
      nameLower === 'createorderwithnonce' ||
      nameLower === 'create_order_with_nonce' ||
      nameLower.includes('createorder') ||
      nameLower.includes('create_order')
    ) {
      return DlnEventType.OrderCreated;
    }

    if (
      nameLower === 'fulfillorder' ||
      nameLower === 'fulfill_order' ||
      nameLower.includes('fulfillorder') ||
      nameLower.includes('fulfill_order')
    ) {
      return DlnEventType.OrderFulfilled;
    }

    // Check log messages as fallback
    for (const log of logMessages) {
      const lowerLog = log.toLowerCase();

      // Check for CreateOrder patterns (including createOrderWithNonce)
      if (
        lowerLog.includes('order created') ||
        lowerLog.includes('ordercreated') ||
        lowerLog.includes('instruction: createorder') ||
        lowerLog.includes('instruction:createorder') ||
        lowerLog.includes('instruction: createorderwithnonce') ||
        lowerLog.includes('instruction:createorderwithnonce')
      ) {
        return DlnEventType.OrderCreated;
      }
      
      // Check for FulfillOrder patterns
      if (
        lowerLog.includes('order fulfilled') || 
        lowerLog.includes('orderfulfilled') ||
        lowerLog.includes('instruction: fulfillorder') ||
        lowerLog.includes('instruction:fulfillorder')
      ) {
        return DlnEventType.OrderFulfilled;
      }
    }

    return null;
  }

  /**
   * Detect event type from log messages only (fallback when instructions can't be parsed)
   */
  private detectEventTypeFromLogs(logMessages: string[]): DlnEventType | null {
    for (const log of logMessages) {
      const lowerLog = log.toLowerCase();

      // Check for CreateOrder patterns (including createOrderWithNonce)
      if (
        lowerLog.includes('order created') ||
        lowerLog.includes('ordercreated') ||
        lowerLog.includes('instruction: createorder') ||
        lowerLog.includes('instruction:createorder') ||
        lowerLog.includes('instruction: createorderwithnonce') ||
        lowerLog.includes('instruction:createorderwithnonce')
      ) {
        return DlnEventType.OrderCreated;
      }
      
      // Check for FulfillOrder patterns
      if (
        lowerLog.includes('order fulfilled') || 
        lowerLog.includes('orderfulfilled') ||
        lowerLog.includes('instruction: fulfillorder') ||
        lowerLog.includes('instruction:fulfillorder')
      ) {
        return DlnEventType.OrderFulfilled;
      }
    }

    return null;
  }

  /**
   * Create event from log messages when instructions can't be parsed
   */
  private createEventFromLogs(
    eventType: DlnEventType,
    orderId: string,
    signature: string,
    slot: number,
    blockTime: number,
  ): ParsedDlnEvent | null {
    try {
      if (eventType === DlnEventType.OrderCreated) {
        // Create minimal OrderCreated data from logs
        const data: OrderCreatedData = {
          maker: '',
          giveChainId: '',
          takeChainId: '',
          giveTokenAddress: '',
          takeTokenAddress: '',
          giveAmount: '0',
          takeAmount: '0',
          receiver: '',
        };
        return {
          eventType,
          orderId,
          signature,
          slot,
          blockTime,
          data,
        };
      } else if (eventType === DlnEventType.OrderFulfilled) {
        // Create minimal OrderFulfilled data from logs
        const data: OrderFulfilledData = {
          fulfiller: '',
          giveAmount: '0',
          takeAmount: '0',
          orderBeneficiary: '',
          unlockBeneficiary: '',
        };
        return {
          eventType,
          orderId,
          signature,
          slot,
          blockTime,
          data,
        };
      }
    } catch (error) {
      console.error('Failed to create event from logs:', error);
    }

    return null;
  }

  /**
   * Parse OrderCreated instruction data
   */
  private parseOrderCreatedData(instruction: ParsedInstruction<Idl, string>): OrderCreatedData | null {
    try {
      const args = (instruction.args || {}) as any;
      const accounts = instruction.accounts || [];

      // Extract data from instruction arguments
      return {
        maker: this.extractAccount(accounts, 'maker') || this.extractAccount(accounts, 0) || '',
        giveChainId: String(args.giveChainId || args.give_chain_id || ''),
        takeChainId: String(args.takeChainId || args.take_chain_id || ''),
        giveTokenAddress: this.extractAccount(accounts, 'giveToken') || this.extractAccount(accounts, 'give_token') || '',
        takeTokenAddress: this.extractAccount(accounts, 'takeToken') || this.extractAccount(accounts, 'take_token') || '',
        giveAmount: String(args.giveAmount || args.give_amount || '0'),
        takeAmount: String(args.takeAmount || args.take_amount || '0'),
        receiver: this.extractAccount(accounts, 'receiver') || '',
        expirySlot: args.expirySlot || args.expiry_slot,
        affiliateFee: args.affiliateFee ? String(args.affiliateFee) : undefined,
        allowedTaker: this.extractAccount(accounts, 'allowedTaker') || this.extractAccount(accounts, 'allowed_taker'),
        allowedCancelBeneficiary: this.extractAccount(accounts, 'allowedCancelBeneficiary') || this.extractAccount(accounts, 'allowed_cancel_beneficiary'),
      };
    } catch (error) {
      console.error('Failed to parse OrderCreated data:', error);
      return null;
    }
  }

  /**
   * Parse OrderFulfilled instruction data
   */
  private parseOrderFulfilledData(instruction: ParsedInstruction<Idl, string>): OrderFulfilledData | null {
    try {
      const args = (instruction.args || {}) as any;
      const accounts = instruction.accounts || [];

      return {
        fulfiller: this.extractAccount(accounts, 'fulfiller') || this.extractAccount(accounts, 0) || '',
        giveAmount: String(args.giveAmount || args.give_amount || '0'),
        takeAmount: String(args.takeAmount || args.take_amount || '0'),
        orderBeneficiary: this.extractAccount(accounts, 'orderBeneficiary') || this.extractAccount(accounts, 'order_beneficiary') || '',
        unlockBeneficiary: this.extractAccount(accounts, 'unlockBeneficiary') || this.extractAccount(accounts, 'unlock_beneficiary') || '',
      };
    } catch (error) {
      console.error('Failed to parse OrderFulfilled data:', error);
      return null;
    }
  }

  /**
   * Extract account address from accounts array
   */
  private extractAccount(accounts: any[], key: string | number): string | undefined {
    if (typeof key === 'number') {
      const account = accounts[key];
      if (!account) return undefined;
      
      // Handle PublicKey object
      if (account.pubkey) {
        return account.pubkey.toBase58 ? account.pubkey.toBase58() : String(account.pubkey);
      }
      
      return typeof account === 'string' ? account : account.address || '';
    }

    const account = accounts.find((acc: any) => 
      acc.name === key
    );

    if (!account) return undefined;
    
    // Handle PublicKey object
    if (account.pubkey) {
      return account.pubkey.toBase58 ? account.pubkey.toBase58() : String(account.pubkey);
    }
    
    return typeof account === 'string' ? account : account.address || '';
  }
}

/**
 * Create a new DLN event parser instance
 * @param programId - Single programId or array of programIds to parse
 * @param idl - Optional IDL for parsing
 */
export function createDlnEventParser(programId: string | string[], idl?: Idl): DlnEventParser {
  return new DlnEventParser(programId, idl);
}
