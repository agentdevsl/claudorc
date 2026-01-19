-- Migration: Add templates table for org and project templates
-- This table stores template configurations that sync from GitHub repositories

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('org', 'project')),

  -- Git repository source
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  config_path TEXT DEFAULT '.claude',

  -- For project-scoped templates
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,

  -- Sync state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'syncing', 'error', 'disabled')),
  last_sync_sha TEXT,
  last_synced_at TEXT,
  sync_error TEXT,

  -- Cached content (JSON)
  cached_skills TEXT, -- JSON array of skills
  cached_commands TEXT, -- JSON array of commands
  cached_agents TEXT, -- JSON array of agents

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for scope-based queries
CREATE INDEX IF NOT EXISTS idx_templates_scope ON templates(scope);

-- Index for project-scoped templates
CREATE INDEX IF NOT EXISTS idx_templates_project_id ON templates(project_id);

-- Index for GitHub repo lookups (for webhook sync)
CREATE INDEX IF NOT EXISTS idx_templates_github_repo ON templates(github_owner, github_repo);

-- Unique constraint: same repo can only be added once per scope/project combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_unique_repo ON templates(
  github_owner,
  github_repo,
  scope,
  COALESCE(project_id, '')
);
