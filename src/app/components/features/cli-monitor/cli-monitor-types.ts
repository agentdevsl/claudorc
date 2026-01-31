// Shared types for CLI Monitor views

export type CliSessionStatus = 'working' | 'waiting_for_approval' | 'waiting_for_input' | 'idle';
export type PageState = 'install' | 'waiting' | 'active';
export type AggregateStatus = 'nominal' | 'attention' | 'idle';

export interface CliSession {
  sessionId: string;
  filePath: string;
  cwd: string;
  projectName: string;
  projectHash?: string;
  gitBranch?: string;
  status: CliSessionStatus;
  messageCount: number;
  turnCount: number;
  goal?: string;
  recentOutput?: string;
  pendingToolUse?: { toolName: string; toolId: string };
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    ephemeral5mTokens?: number;
    ephemeral1hTokens?: number;
  };
  model?: string;
  startedAt: number;
  lastActivityAt: number;
  isSubagent: boolean;
  parentSessionId?: string;
}

export interface AlertToast {
  id: string;
  type: 'approval' | 'input' | 'complete' | 'error' | 'new-session';
  title: string;
  detail: string;
  sessionId: string;
  autoDismiss: boolean;
  createdAt: number;
}
