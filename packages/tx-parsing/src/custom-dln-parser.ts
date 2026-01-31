import { TransactionInstruction } from '@solana/web3.js';
import { ParsedInstruction } from '@debridge-finance/solana-transaction-parser';
import type { Idl } from '@coral-xyz/anchor';
import { DLNInstructionType } from './types.js';

/**
 * Custom parser for DLN program instructions
 * Parses DLN instructions based on the first byte of instruction data
 * 
 * DLN Instruction types (first byte):
 * - 0: CreateOrder
 * - 1: FulfillOrder
 * - 2: CancelOrder
 * - 3: ClaimOrder
 */
export function customDlnParser(
  instruction: TransactionInstruction
): ParsedInstruction<Idl, string> {
  const instructionType = instruction.data[0] as DLNInstructionType;
  let name: string;
  let args: unknown;
  let accounts: any[];

  switch (instructionType) {
    case DLNInstructionType.CreateOrder:
      name = 'createOrder';
      // Parse CreateOrder instruction data
      // Note: This is a simplified version - actual parsing would require
      // knowledge of the exact Borsh layout of CreateOrder instruction
      args = parseCreateOrderArgs(instruction.data);
      accounts = instruction.keys.map((key, index) => ({
        name: getCreateOrderAccountName(index),
        pubkey: key.pubkey,
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      }));
      break;

    case DLNInstructionType.CreateOrderWithNonce:
      name = 'createOrderWithNonce';
      // Parse CreateOrderWithNonce instruction data
      // Similar to CreateOrder but includes nonce field
      args = parseCreateOrderArgs(instruction.data);
      accounts = instruction.keys.map((key, index) => ({
        name: getCreateOrderAccountName(index),
        pubkey: key.pubkey,
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      }));
      break;

    case DLNInstructionType.FulfillOrder:
      name = 'fulfillOrder';
      // Parse FulfillOrder instruction data
      args = parseFulfillOrderArgs(instruction.data);
      accounts = instruction.keys.map((key, index) => ({
        name: getFulfillOrderAccountName(index),
        pubkey: key.pubkey,
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      }));
      break;

    case DLNInstructionType.CancelOrder:
      name = 'cancelOrder';
      args = {};
      accounts = instruction.keys.map((key, index) => ({
        name: getCancelOrderAccountName(index),
        pubkey: key.pubkey,
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      }));
      break;

    case DLNInstructionType.ClaimOrder:
      name = 'claimOrder';
      args = {};
      accounts = instruction.keys.map((key, index) => ({
        name: getClaimOrderAccountName(index),
        pubkey: key.pubkey,
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      }));
      break;

    default:
      throw new Error(`Unknown DLN instruction type: ${instructionType}`);
  }

  return {
    programId: instruction.programId,
    accounts,
    args,
    name,
  };
}

/**
 * Parse CreateOrder instruction arguments
 * This is a placeholder - actual implementation would require Borsh deserialization
 */
function parseCreateOrderArgs(_data: Buffer): unknown {
  // Skip first byte (instruction discriminator)
  // TODO: Implement actual Borsh deserialization based on DLN program IDL
  return {
    // Placeholder - actual parsing would extract:
    // giveChainId, takeChainId, giveAmount, takeAmount, etc.
  };
}

/**
 * Parse FulfillOrder instruction arguments
 * This is a placeholder - actual implementation would require Borsh deserialization
 */
function parseFulfillOrderArgs(_data: Buffer): unknown {
  // Skip first byte (instruction discriminator)
  // TODO: Implement actual Borsh deserialization based on DLN program IDL
  return {
    // Placeholder - actual parsing would extract:
    // giveAmount, takeAmount, etc.
  };
}

/**
 * Get account name for CreateOrder instruction by index
 */
function getCreateOrderAccountName(index: number): string {
  const accountNames = [
    'maker',
    'giveToken',
    'takeToken',
    'receiver',
    'orderAccount',
    'systemProgram',
  ];
  return accountNames[index] || `account${index}`;
}

/**
 * Get account name for FulfillOrder instruction by index
 */
function getFulfillOrderAccountName(index: number): string {
  const accountNames = [
    'fulfiller',
    'orderAccount',
    'orderBeneficiary',
    'unlockBeneficiary',
    'giveToken',
    'takeToken',
    'systemProgram',
  ];
  return accountNames[index] || `account${index}`;
}

/**
 * Get account name for CancelOrder instruction by index
 */
function getCancelOrderAccountName(index: number): string {
  const accountNames = [
    'maker',
    'orderAccount',
    'beneficiary',
    'systemProgram',
  ];
  return accountNames[index] || `account${index}`;
}

/**
 * Get account name for ClaimOrder instruction by index
 */
function getClaimOrderAccountName(index: number): string {
  const accountNames = [
    'claimer',
    'orderAccount',
    'systemProgram',
  ];
  return accountNames[index] || `account${index}`;
}
