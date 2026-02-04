import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ToolStatus } from '../shared/enums';
import { agentRuns } from './agent-runs';
import { agents } from './agents';
import { projects } from './projects';
import { tasks } from './tasks';

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  agentRunId: text('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  tool: text('tool').notNull(),
  status: text('status').$type<ToolStatus>().notNull(),
  input: text('input', { mode: 'json' }),
  output: text('output', { mode: 'json' }),
  errorMessage: text('error_message'),
  durationMs: integer('duration_ms'),
  turnNumber: integer('turn_number'),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
