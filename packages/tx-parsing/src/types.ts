import { PublicKey } from '@solana/web3.js';
import { OrderDto, TransactionDto } from '@incur-data/dtos';

/**
 * DLN Instruction types
 */
export enum DLNInstructionType {
  CreateOrder = 0,
  FulfillOrder = 1,
  CancelOrder = 2,
  ClaimOrder = 3,
  CreateOrderWithNonce = 4,
}

/**
 * Parsed DLN instruction
 */
export interface ParsedDLNInstruction {
  type: DLNInstructionType;
  data: unknown;
  accounts: PublicKey[];
}

/**
 * Create Order instruction data
 */
export interface CreateOrderData {
  orderId: string;
  giveAmount: bigint;
  takeAmount: bigint;
  giveTokenMint: PublicKey;
  takeTokenMint: PublicKey;
  giveChainId: number;
  takeChainId: number;
  receiver: PublicKey;
  affiliateFee?: bigint;
  allowedTaker?: PublicKey;
  allowedCancelBeneficiary?: PublicKey;
  expirySlot?: number;
}

/**
 * Fulfill Order instruction data
 */
export interface FulfillOrderData {
  orderId: string;
  giveAmount: bigint;
  takeAmount: bigint;
  orderBeneficiary: PublicKey;
  unlockBeneficiary: PublicKey;
}

/**
 * Cancel Order instruction data
 */
export interface CancelOrderData {
  orderId: string;
  beneficiary: PublicKey;
}

/**
 * Claim Order instruction data
 */
export interface ClaimOrderData {
  orderId: string;
}

/**
 * Transaction parsing result
 */
export interface ParsedTransaction {
  transaction: TransactionDto;
  orders: OrderDto[];
  instructions: ParsedDLNInstruction[];
}

/**
 * Parser configuration
 */
export interface ParserConfig {
  programId: PublicKey;
  rpcEndpoint?: string;
}

/**
 * DLN Event Types
 */
export enum DlnEventType {
  OrderCreated = 'createOrderWithNonce',
  OrderFulfilled = 'OrderFulfilled',
  Unknown = 'Unknown',
}

/**
 * Base parsed DLN event structure
 */
export interface ParsedDlnEvent {
  eventType: DlnEventType;
  orderId: string;
  signature: string;
  slot: number;
  blockTime: number;
  data: OrderCreatedData | OrderFulfilledData;
}

/**
 * OrderCreated event data
 */
export interface OrderCreatedData {
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

/**
 * OrderFulfilled event data
 */
export interface OrderFulfilledData {
  fulfiller: string;
  giveAmount: string;
  takeAmount: string;
  orderBeneficiary: string;
  unlockBeneficiary: string;
}
