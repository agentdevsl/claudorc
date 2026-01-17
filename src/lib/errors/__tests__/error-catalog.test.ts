import { describe, expect, it } from 'vitest';
import {
  AgentErrors,
  ConcurrencyErrors,
  createError,
  GitHubErrors,
  ProjectErrors,
  SessionErrors,
  TaskErrors,
  ValidationErrors,
  WorktreeErrors,
} from '../index.js';

describe('error catalog', () => {
  it('createError builds AppError objects', () => {
    const error = createError('SAMPLE', 'Sample error', 418, { note: 'ok' });

    expect(error).toEqual({
      code: 'SAMPLE',
      message: 'Sample error',
      status: 418,
      details: { note: 'ok' },
    });
  });

  it('ProjectErrors.NOT_FOUND', () => {
    expect(ProjectErrors.NOT_FOUND).toEqual({
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
      status: 404,
      details: undefined,
    });
  });

  it('ProjectErrors.PATH_EXISTS', () => {
    expect(ProjectErrors.PATH_EXISTS).toEqual({
      code: 'PROJECT_PATH_EXISTS',
      message: 'A project with this path already exists',
      status: 409,
      details: undefined,
    });
  });

  it('ProjectErrors.PATH_INVALID', () => {
    const error = ProjectErrors.PATH_INVALID('/tmp/project');

    expect(error).toEqual({
      code: 'PROJECT_PATH_INVALID',
      message: 'Invalid project path: /tmp/project',
      status: 400,
      details: { path: '/tmp/project' },
    });
  });

  it('ProjectErrors.HAS_RUNNING_AGENTS', () => {
    const error = ProjectErrors.HAS_RUNNING_AGENTS(2);

    expect(error).toEqual({
      code: 'PROJECT_HAS_RUNNING_AGENTS',
      message: 'Cannot delete project with 2 running agent(s)',
      status: 409,
      details: { runningAgentCount: 2 },
    });
  });

  it('ProjectErrors.CONFIG_INVALID', () => {
    const error = ProjectErrors.CONFIG_INVALID(['invalid']);

    expect(error).toEqual({
      code: 'PROJECT_CONFIG_INVALID',
      message: 'Invalid project configuration',
      status: 400,
      details: { validationErrors: ['invalid'] },
    });
  });

  it('TaskErrors.NOT_FOUND', () => {
    expect(TaskErrors.NOT_FOUND).toEqual({
      code: 'TASK_NOT_FOUND',
      message: 'Task not found',
      status: 404,
      details: undefined,
    });
  });

  it('TaskErrors.NOT_IN_COLUMN', () => {
    const error = TaskErrors.NOT_IN_COLUMN('backlog', 'in_progress');

    expect(error).toEqual({
      code: 'TASK_NOT_IN_COLUMN',
      message: 'Task is in "in_progress" but expected "backlog"',
      status: 400,
      details: { expected: 'backlog', actual: 'in_progress' },
    });
  });

  it('TaskErrors.ALREADY_ASSIGNED', () => {
    const error = TaskErrors.ALREADY_ASSIGNED('agent-1');

    expect(error).toEqual({
      code: 'TASK_ALREADY_ASSIGNED',
      message: 'Task is already assigned to an agent',
      status: 409,
      details: { agentId: 'agent-1' },
    });
  });

  it('TaskErrors.NO_DIFF', () => {
    expect(TaskErrors.NO_DIFF).toEqual({
      code: 'TASK_NO_DIFF',
      message: 'No changes to approve',
      status: 400,
      details: undefined,
    });
  });

  it('TaskErrors.ALREADY_APPROVED', () => {
    expect(TaskErrors.ALREADY_APPROVED).toEqual({
      code: 'TASK_ALREADY_APPROVED',
      message: 'Task has already been approved',
      status: 409,
      details: undefined,
    });
  });

  it('TaskErrors.NOT_WAITING_APPROVAL', () => {
    const error = TaskErrors.NOT_WAITING_APPROVAL('in_progress');

    expect(error).toEqual({
      code: 'TASK_NOT_WAITING_APPROVAL',
      message: 'Task is not waiting for approval (current: in_progress)',
      status: 400,
      details: { currentColumn: 'in_progress' },
    });
  });

  it('TaskErrors.INVALID_TRANSITION', () => {
    const error = TaskErrors.INVALID_TRANSITION('backlog', 'verified');

    expect(error.code).toBe('TASK_INVALID_TRANSITION');
    expect(error.status).toBe(400);
    expect(error.details).toMatchObject({
      from: 'backlog',
      to: 'verified',
      allowedTransitions: ['in_progress'],
    });
  });

  it('TaskErrors.POSITION_CONFLICT', () => {
    expect(TaskErrors.POSITION_CONFLICT).toEqual({
      code: 'TASK_POSITION_CONFLICT',
      message: 'Position conflict in column. Please refresh and try again.',
      status: 409,
      details: undefined,
    });
  });

  it('AgentErrors.NOT_FOUND', () => {
    expect(AgentErrors.NOT_FOUND).toEqual({
      code: 'AGENT_NOT_FOUND',
      message: 'Agent not found',
      status: 404,
      details: undefined,
    });
  });

  it('AgentErrors.ALREADY_RUNNING', () => {
    const error = AgentErrors.ALREADY_RUNNING('task-1');

    expect(error).toEqual({
      code: 'AGENT_ALREADY_RUNNING',
      message: 'Agent is already running',
      status: 409,
      details: { currentTaskId: 'task-1' },
    });
  });

  it('AgentErrors.NOT_RUNNING', () => {
    expect(AgentErrors.NOT_RUNNING).toEqual({
      code: 'AGENT_NOT_RUNNING',
      message: 'Agent is not running',
      status: 400,
      details: undefined,
    });
  });

  it('AgentErrors.TURN_LIMIT_EXCEEDED', () => {
    const error = AgentErrors.TURN_LIMIT_EXCEEDED(10, 5);

    expect(error).toEqual({
      code: 'AGENT_TURN_LIMIT_EXCEEDED',
      message: 'Agent completed 10 turns (limit: 5)',
      status: 200,
      details: { turns: 10, maxTurns: 5 },
    });
  });

  it('AgentErrors.NO_AVAILABLE_TASK', () => {
    expect(AgentErrors.NO_AVAILABLE_TASK).toEqual({
      code: 'AGENT_NO_AVAILABLE_TASK',
      message: 'No available tasks for agent',
      status: 400,
      details: undefined,
    });
  });

  it('AgentErrors.TOOL_NOT_ALLOWED', () => {
    const error = AgentErrors.TOOL_NOT_ALLOWED('Bash', ['Read']);

    expect(error).toEqual({
      code: 'AGENT_TOOL_NOT_ALLOWED',
      message: 'Tool "Bash" is not allowed for this agent',
      status: 403,
      details: { tool: 'Bash', allowedTools: ['Read'] },
    });
  });

  it('AgentErrors.EXECUTION_ERROR', () => {
    const error = AgentErrors.EXECUTION_ERROR('boom');

    expect(error).toEqual({
      code: 'AGENT_EXECUTION_ERROR',
      message: 'Agent execution failed: boom',
      status: 500,
      details: { error: 'boom' },
    });
  });

  it('ConcurrencyErrors.LIMIT_EXCEEDED', () => {
    const error = ConcurrencyErrors.LIMIT_EXCEEDED(4, 3);

    expect(error).toEqual({
      code: 'CONCURRENCY_LIMIT_EXCEEDED',
      message: 'Maximum concurrent agents reached (4/3)',
      status: 429,
      details: { currentAgents: 4, maxAgents: 3 },
    });
  });

  it('ConcurrencyErrors.QUEUE_FULL', () => {
    const error = ConcurrencyErrors.QUEUE_FULL(8, 5);

    expect(error).toEqual({
      code: 'QUEUE_FULL',
      message: 'Task queue is full (8/5)',
      status: 429,
      details: { queueSize: 8, maxSize: 5 },
    });
  });

  it('ConcurrencyErrors.RESOURCE_LOCKED', () => {
    const error = ConcurrencyErrors.RESOURCE_LOCKED('task-1', 'agent-1');

    expect(error).toEqual({
      code: 'RESOURCE_LOCKED',
      message: 'Resource "task-1" is locked by another operation',
      status: 423,
      details: { resource: 'task-1', lockedBy: 'agent-1' },
    });
  });

  it('WorktreeErrors.CREATION_FAILED', () => {
    const error = WorktreeErrors.CREATION_FAILED('feature', 'fatal');

    expect(error).toEqual({
      code: 'WORKTREE_CREATION_FAILED',
      message: 'Failed to create worktree for branch "feature"',
      status: 500,
      details: { branch: 'feature', error: 'fatal' },
    });
  });

  it('WorktreeErrors.NOT_FOUND', () => {
    expect(WorktreeErrors.NOT_FOUND).toEqual({
      code: 'WORKTREE_NOT_FOUND',
      message: 'Worktree not found',
      status: 404,
      details: undefined,
    });
  });

  it('WorktreeErrors.BRANCH_EXISTS', () => {
    const error = WorktreeErrors.BRANCH_EXISTS('feature');

    expect(error).toEqual({
      code: 'WORKTREE_BRANCH_EXISTS',
      message: 'Branch "feature" already exists',
      status: 409,
      details: { branch: 'feature' },
    });
  });

  it('WorktreeErrors.MERGE_CONFLICT', () => {
    const error = WorktreeErrors.MERGE_CONFLICT(['a.ts']);

    expect(error).toEqual({
      code: 'WORKTREE_MERGE_CONFLICT',
      message: 'Merge conflict detected',
      status: 409,
      details: { conflictingFiles: ['a.ts'] },
    });
  });

  it('WorktreeErrors.DIRTY', () => {
    const error = WorktreeErrors.DIRTY(['b.ts']);

    expect(error).toEqual({
      code: 'WORKTREE_DIRTY',
      message: 'Worktree has uncommitted changes',
      status: 400,
      details: { uncommittedFiles: ['b.ts'] },
    });
  });

  it('WorktreeErrors.REMOVAL_FAILED', () => {
    const error = WorktreeErrors.REMOVAL_FAILED('/tmp', 'error');

    expect(error).toEqual({
      code: 'WORKTREE_REMOVAL_FAILED',
      message: 'Failed to remove worktree at "/tmp"',
      status: 500,
      details: { path: '/tmp', error: 'error' },
    });
  });

  it('WorktreeErrors.ENV_COPY_FAILED', () => {
    const error = WorktreeErrors.ENV_COPY_FAILED('copy');

    expect(error).toEqual({
      code: 'WORKTREE_ENV_COPY_FAILED',
      message: 'Failed to copy environment file',
      status: 500,
      details: { error: 'copy' },
    });
  });

  it('WorktreeErrors.INIT_SCRIPT_FAILED', () => {
    const error = WorktreeErrors.INIT_SCRIPT_FAILED('npm install', 'exit 1');

    expect(error).toEqual({
      code: 'WORKTREE_INIT_SCRIPT_FAILED',
      message: 'Init script failed: npm install',
      status: 500,
      details: { script: 'npm install', error: 'exit 1' },
    });
  });

  it('SessionErrors.NOT_FOUND', () => {
    expect(SessionErrors.NOT_FOUND).toEqual({
      code: 'SESSION_NOT_FOUND',
      message: 'Session not found',
      status: 404,
      details: undefined,
    });
  });

  it('SessionErrors.CLOSED', () => {
    expect(SessionErrors.CLOSED).toEqual({
      code: 'SESSION_CLOSED',
      message: 'Session is closed',
      status: 400,
      details: undefined,
    });
  });

  it('SessionErrors.CONNECTION_FAILED', () => {
    const error = SessionErrors.CONNECTION_FAILED('timeout');

    expect(error).toEqual({
      code: 'SESSION_CONNECTION_FAILED',
      message: 'Failed to connect to session',
      status: 502,
      details: { error: 'timeout' },
    });
  });

  it('SessionErrors.SYNC_FAILED', () => {
    const error = SessionErrors.SYNC_FAILED('oops');

    expect(error).toEqual({
      code: 'SESSION_SYNC_FAILED',
      message: 'Session sync failed',
      status: 500,
      details: { error: 'oops' },
    });
  });

  it('GitHubErrors.AUTH_FAILED', () => {
    const error = GitHubErrors.AUTH_FAILED('no token');

    expect(error).toEqual({
      code: 'GITHUB_AUTH_FAILED',
      message: 'GitHub authentication failed',
      status: 401,
      details: { error: 'no token' },
    });
  });

  it('GitHubErrors.INSTALLATION_NOT_FOUND', () => {
    const error = GitHubErrors.INSTALLATION_NOT_FOUND('123');

    expect(error).toEqual({
      code: 'GITHUB_INSTALLATION_NOT_FOUND',
      message: 'GitHub App installation not found',
      status: 404,
      details: { installationId: '123' },
    });
  });

  it('GitHubErrors.REPO_NOT_FOUND', () => {
    const error = GitHubErrors.REPO_NOT_FOUND('octo', 'repo');

    expect(error).toEqual({
      code: 'GITHUB_REPO_NOT_FOUND',
      message: 'Repository "octo/repo" not found',
      status: 404,
      details: { owner: 'octo', repo: 'repo' },
    });
  });

  it('GitHubErrors.CONFIG_NOT_FOUND', () => {
    const error = GitHubErrors.CONFIG_NOT_FOUND('.claude/settings.json');

    expect(error).toEqual({
      code: 'GITHUB_CONFIG_NOT_FOUND',
      message: 'Configuration not found at ".claude/settings.json"',
      status: 404,
      details: { path: '.claude/settings.json' },
    });
  });

  it('GitHubErrors.CONFIG_INVALID', () => {
    const error = GitHubErrors.CONFIG_INVALID(['bad']);

    expect(error).toEqual({
      code: 'GITHUB_CONFIG_INVALID',
      message: 'Invalid configuration format',
      status: 400,
      details: { validationErrors: ['bad'] },
    });
  });

  it('GitHubErrors.WEBHOOK_INVALID', () => {
    expect(GitHubErrors.WEBHOOK_INVALID).toEqual({
      code: 'GITHUB_WEBHOOK_INVALID',
      message: 'Invalid webhook signature',
      status: 401,
      details: undefined,
    });
  });

  it('GitHubErrors.RATE_LIMITED', () => {
    const error = GitHubErrors.RATE_LIMITED(1_705_000_000);

    expect(error.code).toBe('GITHUB_RATE_LIMITED');
    expect(error.status).toBe(429);
    expect(error.details).toMatchObject({
      resetAt: '2024-01-11T19:06:40.000Z',
    });
  });

  it('GitHubErrors.PR_CREATION_FAILED', () => {
    const error = GitHubErrors.PR_CREATION_FAILED('boom');

    expect(error).toEqual({
      code: 'GITHUB_PR_CREATION_FAILED',
      message: 'Failed to create pull request',
      status: 500,
      details: { error: 'boom' },
    });
  });

  it('ValidationErrors.VALIDATION_ERROR', () => {
    const error = ValidationErrors.VALIDATION_ERROR([{ path: ['name'], message: 'Required' }]);

    expect(error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      status: 400,
      details: {
        errors: [{ path: 'name', message: 'Required' }],
      },
    });
  });

  it('ValidationErrors.INVALID_ID', () => {
    const error = ValidationErrors.INVALID_ID('agentId');

    expect(error).toEqual({
      code: 'INVALID_ID',
      message: 'Invalid ID format for "agentId"',
      status: 400,
      details: { field: 'agentId' },
    });
  });

  it('ValidationErrors.MISSING_REQUIRED_FIELD', () => {
    const error = ValidationErrors.MISSING_REQUIRED_FIELD('name');

    expect(error).toEqual({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'Missing required field: name',
      status: 400,
      details: { field: 'name' },
    });
  });

  it('ValidationErrors.INVALID_ENUM_VALUE', () => {
    const error = ValidationErrors.INVALID_ENUM_VALUE('status', 'paused', ['idle', 'running']);

    expect(error).toEqual({
      code: 'INVALID_ENUM_VALUE',
      message: 'Invalid value "paused" for "status"',
      status: 400,
      details: { field: 'status', value: 'paused', allowedValues: ['idle', 'running'] },
    });
  });
});
