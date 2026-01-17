import { createId } from '@paralleldrive/cuid2';
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const githubInstallations = pgTable('github_installations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  installationId: text('installation_id').notNull().unique(),
  accountLogin: text('account_login').notNull(),
  accountType: text('account_type').notNull(),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const repositoryConfigs = pgTable('repository_configs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  installationId: text('installation_id')
    .notNull()
    .references(() => githubInstallations.id, { onDelete: 'cascade' }),
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  config: jsonb('config').$type<Record<string, unknown>>(),
  syncedAt: timestamp('synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type GitHubInstallation = typeof githubInstallations.$inferSelect;
export type NewGitHubInstallation = typeof githubInstallations.$inferInsert;
export type RepositoryConfig = typeof repositoryConfigs.$inferSelect;
export type NewRepositoryConfig = typeof repositoryConfigs.$inferInsert;
