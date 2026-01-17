import { createId } from '@paralleldrive/cuid2';
import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { agentStatusEnum, agentTypeEnum } from './enums';
import { projects } from './projects';

export type AgentConfig = {
  allowedTools: string[];
  maxTurns: number;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
};

export const agents = pgTable('agents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: agentTypeEnum('type').default('task').notNull(),
  status: agentStatusEnum('status').default('idle').notNull(),
  config: jsonb('config').$type<AgentConfig>(),
  currentTaskId: text('current_task_id'),
  currentSessionId: text('current_session_id'),
  currentTurn: integer('current_turn').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
