import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema/index.js';

export type Database = BetterSQLite3Database<typeof schema>;

export type TableModel<T extends Table> = InferSelectModel<T>;
export type TableInsert<T extends Table> = InferInsertModel<T>;
