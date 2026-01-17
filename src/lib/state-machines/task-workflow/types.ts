export type TaskColumn = 'backlog' | 'in_progress' | 'waiting_approval' | 'verified';

export type TaskWorkflowState = TaskColumn;

export type TaskWorkflowContext = {
  taskId: string;
  column: TaskColumn;
  agentId?: string;
  diffSummary?: { filesChanged: number } | null;
  runningAgents: number;
  maxConcurrentAgents: number;
};

export type TaskWorkflowEvent =
  | { type: 'ASSIGN'; agentId: string }
  | { type: 'COMPLETE' }
  | { type: 'APPROVE' }
  | { type: 'REJECT'; reason?: string }
  | { type: 'CANCEL' };
