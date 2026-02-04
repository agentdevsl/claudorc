import { createId } from '@paralleldrive/cuid2';
import type { AgentRun, NewAgentRun } from '../../src/db/schema';
import { agentRuns } from '../../src/db/schema';
import { getTestDb } from '../helpers/database';

type AgentRunStatus = 'idle' | 'starting' | 'running' | 'paused' | 'error' | 'completed';

export type AgentRunFactoryOptions = Partial<
  Omit<NewAgentRun, 'agentId' | 'taskId' | 'projectId'>
> & {
  agentId?: string;
  taskId?: string;
  projectId?: string;
  status?: AgentRunStatus;
  turnsUsed?: number;
  tokensUsed?: number;
};

export function buildAgentRun(
  agentId: string,
  taskId: string,
  projectId: string,
  options: AgentRunFactoryOptions = {}
): NewAgentRun {
  const id = options.id ?? createId();

  return {
    id,
    agentId,
    taskId,
    projectId,
    sessionId: options.sessionId ?? null,
    status: options.status ?? 'running',
    startedAt: options.startedAt ?? new Date(),
    completedAt: options.completedAt ?? null,
    turnsUsed: options.turnsUsed ?? 0,
    tokensUsed: options.tokensUsed ?? 0,
    errorMessage: options.errorMessage ?? null,
  };
}

export async function createTestAgentRun(
  agentId: string,
  taskId: string,
  projectId: string,
  options: AgentRunFactoryOptions = {}
): Promise<AgentRun> {
  const db = getTestDb();
  const data = buildAgentRun(agentId, taskId, projectId, options);

  const [agentRun] = await db.insert(agentRuns).values(data).returning();

  if (!agentRun) {
    throw new Error('Failed to create test agent run');
  }

  return agentRun;
}

export async function createTestAgentRuns(
  agentId: string,
  taskId: string,
  projectId: string,
  count: number,
  options: AgentRunFactoryOptions = {}
): Promise<AgentRun[]> {
  const createdRuns: AgentRun[] = [];

  for (let i = 0; i < count; i++) {
    const run = await createTestAgentRun(agentId, taskId, projectId, {
      ...options,
      turnsUsed: options.turnsUsed ?? i * 10,
      tokensUsed: options.tokensUsed ?? i * 1000,
    });
    createdRuns.push(run);
  }

  return createdRuns;
}

export async function createCompletedAgentRun(
  agentId: string,
  taskId: string,
  projectId: string,
  options: AgentRunFactoryOptions = {}
): Promise<AgentRun> {
  return createTestAgentRun(agentId, taskId, projectId, {
    ...options,
    status: 'completed',
    completedAt: options.completedAt ?? new Date(),
    turnsUsed: options.turnsUsed ?? 25,
    tokensUsed: options.tokensUsed ?? 5000,
  });
}

export async function createFailedAgentRun(
  agentId: string,
  taskId: string,
  projectId: string,
  errorMessage: string,
  options: AgentRunFactoryOptions = {}
): Promise<AgentRun> {
  return createTestAgentRun(agentId, taskId, projectId, {
    ...options,
    status: 'error',
    completedAt: options.completedAt ?? new Date(),
    errorMessage,
  });
}
