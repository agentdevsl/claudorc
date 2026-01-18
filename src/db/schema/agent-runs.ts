import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { agents } from './agents';
import type { AgentStatus } from './enums';
import { projects } from './projects';
import { sessions } from './sessions';
import { tasks } from './tasks';

export const agentRuns = sqliteTable('agent_runs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  status: text('status').$type<AgentStatus>().notNull(),
  startedAt: text('started_at').default(sql`(datetime('now'))`).notNull(),
  completedAt: text('completed_at'),
  turnsUsed: integer('turns_used').default(0),
  tokensUsed: integer('tokens_used').default(0),
  errorMessage: text('error_message'),
});

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
