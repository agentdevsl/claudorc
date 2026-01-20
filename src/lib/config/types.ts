import type { ProjectSandboxConfig } from '../sandbox/types.js';

export type ProjectConfig = {
  worktreeRoot: string;
  initScript?: string;
  envFile?: string;
  defaultBranch: string;
  allowedTools: string[];
  maxTurns: number;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  /** Environment variables to pass to sandbox containers securely */
  envVars?: Record<string, string>;
  /** Sandbox configuration for Docker-based execution */
  sandbox?: ProjectSandboxConfig;
};

export type GlobalConfig = {
  anthropicApiKey: string;
  githubToken?: string;
  databaseUrl?: string;
  appUrl?: string;
};

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  worktreeRoot: '.worktrees',
  defaultBranch: 'main',
  allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
  maxTurns: 50,
};
