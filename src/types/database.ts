import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type * as schema from '../db/schema/index.js';

export type Database = PgliteDatabase<typeof schema>;

export type TableModel<T extends Table> = InferSelectModel<T>;
export type TableInsert<T extends Table> = InferInsertModel<T>;
