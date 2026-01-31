/**
 * Database initialization logic
 */

import { ClickHouseClient } from '@clickhouse/client';
import { createMigrationRunner } from './migration-runner.js';
import { formatMigrationStatus } from './migrations.js';

export interface InitializerOptions {
  client: ClickHouseClient;
  migrationsDir?: string;
  database?: string;
  autoMigrate?: boolean;
}

/**
 * Initialize ClickHouse database
 */
export async function initializeDatabase(options: InitializerOptions): Promise<void> {
  const {
    client,
    migrationsDir,
    database = 'dln',
    autoMigrate = false,
  } = options;

  console.log('Initializing ClickHouse database...');

  // 1. Create database if it doesn't exist
  await client.exec({
    query: `CREATE DATABASE IF NOT EXISTS ${database}`,
  });
  console.log(`✓ Database '${database}' ready`);

  // 2. Run migrations
  const migrationRunner = createMigrationRunner(client, migrationsDir);
  const status = await migrationRunner.getStatus();

  console.log('\n' + formatMigrationStatus(status));

  if (status.pendingMigrations.length > 0) {
    if (autoMigrate) {
      console.log('\nAuto-migrating...');
      await migrationRunner.migrateUp();
    } else {
      console.log('\n⚠️  Pending migrations detected. Run migrations with:');
      console.log('  pnpm --filter @incur-data/indexer migrate:up');
      throw new Error('Database not fully migrated');
    }
  }

  console.log('\n✓ Database initialization complete!');
}

/**
 * Verify database is ready
 */
export async function verifyDatabase(client: ClickHouseClient): Promise<boolean> {
  try {
    // Check if database exists
    const dbResult = await client.query({
      query: `SELECT count() FROM system.databases WHERE name = 'dln'`,
      format: 'JSONEachRow',
    });
    const dbRows = await dbResult.json<{ 'count()': number }>() as unknown as any[];
    
    if (!dbRows[0] || dbRows[0]['count()'] === 0) {
      console.error('✗ Database "dln" not found');
      return false;
    }

    // Check if required tables exist
    const requiredTables = [
      'schema_migrations',
      'transactions',
    ];

    const tableResult = await client.query({
      query: `
        SELECT name 
        FROM system.tables 
        WHERE database = 'dln' AND name IN (${requiredTables.map(t => `'${t}'`).join(',')})
      `,
      format: 'JSONEachRow',
    });
    const tableRows = await tableResult.json<{ name: string }>() as unknown as any[];
    const existingTables = tableRows.map((r: any) => r.name);

    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.error('✗ Missing required tables:', missingTables.join(', '));
      return false;
    }

    console.log('✓ Database verification passed');
    return true;
  } catch (error: any) {
    console.error('✗ Database verification failed:', error.message);
    return false;
  }
}

/**
 * Health check for database connection
 */
export async function healthCheck(client: ClickHouseClient): Promise<{
  healthy: boolean;
  version?: string;
  uptime?: number;
  error?: string;
}> {
  try {
    const result = await client.query({
      query: 'SELECT version() as version, uptime() as uptime',
      format: 'JSONEachRow',
    });
    
    const rows = await result.json<{ version: string; uptime: number }>() as unknown as any[];
    const row = rows[0];

    return {
      healthy: true,
      version: row.version,
      uptime: row.uptime,
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(client: ClickHouseClient): Promise<{
  tables: Array<{
    name: string;
    rows: number;
    bytes: number;
    parts: number;
  }>;
  totalRows: number;
  totalBytes: number;
}> {
  const result = await client.query({
    query: `
      SELECT
        table,
        sum(rows) as rows,
        sum(bytes) as bytes,
        count() as parts
      FROM system.parts
      WHERE database = 'dln' AND active = 1
      GROUP BY table
      ORDER BY bytes DESC
    `,
    format: 'JSONEachRow',
  });

  const tables = await result.json<{
    table: string;
    rows: string;
    bytes: string;
    parts: string;
  }>() as unknown as any[];

  const formattedTables = tables.map((t: any) => ({
    name: t.table,
    rows: parseInt(t.rows, 10),
    bytes: parseInt(t.bytes, 10),
    parts: parseInt(t.parts, 10),
  }));

  const totalRows = formattedTables.reduce((sum: number, t: any) => sum + t.rows, 0);
  const totalBytes = formattedTables.reduce((sum: number, t: any) => sum + t.bytes, 0);

  return {
    tables: formattedTables,
    totalRows,
    totalBytes,
  };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Print database statistics
 */
export async function printDatabaseStats(client: ClickHouseClient): Promise<void> {
  const stats = await getDatabaseStats(client);

  console.log('\nDatabase Statistics');
  console.log('==================');
  console.log(`Total Rows: ${stats.totalRows.toLocaleString()}`);
  console.log(`Total Size: ${formatBytes(stats.totalBytes)}`);
  console.log('');
  console.log('Tables:');
  
  for (const table of stats.tables) {
    console.log(
      `  ${table.name.padEnd(30)} ` +
      `${table.rows.toLocaleString().padStart(12)} rows  ` +
      `${formatBytes(table.bytes).padStart(10)}  ` +
      `${table.parts} parts`
    );
  }
}
