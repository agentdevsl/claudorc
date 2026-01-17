import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { DrizzleSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { PGliteDatabase } from 'drizzle-orm/pglite';
import type { drizzle } from 'drizzle-orm/pglite';
import type * as schema from '../db/schema/index.js';

export type Database = PGliteDatabase<typeof schema>;

export type TableModel<T> = InferSelectModel<T>;
export type TableInsert<T> = InferInsertModel<T>;
