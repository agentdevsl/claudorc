import Database, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// Re-export the Database type for external use
export type { SQLiteDatabase };

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

// Create database connection
const createDatabase = (): SQLiteDatabase => {
  if (isE2EMode()) {
    // Use in-memory database for tests
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    return sqlite;
  }

  const dataDir = getDataDir();
  const dbPath = `${dataDir}/agentpane.db`;

  // Ensure data directory exists
  if (typeof process !== 'undefined') {
    const fs = require('node:fs');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL'); // Better concurrency
  sqlite.pragma('foreign_keys = ON'); // Enforce FK constraints

  return sqlite;
};

export const sqlite: SQLiteDatabase = createDatabase();
export const db = drizzle(sqlite, { schema });

// Export for server-side use with custom data directory
export const createServerDb = (dataDir: string = './data') => {
  const dbPath = `${dataDir}/agentpane.db`;
  const serverSqlite = new Database(dbPath);
  serverSqlite.pragma('journal_mode = WAL');
  serverSqlite.pragma('foreign_keys = ON');
  return drizzle(serverSqlite, { schema });
};

// Re-export for compatibility (pglite was the old name)
export { sqlite as pglite };
