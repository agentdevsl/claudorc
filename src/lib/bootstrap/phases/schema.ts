import { createError } from '../../errors/base.js';
import { err, ok } from '../../utils/result.js';
import type { BootstrapContext } from '../types.js';

// Inline migration SQL for browser execution
const MIGRATION_SQL = `
-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE "public"."agent_status" AS ENUM('idle', 'starting', 'running', 'paused', 'error', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."agent_type" AS ENUM('task', 'conversational', 'background');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."session_status" AS ENUM('idle', 'initializing', 'active', 'paused', 'closing', 'closed', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."task_column" AS ENUM('backlog', 'queued', 'in_progress', 'waiting_approval', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."tool_status" AS ENUM('pending', 'running', 'complete', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."worktree_status" AS ENUM('creating', 'active', 'merging', 'removing', 'removed', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "path" text NOT NULL,
  "description" text,
  "config" jsonb,
  "max_concurrent_agents" integer DEFAULT 3,
  "github_owner" text,
  "github_repo" text,
  "github_installation_id" text,
  "config_path" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "projects_path_unique" UNIQUE("path")
);

CREATE TABLE IF NOT EXISTS "agents" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "name" text NOT NULL,
  "type" "agent_type" DEFAULT 'task' NOT NULL,
  "status" "agent_status" DEFAULT 'idle' NOT NULL,
  "config" jsonb,
  "current_task_id" text,
  "current_session_id" text,
  "current_turn" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "task_id" text,
  "agent_id" text,
  "status" "session_status" DEFAULT 'idle' NOT NULL,
  "title" text,
  "url" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "closed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "worktrees" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "task_id" text,
  "branch" text NOT NULL,
  "path" text NOT NULL,
  "base_branch" text DEFAULT 'main' NOT NULL,
  "status" "worktree_status" DEFAULT 'creating' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "merged_at" timestamp,
  "removed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "agent_id" text,
  "session_id" text,
  "worktree_id" text,
  "title" text NOT NULL,
  "description" text,
  "column" "task_column" DEFAULT 'backlog' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "labels" jsonb DEFAULT '[]'::jsonb,
  "branch" text,
  "diff_summary" jsonb,
  "approved_at" timestamp,
  "approved_by" text,
  "rejection_count" integer DEFAULT 0,
  "rejection_reason" text,
  "queued_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp
);

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL,
  "task_id" text NOT NULL,
  "project_id" text NOT NULL,
  "session_id" text,
  "status" "agent_status" NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "turns_used" integer DEFAULT 0,
  "tokens_used" integer DEFAULT 0,
  "error_message" text
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text,
  "agent_run_id" text,
  "task_id" text,
  "project_id" text,
  "tool" text NOT NULL,
  "status" "tool_status" NOT NULL,
  "input" jsonb,
  "output" jsonb,
  "error_message" text,
  "duration_ms" integer,
  "turn_number" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "github_installations" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL,
  "account_login" text NOT NULL,
  "account_type" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "github_installations_installation_id_unique" UNIQUE("installation_id")
);

CREATE TABLE IF NOT EXISTS "repository_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL,
  "owner" text NOT NULL,
  "repo" text NOT NULL,
  "config" jsonb,
  "synced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add missing columns to existing tables (safe to run multiple times)
DO $$ BEGIN
  ALTER TABLE "tasks" ADD COLUMN "queued_at" timestamp;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
`;

export const validateSchema = async (ctx: BootstrapContext) => {
  if (!ctx.db) {
    return err(createError('BOOTSTRAP_NO_DATABASE', 'Database not initialized', 500));
  }

  try {
    // Run migrations by executing SQL directly against PGlite
    await ctx.db.exec(MIGRATION_SQL);

    // Verify tables exist
    const result = await ctx.db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects'"
    );

    if (!result.rows || result.rows.length === 0) {
      return err(
        createError('BOOTSTRAP_SCHEMA_VALIDATION_FAILED', 'Projects table not found after migration', 500)
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
