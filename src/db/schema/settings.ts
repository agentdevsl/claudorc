import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Settings table for storing user preferences (replaces localStorage)
 * Keys: 'task_creation_model', 'task_creation_tools'
 */
export const settings = sqliteTable('settings', {
  // The setting name (e.g., 'task_creation_model', 'task_creation_tools')
  key: text('key').primaryKey(),
  // JSON-encoded value
  value: text('value').notNull(),
  // Timestamps
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
