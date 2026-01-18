-- Add 'queued' value to task_column enum
ALTER TYPE "public"."task_column" ADD VALUE IF NOT EXISTS 'queued';--> statement-breakpoint

-- Add 'queued' value to agent_status enum
ALTER TYPE "public"."agent_status" ADD VALUE IF NOT EXISTS 'queued';--> statement-breakpoint

-- Add queued_at column to tasks table
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "queued_at" timestamp;
