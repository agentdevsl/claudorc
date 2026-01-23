-- Migration: Add sync interval fields to templates table
-- Allows automatic periodic syncing of templates from GitHub

-- Add sync interval column (minutes, null = disabled, minimum 5)
ALTER TABLE templates ADD COLUMN sync_interval_minutes INTEGER;

-- Add next sync time column (ISO datetime string)
ALTER TABLE templates ADD COLUMN next_sync_at TEXT;

-- Index for efficient scheduled sync queries
CREATE INDEX IF NOT EXISTS idx_templates_next_sync ON templates(next_sync_at)
  WHERE sync_interval_minutes IS NOT NULL AND next_sync_at IS NOT NULL;
