import { createId } from '@paralleldrive/cuid2';
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { agents } from './agents';
import { agentStatusEnum } from './enums';
import { projects } from './projects';
import { sessions } from './sessions';
import { tasks } from './tasks';

export const agentRuns = pgTable('agent_runs', {
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
  status: agentStatusEnum('status').notNull(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  turnsUsed: integer('turns_used').default(0),
  tokensUsed: integer('tokens_used').default(0),
  errorMessage: text('error_message'),
});

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;
