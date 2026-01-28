CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`task_id` text NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text,
	`status` text NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`turns_used` integer DEFAULT 0,
	`tokens_used` integer DEFAULT 0,
	`error_message` text,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'task' NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`config` text,
	`current_task_id` text,
	`current_session_id` text,
	`current_turn` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`service` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`masked_key` text NOT NULL,
	`is_valid` integer DEFAULT true,
	`last_validated_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_service_unique` ON `api_keys` (`service`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text,
	`agent_run_id` text,
	`task_id` text,
	`project_id` text,
	`tool` text NOT NULL,
	`status` text NOT NULL,
	`input` text,
	`output` text,
	`error_message` text,
	`duration_ms` integer,
	`turn_number` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`agent_run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `github_installations` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`account_login` text NOT NULL,
	`account_type` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_installations_installation_id_unique` ON `github_installations` (`installation_id`);--> statement-breakpoint
CREATE TABLE `github_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`encrypted_token` text NOT NULL,
	`token_type` text DEFAULT 'pat' NOT NULL,
	`scopes` text,
	`github_login` text,
	`github_id` text,
	`is_valid` integer DEFAULT true,
	`last_validated_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repository_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`installation_id` text NOT NULL,
	`owner` text NOT NULL,
	`repo` text NOT NULL,
	`config` text,
	`synced_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`installation_id`) REFERENCES `github_installations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `marketplaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`github_owner` text NOT NULL,
	`github_repo` text NOT NULL,
	`branch` text DEFAULT 'main',
	`plugins_path` text DEFAULT 'plugins',
	`is_default` integer DEFAULT false,
	`is_enabled` integer DEFAULT true,
	`status` text DEFAULT 'active',
	`last_sync_sha` text,
	`last_synced_at` text,
	`sync_error` text,
	`cached_plugins` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`project_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`turns` text DEFAULT '[]',
	`github_issue_url` text,
	`github_issue_number` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`completed_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`description` text,
	`config` text,
	`max_concurrent_agents` integer DEFAULT 3,
	`github_owner` text,
	`github_repo` text,
	`github_installation_id` text,
	`config_path` text DEFAULT '.claude',
	`sandbox_config_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`github_installation_id`) REFERENCES `github_installations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sandbox_config_id`) REFERENCES `sandbox_configs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_path_unique` ON `projects` (`path`);--> statement-breakpoint
CREATE TABLE `sandbox_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'docker' NOT NULL,
	`is_default` integer DEFAULT false,
	`base_image` text DEFAULT 'node:22-slim' NOT NULL,
	`memory_mb` integer DEFAULT 4096 NOT NULL,
	`cpu_cores` real DEFAULT 2 NOT NULL,
	`max_processes` integer DEFAULT 256 NOT NULL,
	`timeout_minutes` integer DEFAULT 60 NOT NULL,
	`volume_mount_path` text,
	`kube_config_path` text,
	`kube_context` text,
	`kube_namespace` text DEFAULT 'agentpane-sandboxes',
	`network_policy_enabled` integer DEFAULT true,
	`allowed_egress_hosts` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sandbox_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`container_id` text NOT NULL,
	`status` text DEFAULT 'stopped' NOT NULL,
	`image` text NOT NULL,
	`memory_mb` integer NOT NULL,
	`cpu_cores` integer NOT NULL,
	`idle_timeout_minutes` integer NOT NULL,
	`volume_mounts` text DEFAULT '[]',
	`env` text,
	`error_message` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_activity_at` text DEFAULT (datetime('now')) NOT NULL,
	`stopped_at` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sandbox_instances_project_id_unique` ON `sandbox_instances` (`project_id`);--> statement-breakpoint
CREATE TABLE `sandbox_tmux_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`sandbox_id` text NOT NULL,
	`session_name` text NOT NULL,
	`task_id` text,
	`window_count` integer DEFAULT 1 NOT NULL,
	`attached` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`last_activity_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`sandbox_id`) REFERENCES `sandbox_instances`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sandbox_session_unique` ON `sandbox_tmux_sessions` (`sandbox_id`,`session_name`);--> statement-breakpoint
CREATE TABLE `session_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`offset` integer NOT NULL,
	`type` text NOT NULL,
	`channel` text NOT NULL,
	`data` text NOT NULL,
	`timestamp` integer NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_events_session_idx` ON `session_events` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_events_offset_idx` ON `session_events` (`session_id`,`offset`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_events_unique_offset` ON `session_events` (`session_id`,`offset`);--> statement-breakpoint
CREATE TABLE `session_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`duration_ms` integer,
	`turns_count` integer DEFAULT 0,
	`tokens_used` integer DEFAULT 0,
	`files_modified` integer DEFAULT 0,
	`lines_added` integer DEFAULT 0,
	`lines_removed` integer DEFAULT 0,
	`final_status` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_summaries_session_id_unique` ON `session_summaries` (`session_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text,
	`agent_id` text,
	`status` text DEFAULT 'idle' NOT NULL,
	`title` text,
	`url` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`agent_id` text,
	`session_id` text,
	`worktree_id` text,
	`title` text NOT NULL,
	`description` text,
	`column` text DEFAULT 'backlog' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`labels` text DEFAULT '[]',
	`priority` text DEFAULT 'medium',
	`branch` text,
	`diff_summary` text,
	`approved_at` text,
	`approved_by` text,
	`rejection_count` integer DEFAULT 0,
	`rejection_reason` text,
	`model_override` text,
	`plan_options` text,
	`plan` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`started_at` text,
	`completed_at` text,
	`last_agent_status` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `template_projects` (
	`template_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`template_id`, `project_id`),
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`scope` text NOT NULL,
	`github_owner` text NOT NULL,
	`github_repo` text NOT NULL,
	`branch` text DEFAULT 'main',
	`config_path` text DEFAULT '.claude',
	`project_id` text,
	`status` text DEFAULT 'active',
	`last_sync_sha` text,
	`last_synced_at` text,
	`sync_error` text,
	`sync_interval_minutes` integer,
	`next_sync_at` text,
	`cached_skills` text,
	`cached_commands` text,
	`cached_agents` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`nodes` text,
	`edges` text,
	`source_template_id` text,
	`source_template_name` text,
	`viewport` text,
	`status` text DEFAULT 'draft',
	`tags` text,
	`thumbnail` text,
	`ai_generated` integer,
	`ai_model` text,
	`ai_confidence` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `worktrees` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`agent_id` text,
	`task_id` text,
	`branch` text NOT NULL,
	`path` text NOT NULL,
	`base_branch` text DEFAULT 'main' NOT NULL,
	`status` text DEFAULT 'creating' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`merged_at` text,
	`removed_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
