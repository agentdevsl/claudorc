import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as pgSchema from '../db/schema/postgres/index.js';
import type * as sqliteSchema from '../db/schema/sqlite/index.js';

export type SqliteDatabase = BetterSQLite3Database<typeof sqliteSchema>;
export type PostgresDatabase = PostgresJsDatabase<typeof pgSchema>;
export type Database = SqliteDatabase | PostgresDatabase;

export type TableModel<T extends Table> = InferSelectModel<T>;
export type TableInsert<T extends Table> = InferInsertModel<T>;
