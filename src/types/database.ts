import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { PGliteDatabase } from 'drizzle-orm/pglite';
import type * as schema from '../db/schema/index.js';

export type Database = PGliteDatabase<typeof schema>;

export type TableModel<T> = InferSelectModel<T>;
export type TableInsert<T> = InferInsertModel<T>;
