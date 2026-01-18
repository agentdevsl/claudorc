import * as fs from 'node:fs';
import Database, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { MIGRATION_SQL } from '../lib/bootstrap/phases/schema';
import * as schema from './schema';

// Re-export the Database type for external use
export type { SQLiteDatabase };

// Check if we're running in a browser environment
const isBrowser = () => {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
};

// Get data directory from environment or use default
const getDataDir = () => {
  if (typeof process !== 'undefined' && process.env?.SQLITE_DATA_DIR) {
    return process.env.SQLITE_DATA_DIR;
  }
  return './data';
};

// Check if we're in E2E test mode (use in-memory database)
const isE2EMode = () => {
  if (typeof process !== 'undefined') {
    return process.env?.VITE_E2E_SEED === 'true' || process.env?.NODE_ENV === 'test';
  }
  return false;
};

// Run schema migration on a database
const runMigration = (sqlite: SQLiteDatabase): void => {
  try {
    sqlite.exec(MIGRATION_SQL);
    console.log('[DB] Schema migration completed successfully');
  } catch (error) {
    console.error('[DB] Schema migration failed:', error);
    throw error;
  }
};

// Create database connection (server-side only)
const createDatabase = (): SQLiteDatabase | null => {
  // Don't create database in browser - this module should only run on server
  if (isBrowser()) {
    return null;
  }

  if (isE2EMode()) {
    // Use in-memory database for tests
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    runMigration(sqlite); // Run migration for test databases too
    return sqlite;
  }

  const dataDir = getDataDir();
  const dbPath = `${dataDir}/agentpane.db`;

  // Ensure data directory exists (server-side only)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL'); // Better concurrency
  sqlite.pragma('foreign_keys = ON'); // Enforce FK constraints

  // Run schema migration on startup (CREATE TABLE IF NOT EXISTS is idempotent)
  runMigration(sqlite);

  return sqlite;
};

const sqliteInstance = createDatabase();
export const sqlite: SQLiteDatabase | null = sqliteInstance;
export const db = sqliteInstance ? drizzle(sqliteInstance, { schema }) : null;

// Export for server-side use with custom data directory
export const createServerDb = (dataDir: string = './data') => {
  const dbPath = `${dataDir}/agentpane.db`;
  const serverSqlite = new Database(dbPath);
  serverSqlite.pragma('journal_mode = WAL');
  serverSqlite.pragma('foreign_keys = ON');
  runMigration(serverSqlite); // Run migration on startup
  return drizzle(serverSqlite, { schema });
};

// Re-export for compatibility (pglite was the old name)
export { sqlite as pglite };
