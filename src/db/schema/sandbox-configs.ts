import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const SANDBOX_TYPES = ['docker', 'devcontainer'] as const;
export type SandboxType = (typeof SANDBOX_TYPES)[number];

export const sandboxConfigs = sqliteTable('sandbox_configs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', { enum: SANDBOX_TYPES }).notNull().default('docker'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  baseImage: text('base_image').notNull().default('node:22-slim'),
  memoryMb: integer('memory_mb').notNull().default(4096),
  cpuCores: real('cpu_cores').notNull().default(2.0),
  maxProcesses: integer('max_processes').notNull().default(256),
  timeoutMinutes: integer('timeout_minutes').notNull().default(60),
  /** Volume mount path from local host for docker sandboxes (e.g., /home/user/projects) */
  volumeMountPath: text('volume_mount_path'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export type SandboxConfig = typeof sandboxConfigs.$inferSelect;
export type NewSandboxConfig = typeof sandboxConfigs.$inferInsert;
