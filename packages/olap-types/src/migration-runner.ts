/**
 * ClickHouse Migration Runner Implementation
 */

import { ClickHouseClient } from '@clickhouse/client';
import * as path from 'path';
import {
  Migration,
  AppliedMigration,
  MigrationStatus,
  MigrationResult,
  MigrationRunner,
  loadMigrations,
  verifyMigrations,
  getPendingMigrations,
  splitSqlStatements,
} from './migrations.js';

export interface MigrationRunnerOptions {
  client: ClickHouseClient;
  migrationsDir: string;
  database?: string;
}

/**
 * ClickHouse migration runner
 */
export class ClickHouseMigrationRunner implements MigrationRunner {
  private client: ClickHouseClient;
  private migrationsDir: string;
  private database: string;

  constructor(options: MigrationRunnerOptions) {
    this.client = options.client;
    this.migrationsDir = options.migrationsDir;
    this.database = options.database || 'dln';
  }

  /**
   * Get applied migrations from database
   */
  private async getAppliedMigrations(): Promise<AppliedMigration[]> {
    try {
      const result = await this.client.query({
        query: `
          SELECT 
            version,
            name,
            applied_at,
            checksum,
            execution_time_ms,
            status
          FROM ${this.database}.schema_migrations
          ORDER BY version ASC
        `,
        format: 'JSONEachRow',
      });

      const rows = await result.json<any>();
      return rows.map((row: any) => ({
        version: row.version,
        name: row.name,
        applied_at: new Date(row.applied_at),
        checksum: row.checksum,
        execution_time_ms: row.execution_time_ms,
        status: row.status,
      }));
    } catch (error: any) {
      // If migrations table doesn't exist, return empty array
      if (error.message?.includes('schema_migrations')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Record migration in database
   */
  private async recordMigration(result: MigrationResult, checksum: string): Promise<void> {
    await this.client.insert({
      table: `${this.database}.schema_migrations`,
      values: [
        {
          version: result.version,
          name: result.name,
          applied_at: Math.floor(Date.now() / 1000),
          checksum,
          execution_time_ms: result.executionTimeMs,
          status: result.success ? 'success' : 'failed',
        },
      ],
      format: 'JSONEachRow',
    });
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Applying migration ${migration.version}: ${migration.name}...`);

      // Split SQL into statements and execute each
      const statements = splitSqlStatements(migration.sql);
      
      for (const statement of statements) {
        if (statement.trim().length === 0) continue;
        
        await this.client.exec({
          query: statement,
        });
      }

      const executionTimeMs = Date.now() - startTime;
      console.log(`✓ Migration ${migration.version} completed in ${executionTimeMs}ms`);

      return {
        version: migration.version,
        name: migration.name,
        success: true,
        executionTimeMs,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      console.error(`✗ Migration ${migration.version} failed:`, error.message);

      return {
        version: migration.version,
        name: migration.name,
        success: false,
        executionTimeMs,
        error: error.message,
      };
    }
  }

  /**
   * Get current migration status
   */
  async getStatus(): Promise<MigrationStatus> {
    const availableMigrations = loadMigrations(this.migrationsDir);
    const appliedMigrations = await this.getAppliedMigrations();

    // Verify migration integrity
    verifyMigrations(appliedMigrations, availableMigrations);

    const pendingMigrations = getPendingMigrations(appliedMigrations, availableMigrations);
    const currentVersion = appliedMigrations.length > 0
      ? Math.max(...appliedMigrations.map(m => m.version))
      : 0;

    return {
      currentVersion,
      pendingMigrations,
      appliedMigrations,
    };
  }

  /**
   * Apply all pending migrations
   */
  async migrateUp(): Promise<void> {
    const status = await this.getStatus();

    if (status.pendingMigrations.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    console.log(`Applying ${status.pendingMigrations.length} pending migration(s)...`);

    for (const migration of status.pendingMigrations) {
      const result = await this.executeMigration(migration);
      
      if (!result.success) {
        await this.recordMigration(result, migration.checksum);
        throw new Error(
          `Migration ${migration.version} failed: ${result.error}`
        );
      }

      await this.recordMigration(result, migration.checksum);
    }

    console.log('All migrations applied successfully!');
  }

  /**
   * Apply migrations up to specific version
   */
  async migrateTo(targetVersion: number): Promise<void> {
    const status = await this.getStatus();
    const migrationsToApply = status.pendingMigrations.filter(
      m => m.version <= targetVersion
    );

    if (migrationsToApply.length === 0) {
      console.log(`Already at version ${targetVersion} or higher.`);
      return;
    }

    console.log(`Migrating to version ${targetVersion}...`);

    for (const migration of migrationsToApply) {
      const result = await this.executeMigration(migration);
      
      if (!result.success) {
        await this.recordMigration(result, migration.checksum);
        throw new Error(
          `Migration ${migration.version} failed: ${result.error}`
        );
      }

      await this.recordMigration(result, migration.checksum);
    }

    console.log(`Successfully migrated to version ${targetVersion}!`);
  }

  /**
   * Rollback last migration (not implemented - dangerous operation)
   */
  async migrateDown(): Promise<void> {
    throw new Error(
      'Migration rollback is not implemented. ' +
      'Please create explicit down migrations if needed.'
    );
  }

  /**
   * Reset database (dangerous - use with caution)
   */
  async reset(): Promise<void> {
    console.warn('WARNING: Resetting database will drop all tables!');

    // Drop all tables in database
    const result = await this.client.query({
      query: `SHOW TABLES FROM ${this.database}`,
      format: 'JSONEachRow',
    });

    const tables = await result.json<{ name: string }>() as unknown as any[];

    for (const table of tables) {
      // Skip internal ClickHouse tables (start with .inner_id)
      if (table.name.startsWith('.inner_id')) {
        continue;
      }

      console.log(`Dropping table ${table.name}...`);
      await this.client.exec({
        query: `DROP TABLE IF EXISTS ${this.database}.${table.name}`,
      });
    }

    console.log('Database reset complete.');
  }
}

/**
 * Create migration runner instance
 */
export function createMigrationRunner(
  client: ClickHouseClient,
  migrationsDir?: string
): ClickHouseMigrationRunner {
  const defaultMigrationsDir = path.join(process.cwd(), 'migrations');
  
  return new ClickHouseMigrationRunner({
    client,
    migrationsDir: migrationsDir || defaultMigrationsDir,
    database: 'dln',
  });
}
