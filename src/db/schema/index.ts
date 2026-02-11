// Default: SQLite schema (re-export everything for backward compatibility)
export * from './sqlite';

// NOTE: Do NOT use `export * as pgSchema` or `export * as sqliteSchema` here.
// Module namespace objects have null prototypes, which crashes drizzle-orm's
// extractTablesRelationalConfig. Import directly from the dialect directories:
//   import * as pgSchema from '@/db/schema/postgres';
//   import * as sqliteSchema from '@/db/schema/sqlite';
