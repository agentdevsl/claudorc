import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { DiffSummary } from '../../lib/types/diff.js';
import { agents } from './agents';
import type { TaskColumn, TaskPriority } from './enums';

export type { TaskColumn, TaskPriority } from './enums';

/**
 * Task execution mode
 * - plan: Multi-turn planning session (no sandbox)
 * - implement: Full implementation with sandbox
 */
export type TaskMode = 'plan' | 'implement';

import { projects } from './projects';
import { sessions } from './sessions';
import { worktrees } from './worktrees';

export const tasks = sqliteTable('tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  sessionId: text('session_id').references((): AnySQLiteColumn => sessions.id, {
    onDelete: 'set null',
  }),
  worktreeId: text('worktree_id').references((): AnySQLiteColumn => worktrees.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  description: text('description'),
  mode: text('mode').$type<TaskMode>().notNull().default('implement'),
  column: text('column').$type<TaskColumn>().default('backlog').notNull(),
  position: integer('position').default(0).notNull(),
  labels: text('labels', { mode: 'json' }).$type<string[]>().default([]),
  priority: text('priority').$type<TaskPriority>().default('medium'),
  branch: text('branch'),
  diffSummary: text('diff_summary', { mode: 'json' }).$type<DiffSummary>(),
  approvedAt: text('approved_at'),
  approvedBy: text('approved_by'),
  rejectionCount: integer('rejection_count').default(0),
  rejectionReason: text('rejection_reason'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
