import { describe, it, expect } from 'vitest';
import { extractOrderIdFromLogs } from '../src/dln-event-parser.js';

describe('extractOrderIdFromLogs', () => {
  describe('successful extraction', () => {
    it('should extract orderId from standard format with 0x prefix', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: OrderId: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        'Program log: Order created successfully',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    });

    it('should extract orderId without 0x prefix', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: OrderId: abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        'Program log: Order created successfully',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    });

    it('should extract orderId from "Order created:" format', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: Order created: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    });

    it('should extract orderId from "Order fulfilled:" format', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: Order fulfilled: 0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321');
    });

    it('should extract orderId with JSON-style format', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: {"orderId": "0xaabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344"}',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344');
    });

    it('should handle uppercase hex characters', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: OrderId: 0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    });

    it('should extract first orderId when multiple matches exist', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: OrderId: 0x1111111111111111111111111111111111111111111111111111111111111111',
        'Program log: Related order: 0x2222222222222222222222222222222222222222222222222222222222222222',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('1111111111111111111111111111111111111111111111111111111111111111');
    });

    it('should handle mixed case in log messages', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: ORDERID: 0xCcDdEeFf00112233CcDdEeFf00112233CcDdEeFf00112233CcDdEeFf00112233',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('ccddeeff00112233ccddeeff00112233ccddeeff00112233ccddeeff00112233');
    });

    it('should handle orderid with equals sign', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: orderId=0x9999999999999999999999999999999999999999999999999999999999999999',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('9999999999999999999999999999999999999999999999999999999999999999');
    });
  });

  describe('failed extraction', () => {
    it('should return null when no orderId present', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: Instruction: UpdateConfig',
        'Program log: Config updated successfully',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBeNull();
    });

    it('should return null for empty logs', () => {
      const logs: string[] = [];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBeNull();
    });

    it('should return null when orderId is too short', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: OrderId: 0x123',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBeNull();
    });

    it('should return null when orderId is too long', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: OrderId: 0x12345678901234567890123456789012345678901234567890123456789012345678',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBeNull();
    });

    it('should return null when orderId contains invalid characters', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: OrderId: 0xghijklmnopqrstuv1234567890123456789012345678901234567890123456',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBeNull();
    });

    it('should return null for logs with only whitespace', () => {
      const logs = ['   ', '\t', '\n'];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBeNull();
    });

    it('should return null when keyword is present but no valid hex', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: OrderId: invalid',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle logs with special characters and unicode', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: 🚀 OrderId: 0x5555555555555555555555555555555555555555555555555555555555555555',
        'Program log: Success ✓',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('5555555555555555555555555555555555555555555555555555555555555555');
    });

    it('should handle logs with multiple lines and spacing', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: Order created',
        'Program log:    OrderId:   0x7777777777777777777777777777777777777777777777777777777777777777   ',
        'Program log: Success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('7777777777777777777777777777777777777777777777777777777777777777');
    });

    it('should work with real-world complex log structure', () => {
      const logs = [
        'Program DLNProg11111111111111111111111111111111111 invoke [1]',
        'Program log: Instruction: CreateOrder',
        'Program log: OrderId: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        'Program log: Maker: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        'Program log: Give amount: 1000000000',
        'Program log: Take amount: 500000000',
        'Program DLNProg11111111111111111111111111111111111 consumed 35000 of 200000 compute units',
        'Program DLNProg11111111111111111111111111111111111 success',
      ];

      const orderId = extractOrderIdFromLogs(logs);
      expect(orderId).toBe('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    });
  });
});
