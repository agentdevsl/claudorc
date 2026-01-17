import type { AppError } from '../../errors/base.js';

export type AgentLifecycleState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error';

export type AgentLifecycleContext = {
  agentId?: string;
  taskId?: string;
  status: AgentLifecycleState;
  currentTurn: number;
  maxTurns: number;
  allowedTools: string[];
  error?: AppError;
};

export type AgentLifecycleEvent =
  | { type: 'START'; taskId: string }
  | { type: 'STEP'; turn: number }
  | { type: 'PAUSE'; reason: string }
  | { type: 'RESUME'; feedback?: string }
  | { type: 'ERROR'; error: AppError }
  | { type: 'COMPLETE'; result: unknown }
  | { type: 'ABORT' }
  | { type: 'TOOL'; tool: string };
