/**
 * Migration management utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Migration record
 */
export interface Migration {
  version: number;
  name: string;
  filepath: string;
  checksum: string;
  sql: string;
}

/**
 * Applied migration record from database
 */
export interface AppliedMigration {
  version: number;
  name: string;
  applied_at: Date;
  checksum: string;
  execution_time_ms: number;
  status: string;
}

/**
 * Migration status
 */
export interface MigrationStatus {
  currentVersion: number;
  pendingMigrations: Migration[];
  appliedMigrations: AppliedMigration[];
}

/**
 * Load all migration files from directory
 */
export function loadMigrations(migrationsDir: string): Migration[] {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(file => {
    const filepath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filepath, 'utf-8');
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid migration filename: ${file}. Expected format: NNN_name.sql`);
    }

    const versionStr = match[1];
    const name = match[2];
    const version = parseInt(versionStr, 10);
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    return {
      version,
      name,
      filepath,
      checksum,
      sql,
    };
  });
}

/**
 * Parse migration version from filename
 */
export function parseMigrationVersion(filename: string): number {
  const match = filename.match(/^(\d+)_/);
  if (!match || !match[1]) {
    throw new Error(`Invalid migration filename: ${filename}`);
  }
  return parseInt(match[1], 10);
}

/**
 * Calculate checksum for migration SQL
 */
export function calculateChecksum(sql: string): string {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

/**
 * Verify migration integrity
 */
export function verifyMigrations(
  appliedMigrations: AppliedMigration[],
  availableMigrations: Migration[]
): void {
  for (const applied of appliedMigrations) {
    const available = availableMigrations.find(m => m.version === applied.version);
    
    if (!available) {
      throw new Error(
        `Migration ${applied.version} (${applied.name}) was applied but migration file is missing`
      );
    }

    if (available.checksum !== applied.checksum) {
      throw new Error(
        `Migration ${applied.version} (${applied.name}) has been modified after being applied. ` +
        `Expected checksum: ${applied.checksum}, actual: ${available.checksum}`
      );
    }
  }
}

/**
 * Get pending migrations
 */
export function getPendingMigrations(
  appliedMigrations: AppliedMigration[],
  availableMigrations: Migration[]
): Migration[] {
  const appliedVersions = new Set(appliedMigrations.map(m => m.version));
  return availableMigrations.filter(m => !appliedVersions.has(m.version));
}

/**
 * Split SQL into individual statements
 */
export function splitSqlStatements(sql: string): string[] {
  // Remove comments
  const withoutComments = sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Split by semicolon, filter empty
  return withoutComments
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
}

/**
 * Format migration status for display
 */
export function formatMigrationStatus(status: MigrationStatus): string {
  const lines: string[] = [];
  
  lines.push('Migration Status');
  lines.push('================');
  lines.push(`Current Version: ${status.currentVersion}`);
  lines.push('');

  if (status.appliedMigrations.length > 0) {
    lines.push('Applied Migrations:');
    for (const migration of status.appliedMigrations) {
      const statusIcon = migration.status === 'success' ? '✓' : '✗';
      lines.push(
        `  ${statusIcon} ${migration.version.toString().padStart(3, '0')} ` +
        `${migration.name} (${migration.applied_at.toISOString()}) ` +
        `[${migration.execution_time_ms}ms]`
      );
    }
    lines.push('');
  }

  if (status.pendingMigrations.length > 0) {
    lines.push('Pending Migrations:');
    for (const migration of status.pendingMigrations) {
      lines.push(`  ⧗ ${migration.version.toString().padStart(3, '0')} ${migration.name}`);
    }
  } else {
    lines.push('No pending migrations.');
  }

  return lines.join('\n');
}

/**
 * Migration runner interface
 */
export interface MigrationRunner {
  /**
   * Get current migration status
   */
  getStatus(): Promise<MigrationStatus>;

  /**
   * Apply all pending migrations
   */
  migrateUp(): Promise<void>;

  /**
   * Apply migrations up to specific version
   */
  migrateTo(version: number): Promise<void>;

  /**
   * Rollback last migration
   */
  migrateDown(): Promise<void>;

  /**
   * Reset database (drop all tables)
   */
  reset(): Promise<void>;
}

/**
 * Migration result
 */
export interface MigrationResult {
  version: number;
  name: string;
  success: boolean;
  executionTimeMs: number;
  error?: string;
}
