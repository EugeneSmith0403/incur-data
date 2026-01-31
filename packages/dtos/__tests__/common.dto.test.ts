import { describe, it, expect } from 'vitest';
import {
  timestampSchema,
  paginationSchema,
  paginatedResponseSchema,
  chainIdSchema,
  transactionStatusSchema,
} from '../src/common.dto.js';
import { z } from 'zod';

describe('timestampSchema', () => {
  it('should validate with Date object for createdAt', () => {
    const timestamp = {
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };
    const result = timestampSchema.safeParse(timestamp);
    expect(result.success).toBe(true);
  });

  it('should validate with ISO string for createdAt', () => {
    const timestamp = {
      createdAt: '2024-01-01T00:00:00Z',
    };
    const result = timestampSchema.safeParse(timestamp);
    expect(result.success).toBe(true);
  });

  it('should require createdAt', () => {
    const timestamp = {};
    const result = timestampSchema.safeParse(timestamp);
    expect(result.success).toBe(false);
  });

  it('should accept optional updatedAt as Date', () => {
    const timestamp = {
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
    };
    const result = timestampSchema.safeParse(timestamp);
    expect(result.success).toBe(true);
  });

  it('should accept optional updatedAt as ISO string', () => {
    const timestamp = {
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    };
    const result = timestampSchema.safeParse(timestamp);
    expect(result.success).toBe(true);
  });

  it('should work without updatedAt', () => {
    const timestamp = {
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };
    const result = timestampSchema.safeParse(timestamp);
    expect(result.success).toBe(true);
  });

  it('should reject invalid datetime string', () => {
    const timestamp = {
      createdAt: 'not-a-date',
    };
    const result = timestampSchema.safeParse(timestamp);
    expect(result.success).toBe(false);
  });

  it('should reject numeric timestamp', () => {
    const timestamp = {
      createdAt: 1704067200,
    };
    const result = timestampSchema.safeParse(timestamp);
    expect(result.success).toBe(false);
  });
});

describe('paginationSchema', () => {
  describe('defaults', () => {
    it('should apply default values', () => {
      const pagination = {};
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
        expect(result.data.sortOrder).toBe('desc');
      }
    });
  });

  describe('page validation', () => {
    it('should accept valid page number', () => {
      const pagination = { page: 5 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
      }
    });

    it('should coerce string to number', () => {
      const pagination = { page: '5' };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(typeof result.data.page).toBe('number');
      }
    });

    it('should reject page 0', () => {
      const pagination = { page: 0 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(false);
    });

    it('should reject negative page', () => {
      const pagination = { page: -1 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(false);
    });

    it('should reject decimal page', () => {
      const pagination = { page: 1.5 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(false);
    });
  });

  describe('pageSize validation', () => {
    it('should accept valid pageSize', () => {
      const pagination = { pageSize: 50 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pageSize).toBe(50);
      }
    });

    it('should coerce string to number', () => {
      const pagination = { pageSize: '50' };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pageSize).toBe(50);
        expect(typeof result.data.pageSize).toBe('number');
      }
    });

    it('should enforce max pageSize of 100', () => {
      const pagination = { pageSize: 101 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(false);
    });

    it('should accept pageSize of 100', () => {
      const pagination = { pageSize: 100 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
    });

    it('should reject pageSize 0', () => {
      const pagination = { pageSize: 0 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(false);
    });

    it('should reject negative pageSize', () => {
      const pagination = { pageSize: -1 };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(false);
    });
  });

  describe('sortBy and sortOrder', () => {
    it('should accept sortBy', () => {
      const pagination = { sortBy: 'createdAt' };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe('createdAt');
      }
    });

    it('should make sortBy optional', () => {
      const pagination = {};
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBeUndefined();
      }
    });

    it('should accept asc sortOrder', () => {
      const pagination = { sortOrder: 'asc' as const };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortOrder).toBe('asc');
      }
    });

    it('should accept desc sortOrder', () => {
      const pagination = { sortOrder: 'desc' as const };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should reject invalid sortOrder', () => {
      const pagination = { sortOrder: 'invalid' };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(false);
    });
  });

  describe('complete pagination', () => {
    it('should validate full pagination object', () => {
      const pagination = {
        page: 3,
        pageSize: 50,
        sortBy: 'createdAt',
        sortOrder: 'asc' as const,
      };
      const result = paginationSchema.safeParse(pagination);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(pagination);
      }
    });
  });
});

describe('paginatedResponseSchema', () => {
  const itemSchema = z.object({
    id: z.string(),
    name: z.string(),
  });
  const responseSchema = paginatedResponseSchema(itemSchema);

  it('should validate valid paginated response', () => {
    const response = {
      items: [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ],
      total: 100,
      page: 1,
      pageSize: 20,
      totalPages: 5,
    };
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should require items array', () => {
    const response = {
      total: 100,
      page: 1,
      pageSize: 20,
      totalPages: 5,
    };
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should validate items against provided schema', () => {
    const response = {
      items: [
        { id: '1', name: 'Item 1' },
        { id: '2' }, // Missing name
      ],
      total: 100,
      page: 1,
      pageSize: 20,
      totalPages: 5,
    };
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should accept empty items array', () => {
    const response = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('should require total as non-negative integer', () => {
    const response = {
      items: [],
      total: -1,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should require page as positive integer', () => {
    const response = {
      items: [],
      total: 0,
      page: 0,
      pageSize: 20,
      totalPages: 0,
    };
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should require pageSize as positive integer', () => {
    const response = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 0,
      totalPages: 0,
    };
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('should require totalPages as non-negative integer', () => {
    const response = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: -1,
    };
    const result = responseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });
});

describe('chainIdSchema', () => {
  describe('predefined chains', () => {
    it('should accept solana', () => {
      const result = chainIdSchema.safeParse('solana');
      expect(result.success).toBe(true);
    });

    it('should accept ethereum', () => {
      const result = chainIdSchema.safeParse('ethereum');
      expect(result.success).toBe(true);
    });

    it('should accept arbitrum', () => {
      const result = chainIdSchema.safeParse('arbitrum');
      expect(result.success).toBe(true);
    });

    it('should accept polygon', () => {
      const result = chainIdSchema.safeParse('polygon');
      expect(result.success).toBe(true);
    });

    it('should accept bsc', () => {
      const result = chainIdSchema.safeParse('bsc');
      expect(result.success).toBe(true);
    });
  });

  describe('custom chains', () => {
    it('should accept custom chain ID strings', () => {
      const customChains = [
        'chain-1',
        'chain-7565164',
        'optimism',
        'avalanche',
        'fantom',
      ];

      customChains.forEach(chain => {
        const result = chainIdSchema.safeParse(chain);
        expect(result.success).toBe(true);
      });
    });

    it('should accept numeric-looking chain IDs', () => {
      const result = chainIdSchema.safeParse('1');
      expect(result.success).toBe(true);
    });

    it('should accept chain IDs with special characters', () => {
      const chains = ['chain-1', 'chain_7565164', 'chain.56'];
      
      chains.forEach(chain => {
        const result = chainIdSchema.safeParse(chain);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('invalid chains', () => {
    it('should reject empty string', () => {
      const result = chainIdSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject non-string values', () => {
      const invalidValues = [null, undefined, 123, true, {}, []];
      
      invalidValues.forEach(value => {
        const result = chainIdSchema.safeParse(value);
        expect(result.success).toBe(false);
      });
    });
  });
});

describe('transactionStatusSchema', () => {
  it('should accept pending status', () => {
    const result = transactionStatusSchema.safeParse('pending');
    expect(result.success).toBe(true);
  });

  it('should accept confirmed status', () => {
    const result = transactionStatusSchema.safeParse('confirmed');
    expect(result.success).toBe(true);
  });

  it('should accept finalized status', () => {
    const result = transactionStatusSchema.safeParse('finalized');
    expect(result.success).toBe(true);
  });

  it('should accept failed status', () => {
    const result = transactionStatusSchema.safeParse('failed');
    expect(result.success).toBe(true);
  });

  it('should accept cancelled status', () => {
    const result = transactionStatusSchema.safeParse('cancelled');
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const invalidStatuses = [
      'created',
      'processing',
      'completed',
      'success',
      'error',
      '',
    ];

    invalidStatuses.forEach(status => {
      const result = transactionStatusSchema.safeParse(status);
      expect(result.success).toBe(false);
    });
  });

  it('should reject non-string values', () => {
    const invalidValues = [null, undefined, 123, true, {}, []];
    
    invalidValues.forEach(value => {
      const result = transactionStatusSchema.safeParse(value);
      expect(result.success).toBe(false);
    });
  });

  it('should be case-sensitive', () => {
    const result = transactionStatusSchema.safeParse('CONFIRMED');
    expect(result.success).toBe(false);
  });
});
