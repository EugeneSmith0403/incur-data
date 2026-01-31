import { describe, it, expect } from 'vitest';
import {
  orderDtoSchema,
  orderStatusSchema,
  orderFiltersSchema,
  orderStatsSchema,
  type OrderDto,
  type OrderStatus,
} from '../src/order.dto.js';

describe('orderStatusSchema', () => {
  it('should validate valid order statuses', () => {
    const validStatuses: OrderStatus[] = ['created', 'fulfilled', 'cancelled', 'claimed', 'expired'];
    
    validStatuses.forEach(status => {
      const result = orderStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid order statuses', () => {
    const invalidStatuses = ['pending', 'active', 'completed', 'failed', ''];
    
    invalidStatuses.forEach(status => {
      const result = orderStatusSchema.safeParse(status);
      expect(result.success).toBe(false);
    });
  });
});

describe('orderDtoSchema', () => {
  const validOrder: OrderDto = {
    orderId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    signature: '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7',
    maker: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    giveChainId: 'solana',
    takeChainId: 'ethereum',
    giveTokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    takeTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    giveAmount: '1000000000',
    takeAmount: '95000000',
    status: 'created',
    createdSlot: 234567890,
    createdAt: new Date('2024-01-01T00:00:00Z'),
  };

  describe('required fields', () => {
    it('should validate a complete valid order', () => {
      const result = orderDtoSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderId).toBe(validOrder.orderId);
        expect(result.data.signature).toBe(validOrder.signature);
      }
    });

    it('should require orderId', () => {
      const { orderId, ...orderWithoutId } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutId);
      expect(result.success).toBe(false);
    });

    it('should reject empty orderId', () => {
      const orderWithEmptyId = { ...validOrder, orderId: '' };
      const result = orderDtoSchema.safeParse(orderWithEmptyId);
      expect(result.success).toBe(false);
    });

    it('should require signature', () => {
      const { signature, ...orderWithoutSig } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutSig);
      expect(result.success).toBe(false);
    });

    it('should reject empty signature', () => {
      const orderWithEmptySig = { ...validOrder, signature: '' };
      const result = orderDtoSchema.safeParse(orderWithEmptySig);
      expect(result.success).toBe(false);
    });

    it('should require maker', () => {
      const { maker, ...orderWithoutMaker } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutMaker);
      expect(result.success).toBe(false);
    });

    it('should require giveChainId', () => {
      const { giveChainId, ...orderWithoutChain } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutChain);
      expect(result.success).toBe(false);
    });

    it('should require takeChainId', () => {
      const { takeChainId, ...orderWithoutChain } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutChain);
      expect(result.success).toBe(false);
    });

    it('should require giveTokenAddress', () => {
      const { giveTokenAddress, ...orderWithoutToken } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutToken);
      expect(result.success).toBe(false);
    });

    it('should require takeTokenAddress', () => {
      const { takeTokenAddress, ...orderWithoutToken } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutToken);
      expect(result.success).toBe(false);
    });

    it('should require giveAmount as string', () => {
      const { giveAmount, ...orderWithoutAmount } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutAmount);
      expect(result.success).toBe(false);
    });

    it('should require takeAmount as string', () => {
      const { takeAmount, ...orderWithoutAmount } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutAmount);
      expect(result.success).toBe(false);
    });

    it('should require status', () => {
      const { status, ...orderWithoutStatus } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutStatus);
      expect(result.success).toBe(false);
    });

    it('should require createdSlot as positive integer', () => {
      const { createdSlot, ...orderWithoutSlot } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutSlot);
      expect(result.success).toBe(false);
    });

    it('should require createdAt', () => {
      const { createdAt, ...orderWithoutTimestamp } = validOrder;
      const result = orderDtoSchema.safeParse(orderWithoutTimestamp);
      expect(result.success).toBe(false);
    });
  });

  describe('optional fields', () => {
    it('should accept order without taker', () => {
      const result = orderDtoSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it('should accept order with taker', () => {
      const orderWithTaker = {
        ...validOrder,
        taker: '7XawhbbxtsRcQA8KTkHT9f9nc6d69UwqCDh6U5EEbEmX',
      };
      const result = orderDtoSchema.safeParse(orderWithTaker);
      expect(result.success).toBe(true);
    });

    it('should accept order with USD amounts', () => {
      const orderWithUsd = {
        ...validOrder,
        giveAmountUsd: '100.50',
        takeAmountUsd: '95.25',
      };
      const result = orderDtoSchema.safeParse(orderWithUsd);
      expect(result.success).toBe(true);
    });

    it('should accept order with fulfilledSlot', () => {
      const orderWithFulfilled = {
        ...validOrder,
        status: 'fulfilled' as const,
        fulfilledSlot: 234568000,
      };
      const result = orderDtoSchema.safeParse(orderWithFulfilled);
      expect(result.success).toBe(true);
    });

    it('should accept order with expirySlot', () => {
      const orderWithExpiry = {
        ...validOrder,
        expirySlot: 234600000,
      };
      const result = orderDtoSchema.safeParse(orderWithExpiry);
      expect(result.success).toBe(true);
    });

    it('should accept order with affiliateFee', () => {
      const orderWithFee = {
        ...validOrder,
        affiliateFee: '500000',
      };
      const result = orderDtoSchema.safeParse(orderWithFee);
      expect(result.success).toBe(true);
    });

    it('should accept order with allowedTaker', () => {
      const orderWithAllowed = {
        ...validOrder,
        allowedTaker: '5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG',
      };
      const result = orderDtoSchema.safeParse(orderWithAllowed);
      expect(result.success).toBe(true);
    });

    it('should accept order with allowedCancelBeneficiary', () => {
      const orderWithBeneficiary = {
        ...validOrder,
        allowedCancelBeneficiary: '8YZj8b2g9UljCFTIKhsLnYtxreZ0TZdgbshpBrQrB',
      };
      const result = orderDtoSchema.safeParse(orderWithBeneficiary);
      expect(result.success).toBe(true);
    });

    it('should accept order with externalCall', () => {
      const orderWithCall = {
        ...validOrder,
        externalCall: '0x1234567890abcdef',
      };
      const result = orderDtoSchema.safeParse(orderWithCall);
      expect(result.success).toBe(true);
    });

    it('should accept order with updatedAt', () => {
      const orderWithUpdated = {
        ...validOrder,
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };
      const result = orderDtoSchema.safeParse(orderWithUpdated);
      expect(result.success).toBe(true);
    });
  });

  describe('field validation', () => {
    it('should reject non-string amounts', () => {
      const orderWithNumberAmount = { ...validOrder, giveAmount: 1000000000 };
      const result = orderDtoSchema.safeParse(orderWithNumberAmount);
      expect(result.success).toBe(false);
    });

    it('should reject negative createdSlot', () => {
      const orderWithNegativeSlot = { ...validOrder, createdSlot: -1 };
      const result = orderDtoSchema.safeParse(orderWithNegativeSlot);
      expect(result.success).toBe(false);
    });

    it('should reject zero createdSlot', () => {
      const orderWithZeroSlot = { ...validOrder, createdSlot: 0 };
      const result = orderDtoSchema.safeParse(orderWithZeroSlot);
      expect(result.success).toBe(false);
    });

    it('should reject decimal createdSlot', () => {
      const orderWithDecimalSlot = { ...validOrder, createdSlot: 123.45 };
      const result = orderDtoSchema.safeParse(orderWithDecimalSlot);
      expect(result.success).toBe(false);
    });

    it('should accept string datetime for createdAt', () => {
      const orderWithStringDate = {
        ...validOrder,
        createdAt: '2024-01-01T00:00:00Z',
      };
      const result = orderDtoSchema.safeParse(orderWithStringDate);
      expect(result.success).toBe(true);
    });

    it('should reject invalid datetime string', () => {
      const orderWithInvalidDate = {
        ...validOrder,
        createdAt: 'not-a-date',
      };
      const result = orderDtoSchema.safeParse(orderWithInvalidDate);
      expect(result.success).toBe(false);
    });

    it('should accept large amount strings', () => {
      const orderWithLargeAmounts = {
        ...validOrder,
        giveAmount: '999999999999999999999999',
        takeAmount: '888888888888888888888888',
      };
      const result = orderDtoSchema.safeParse(orderWithLargeAmounts);
      expect(result.success).toBe(true);
    });
  });

  describe('chainId validation', () => {
    it('should accept standard chain IDs', () => {
      const chains = ['solana', 'ethereum', 'arbitrum', 'polygon', 'bsc'];
      
      chains.forEach(chain => {
        const orderWithChain = { ...validOrder, giveChainId: chain };
        const result = orderDtoSchema.safeParse(orderWithChain);
        expect(result.success).toBe(true);
      });
    });

    it('should accept custom chain IDs', () => {
      const orderWithCustomChain = {
        ...validOrder,
        giveChainId: 'chain-7565164',
        takeChainId: 'chain-1',
      };
      const result = orderDtoSchema.safeParse(orderWithCustomChain);
      expect(result.success).toBe(true);
    });
  });
});

describe('orderFiltersSchema', () => {
  it('should validate empty filters', () => {
    const result = orderFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should validate filter by orderId', () => {
    const filters = {
      orderId: '0xabcdef1234567890',
    };
    const result = orderFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should validate filter by maker', () => {
    const filters = {
      maker: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    };
    const result = orderFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should validate filter by status', () => {
    const filters = {
      status: 'fulfilled' as const,
    };
    const result = orderFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should validate slot range filters', () => {
    const filters = {
      fromSlot: 234567000,
      toSlot: 234568000,
    };
    const result = orderFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });

  it('should coerce string numbers to integers', () => {
    const filters = {
      fromSlot: '234567000',
      toSlot: '234568000',
    };
    const result = orderFiltersSchema.safeParse(filters);
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
    const result = orderFiltersSchema.safeParse(filters);
    expect(result.success).toBe(false);
  });

  it('should validate combined filters', () => {
    const filters = {
      maker: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      status: 'created' as const,
      giveChainId: 'solana',
      fromSlot: 234567000,
    };
    const result = orderFiltersSchema.safeParse(filters);
    expect(result.success).toBe(true);
  });
});

describe('orderStatsSchema', () => {
  const validStats = {
    totalOrders: 1000,
    activeOrders: 50,
    fulfilledOrders: 900,
    cancelledOrders: 50,
    totalVolume: '1000000000000',
    totalVolumeUsd: '1000000.50',
    avgFulfillmentTime: 120.5,
    uniqueMakers: 100,
    uniqueTakers: 150,
    period: {
      from: new Date('2024-01-01T00:00:00Z'),
      to: new Date('2024-01-31T23:59:59Z'),
    },
  };

  it('should validate valid order stats', () => {
    const result = orderStatsSchema.safeParse(validStats);
    expect(result.success).toBe(true);
  });

  it('should require all count fields', () => {
    const { totalOrders, ...incomplete } = validStats;
    const result = orderStatsSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('should reject negative counts', () => {
    const statsWithNegative = { ...validStats, totalOrders: -1 };
    const result = orderStatsSchema.safeParse(statsWithNegative);
    expect(result.success).toBe(false);
  });

  it('should accept zero counts', () => {
    const statsWithZero = { ...validStats, activeOrders: 0 };
    const result = orderStatsSchema.safeParse(statsWithZero);
    expect(result.success).toBe(true);
  });

  it('should require totalVolume as string', () => {
    const statsWithNumberVolume = { ...validStats, totalVolume: 1000000 };
    const result = orderStatsSchema.safeParse(statsWithNumberVolume);
    expect(result.success).toBe(false);
  });

  it('should accept string datetime for period', () => {
    const statsWithStringDates = {
      ...validStats,
      period: {
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-31T23:59:59Z',
      },
    };
    const result = orderStatsSchema.safeParse(statsWithStringDates);
    expect(result.success).toBe(true);
  });

  it('should require period object', () => {
    const { period, ...statsWithoutPeriod } = validStats;
    const result = orderStatsSchema.safeParse(statsWithoutPeriod);
    expect(result.success).toBe(false);
  });

  it('should require both from and to in period', () => {
    const statsWithIncompletePeriod = {
      ...validStats,
      period: { from: new Date() },
    };
    const result = orderStatsSchema.safeParse(statsWithIncompletePeriod);
    expect(result.success).toBe(false);
  });

  it('should reject negative avgFulfillmentTime', () => {
    const statsWithNegativeTime = { ...validStats, avgFulfillmentTime: -10 };
    const result = orderStatsSchema.safeParse(statsWithNegativeTime);
    expect(result.success).toBe(false);
  });

  it('should accept decimal avgFulfillmentTime', () => {
    const statsWithDecimalTime = { ...validStats, avgFulfillmentTime: 123.456 };
    const result = orderStatsSchema.safeParse(statsWithDecimalTime);
    expect(result.success).toBe(true);
  });
});
