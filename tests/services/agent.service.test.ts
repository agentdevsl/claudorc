import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentRuns } from '../../src/db/schema/agent-runs';
import { agents } from '../../src/db/schema/agents';
import { tasks } from '../../src/db/schema/tasks';
import { AgentErrors } from '../../src/lib/errors/agent-errors';
import { ConcurrencyErrors } from '../../src/lib/errors/concurrency-errors';
import { ValidationErrors } from '../../src/lib/errors/validation-errors';
import { AgentService } from '../../src/services/agent.service';
import { createRunningAgent, createTestAgent } from '../factories/agent.factory';
import { createTestProject } from '../factories/project.factory';
import { createTestSession } from '../factories/session.factory';
import { createTestTask } from '../factories/task.factory';
import { createTestWorktree } from '../factories/worktree.factory';
import { clearTestDatabase, getTestDb, setupTestDatabase } from '../helpers/database';

// Mock external dependencies
vi.mock('../../src/lib/agents/stream-handler', () => ({
  runAgentWithStreaming: vi.fn(),
}));

vi.mock('../../src/lib/agents/hooks/index', () => ({
  createAgentHooks: vi.fn().mockReturnValue({
    PreToolUse: [],
    PostToolUse: [],
  }),
}));

import { runAgentWithStreaming } from '../../src/lib/agents/stream-handler';

const mockRunAgentWithStreaming = vi.mocked(runAgentWithStreaming);

describe('AgentService', () => {
  let agentService: AgentService;

  const mockWorktreeService = {
    create: vi.fn(),
  };

  const mockTaskService = {
    moveColumn: vi.fn().mockResolvedValue({ ok: true, value: {} }),
  };

  const mockSessionService = {
    create: vi.fn(),
    publish: vi.fn().mockResolvedValue({ ok: true }),
  };

  beforeEach(async () => {
    await setupTestDatabase();
    const db = getTestDb();
    agentService = new AgentService(
      db as never,
      mockWorktreeService,
      mockTaskService,
      mockSessionService
    );
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  // =============================================================================
  // Agent CRUD Operations (5 tests)
  // =============================================================================

  describe('Agent CRUD Operations', () => {
    it('creates an agent with default config', async () => {
      const project = await createTestProject({
        config: {
          worktreeRoot: '.worktrees',
          defaultBranch: 'main',
          allowedTools: [],
          maxTurns: 50,
        },
      });

      const result = await agentService.create({
        projectId: project.id,
        name: 'Test Agent',
        type: 'task',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Test Agent');
        expect(result.value.type).toBe('task');
        expect(result.value.status).toBe('idle');
        expect(result.value.config?.maxTurns).toBe(50);
        expect(result.value.config?.allowedTools).toEqual([]);
      }
    });

    it('creates an agent with custom config', async () => {
      const project = await createTestProject({
        config: {
          worktreeRoot: '.worktrees',
          defaultBranch: 'main',
          allowedTools: ['Read', 'Write'],
          maxTurns: 100,
        },
      });

      const result = await agentService.create({
        projectId: project.id,
        name: 'Custom Agent',
        type: 'task',
        config: {
          allowedTools: ['Read', 'Edit', 'Bash'],
          maxTurns: 75,
          model: 'claude-sonnet-4-20250514',
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.config?.allowedTools).toEqual(['Read', 'Edit', 'Bash']);
        expect(result.value.config?.maxTurns).toBe(75);
        expect(result.value.config?.model).toBe('claude-sonnet-4-20250514');
      }
    });

    it('returns error when creating agent for non-existent project', async () => {
      const result = await agentService.create({
        projectId: 'non-existent-id',
        name: 'Test Agent',
        type: 'task',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ID');
      }
    });

    it('retrieves an agent by ID', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id, { name: 'Find Me' });

      const result = await agentService.getById(agent.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(agent.id);
        expect(result.value.name).toBe('Find Me');
      }
    });

    it('returns error for non-existent agent', async () => {
      const result = await agentService.getById('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_FOUND');
      }
    });
  });

  // =============================================================================
  // Agent List Operations (3 tests)
  // =============================================================================

  describe('Agent List Operations', () => {
    it('lists agents for a project', async () => {
      const project = await createTestProject();
      await createTestAgent(project.id, { name: 'Agent 1' });
      await createTestAgent(project.id, { name: 'Agent 2' });

      const result = await agentService.list(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });

    it('lists all agents across projects', async () => {
      const project1 = await createTestProject();
      const project2 = await createTestProject();
      await createTestAgent(project1.id);
      await createTestAgent(project2.id);

      const result = await agentService.listAll();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });

    it('gets running count for all agents', async () => {
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id, { taskId: task.id });
      await createRunningAgent(project.id, task.id, session.id);
      await createTestAgent(project.id, { status: 'idle' });

      const result = await agentService.getRunningCountAll();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(1);
      }
    });
  });

  // =============================================================================
  // Agent Update Operations (4 tests)
  // =============================================================================

  describe('Agent Update Operations', () => {
    it('updates agent config', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id, {
        config: { allowedTools: ['Read'], maxTurns: 50 },
      });

      const result = await agentService.update(agent.id, {
        maxTurns: 100,
        systemPrompt: 'New prompt',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.config?.maxTurns).toBe(100);
        expect(result.value.config?.systemPrompt).toBe('New prompt');
      }
    });

    it('prevents updating critical config of running agent', async () => {
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id, { taskId: task.id });
      const agent = await createRunningAgent(project.id, task.id, session.id);

      const result = await agentService.update(agent.id, {
        allowedTools: ['Read', 'Write'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_ALREADY_RUNNING');
      }
    });

    it('returns error when updating non-existent agent', async () => {
      const result = await agentService.update('non-existent-id', {
        maxTurns: 100,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_FOUND');
      }
    });

    it('deletes an agent', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);

      const result = await agentService.delete(agent.id);

      expect(result.ok).toBe(true);

      const getResult = await agentService.getById(agent.id);
      expect(getResult.ok).toBe(false);
    });
  });

  // =============================================================================
  // Agent Start Operations (6 tests)
  // =============================================================================

  describe('Agent Start Operations', () => {
    it('starts an agent with a specific task', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);
      const task = await createTestTask(project.id, { column: 'backlog' });
      const worktree = await createTestWorktree(project.id, { taskId: task.id });
      const session = await createTestSession(project.id, { taskId: task.id, agentId: agent.id });

      mockWorktreeService.create.mockResolvedValue({ ok: true, value: worktree });
      mockSessionService.create.mockResolvedValue({ ok: true, value: session });
      mockRunAgentWithStreaming.mockResolvedValue({
        runId: 'run-1',
        status: 'completed',
        turnCount: 5,
      });

      const result = await agentService.start(agent.id, task.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.agent.status).toBe('running');
        expect(result.value.task.id).toBe(task.id);
        expect(mockWorktreeService.create).toHaveBeenCalled();
        expect(mockSessionService.create).toHaveBeenCalled();
      }
    });

    it('starts an agent and picks next available task', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);
      const task = await createTestTask(project.id, { column: 'backlog', title: 'Available Task' });
      const worktree = await createTestWorktree(project.id, { taskId: task.id });
      const session = await createTestSession(project.id, { taskId: task.id, agentId: agent.id });

      mockWorktreeService.create.mockResolvedValue({ ok: true, value: worktree });
      mockSessionService.create.mockResolvedValue({ ok: true, value: session });
      mockRunAgentWithStreaming.mockResolvedValue({
        runId: 'run-1',
        status: 'completed',
        turnCount: 5,
      });

      const result = await agentService.start(agent.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.task.title).toBe('Available Task');
      }
    });

    it('returns error when agent is already running', async () => {
      const project = await createTestProject();
      const task = await createTestTask(project.id, { column: 'backlog' });
      const session = await createTestSession(project.id, { taskId: task.id });
      const agent = await createRunningAgent(project.id, task.id, session.id);

      const result = await agentService.start(agent.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_ALREADY_RUNNING');
      }
    });

    it('returns error when no tasks available', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);

      const result = await agentService.start(agent.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NO_AVAILABLE_TASK');
      }
    });

    it('returns error when task is not in backlog', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);
      await createTestTask(project.id, { column: 'in_progress' });

      const result = await agentService.start(agent.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NO_AVAILABLE_TASK');
      }
    });

    it('returns error when concurrency limit exceeded', async () => {
      const project = await createTestProject({ maxConcurrentAgents: 1 });
      const task1 = await createTestTask(project.id, { column: 'in_progress' });
      const session1 = await createTestSession(project.id, { taskId: task1.id });
      await createRunningAgent(project.id, task1.id, session1.id);

      const agent2 = await createTestAgent(project.id);
      await createTestTask(project.id, { column: 'backlog' });

      const result = await agentService.start(agent2.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      }
    });
  });

  // =============================================================================
  // Agent Stop Operations (2 tests)
  // =============================================================================

  describe('Agent Stop Operations', () => {
    it('returns error when stopping non-running agent', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id, { status: 'idle' });

      const result = await agentService.stop(agent.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_RUNNING');
      }
    });

    it('returns not running error for unknown agent', async () => {
      // Agent is not in the running agents map
      const result = await agentService.stop('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_RUNNING');
      }
    });
  });

  // =============================================================================
  // Agent Pause/Resume Operations (4 tests)
  // =============================================================================

  describe('Agent Pause/Resume Operations', () => {
    it('pauses a running agent', async () => {
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id, { taskId: task.id });
      const agent = await createRunningAgent(project.id, task.id, session.id);

      const result = await agentService.pause(agent.id);

      expect(result.ok).toBe(true);

      const db = getTestDb();
      const updatedAgent = await db.query.agents.findFirst({
        where: eq(agents.id, agent.id),
      });
      expect(updatedAgent?.status).toBe('paused');
    });

    it('returns error when pausing non-existent agent', async () => {
      const result = await agentService.pause('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_FOUND');
      }
    });

    it('resumes a paused agent', async () => {
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id, { taskId: task.id });
      const agent = await createTestAgent(project.id, {
        status: 'paused',
        currentTaskId: task.id,
        currentSessionId: session.id,
        currentTurn: 10,
      });

      const result = await agentService.resume(agent.id, 'Continue please');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.turnCount).toBe(10);
      }

      const db = getTestDb();
      const updatedAgent = await db.query.agents.findFirst({
        where: eq(agents.id, agent.id),
      });
      expect(updatedAgent?.status).toBe('running');
      expect(mockSessionService.publish).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          type: 'approval:rejected',
          data: { feedback: 'Continue please' },
        })
      );
    });

    it('returns error when resuming non-existent agent', async () => {
      const result = await agentService.resume('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_FOUND');
      }
    });
  });

  // =============================================================================
  // Availability and Queue Operations (5 tests)
  // =============================================================================

  describe('Availability and Queue Operations', () => {
    it('checks availability when under limit', async () => {
      const project = await createTestProject({ maxConcurrentAgents: 3 });
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id, { taskId: task.id });
      await createRunningAgent(project.id, task.id, session.id);

      const result = await agentService.checkAvailability(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('checks availability when at limit', async () => {
      const project = await createTestProject({ maxConcurrentAgents: 1 });
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id, { taskId: task.id });
      await createRunningAgent(project.id, task.id, session.id);

      const result = await agentService.checkAvailability(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    it('returns false availability for non-existent project', async () => {
      const result = await agentService.checkAvailability('non-existent-id');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });

    it('gets running count for a project', async () => {
      const project = await createTestProject();
      const task1 = await createTestTask(project.id);
      const task2 = await createTestTask(project.id);
      const session1 = await createTestSession(project.id, { taskId: task1.id });
      const session2 = await createTestSession(project.id, { taskId: task2.id });
      await createRunningAgent(project.id, task1.id, session1.id);
      await createRunningAgent(project.id, task2.id, session2.id);
      await createTestAgent(project.id, { status: 'idle' });

      const result = await agentService.getRunningCount(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(2);
      }
    });

    it('returns queue full error when queueing task', async () => {
      const project = await createTestProject();
      const task = await createTestTask(project.id);

      const result = await agentService.queueTask(project.id, task.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('QUEUE_FULL');
      }
    });
  });

  // =============================================================================
  // Queue Stats Operations (3 tests)
  // =============================================================================

  describe('Queue Stats Operations', () => {
    it('returns null for queue position when not queued', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);

      const result = await agentService.getQueuePosition(agent.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('returns empty queue stats', async () => {
      const project = await createTestProject();

      const result = await agentService.getQueueStats(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalQueued).toBe(0);
        expect(result.value.averageCompletionMs).toBe(0);
        expect(result.value.recentCompletions).toBe(0);
      }
    });

    it('returns empty queued tasks list', async () => {
      const project = await createTestProject();

      const result = await agentService.getQueuedTasks(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });

  // =============================================================================
  // Hook Registration (2 tests)
  // =============================================================================

  describe('Hook Registration', () => {
    it('registers pre-tool use hook', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);

      const hook = vi.fn().mockResolvedValue({ deny: false });
      agentService.registerPreToolUseHook(agent.id, hook);

      // Hook registration should not throw
      expect(true).toBe(true);
    });

    it('registers post-tool use hook', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);

      const hook = vi.fn().mockResolvedValue(undefined);
      agentService.registerPostToolUseHook(agent.id, hook);

      // Hook registration should not throw
      expect(true).toBe(true);
    });
  });

  // =============================================================================
  // Session Creation Failure (1 test)
  // =============================================================================

  describe('Session Creation Failure', () => {
    it('returns error when session creation fails', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);
      const task = await createTestTask(project.id, { column: 'backlog' });
      const worktree = await createTestWorktree(project.id, { taskId: task.id });

      mockWorktreeService.create.mockResolvedValue({ ok: true, value: worktree });
      mockSessionService.create.mockResolvedValue({ ok: false, error: { code: 'SESSION_ERROR' } });

      const result = await agentService.start(agent.id, task.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_EXECUTION_ERROR');
      }
    });
  });

  // =============================================================================
  // Worktree Creation Failure (1 test)
  // =============================================================================

  describe('Worktree Creation Failure', () => {
    it('returns error when worktree creation fails', async () => {
      const project = await createTestProject();
      const agent = await createTestAgent(project.id);
      await createTestTask(project.id, { column: 'backlog' });

      mockWorktreeService.create.mockResolvedValue({
        ok: false,
        error: AgentErrors.EXECUTION_ERROR('Worktree creation failed'),
      });

      const result = await agentService.start(agent.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_EXECUTION_ERROR');
      }
    });
  });

  // =============================================================================
  // Delete Non-Existent Agent (1 test)
  // =============================================================================

  describe('Delete Non-Existent Agent', () => {
    it('returns error when deleting non-existent agent', async () => {
      const result = await agentService.delete('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_NOT_FOUND');
      }
    });
  });
});
