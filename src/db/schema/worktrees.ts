import { createId } from '@paralleldrive/cuid2';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { worktreeStatusEnum } from './enums';
export type { WorktreeStatus } from './enums';
import { projects } from './projects';
import { tasks } from './tasks';

export const worktrees = pgTable('worktrees', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  branch: text('branch').notNull(),
  path: text('path').notNull(),
  baseBranch: text('base_branch').default('main').notNull(),
  status: worktreeStatusEnum('status').default('creating').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  mergedAt: timestamp('merged_at'),
  removedAt: timestamp('removed_at'),
});

export type Worktree = typeof worktrees.$inferSelect;
export type NewWorktree = typeof worktrees.$inferInsert;
