import { Connection, ParsedTransactionWithMeta, PublicKey } from '@solana/web3.js';
import type { TransactionDto, OrderDto } from '@incur-data/dtos';
import { parseInstruction } from './instruction-parser.js';
import { parseAccounts } from './account-parser.js';
import type {
  ParsedTransaction,
  ParserConfig,
  CreateOrderData,
} from './types.js';

/**
 * Main transaction parser class
 */
export class TransactionParser {
  private readonly programId: PublicKey;
  private readonly connection?: Connection;

  constructor(config: ParserConfig) {
    this.programId = config.programId;
    if (config.rpcEndpoint) {
      this.connection = new Connection(config.rpcEndpoint, 'confirmed');
    }
  }

  /**
   * Parse a transaction signature and extract DLN data
   */
  async parseTransaction(signature: string): Promise<ParsedTransaction | null> {
    if (!this.connection) {
      throw new Error('RPC endpoint not configured');
    }

    const tx = await this.connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return null;
    }

    return this.parseTransactionData(signature, tx);
  }

  /**
   * Parse transaction data from a ParsedTransactionWithMeta
   */
  parseTransactionData(
    signature: string,
    tx: ParsedTransactionWithMeta,
  ): ParsedTransaction | null {
    if (!tx.meta || !tx.blockTime) {
      return null;
    }

    // Build base transaction DTO
    const transactionDto: TransactionDto = {
      signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      status: tx.meta.err ? 'failed' : 'confirmed',
      fee: tx.meta.fee.toString(),
      programId: this.programId.toBase58(),
      accounts: parseAccounts(tx),
      instructions: [],
      logs: tx.meta.logMessages ?? undefined,
      error: tx.meta.err ? JSON.stringify(tx.meta.err) : undefined,
      createdAt: new Date(tx.blockTime * 1000),
    };

    // Parse instructions
    const parsedInstructions = [];
    const orders: OrderDto[] = [];

    if (tx.transaction.message.instructions) {
      for (const instruction of tx.transaction.message.instructions) {
        try {
          const parsed = parseInstruction(instruction, this.programId);
          if (parsed) {
            parsedInstructions.push(parsed);

            // Extract order data if it's a CreateOrder instruction
            if (parsed.type === 0) {
              // DLNInstructionType.CreateOrder
              const orderData = parsed.data as CreateOrderData;
              const order = this.createOrderDto(signature, tx, orderData);
              orders.push(order);
            }
          }
        } catch (error) {
          console.error('Failed to parse instruction:', error);
        }
      }
    }

    return {
      transaction: transactionDto,
      orders,
      instructions: parsedInstructions,
    };
  }

  /**
   * Create an OrderDto from CreateOrder instruction data
   */
  private createOrderDto(
    signature: string,
    tx: ParsedTransactionWithMeta,
    data: CreateOrderData,
  ): OrderDto {
    return {
      orderId: data.orderId,
      signature,
      maker: data.receiver.toBase58(),
      giveChainId: `chain-${data.giveChainId}`,
      takeChainId: `chain-${data.takeChainId}`,
      giveTokenAddress: data.giveTokenMint.toBase58(),
      takeTokenAddress: data.takeTokenMint.toBase58(),
      giveAmount: data.giveAmount.toString(),
      takeAmount: data.takeAmount.toString(),
      status: 'created',
      createdSlot: tx.slot,
      expirySlot: data.expirySlot,
      affiliateFee: data.affiliateFee?.toString(),
      allowedTaker: data.allowedTaker?.toBase58(),
      allowedCancelBeneficiary: data.allowedCancelBeneficiary?.toBase58(),
      createdAt: new Date(tx.blockTime! * 1000),
    };
  }
}

/**
 * Create a new transaction parser instance
 */
export function createParser(config: ParserConfig): TransactionParser {
  return new TransactionParser(config);
}
