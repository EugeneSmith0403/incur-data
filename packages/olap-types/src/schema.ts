/**
 * ClickHouse table schemas for DLN data
 * Simplified structure with single transactions table
 */

/**
 * Transactions table schema
 */
export interface TransactionsTable {
  signature: string;
  slot: number;
  block_time: Date;
  program_id: string;
  account: string;
  token_address: string;
  amount: string;
  amount_usd: number;
  status: 'success' | 'failed' | 'pending';
  instruction_type: string;
  event_type: string;
  order_id: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Daily program statistics view schema
 */
export interface DailyProgramStatsTable {
  date: Date;
  program_id: string;
  tx_count: number;
  total_volume_usd: number;
  unique_accounts: number;
  success_count: number;
  failed_count: number;
}

/**
 * Account statistics view schema
 */
export interface AccountStatsTable {
  date: Date;
  account: string;
  program_id: string;
  tx_count: number;
  total_received_usd: number;
  unique_tokens: number;
}

/**
 * Hourly volume view schema
 */
export interface HourlyVolumeTable {
  hour: Date;
  program_id: string;
  event_type: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  min_volume_usd: number;
  max_volume_usd: number;
  unique_accounts: number;
  unique_tokens: number;
}

/**
 * Daily volume view schema
 */
export interface DailyVolumeTable {
  date: Date;
  program_id: string;
  event_type: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  min_volume_usd: number;
  max_volume_usd: number;
  unique_accounts: number;
  unique_tokens: number;
  success_count: number;
  failed_count: number;
}

/**
 * Hourly token volume view schema
 */
export interface HourlyTokenVolumeTable {
  hour: Date;
  token_address: string;
  program_id: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  unique_accounts: number;
}

/**
 * Daily token volume view schema
 */
export interface DailyTokenVolumeTable {
  date: Date;
  token_address: string;
  program_id: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  unique_accounts: number;
}

/**
 * Daily account volume view schema
 */
export interface DailyAccountVolumeTable {
  date: Date;
  account: string;
  program_id: string;
  total_volume_usd: number;
  tx_count: number;
  avg_volume_usd: number;
  unique_tokens: number;
}

/**
 * All table types
 */
export type TableSchemas = {
  transactions: TransactionsTable;
  daily_program_stats: DailyProgramStatsTable;
  account_stats: AccountStatsTable;
  hourly_volume: HourlyVolumeTable;
  daily_volume: DailyVolumeTable;
  hourly_token_volume: HourlyTokenVolumeTable;
  daily_token_volume: DailyTokenVolumeTable;
  daily_account_volume: DailyAccountVolumeTable;
};

/**
 * Table names
 */
export type TableName = keyof TableSchemas;

/**
 * Insert data type for transactions (without auto-generated fields)
 */
export type TransactionInsert = Omit<TransactionsTable, 'created_at' | 'updated_at'>;
