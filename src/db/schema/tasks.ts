import { createId } from '@paralleldrive/cuid2';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import type { DiffSummary } from '../../lib/types/diff.js';
import { agents } from './agents';
import { taskColumnEnum } from './enums';

export type { TaskColumn } from './enums';

import { projects } from './projects';
import { sessions } from './sessions';
import { worktrees } from './worktrees';

export const tasks = pgTable('tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  sessionId: text('session_id').references((): AnyPgColumn => sessions.id, { onDelete: 'set null' }),
  worktreeId: text('worktree_id').references((): AnyPgColumn => worktrees.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  column: taskColumnEnum('column').default('backlog').notNull(),
  position: integer('position').default(0).notNull(),
  labels: jsonb('labels').$type<string[]>().default([]),
  branch: text('branch'),
  diffSummary: jsonb('diff_summary').$type<DiffSummary>(),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by'),
  rejectionCount: integer('rejection_count').default(0),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
