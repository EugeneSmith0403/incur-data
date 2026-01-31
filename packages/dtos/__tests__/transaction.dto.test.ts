import { describe, it, expect } from 'vitest';
import {
  transactionDtoSchema,
  transactionFiltersSchema,
  transactionStatsSchema,
  txIngestMessageSchema,
  createTxIngestMessage,
  type TransactionDto,
  type TxIngestMessage,
} from '../src/transaction.dto.js';

describe('transactionDtoSchema', () => {
  const validTransaction: TransactionDto = {
    signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
    slot: 234567890,
    blockTime: 1704067200,
    status: 'confirmed',
    fee: '5000',
    programId: 'DLNProg11111111111111111111111111111111111',
    accounts: [
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    ],
    instructions: [
      {
        programId: 'DLNProg11111111111111111111111111111111111',
        accounts: ['9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'],
        data: '3Bxs4h24hBtQy9rw',
      },
    ],
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };

  describe('required fields', () => {
    it('should validate a complete valid transaction', () => {
      const result = transactionDtoSchema.safeParse(validTransaction);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.signature).toBe(validTransaction.signature);
        expect(result.data.slot).toBe(validTransaction.slot);
      }
    });

    it('should require signature', () => {
      const { signature, ...txWithoutSig } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutSig);
      expect(result.success).toBe(false);
    });

    it('should reject empty signature', () => {
      const txWithEmptySig = { ...validTransaction, signature: '' };
      const result = transactionDtoSchema.safeParse(txWithEmptySig);
      expect(result.success).toBe(false);
    });

    it('should require slot as positive integer', () => {
      const { slot, ...txWithoutSlot } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutSlot);
      expect(result.success).toBe(false);
    });

    it('should reject negative slot', () => {
      const txWithNegativeSlot = { ...validTransaction, slot: -1 };
      const result = transactionDtoSchema.safeParse(txWithNegativeSlot);
      expect(result.success).toBe(false);
    });

    it('should reject zero slot', () => {
      const txWithZeroSlot = { ...validTransaction, slot: 0 };
      const result = transactionDtoSchema.safeParse(txWithZeroSlot);
      expect(result.success).toBe(false);
    });

    it('should require blockTime as positive integer', () => {
      const { blockTime, ...txWithoutTime } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutTime);
      expect(result.success).toBe(false);
    });

    it('should require status', () => {
      const { status, ...txWithoutStatus } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutStatus);
      expect(result.success).toBe(false);
    });

    it('should require fee as string', () => {
      const { fee, ...txWithoutFee } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutFee);
      expect(result.success).toBe(false);
    });

    it('should reject numeric fee', () => {
      const txWithNumericFee = { ...validTransaction, fee: 5000 };
      const result = transactionDtoSchema.safeParse(txWithNumericFee);
      expect(result.success).toBe(false);
    });

    it('should require programId', () => {
      const { programId, ...txWithoutProgram } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutProgram);
      expect(result.success).toBe(false);
    });

    it('should require accounts array', () => {
      const { accounts, ...txWithoutAccounts } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutAccounts);
      expect(result.success).toBe(false);
    });

    it('should require instructions array', () => {
      const { instructions, ...txWithoutInstructions } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutInstructions);
      expect(result.success).toBe(false);
    });

    it('should require createdAt', () => {
      const { createdAt, ...txWithoutTimestamp } = validTransaction;
      const result = transactionDtoSchema.safeParse(txWithoutTimestamp);
      expect(result.success).toBe(false);
    });
  });

  describe('optional fields', () => {
    it('should accept transaction with logs', () => {
      const txWithLogs = {
        ...validTransaction,
        logs: [
          'Program DLNProg11111111111111111111111111111111111 invoke [1]',
          'Program log: Success',
        ],
      };
      const result = transactionDtoSchema.safeParse(txWithLogs);
      expect(result.success).toBe(true);
    });

    it('should accept transaction with error', () => {
      const txWithError = {
        ...validTransaction,
        status: 'failed' as const,
        error: '{"InstructionError":[0,{"Custom":6000}]}',
      };
      const result = transactionDtoSchema.safeParse(txWithError);
      expect(result.success).toBe(true);
    });

    it('should accept transaction with processedAt', () => {
      const txWithProcessedAt = {
        ...validTransaction,
        processedAt: new Date('2024-01-01T00:01:00Z'),
      };
      const result = transactionDtoSchema.safeParse(txWithProcessedAt);
      expect(result.success).toBe(true);
    });

    it('should accept transaction with updatedAt', () => {
      const txWithUpdatedAt = {
        ...validTransaction,
        updatedAt: new Date('2024-01-01T00:02:00Z'),
      };
      const result = transactionDtoSchema.safeParse(txWithUpdatedAt);
      expect(result.success).toBe(true);
    });
  });

  describe('status validation', () => {
    it('should accept valid status values', () => {
      const statuses: Array<'pending' | 'confirmed' | 'finalized' | 'failed' | 'cancelled'> = [
        'pending',
        'confirmed',
        'finalized',
        'failed',
        'cancelled',
      ];

      statuses.forEach(status => {
        const txWithStatus = { ...validTransaction, status };
        const result = transactionDtoSchema.safeParse(txWithStatus);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status', () => {
      const txWithInvalidStatus = { ...validTransaction, status: 'unknown' };
      const result = transactionDtoSchema.safeParse(txWithInvalidStatus);
      expect(result.success).toBe(false);
    });
  });

  describe('arrays validation', () => {
    it('should accept empty accounts array', () => {
      const txWithEmptyAccounts = { ...validTransaction, accounts: [] };
      const result = transactionDtoSchema.safeParse(txWithEmptyAccounts);
      expect(result.success).toBe(true);
    });

    it('should accept empty instructions array', () => {
      const txWithEmptyInstructions = { ...validTransaction, instructions: [] };
      const result = transactionDtoSchema.safeParse(txWithEmptyInstructions);
      expect(result.success).toBe(true);
    });

    it('should reject non-array accounts', () => {
      const txWithInvalidAccounts = { ...validTransaction, accounts: 'not-an-array' };
      const result = transactionDtoSchema.safeParse(txWithInvalidAccounts);
      expect(result.success).toBe(false);
    });

    it('should validate instruction structure', () => {
      const txWithValidInstruction = {
        ...validTransaction,
        instructions: [
          {
            programId: 'Program123',
            accounts: ['Account1', 'Account2'],
            data: 'SomeData',
          },
        ],
      };
      const result = transactionDtoSchema.safeParse(txWithValidInstruction);
      expect(result.success).toBe(true);
    });

    it('should reject invalid instruction structure', () => {
      const txWithInvalidInstruction = {
        ...validTransaction,
        instructions: [
          {
            programId: 'Program123',
            // missing accounts and data
          },
        ],
      };
      const result = transactionDtoSchema.safeParse(txWithInvalidInstruction);
      expect(result.success).toBe(false);
    });
  });

  describe('datetime handling', () => {
    it('should accept Date object for createdAt', () => {
      const txWithDate = {
        ...validTransaction,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };
      const result = transactionDtoSchema.safeParse(txWithDate);
      expect(result.success).toBe(true);
    });

    it('should accept ISO string for createdAt', () => {
      const txWithString = {
        ...validTransaction,
        createdAt: '2024-01-01T00:00:00Z',
      };
      const result = transactionDtoSchema.safeParse(txWithString);
      expect(result.success).toBe(true);
    });

    it('should reject invalid datetime string', () => {
      const txWithInvalidDate = {
        ...validTransaction,
        createdAt: 'not-a-date',
      };
      const result = transactionDtoSchema.safeParse(txWithInvalidDate);
      expect(result.success).toBe(false);
    });
  });
});

describe('transactionFiltersSchema', () => {
  it('should validate empty filters', () => {
    const result = transactionFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should validate filter by signature', () => {
    const filters = {
      signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
    };
    const result = transactionFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should validate filter by programId', () => {
    const filters = {
      programId: 'DLNProg11111111111111111111111111111111111',
    };
    const result = transactionFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should validate filter by status', () => {
    const filters = {
      status: 'confirmed' as const,
    };
    const result = transactionFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should validate slot range filters', () => {
    const filters = {
      fromSlot: 234567000,
      toSlot: 234568000,
    };
    const result = transactionFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should validate blockTime range filters', () => {
    const filters = {
      fromBlockTime: 1704067000,
      toBlockTime: 1704067200,
    };
    const result = transactionFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should validate filter by account', () => {
    const filters = {
      account: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    };
    const result = transactionFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should coerce string numbers to integers', () => {
    const filters = {
      fromSlot: '234567000',
      toSlot: '234568000',
    };
    const result = transactionFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.fromSlot).toBe('number');
      expect(typeof result.data.toSlot).toBe('number');
    }
  });

  it('should reject negative slot numbers', () => {
    const filters = {
      fromSlot: -1,
    };
    const result = transactionFiltersSchema.safeParse(filters);
    expect(result.success).toBe(false);
  });
});

describe('transactionStatsSchema', () => {
  const validStats = {
    totalTransactions: 10000,
    confirmedTransactions: 9500,
    failedTransactions: 500,
    totalFees: '50000000',
    avgProcessingTime: 2.5,
    transactionsPerSecond: 15.5,
    period: {
      from: new Date('2024-01-01T00:00:00Z'),
      to: new Date('2024-01-31T23:59:59Z'),
    },
  };

  it('should validate valid transaction stats', () => {
    const result = transactionStatsSchema.safeParse(validStats);
    expect(result.success).toBe(true);
  });

  it('should require all count fields', () => {
    const { totalTransactions, ...incomplete } = validStats;
    const result = transactionStatsSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('should reject negative counts', () => {
    const statsWithNegative = { ...validStats, totalTransactions: -1 };
    const result = transactionStatsSchema.safeParse(statsWithNegative);
    expect(result.success).toBe(false);
  });

  it('should accept zero counts', () => {
    const statsWithZero = { ...validStats, failedTransactions: 0 };
    const result = transactionStatsSchema.safeParse(statsWithZero);
    expect(result.success).toBe(true);
  });

  it('should require totalFees as string', () => {
    const statsWithNumberFees = { ...validStats, totalFees: 50000000 };
    const result = transactionStatsSchema.safeParse(statsWithNumberFees);
    expect(result.success).toBe(false);
  });

  it('should reject negative avgProcessingTime', () => {
    const statsWithNegativeTime = { ...validStats, avgProcessingTime: -1 };
    const result = transactionStatsSchema.safeParse(statsWithNegativeTime);
    expect(result.success).toBe(false);
  });

  it('should accept decimal values for timing metrics', () => {
    const statsWithDecimals = {
      ...validStats,
      avgProcessingTime: 2.567,
      transactionsPerSecond: 15.234,
    };
    const result = transactionStatsSchema.safeParse(statsWithDecimals);
    expect(result.success).toBe(true);
  });
});

describe('txIngestMessageSchema', () => {
  const validMessage: TxIngestMessage = {
    signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
    slot: 234567890,
    blockTime: 1704067200,
    source: 'realtime',
    programId: 'DLNProg11111111111111111111111111111111111',
    enqueuedAt: '2024-01-01T00:00:00Z',
    attempt: 0,
    priority: 'normal',
  };

  describe('required fields', () => {
    it('should validate a complete valid message', () => {
      const result = txIngestMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should require signature', () => {
      const { signature, ...msgWithoutSig } = validMessage;
      const result = txIngestMessageSchema.safeParse(msgWithoutSig);
      expect(result.success).toBe(false);
    });

    it('should enforce max signature length of 128', () => {
      const msgWithLongSig = {
        ...validMessage,
        signature: 'a'.repeat(129),
      };
      const result = txIngestMessageSchema.safeParse(msgWithLongSig);
      expect(result.success).toBe(false);
    });

    it('should require slot as positive integer', () => {
      const { slot, ...msgWithoutSlot } = validMessage;
      const result = txIngestMessageSchema.safeParse(msgWithoutSlot);
      expect(result.success).toBe(false);
    });

    it('should require source', () => {
      const { source, ...msgWithoutSource } = validMessage;
      const result = txIngestMessageSchema.safeParse(msgWithoutSource);
      expect(result.success).toBe(false);
    });

    it('should only accept "history" or "realtime" for source', () => {
      const sources: Array<'history' | 'realtime'> = ['history', 'realtime'];

      sources.forEach(source => {
        const msgWithSource = { ...validMessage, source };
        const result = txIngestMessageSchema.safeParse(msgWithSource);
        expect(result.success).toBe(true);
      });

      const msgWithInvalidSource = { ...validMessage, source: 'invalid' };
      const result = txIngestMessageSchema.safeParse(msgWithInvalidSource);
      expect(result.success).toBe(false);
    });

    it('should require programId', () => {
      const { programId, ...msgWithoutProgram } = validMessage;
      const result = txIngestMessageSchema.safeParse(msgWithoutProgram);
      expect(result.success).toBe(false);
    });

    it('should enforce max programId length of 64', () => {
      const msgWithLongProgramId = {
        ...validMessage,
        programId: 'a'.repeat(65),
      };
      const result = txIngestMessageSchema.safeParse(msgWithLongProgramId);
      expect(result.success).toBe(false);
    });

    it('should require enqueuedAt as datetime string', () => {
      const { enqueuedAt, ...msgWithoutEnqueued } = validMessage;
      const result = txIngestMessageSchema.safeParse(msgWithoutEnqueued);
      expect(result.success).toBe(false);
    });
  });

  describe('optional fields with defaults', () => {
    it('should default attempt to 0', () => {
      const { attempt, ...msgWithoutAttempt } = validMessage;
      const result = txIngestMessageSchema.safeParse(msgWithoutAttempt);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.attempt).toBe(0);
      }
    });

    it('should default priority to normal', () => {
      const { priority, ...msgWithoutPriority } = validMessage;
      const result = txIngestMessageSchema.safeParse(msgWithoutPriority);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('normal');
      }
    });

    it('should accept custom attempt value', () => {
      const msgWithAttempt = { ...validMessage, attempt: 3 };
      const result = txIngestMessageSchema.safeParse(msgWithAttempt);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.attempt).toBe(3);
      }
    });

    it('should accept all priority levels', () => {
      const priorities: Array<'low' | 'normal' | 'high'> = ['low', 'normal', 'high'];

      priorities.forEach(priority => {
        const msgWithPriority = { ...validMessage, priority };
        const result = txIngestMessageSchema.safeParse(msgWithPriority);
        expect(result.success).toBe(true);
      });
    });

    it('should make blockTime optional', () => {
      const { blockTime, ...msgWithoutBlockTime } = validMessage;
      const result = txIngestMessageSchema.safeParse(msgWithoutBlockTime);
      expect(result.success).toBe(true);
    });
  });

  describe('field validation', () => {
    it('should reject negative attempt', () => {
      const msgWithNegativeAttempt = { ...validMessage, attempt: -1 };
      const result = txIngestMessageSchema.safeParse(msgWithNegativeAttempt);
      expect(result.success).toBe(false);
    });

    it('should reject decimal attempt', () => {
      const msgWithDecimalAttempt = { ...validMessage, attempt: 1.5 };
      const result = txIngestMessageSchema.safeParse(msgWithDecimalAttempt);
      expect(result.success).toBe(false);
    });

    it('should reject invalid datetime for enqueuedAt', () => {
      const msgWithInvalidDate = { ...validMessage, enqueuedAt: 'not-a-date' };
      const result = txIngestMessageSchema.safeParse(msgWithInvalidDate);
      expect(result.success).toBe(false);
    });
  });
});

describe('createTxIngestMessage', () => {
  it('should create a valid message with defaults', () => {
    const params = {
      signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
      slot: 234567890,
      blockTime: 1704067200,
      source: 'realtime' as const,
      programId: 'DLNProg11111111111111111111111111111111111',
    };

    const message = createTxIngestMessage(params);

    expect(message.signature).toBe(params.signature);
    expect(message.slot).toBe(params.slot);
    expect(message.source).toBe(params.source);
    expect(message.programId).toBe(params.programId);
    expect(message.attempt).toBe(0);
    expect(message.priority).toBe('normal');
    expect(message.enqueuedAt).toBeDefined();
  });

  it('should create message with custom priority', () => {
    const params = {
      signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
      slot: 234567890,
      source: 'history' as const,
      programId: 'DLNProg11111111111111111111111111111111111',
      priority: 'high' as const,
    };

    const message = createTxIngestMessage(params);

    expect(message.priority).toBe('high');
  });

  it('should create message without blockTime', () => {
    const params = {
      signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
      slot: 234567890,
      source: 'realtime' as const,
      programId: 'DLNProg11111111111111111111111111111111111',
    };

    const message = createTxIngestMessage(params);

    expect(message.blockTime).toBeUndefined();
  });

  it('should generate valid ISO datetime for enqueuedAt', () => {
    const params = {
      signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
      slot: 234567890,
      source: 'realtime' as const,
      programId: 'DLNProg11111111111111111111111111111111111',
    };

    const message = createTxIngestMessage(params);

    // Should be a valid ISO datetime string
    expect(message.enqueuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    
    // Should be parseable as a date
    const date = new Date(message.enqueuedAt);
    expect(date.toString()).not.toBe('Invalid Date');
  });

  it('should throw on invalid data', () => {
    const invalidParams = {
      signature: '', // Empty signature should fail
      slot: 234567890,
      source: 'realtime' as const,
      programId: 'DLNProg11111111111111111111111111111111111',
    };

    expect(() => createTxIngestMessage(invalidParams)).toThrow();
  });
});
