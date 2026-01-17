import { createId } from '@paralleldrive/cuid2';
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { agentRuns } from './agent-runs';
import { agents } from './agents';
import { toolStatusEnum } from './enums';
import { projects } from './projects';
import { tasks } from './tasks';

export const auditLogs = pgTable('audit_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  agentRunId: text('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  tool: text('tool').notNull(),
  status: toolStatusEnum('status').notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  turnNumber: integer('turn_number'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
