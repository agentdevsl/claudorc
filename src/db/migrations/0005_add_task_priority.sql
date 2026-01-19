-- Migration: Add priority field to tasks table
-- Priority can be 'high', 'medium', or 'low' with 'medium' as default

ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low'));
