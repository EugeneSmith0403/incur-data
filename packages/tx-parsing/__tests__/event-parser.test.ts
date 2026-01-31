import { describe, it, expect, beforeEach } from 'vitest';
import { DlnEventParser, DlnEventType } from '../src/dln-event-parser.js';
import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import orderCreatedTx from './fixtures/order-created-tx.json';
import orderFulfilledTx from './fixtures/order-fulfilled-tx.json';
import failedTx from './fixtures/failed-tx.json';
import noOrderIdTx from './fixtures/no-orderid-tx.json';
import complexOrderCreatedTx from './fixtures/complex-order-created-tx.json';

describe('DlnEventParser', () => {
  let parser: DlnEventParser;
  const programId = 'DLNProg11111111111111111111111111111111111';
  const testSignature = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';

  beforeEach(() => {
    parser = new DlnEventParser(programId);
  });

  describe('parseTransaction - OrderCreated events', () => {
    it('should parse a basic OrderCreated transaction from fixture', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(1);
      const event = events[0];
      
      expect(event.eventType).toBe(DlnEventType.OrderCreated);
      expect(event.orderId).toBe('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(event.signature).toBe(testSignature);
      expect(event.slot).toBe(234567890);
      expect(event.blockTime).toBe(1704067200);
    });

    it('should parse a complex OrderCreated transaction with all fields', () => {
      const tx = complexOrderCreatedTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(1);
      const event = events[0];
      
      expect(event.eventType).toBe(DlnEventType.OrderCreated);
      expect(event.orderId).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      expect(event.signature).toBe(testSignature);
      expect(event.slot).toBe(234571000);
      expect(event.blockTime).toBe(1704069600);
    });

    it('should extract OrderCreated data structure', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(1);
      const data = events[0].data;
      
      // Verify data structure matches OrderCreatedData interface
      expect(data).toHaveProperty('maker');
      expect(data).toHaveProperty('giveChainId');
      expect(data).toHaveProperty('takeChainId');
      expect(data).toHaveProperty('giveTokenAddress');
      expect(data).toHaveProperty('takeTokenAddress');
      expect(data).toHaveProperty('giveAmount');
      expect(data).toHaveProperty('takeAmount');
      expect(data).toHaveProperty('receiver');
    });
  });

  describe('parseTransaction - OrderFulfilled events', () => {
    it('should parse an OrderFulfilled transaction from fixture', () => {
      const tx = orderFulfilledTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(1);
      const event = events[0];
      
      expect(event.eventType).toBe(DlnEventType.OrderFulfilled);
      expect(event.orderId).toBe('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(event.signature).toBe(testSignature);
      expect(event.slot).toBe(234568000);
      expect(event.blockTime).toBe(1704067800);
    });

    it('should extract OrderFulfilled data structure', () => {
      const tx = orderFulfilledTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(1);
      const data = events[0].data;
      
      // Verify data structure matches OrderFulfilledData interface
      expect(data).toHaveProperty('fulfiller');
      expect(data).toHaveProperty('giveAmount');
      expect(data).toHaveProperty('takeAmount');
      expect(data).toHaveProperty('orderBeneficiary');
      expect(data).toHaveProperty('unlockBeneficiary');
    });
  });

  describe('parseTransaction - edge cases', () => {
    it('should return empty array for transaction without orderId', () => {
      const tx = noOrderIdTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(0);
    });

    it('should handle failed transactions with orderId', () => {
      const tx = failedTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      // Failed transactions still have logs and can have orderIds
      // but typically won't have valid instruction parsing
      // This tests the parser's error handling
      expect(Array.isArray(events)).toBe(true);
    });

    it('should return empty array for transaction without metadata', () => {
      const tx = {
        ...orderCreatedTx,
        meta: null,
      } as unknown as ParsedTransactionWithMeta;
      
      const events = parser.parseTransaction(testSignature, tx);
      expect(events).toHaveLength(0);
    });

    it('should return empty array for transaction without blockTime', () => {
      const tx = {
        ...orderCreatedTx,
        blockTime: null,
      } as unknown as ParsedTransactionWithMeta;
      
      const events = parser.parseTransaction(testSignature, tx);
      expect(events).toHaveLength(0);
    });

    it('should handle transaction with empty log messages', () => {
      const tx = {
        ...orderCreatedTx,
        meta: {
          ...orderCreatedTx.meta,
          logMessages: [],
        },
      } as unknown as ParsedTransactionWithMeta;
      
      const events = parser.parseTransaction(testSignature, tx);
      expect(events).toHaveLength(0);
    });

    it('should handle transaction with missing logMessages property', () => {
      const tx = {
        ...orderCreatedTx,
        meta: {
          ...orderCreatedTx.meta,
          logMessages: undefined,
        },
      } as unknown as ParsedTransactionWithMeta;
      
      const events = parser.parseTransaction(testSignature, tx);
      expect(events).toHaveLength(0);
    });
  });

  describe('parseTransaction - multiple programs', () => {
    it('should only parse transactions for the configured programId', () => {
      const differentProgramParser = new DlnEventParser('OtherProg1111111111111111111111111111111');
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      
      const events = differentProgramParser.parseTransaction(testSignature, tx);
      
      // Should not parse events from a different program
      expect(events).toHaveLength(0);
    });

    it('should handle transactions with multiple instructions', () => {
      const tx = {
        ...orderCreatedTx,
        transaction: {
          ...orderCreatedTx.transaction,
          message: {
            ...orderCreatedTx.transaction.message,
            instructions: [
              orderCreatedTx.transaction.message.instructions[0],
              orderCreatedTx.transaction.message.instructions[0], // Duplicate for test
            ],
          },
        },
      } as unknown as ParsedTransactionWithMeta;
      
      const events = parser.parseTransaction(testSignature, tx);
      
      // Even with multiple instructions, should handle gracefully
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('event data validation', () => {
    it('should produce consistent orderId format (lowercase)', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(1);
      expect(events[0].orderId).toMatch(/^[a-f0-9]{64}$/);
      expect(events[0].orderId).toBe(events[0].orderId.toLowerCase());
    });

    it('should preserve signature exactly as provided', () => {
      const customSignature = 'CustomSig123456789';
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(customSignature, tx);

      expect(events).toHaveLength(1);
      expect(events[0].signature).toBe(customSignature);
    });

    it('should have valid slot numbers', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(1);
      expect(events[0].slot).toBeGreaterThan(0);
      expect(Number.isInteger(events[0].slot)).toBe(true);
    });

    it('should have valid blockTime (unix timestamp)', () => {
      const tx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const events = parser.parseTransaction(testSignature, tx);

      expect(events).toHaveLength(1);
      expect(events[0].blockTime).toBeGreaterThan(0);
      expect(Number.isInteger(events[0].blockTime)).toBe(true);
      
      // Should be a reasonable timestamp (after 2020, before 2100)
      const date = new Date(events[0].blockTime * 1000);
      expect(date.getFullYear()).toBeGreaterThanOrEqual(2020);
      expect(date.getFullYear()).toBeLessThan(2100);
    });
  });

  describe('parser initialization', () => {
    it('should create parser with programId', () => {
      const customParser = new DlnEventParser(programId);
      expect(customParser).toBeInstanceOf(DlnEventParser);
    });

    it('should create parser with programId and IDL', () => {
      const mockIdl = {
        version: '0.1.0',
        name: 'dln_program',
        instructions: [],
      };
      const customParser = new DlnEventParser(programId, mockIdl as any);
      expect(customParser).toBeInstanceOf(DlnEventParser);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle rapid sequence of order creation', () => {
      const tx1 = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const tx2 = complexOrderCreatedTx as unknown as ParsedTransactionWithMeta;

      const events1 = parser.parseTransaction('sig1', tx1);
      const events2 = parser.parseTransaction('sig2', tx2);

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0].orderId).not.toBe(events2[0].orderId);
    });

    it('should handle order creation followed by fulfillment', () => {
      const createTx = orderCreatedTx as unknown as ParsedTransactionWithMeta;
      const fulfillTx = orderFulfilledTx as unknown as ParsedTransactionWithMeta;

      const createEvents = parser.parseTransaction('sig1', createTx);
      const fulfillEvents = parser.parseTransaction('sig2', fulfillTx);

      expect(createEvents).toHaveLength(1);
      expect(fulfillEvents).toHaveLength(1);
      expect(createEvents[0].eventType).toBe(DlnEventType.OrderCreated);
      expect(fulfillEvents[0].eventType).toBe(DlnEventType.OrderFulfilled);
      
      // Both events reference the same order
      expect(createEvents[0].orderId).toBe(fulfillEvents[0].orderId);
    });

    it('should handle concurrent parsing of multiple transactions', () => {
      const transactions = [
        orderCreatedTx,
        orderFulfilledTx,
        complexOrderCreatedTx,
      ];

      const allEvents = transactions.map((tx, idx) => 
        parser.parseTransaction(`sig${idx}`, tx as unknown as ParsedTransactionWithMeta)
      );

      expect(allEvents).toHaveLength(3);
      allEvents.forEach(events => {
        expect(events.length).toBeGreaterThan(0);
      });
    });
  });
});
