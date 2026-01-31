import type { ClickHouseClient } from '@clickhouse/client';
import type { TableName, TableSchemas } from './schema.js';

/**
 * Query builder for ClickHouse queries
 */
export class QueryBuilder<T extends TableName> {
  private tableName: T;
  private selectFields: string[] = ['*'];
  private whereConditions: string[] = [];
  private orderByFields: Array<{ field: string; direction: 'ASC' | 'DESC' }> = [];
  private limitValue?: number;
  private offsetValue?: number;
  private groupByFields: string[] = [];

  constructor(tableName: T) {
    this.tableName = tableName;
  }

  /**
   * Select specific fields
   */
  select(...fields: string[]): this {
    this.selectFields = fields;
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  /**
   * Add GROUP BY clause
   */
  groupBy(...fields: string[]): this {
    this.groupByFields.push(...fields);
    return this;
  }

  /**
   * Add ORDER BY clause
   */
  orderBy(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByFields.push({ field, direction });
    return this;
  }

  /**
   * Add LIMIT clause
   */
  limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  /**
   * Add OFFSET clause
   */
  offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  /**
   * Build the SQL query
   */
  build(): string {
    let query = `SELECT ${this.selectFields.join(', ')} FROM dln.${this.tableName}`;

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    if (this.groupByFields.length > 0) {
      query += ` GROUP BY ${this.groupByFields.join(', ')}`;
    }

    if (this.orderByFields.length > 0) {
      const orderBy = this.orderByFields
        .map((field) => `${field.field} ${field.direction}`)
        .join(', ');
      query += ` ORDER BY ${orderBy}`;
    }

    if (this.limitValue !== undefined) {
      query += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== undefined) {
      query += ` OFFSET ${this.offsetValue}`;
    }

    return query;
  }

  /**
   * Execute the query
   */
  async execute(client: ClickHouseClient): Promise<TableSchemas[T][]> {
    const query = this.build();
    const result = await client.query({ query });
    return (await result.json()) as TableSchemas[T][];
  }
}

/**
 * Create a new query builder
 */
export function query<T extends TableName>(tableName: T): QueryBuilder<T> {
  return new QueryBuilder(tableName);
}

/**
 * Helper functions for common queries
 */
export const queries = {
  /**
   * Get transaction by signature
   */
  getTransactionBySignature(signature: string): QueryBuilder<'transactions'> {
    return query('transactions').where(`signature = '${signature}'`).limit(1);
  },

  /**
   * Get transactions by account
   */
  getTransactionsByAccount(account: string, limit: number = 100): QueryBuilder<'transactions'> {
    return query('transactions')
      .where(`account = '${account}'`)
      .orderBy('block_time', 'DESC')
      .limit(limit);
  },

  /**
   * Get transactions by program_id
   */
  getTransactionsByProgram(programId: string, limit: number = 100): QueryBuilder<'transactions'> {
    return query('transactions')
      .where(`program_id = '${programId}'`)
      .orderBy('block_time', 'DESC')
      .limit(limit);
  },

  /**
   * Get transactions by account and program
   */
  getTransactionsByAccountAndProgram(
    account: string,
    programId: string,
    limit: number = 100,
  ): QueryBuilder<'transactions'> {
    return query('transactions')
      .where(`account = '${account}'`)
      .where(`program_id = '${programId}'`)
      .orderBy('block_time', 'DESC')
      .limit(limit);
  },

  /**
   * Get recent transactions
   */
  getRecentTransactions(limit: number = 100): QueryBuilder<'transactions'> {
    return query('transactions').orderBy('block_time', 'DESC').limit(limit);
  },

  /**
   * Get daily program statistics
   */
  getDailyProgramStats(
    programId: string,
    startDate: Date,
    endDate: Date,
  ): QueryBuilder<'daily_program_stats'> {
    return query('daily_program_stats')
      .where(`program_id = '${programId}'`)
      .where(`date >= '${startDate.toISOString().split('T')[0]}'`)
      .where(`date <= '${endDate.toISOString().split('T')[0]}'`)
      .orderBy('date', 'ASC');
  },

  /**
   * Get account statistics
   */
  getAccountStats(
    account: string,
    programId: string,
    startDate: Date,
    endDate: Date,
  ): QueryBuilder<'account_stats'> {
    return query('account_stats')
      .where(`account = '${account}'`)
      .where(`program_id = '${programId}'`)
      .where(`date >= '${startDate.toISOString().split('T')[0]}'`)
      .where(`date <= '${endDate.toISOString().split('T')[0]}'`)
      .orderBy('date', 'ASC');
  },
};
