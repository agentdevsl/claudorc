export type ProjectConfig = {
  worktreeRoot: string;
  initScript?: string;
  envFile?: string;
  defaultBranch: string;
  maxConcurrentAgents: number;
  allowedTools: string[];
  maxTurns: number;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
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
  maxConcurrentAgents: 3,
  allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
  maxTurns: 50,
};
