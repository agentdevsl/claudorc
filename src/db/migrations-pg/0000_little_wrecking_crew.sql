CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"task_id" text NOT NULL,
	"project_id" text NOT NULL,
	"session_id" text,
	"status" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"turns_used" integer DEFAULT 0,
	"tokens_used" integer DEFAULT 0,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'task' NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"config" jsonb,
	"current_task_id" text,
	"current_session_id" text,
	"current_turn" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"masked_key" text NOT NULL,
	"is_valid" boolean DEFAULT true,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_service_unique" UNIQUE("service")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text,
	"agent_run_id" text,
	"task_id" text,
	"project_id" text,
	"tool" text NOT NULL,
	"status" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_message" text,
	"duration_ms" integer,
	"turn_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cli_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"file_path" text NOT NULL,
	"cwd" text NOT NULL,
	"project_name" text NOT NULL,
	"project_hash" text NOT NULL,
	"git_branch" text,
	"status" text DEFAULT 'idle' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"goal" text,
	"recent_output" text,
	"pending_tool_use" text,
	"token_usage" text,
	"performance_metrics" text,
	"model" text,
	"started_at" integer NOT NULL,
	"last_activity_at" integer NOT NULL,
	"is_subagent" boolean DEFAULT false NOT NULL,
	"parent_session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cli_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_installations_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
CREATE TABLE "github_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"encrypted_token" text NOT NULL,
	"token_type" text DEFAULT 'pat' NOT NULL,
	"scopes" text,
	"github_login" text,
	"github_id" text,
	"is_valid" boolean DEFAULT true,
	"last_validated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"config" jsonb,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"github_owner" text NOT NULL,
	"github_repo" text NOT NULL,
	"branch" text DEFAULT 'main',
	"plugins_path" text DEFAULT 'plugins',
	"is_default" boolean DEFAULT false,
	"is_enabled" boolean DEFAULT true,
	"status" text DEFAULT 'active',
	"last_sync_sha" text,
	"last_synced_at" timestamp,
	"sync_error" text,
	"cached_plugins" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"project_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb,
	"github_issue_url" text,
	"github_issue_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"description" text,
	"config" jsonb,
	"max_concurrent_agents" integer DEFAULT 3,
	"github_owner" text,
	"github_repo" text,
	"github_installation_id" text,
	"config_path" text DEFAULT '.claude',
	"sandbox_config_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "sandbox_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'docker' NOT NULL,
	"is_default" boolean DEFAULT false,
	"base_image" text DEFAULT 'node:22-slim' NOT NULL,
	"memory_mb" integer DEFAULT 4096 NOT NULL,
	"cpu_cores" double precision DEFAULT 2 NOT NULL,
	"max_processes" integer DEFAULT 256 NOT NULL,
	"timeout_minutes" integer DEFAULT 60 NOT NULL,
	"volume_mount_path" text,
	"kube_config_path" text,
	"kube_context" text,
	"kube_namespace" text DEFAULT 'agentpane-sandboxes',
	"network_policy_enabled" boolean DEFAULT true,
	"allowed_egress_hosts" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"container_id" text NOT NULL,
	"status" text DEFAULT 'stopped' NOT NULL,
	"image" text NOT NULL,
	"memory_mb" integer NOT NULL,
	"cpu_cores" integer NOT NULL,
	"idle_timeout_minutes" integer NOT NULL,
	"volume_mounts" jsonb DEFAULT '[]'::jsonb,
	"env" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"stopped_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_instances_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "sandbox_tmux_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"sandbox_id" text NOT NULL,
	"session_name" text NOT NULL,
	"task_id" text,
	"window_count" integer DEFAULT 1 NOT NULL,
	"attached" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_session_unique" UNIQUE("sandbox_id","session_name")
);
--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"offset" integer NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"data" jsonb NOT NULL,
	"timestamp" integer NOT NULL,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"duration_ms" integer,
	"turns_count" integer DEFAULT 0,
	"tokens_used" integer DEFAULT 0,
	"files_modified" integer DEFAULT 0,
	"lines_added" integer DEFAULT 0,
	"lines_removed" integer DEFAULT 0,
	"final_status" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_summaries_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text,
	"agent_id" text,
	"status" text DEFAULT 'idle' NOT NULL,
	"title" text,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"agent_id" text,
	"session_id" text,
	"worktree_id" text,
	"title" text NOT NULL,
	"description" text,
	"column" text DEFAULT 'backlog' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb,
	"priority" text DEFAULT 'medium',
	"branch" text,
	"diff_summary" jsonb,
	"approved_at" timestamp,
	"approved_by" text,
	"rejection_count" integer DEFAULT 0,
	"rejection_reason" text,
	"model_override" text,
	"plan_options" jsonb,
	"plan" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_agent_status" text
);
--> statement-breakpoint
CREATE TABLE "template_projects" (
	"template_id" text NOT NULL,
	"project_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "template_projects_template_id_project_id_pk" PRIMARY KEY("template_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scope" text NOT NULL,
	"github_owner" text NOT NULL,
	"github_repo" text NOT NULL,
	"branch" text DEFAULT 'main',
	"config_path" text DEFAULT '.claude',
	"project_id" text,
	"status" text DEFAULT 'active',
	"last_sync_sha" text,
	"last_synced_at" timestamp,
	"sync_error" text,
	"sync_interval_minutes" integer,
	"next_sync_at" timestamp,
	"cached_skills" jsonb,
	"cached_commands" jsonb,
	"cached_agents" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terraform_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"registry_id" text NOT NULL,
	"name" text NOT NULL,
	"namespace" text NOT NULL,
	"provider" text NOT NULL,
	"version" text NOT NULL,
	"source" text NOT NULL,
	"description" text,
	"readme" text,
	"inputs" jsonb,
	"outputs" jsonb,
	"dependencies" jsonb,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terraform_registries" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"org_name" text NOT NULL,
	"token_setting_key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp,
	"sync_error" text,
	"module_count" integer DEFAULT 0,
	"sync_interval_minutes" integer,
	"next_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"nodes" jsonb,
	"edges" jsonb,
	"source_template_id" text,
	"source_template_name" text,
	"viewport" jsonb,
	"status" text DEFAULT 'draft',
	"tags" jsonb,
	"thumbnail" text,
	"ai_generated" boolean,
	"ai_model" text,
	"ai_confidence" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worktrees" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"agent_id" text,
	"task_id" text,
	"branch" text NOT NULL,
	"path" text NOT NULL,
	"base_branch" text DEFAULT 'main' NOT NULL,
	"status" text DEFAULT 'creating' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"merged_at" timestamp,
	"removed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_configs" ADD CONSTRAINT "repository_configs_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_github_installation_id_github_installations_id_fk" FOREIGN KEY ("github_installation_id") REFERENCES "public"."github_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_sandbox_config_id_sandbox_configs_id_fk" FOREIGN KEY ("sandbox_config_id") REFERENCES "public"."sandbox_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_instances" ADD CONSTRAINT "sandbox_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_tmux_sessions" ADD CONSTRAINT "sandbox_tmux_sessions_sandbox_id_sandbox_instances_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "public"."sandbox_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_tmux_sessions" ADD CONSTRAINT "sandbox_tmux_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_summaries" ADD CONSTRAINT "session_summaries_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_worktree_id_worktrees_id_fk" FOREIGN KEY ("worktree_id") REFERENCES "public"."worktrees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_projects" ADD CONSTRAINT "template_projects_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_projects" ADD CONSTRAINT "template_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_source_template_id_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worktrees" ADD CONSTRAINT "worktrees_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worktrees" ADD CONSTRAINT "worktrees_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worktrees" ADD CONSTRAINT "worktrees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cli_sessions_project" ON "cli_sessions" USING btree ("project_hash","last_activity_at");--> statement-breakpoint
CREATE INDEX "idx_cli_sessions_status" ON "cli_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cli_sessions_last_activity" ON "cli_sessions" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "session_events_session_idx" ON "session_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_events_offset_idx" ON "session_events" USING btree ("session_id","offset");--> statement-breakpoint
CREATE UNIQUE INDEX "session_events_unique_offset" ON "session_events" USING btree ("session_id","offset");--> statement-breakpoint
CREATE INDEX "idx_tf_modules_registry" ON "terraform_modules" USING btree ("registry_id");--> statement-breakpoint
CREATE INDEX "idx_tf_modules_provider" ON "terraform_modules" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_tf_modules_name" ON "terraform_modules" USING btree ("name");
