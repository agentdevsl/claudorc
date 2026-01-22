import { createError } from '../../errors/base.js';
import { err, ok } from '../../utils/result.js';
import type { BootstrapContext } from '../types.js';

// SQLite migration SQL - creates tables if they don't exist
// Exported for test setup reuse
export const MIGRATION_SQL = `
-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "path" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "config" TEXT,
  "max_concurrent_agents" INTEGER DEFAULT 3,
  "github_owner" TEXT,
  "github_repo" TEXT,
  "github_installation_id" TEXT,
  "config_path" TEXT DEFAULT '.claude',
  "sandbox_config_id" TEXT,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "github_installations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "installation_id" TEXT NOT NULL UNIQUE,
  "account_login" TEXT NOT NULL,
  "account_type" TEXT NOT NULL,
  "status" TEXT DEFAULT 'active' NOT NULL,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "github_tokens" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "encrypted_token" TEXT NOT NULL,
  "token_type" TEXT NOT NULL DEFAULT 'pat',
  "scopes" TEXT,
  "github_login" TEXT,
  "github_id" TEXT,
  "is_valid" INTEGER DEFAULT 1,
  "last_validated_at" TEXT,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "repository_configs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "installation_id" TEXT NOT NULL REFERENCES "github_installations"("id") ON DELETE CASCADE,
  "owner" TEXT NOT NULL,
  "repo" TEXT NOT NULL,
  "config" TEXT,
  "synced_at" TEXT,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "agents" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "type" TEXT DEFAULT 'task' NOT NULL,
  "status" TEXT DEFAULT 'idle' NOT NULL,
  "config" TEXT,
  "current_task_id" TEXT,
  "current_session_id" TEXT,
  "current_turn" INTEGER DEFAULT 0,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "task_id" TEXT,
  "agent_id" TEXT REFERENCES "agents"("id") ON DELETE SET NULL,
  "status" TEXT DEFAULT 'idle' NOT NULL,
  "title" TEXT,
  "url" TEXT NOT NULL,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "closed_at" TEXT
);

CREATE TABLE IF NOT EXISTS "worktrees" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "task_id" TEXT,
  "branch" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "base_branch" TEXT DEFAULT 'main' NOT NULL,
  "status" TEXT DEFAULT 'creating' NOT NULL,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "merged_at" TEXT,
  "removed_at" TEXT
);

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "agent_id" TEXT REFERENCES "agents"("id") ON DELETE SET NULL,
  "session_id" TEXT,
  "worktree_id" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "mode" TEXT DEFAULT 'implement',
  "column" TEXT DEFAULT 'backlog' NOT NULL,
  "position" INTEGER DEFAULT 0 NOT NULL,
  "labels" TEXT DEFAULT '[]',
  "priority" TEXT DEFAULT 'medium',
  "branch" TEXT,
  "diff_summary" TEXT,
  "approved_at" TEXT,
  "approved_by" TEXT,
  "rejection_count" INTEGER DEFAULT 0,
  "rejection_reason" TEXT,
  "queued_at" TEXT,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "started_at" TEXT,
  "completed_at" TEXT
);

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "agent_id" TEXT NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "task_id" TEXT NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "session_id" TEXT REFERENCES "sessions"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL,
  "started_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "completed_at" TEXT,
  "turns_used" INTEGER DEFAULT 0,
  "tokens_used" INTEGER DEFAULT 0,
  "error_message" TEXT
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "agent_id" TEXT REFERENCES "agents"("id") ON DELETE SET NULL,
  "agent_run_id" TEXT REFERENCES "agent_runs"("id") ON DELETE SET NULL,
  "task_id" TEXT REFERENCES "tasks"("id") ON DELETE SET NULL,
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE CASCADE,
  "tool" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "input" TEXT,
  "output" TEXT,
  "error_message" TEXT,
  "duration_ms" INTEGER,
  "turn_number" INTEGER,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "service" TEXT NOT NULL UNIQUE,
  "encrypted_key" TEXT NOT NULL,
  "masked_key" TEXT NOT NULL,
  "is_valid" INTEGER DEFAULT 1,
  "last_validated_at" TEXT,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "templates" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scope" TEXT NOT NULL,
  "github_owner" TEXT NOT NULL,
  "github_repo" TEXT NOT NULL,
  "branch" TEXT DEFAULT 'main',
  "config_path" TEXT DEFAULT '.claude',
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE CASCADE,
  "status" TEXT DEFAULT 'active',
  "last_sync_sha" TEXT,
  "last_synced_at" TEXT,
  "sync_error" TEXT,
  "cached_skills" TEXT,
  "cached_commands" TEXT,
  "cached_agents" TEXT,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "template_projects" (
  "template_id" TEXT NOT NULL REFERENCES "templates"("id") ON DELETE CASCADE,
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  PRIMARY KEY ("template_id", "project_id")
);

CREATE TABLE IF NOT EXISTS "sandbox_configs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_default" INTEGER DEFAULT 0,
  "base_image" TEXT NOT NULL DEFAULT 'node:22-slim',
  "memory_mb" INTEGER NOT NULL DEFAULT 4096,
  "cpu_cores" REAL NOT NULL DEFAULT 2.0,
  "max_processes" INTEGER NOT NULL DEFAULT 256,
  "timeout_minutes" INTEGER NOT NULL DEFAULT 60,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS "session_events" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "session_id" TEXT NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "offset" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "timestamp" INTEGER NOT NULL,
  "user_id" TEXT,
  "created_at" TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE INDEX IF NOT EXISTS "session_events_session_idx" ON "session_events"("session_id");
CREATE INDEX IF NOT EXISTS "session_events_offset_idx" ON "session_events"("session_id", "offset");
CREATE UNIQUE INDEX IF NOT EXISTS "session_events_unique_offset" ON "session_events"("session_id", "offset");

CREATE TABLE IF NOT EXISTS "session_summaries" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "session_id" TEXT NOT NULL UNIQUE REFERENCES "sessions"("id") ON DELETE CASCADE,
  "duration_ms" INTEGER,
  "turns_count" INTEGER DEFAULT 0,
  "tokens_used" INTEGER DEFAULT 0,
  "files_modified" INTEGER DEFAULT 0,
  "lines_added" INTEGER DEFAULT 0,
  "lines_removed" INTEGER DEFAULT 0,
  "final_status" TEXT,
  "updated_at" TEXT DEFAULT (datetime('now')) NOT NULL
);
`;

// Additional migrations for existing databases
export const SANDBOX_MIGRATION_SQL = `
-- Add sandbox_config_id to projects if it doesn't exist
-- This runs separately because SQLite doesn't support IF NOT EXISTS for ALTER TABLE
ALTER TABLE projects ADD COLUMN sandbox_config_id TEXT;
`;

export const validateSchema = async (ctx: BootstrapContext) => {
  if (!ctx.db) {
    return err(createError('BOOTSTRAP_NO_DATABASE', 'Database not initialized', 500));
  }

  try {
    // Run migrations by executing SQL directly against SQLite
    ctx.db.exec(MIGRATION_SQL);

    // Verify tables exist using SQLite syntax
    const result = ctx.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
      .get() as { name: string } | undefined;

    if (!result?.name) {
      return err(
        createError(
          'BOOTSTRAP_SCHEMA_VALIDATION_FAILED',
          'Projects table not found after migration',
          500
        )
      );
    }

    return ok(undefined);
  } catch (error) {
    console.error('[Schema] Migration failed:', error);
    return err(
      createError('BOOTSTRAP_SCHEMA_VALIDATION_FAILED', 'Schema migration failed', 500, {
        error: String(error),
      })
    );
  }
};
