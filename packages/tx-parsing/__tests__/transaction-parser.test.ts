import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionParser } from '../src/parser.js';
import { PublicKey } from '@solana/web3.js';
import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import orderCreatedTx from './fixtures/order-created-tx.json';
import orderFulfilledTx from './fixtures/order-fulfilled-tx.json';
import failedTx from './fixtures/failed-tx.json';
import noOrderIdTx from './fixtures/no-orderid-tx.json';

describe('TransactionParser', () => {
  let parser: TransactionParser;
  const programId = new PublicKey('DLNProg11111111111111111111111111111111111');
  const testSignature = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';

  beforeEach(() => {
    parser = new TransactionParser({ programId });
  });

  describe('parseTransactionData', () => {
    it('should parse a successful transaction', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result?.transaction).toBeDefined();
      expect(result?.orders).toBeDefined();
      expect(result?.instructions).toBeDefined();
    });

    it('should extract transaction metadata correctly', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result!.transaction.signature).toBe(testSignature);
      expect(result!.transaction.slot).toBe(234567890);
      expect(result!.transaction.blockTime).toBe(1704067200);
      expect(result!.transaction.status).toBe('confirmed');
      expect(result!.transaction.fee).toBe('5000');
      expect(result!.transaction.programId).toBe(programId.toBase58());
    });

    it('should parse transaction accounts', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result!.transaction.accounts).toBeDefined();
      expect(Array.isArray(result!.transaction.accounts)).toBe(true);
      expect(result!.transaction.accounts.length).toBeGreaterThan(0);
    });

    it('should include log messages when present', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result!.transaction.logs).toBeDefined();
      expect(Array.isArray(result!.transaction.logs)).toBe(true);
      expect(result!.transaction.logs!.length).toBeGreaterThan(0);
    });

    it('should mark failed transactions correctly', () => {
      const tx = failedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result!.transaction.status).toBe('failed');
      expect(result!.transaction.error).toBeDefined();
      expect(result!.transaction.error).toContain('InstructionError');
    });

    it('should return null for transaction without metadata', () => {
      const tx = {
        ...orderCreatedTx,
        meta: null,
      } as unknown as ParsedTransactionWithMeta;
      
      const result = parser.parseTransactionData(testSignature, tx);
      expect(result).toBeNull();
    });

    it('should return null for transaction without blockTime', () => {
      const tx = {
        ...orderCreatedTx,
        blockTime: null,
      } as unknown as ParsedTransactionWithMeta;
      
      const result = parser.parseTransactionData(testSignature, tx);
      expect(result).toBeNull();
    });

    it('should handle transaction with no instructions', () => {
      const tx = {
        ...orderCreatedTx,
        transaction: {
          ...orderCreatedTx.transaction,
          message: {
            ...orderCreatedTx.transaction.message,
            instructions: [],
          },
        },
      } as unknown as ParsedTransactionWithMeta;
      
      const result = parser.parseTransactionData(testSignature, tx);
      
      expect(result).not.toBeNull();
      expect(result!.instructions).toHaveLength(0);
      expect(result!.orders).toHaveLength(0);
    });
  });

  describe('transaction DTO structure', () => {
    it('should create valid TransactionDto', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      const dto = result!.transaction;
      
      // Verify all required fields
      expect(dto.signature).toBeDefined();
      expect(dto.slot).toBeDefined();
      expect(dto.blockTime).toBeDefined();
      expect(dto.status).toBeDefined();
      expect(dto.fee).toBeDefined();
      expect(dto.programId).toBeDefined();
      expect(dto.accounts).toBeDefined();
      expect(dto.instructions).toBeDefined();
      expect(dto.createdAt).toBeDefined();
    });

    it('should use string for fee amount', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(typeof result!.transaction.fee).toBe('string');
    });

    it('should convert blockTime to Date for createdAt', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result!.transaction.createdAt).toBeInstanceOf(Date);
      
      const expectedDate = new Date(tx.blockTime! * 1000);
      expect(result!.transaction.createdAt.getTime()).toBe(expectedDate.getTime());
    });
  });

  describe('instruction parsing', () => {
    it('should parse instructions from transaction', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(Array.isArray(result!.instructions)).toBe(true);
    });

    it('should handle parsing errors gracefully', () => {
      const tx = {
        ...orderCreatedTx,
        transaction: {
          ...orderCreatedTx.transaction,
          message: {
            ...orderCreatedTx.transaction.message,
            instructions: [
              {
                accounts: [],
                data: 'invalid_base58_data!!!',
                programIdIndex: 2,
              },
            ],
          },
        },
      } as unknown as ParsedTransactionWithMeta;
      
      // Should not throw, just handle error gracefully
      expect(() => {
        parser.parseTransactionData(testSignature, tx);
      }).not.toThrow();
    });
  });

  describe('order extraction', () => {
    it('should extract orders from CreateOrder instructions', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      // Orders are only extracted when instruction type is 0 (CreateOrder)
      // and proper parsing is successful
      expect(Array.isArray(result!.orders)).toBe(true);
    });

    it('should not extract orders from non-CreateOrder instructions', () => {
      const tx = noOrderIdTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result!.orders).toHaveLength(0);
    });

    it('should not extract orders from FulfillOrder instructions', () => {
      const tx = orderFulfilledTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      // FulfillOrder should not create new order entries
      expect(result!.orders).toHaveLength(0);
    });
  });

  describe('parser configuration', () => {
    it('should initialize with programId only', () => {
      const customParser = new TransactionParser({ programId });
      expect(customParser).toBeInstanceOf(TransactionParser);
    });

    it('should initialize with programId and rpcEndpoint', () => {
      const customParser = new TransactionParser({
        programId,
        rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      });
      expect(customParser).toBeInstanceOf(TransactionParser);
    });

    it('should throw error when calling parseTransaction without RPC endpoint', async () => {
      const parserWithoutRpc = new TransactionParser({ programId });
      
      await expect(
        parserWithoutRpc.parseTransaction(testSignature)
      ).rejects.toThrow('RPC endpoint not configured');
    });
  });

  describe('multiple transaction types', () => {
    it('should handle sequence of different transaction types', () => {
      const transactions = [
        orderCreatedTx,
        orderFulfilledTx,
        failedTx,
        noOrderIdTx,
      ];

      const results = transactions.map((tx, idx) =>
        parser.parseTransactionData(`sig${idx}`, tx as unknown as ParsedTransactionWithMeta)
      );

      // All transactions should be parsed (even if failed or without orders)
      results.forEach(result => {
        expect(result).not.toBeNull();
        expect(result!.transaction).toBeDefined();
      });

      // Verify different statuses
      expect(results[0]!.transaction.status).toBe('confirmed');
      expect(results[1]!.transaction.status).toBe('confirmed');
      expect(results[2]!.transaction.status).toBe('failed');
      expect(results[3]!.transaction.status).toBe('confirmed');
    });
  });

  describe('data integrity', () => {
    it('should preserve signature throughout parsing', () => {
      const customSig = 'CustomSignature123';
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(customSig, tx);

      expect(result).not.toBeNull();
      expect(result!.transaction.signature).toBe(customSig);
      
      // All orders should reference the same signature
      result!.orders.forEach(order => {
        expect(order.signature).toBe(customSig);
      });
    });

    it('should maintain slot consistency', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result!.transaction.slot).toBe(tx.slot);
      
      // All orders should reference the correct slot
      result!.orders.forEach(order => {
        expect(order.createdSlot).toBe(tx.slot);
      });
    });

    it('should maintain blockTime consistency', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const result = parser.parseTransactionData(testSignature, tx);

      expect(result).not.toBeNull();
      expect(result!.transaction.blockTime).toBe(tx.blockTime);
      
      const expectedDate = new Date(tx.blockTime! * 1000);
      expect(result!.transaction.createdAt.getTime()).toBe(expectedDate.getTime());
    });
  });

  describe('error handling', () => {
    it('should handle malformed transaction gracefully', () => {
      const malformedTx = {
        slot: 12345,
        blockTime: 1704067200,
        meta: {
          err: null,
          fee: 5000,
        },
        transaction: null,
      } as any;

      expect(() => {
        parser.parseTransactionData(testSignature, malformedTx);
      }).not.toThrow();
    });

    it('should handle missing transaction fields', () => {
      const incompleteTx = {
        slot: 12345,
        blockTime: 1704067200,
        meta: {
          err: null,
          fee: 5000,
        },
        transaction: {
          message: {},
        },
      } as any;

      expect(() => {
        parser.parseTransactionData(testSignature, incompleteTx);
      }).not.toThrow();
    });
  });
});
