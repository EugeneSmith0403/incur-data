#!/usr/bin/env tsx
/**
 * Migration CLI tool
 * Usage:
 *   pnpm migrate up          - Apply all pending migrations
 *   pnpm migrate to 3        - Migrate to version 3
 *   pnpm migrate status      - Show migration status
 *   pnpm migrate stats       - Show database statistics
 */

import { createClient } from '@clickhouse/client';
import {
  createMigrationRunner,
  formatMigrationStatus,
  initializeDatabase,
  verifyDatabase,
  healthCheck,
  printDatabaseStats,
} from '@incur-data/olap-types';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CLICKHOUSE_HOST = process.env.CLICKHOUSE_HOST || 'localhost';
const CLICKHOUSE_PORT = parseInt(process.env.CLICKHOUSE_PORT || '8123');
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'dln';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'default';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || '';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Create ClickHouse client
  const client = createClient({
    host: `http://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}`,
    username: CLICKHOUSE_USER,
    password: CLICKHOUSE_PASSWORD,
    database: CLICKHOUSE_DATABASE,
    request_timeout: 30000,
  });

  try {
    // Health check
    console.log('Checking ClickHouse connection...');
    const health = await healthCheck(client);
    
    if (!health.healthy) {
      console.error('❌ ClickHouse is not healthy:', health.error);
      process.exit(1);
    }
    
    console.log(`✓ Connected to ClickHouse ${health.version}`);
    console.log(`  Uptime: ${Math.floor(health.uptime! / 3600)}h\n`);

    // Get migrations directory
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const migrationRunner = createMigrationRunner(client, migrationsDir);

    switch (command) {
      case 'up': {
        console.log('Applying pending migrations...\n');
        await migrationRunner.migrateUp();
        break;
      }

      case 'to': {
        const version = parseInt(args[1], 10);
        if (isNaN(version)) {
          console.error('Error: Invalid version number');
          process.exit(1);
        }
        console.log(`Migrating to version ${version}...\n`);
        await migrationRunner.migrateTo(version);
        break;
      }

      case 'status': {
        const status = await migrationRunner.getStatus();
        console.log(formatMigrationStatus(status));
        break;
      }

      case 'verify': {
        console.log('Verifying database...\n');
        const isValid = await verifyDatabase(client);
        if (!isValid) {
          console.error('\n❌ Database verification failed');
          process.exit(1);
        }
        console.log('\n✓ Database is valid');
        break;
      }

      case 'stats': {
        await printDatabaseStats(client);
        break;
      }

      case 'init': {
        const autoMigrate = args.includes('--auto');
        await initializeDatabase({
          client,
          migrationsDir,
          database: CLICKHOUSE_DATABASE,
          autoMigrate,
        });
        break;
      }

      case 'reset': {
        if (!args.includes('--force')) {
          console.error(
            '⚠️  WARNING: This will drop all tables!\n' +
            'Use --force flag to confirm: pnpm migrate reset --force'
          );
          process.exit(1);
        }
        
        console.log('⚠️  Resetting database...\n');
        await migrationRunner.reset();
        console.log('\n✓ Database reset complete');
        break;
      }

      default: {
        console.log('ClickHouse Migration Tool\n');
        console.log('Usage:');
        console.log('  pnpm migrate up              Apply all pending migrations');
        console.log('  pnpm migrate to <version>    Migrate to specific version');
        console.log('  pnpm migrate status          Show migration status');
        console.log('  pnpm migrate verify          Verify database schema');
        console.log('  pnpm migrate stats           Show database statistics');
        console.log('  pnpm migrate init [--auto]   Initialize database');
        console.log('  pnpm migrate reset --force   Reset database (destructive!)');
        console.log('');
        console.log('Environment Variables:');
        console.log('  CLICKHOUSE_HOST              Default: localhost');
        console.log('  CLICKHOUSE_PORT              Default: 8123');
        console.log('  CLICKHOUSE_DATABASE          Default: dln');
        console.log('  CLICKHOUSE_USER              Default: default');
        console.log('  CLICKHOUSE_PASSWORD          Default: (empty)');
        break;
      }
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
