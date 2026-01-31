/**
 * Jupiter Price Service Types
 * Types for token price fetching and caching
 */

export interface JupiterPriceConfig {
  apiUrl: string;
  apiKey?: string;
  priceEndpoint: string;
  timeout: number;
  retryAttempts: number;
  cacheTtl: number;
  rateLimit: number; // Minimum delay between requests in ms (1 RPS = 1000ms)
}

export interface TokenPrice {
  address: string;
  price: number;
  timestamp: number;
}

export interface JupiterPriceResponse {
  [address: string]: {
    createdAt: string;
    liquidity: number;
    usdPrice: number;
    blockId: number;
    decimals: number;
    priceChange24h: number;
  };
}
