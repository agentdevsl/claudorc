import { createId } from '@paralleldrive/cuid2';
import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Stores encrypted GitHub Personal Access Tokens
 * Tokens are encrypted using AES-GCM before storage
 */
export const githubTokens = pgTable('github_tokens', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  // The encrypted token (base64-encoded)
  encryptedToken: text('encrypted_token').notNull(),
  // Token metadata (not sensitive)
  tokenType: text('token_type').notNull().default('pat'), // 'pat' | 'oauth'
  scopes: text('scopes'), // Comma-separated scopes
  // Associated GitHub user info (from validation)
  githubLogin: text('github_login'),
  githubId: text('github_id'),
  // Status
  isValid: boolean('is_valid').default(true),
  lastValidatedAt: timestamp('last_validated_at'),
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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

export type GitHubToken = typeof githubTokens.$inferSelect;
export type NewGitHubToken = typeof githubTokens.$inferInsert;
export type GitHubInstallation = typeof githubInstallations.$inferSelect;
export type NewGitHubInstallation = typeof githubInstallations.$inferInsert;
export type RepositoryConfig = typeof repositoryConfigs.$inferSelect;
export type NewRepositoryConfig = typeof repositoryConfigs.$inferInsert;
