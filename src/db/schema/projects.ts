import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ProjectSandboxConfig } from '../../lib/sandbox/types.js';
import { githubInstallations } from './github.js';
import { sandboxConfigs } from './sandbox-configs.js';

export type ProjectConfig = {
  worktreeRoot: string;
  initScript?: string;
  envFile?: string;
  defaultBranch: string;
  allowedTools: string[];
  maxTurns: number;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  /** Environment variables to pass to sandbox containers securely */
  envVars?: Record<string, string>;
  /** Sandbox configuration for Docker-based execution */
  sandbox?: ProjectSandboxConfig;
};

export const projects = sqliteTable('projects', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  description: text('description'),
  config: text('config', { mode: 'json' }).$type<ProjectConfig>(),
  maxConcurrentAgents: integer('max_concurrent_agents').default(3),
  githubOwner: text('github_owner'),
  githubRepo: text('github_repo'),
  githubInstallationId: text('github_installation_id').references(() => githubInstallations.id),
  configPath: text('config_path').default('.claude'),
  sandboxConfigId: text('sandbox_config_id').references(() => sandboxConfigs.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`).notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
