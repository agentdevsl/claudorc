import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as pgSchema from '../db/schema/postgres/index.js';
import type * as sqliteSchema from '../db/schema/sqlite/index.js';

export type SqliteDatabase = BetterSQLite3Database<typeof sqliteSchema>;
export type PostgresDatabase = PostgresJsDatabase<typeof pgSchema>;

/**
 * Canonical database type used throughout the application.
 *
 * Uses SqliteDatabase as the structural type since all services import tables
 * from `db/schema` (which re-exports the SQLite schema by default). In postgres
 * mode the Drizzle instance is cast to this type at creation time — the runtime
 * API surface is identical.
 */
export type Database = SqliteDatabase;

export type TableModel<T extends Table> = InferSelectModel<T>;
export type TableInsert<T extends Table> = InferInsertModel<T>;
