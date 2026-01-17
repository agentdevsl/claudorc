import { describe, expect, it } from 'vitest';
import { createError } from '../../errors/base.js';
import { createAgentLifecycleMachine } from '../agent-lifecycle/machine.js';
import { createSessionLifecycleMachine } from '../session-lifecycle/machine.js';
import { createTaskWorkflowMachine } from '../task-workflow/machine.js';
import { createWorktreeLifecycleMachine } from '../worktree-lifecycle/machine.js';

describe('state machines', () => {
  describe('agent lifecycle', () => {
    it('starts in idle', () => {
      const machine = createAgentLifecycleMachine();
      expect(machine.state).toBe('idle');
    });

    it('transitions to running on START', () => {
      const machine = createAgentLifecycleMachine();
      const result = machine.send({ type: 'START', taskId: 'task-1' });

      expect(result.state).toBe('running');
      expect(result.ok).toBe(true);
    });

    it('rejects tool not in allowedTools', () => {
      const machine = createAgentLifecycleMachine({ allowedTools: ['Read'] });
      const result = machine.send({ type: 'TOOL', tool: 'Bash' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_TOOL_NOT_ALLOWED');
      }
    });

    it('allows tool in allowedTools', () => {
      const machine = createAgentLifecycleMachine({ allowedTools: ['Read', 'Edit'] });
      machine.send({ type: 'START', taskId: 'task-1' });
      const result = machine.send({ type: 'TOOL', tool: 'Read' });

      // TOOL event does not have a transition, so it returns invalid transition
      // but should pass the guard check
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_INVALID_TRANSITION');
      }
    });

    it('rejects invalid transition from idle', () => {
      const machine = createAgentLifecycleMachine();
      const result = machine.send({ type: 'PAUSE', reason: 'test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_INVALID_TRANSITION');
      }
    });

    it('increments turn on STEP event', () => {
      const machine = createAgentLifecycleMachine();
      machine.send({ type: 'START', taskId: 'task-1' });
      const result = machine.send({ type: 'STEP', turn: 1 });

      expect(result.state).toBe('running');
      expect(result.ok).toBe(true);
      expect(machine.context.currentTurn).toBe(1);
    });

    it('returns error when turn limit exceeded', () => {
      const machine = createAgentLifecycleMachine({ maxTurns: 2, currentTurn: 1 });
      machine.send({ type: 'START', taskId: 'task-1' });
      const result = machine.send({ type: 'STEP', turn: 2 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_TURN_LIMIT_EXCEEDED');
      }
    });

    it('transitions to paused on PAUSE from running', () => {
      const machine = createAgentLifecycleMachine();
      machine.send({ type: 'START', taskId: 'task-1' });
      const result = machine.send({ type: 'PAUSE', reason: 'user request' });

      expect(result.state).toBe('paused');
      expect(result.ok).toBe(true);
    });

    it('transitions to completed on COMPLETE from running', () => {
      const machine = createAgentLifecycleMachine();
      machine.send({ type: 'START', taskId: 'task-1' });
      const result = machine.send({ type: 'COMPLETE', result: { success: true } });

      expect(result.state).toBe('completed');
      expect(result.ok).toBe(true);
      expect(machine.context.taskId).toBeUndefined();
      expect(machine.context.currentTurn).toBe(0);
    });

    it('transitions to error on ERROR from running', () => {
      const machine = createAgentLifecycleMachine();
      machine.send({ type: 'START', taskId: 'task-1' });
      const error = createError('TEST_ERROR', 'Test error', 500);
      const result = machine.send({ type: 'ERROR', error });

      expect(result.state).toBe('error');
      expect(result.ok).toBe(false);
      expect(machine.context.error).toBe(error);
    });

    it('transitions to idle on ABORT from running', () => {
      const machine = createAgentLifecycleMachine();
      machine.send({ type: 'START', taskId: 'task-1' });
      const result = machine.send({ type: 'ABORT' });

      expect(result.state).toBe('idle');
      expect(result.ok).toBe(true);
      expect(machine.context.taskId).toBeUndefined();
    });

    it('transitions to running on RESUME from paused', () => {
      const machine = createAgentLifecycleMachine();
      machine.send({ type: 'START', taskId: 'task-1' });
      machine.send({ type: 'PAUSE', reason: 'test' });
      const result = machine.send({ type: 'RESUME', feedback: 'continue' });

      expect(result.state).toBe('running');
      expect(result.ok).toBe(true);
    });

    it('transitions to idle on ABORT from paused', () => {
      const machine = createAgentLifecycleMachine();
      machine.send({ type: 'START', taskId: 'task-1' });
      machine.send({ type: 'PAUSE', reason: 'test' });
      const result = machine.send({ type: 'ABORT' });

      expect(result.state).toBe('idle');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from paused', () => {
      const machine = createAgentLifecycleMachine();
      machine.send({ type: 'START', taskId: 'task-1' });
      machine.send({ type: 'PAUSE', reason: 'test' });
      const result = machine.send({ type: 'COMPLETE', result: {} });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_INVALID_TRANSITION');
      }
    });

    it('transitions to running on START from completed', () => {
      const machine = createAgentLifecycleMachine({ taskId: 'task-1' });
      machine.send({ type: 'START', taskId: 'task-1' });
      machine.send({ type: 'COMPLETE', result: {} });
      const result = machine.send({ type: 'START', taskId: 'task-2' });

      expect(result.state).toBe('running');
      expect(result.ok).toBe(true);
    });

    it('transitions to running on START from error', () => {
      const machine = createAgentLifecycleMachine({ taskId: 'task-1' });
      machine.send({ type: 'START', taskId: 'task-1' });
      machine.send({ type: 'ERROR', error: createError('TEST', 'test', 500) });
      const result = machine.send({ type: 'START', taskId: 'task-2' });

      expect(result.state).toBe('running');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from completed', () => {
      const machine = createAgentLifecycleMachine({ taskId: 'task-1' });
      machine.send({ type: 'START', taskId: 'task-1' });
      machine.send({ type: 'COMPLETE', result: {} });
      const result = machine.send({ type: 'PAUSE', reason: 'test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_INVALID_TRANSITION');
      }
    });

    it('rejects invalid transition from error', () => {
      const machine = createAgentLifecycleMachine({ taskId: 'task-1' });
      machine.send({ type: 'START', taskId: 'task-1' });
      machine.send({ type: 'ERROR', error: createError('TEST', 'test', 500) });
      const result = machine.send({ type: 'PAUSE', reason: 'test' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('AGENT_INVALID_TRANSITION');
      }
    });

    it('rejects START without taskId in context', () => {
      const machine = createAgentLifecycleMachine({ taskId: undefined });
      // canStart requires ctx.taskId to be set, which is passed via event
      const result = machine.send({ type: 'START', taskId: '' });

      // Empty taskId should fail canStart
      expect(result.ok).toBe(false);
    });
  });

  describe('session lifecycle', () => {
    it('starts in idle', () => {
      const machine = createSessionLifecycleMachine();
      expect(machine.state).toBe('idle');
    });

    it('transitions to initializing on INITIALIZE', () => {
      const machine = createSessionLifecycleMachine();
      const result = machine.send({ type: 'INITIALIZE' });

      expect(result.state).toBe('initializing');
      expect(result.ok).toBe(true);
    });

    it('transitions to active on READY from initializing', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      const result = machine.send({ type: 'READY' });

      expect(result.state).toBe('active');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from idle', () => {
      const machine = createSessionLifecycleMachine();
      const result = machine.send({ type: 'READY' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_INVALID_TRANSITION');
      }
    });

    it('rejects invalid transition from initializing', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      const result = machine.send({ type: 'JOIN', userId: 'user-1' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_INVALID_TRANSITION');
      }
    });

    it('allows JOIN when session has capacity', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'JOIN', userId: 'user-1' });

      expect(result.state).toBe('active');
      expect(result.ok).toBe(true);
      expect(machine.context.participants).toContain('user-1');
    });

    it('rejects JOIN when session is full', () => {
      const machine = createSessionLifecycleMachine({
        maxParticipants: 1,
        participants: ['user-1'],
      });
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'JOIN', userId: 'user-2' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_CAPACITY_REACHED');
      }
    });

    it('allows LEAVE for existing participant', () => {
      const machine = createSessionLifecycleMachine({
        participants: ['user-1'],
      });
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'LEAVE', userId: 'user-1' });

      expect(result.state).toBe('active');
      expect(result.ok).toBe(true);
      expect(machine.context.participants).not.toContain('user-1');
    });

    it('rejects LEAVE for non-participant', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'LEAVE', userId: 'user-1' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_NOT_PARTICIPANT');
      }
    });

    it('updates lastActivity on HEARTBEAT', () => {
      const machine = createSessionLifecycleMachine({ lastActivity: 0 });
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'HEARTBEAT' });

      expect(result.state).toBe('active');
      expect(result.ok).toBe(true);
      expect(machine.context.lastActivity).toBeGreaterThan(0);
    });

    it('transitions to paused on PAUSE from active', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'PAUSE' });

      expect(result.state).toBe('paused');
      expect(result.ok).toBe(true);
    });

    it('transitions to closing on TIMEOUT when stale', () => {
      const machine = createSessionLifecycleMachine({
        lastActivity: Date.now() - 120000, // 2 minutes ago
      });
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'TIMEOUT' });

      expect(result.state).toBe('closing');
      expect(result.ok).toBe(true);
    });

    it('rejects TIMEOUT when not stale', () => {
      const machine = createSessionLifecycleMachine({
        lastActivity: Date.now(),
      });
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'TIMEOUT' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_INVALID_TRANSITION');
      }
    });

    it('transitions to closing on CLOSE from active', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const result = machine.send({ type: 'CLOSE' });

      expect(result.state).toBe('closing');
      expect(result.ok).toBe(true);
    });

    it('transitions to active on RESUME from paused', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      machine.send({ type: 'PAUSE' });
      const result = machine.send({ type: 'RESUME' });

      expect(result.state).toBe('active');
      expect(result.ok).toBe(true);
    });

    it('transitions to closing on CLOSE from paused', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      machine.send({ type: 'PAUSE' });
      const result = machine.send({ type: 'CLOSE' });

      expect(result.state).toBe('closing');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from paused', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      machine.send({ type: 'PAUSE' });
      const result = machine.send({ type: 'JOIN', userId: 'user-1' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_INVALID_TRANSITION');
      }
    });

    it('transitions to closed on CLOSE from closing', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      machine.send({ type: 'CLOSE' });
      const result = machine.send({ type: 'CLOSE' });

      expect(result.state).toBe('closed');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from closing', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      machine.send({ type: 'CLOSE' });
      const result = machine.send({ type: 'RESUME' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_INVALID_TRANSITION');
      }
    });

    it('transitions to error on ERROR event', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      const error = createError('TEST_ERROR', 'Test error', 500);
      const result = machine.send({ type: 'ERROR', error });

      expect(result.state).toBe('error');
      expect(result.ok).toBe(false);
      expect(machine.context.error).toBe(error);
    });

    it('transitions to closed on CLOSE from error', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      machine.send({ type: 'ERROR', error: createError('TEST', 'test', 500) });
      const result = machine.send({ type: 'CLOSE' });

      expect(result.state).toBe('closed');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from closed', () => {
      const machine = createSessionLifecycleMachine();
      machine.send({ type: 'INITIALIZE' });
      machine.send({ type: 'READY' });
      machine.send({ type: 'CLOSE' });
      machine.send({ type: 'CLOSE' });
      const result = machine.send({ type: 'RESUME' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_INVALID_TRANSITION');
      }
    });

    it('allows ERROR from any state', () => {
      const machine = createSessionLifecycleMachine();
      const error = createError('TEST_ERROR', 'Test error', 500);
      const result = machine.send({ type: 'ERROR', error });

      expect(result.state).toBe('error');
      expect(result.ok).toBe(false);
    });
  });

  describe('task workflow', () => {
    it('starts in backlog', () => {
      const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
      expect(machine.state).toBe('backlog');
    });

    it('transitions to in_progress on ASSIGN', () => {
      const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
      const result = machine.send({ type: 'ASSIGN', agentId: 'agent-1' });

      expect(result.state).toBe('in_progress');
      expect(result.ok).toBe(true);
      expect(machine.context.agentId).toBe('agent-1');
    });

    it('rejects ASSIGN when already assigned', () => {
      const machine = createTaskWorkflowMachine({
        taskId: 'task-1',
        agentId: 'agent-1',
      });
      const result = machine.send({ type: 'ASSIGN', agentId: 'agent-2' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_ALREADY_ASSIGNED');
      }
    });

    it('rejects ASSIGN when concurrency limit exceeded', () => {
      const machine = createTaskWorkflowMachine({
        taskId: 'task-1',
        runningAgents: 3,
        maxConcurrentAgents: 3,
      });
      const result = machine.send({ type: 'ASSIGN', agentId: 'agent-1' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONCURRENCY_LIMIT_EXCEEDED');
      }
    });

    it('rejects invalid transition from backlog', () => {
      const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
      const result = machine.send({ type: 'APPROVE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_INVALID_TRANSITION');
      }
    });

    it('transitions to waiting_approval on COMPLETE', () => {
      const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      const result = machine.send({ type: 'COMPLETE' });

      expect(result.state).toBe('waiting_approval');
      expect(result.ok).toBe(true);
    });

    it('transitions to backlog on CANCEL', () => {
      const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      const result = machine.send({ type: 'CANCEL' });

      expect(result.state).toBe('backlog');
      expect(result.ok).toBe(true);
      expect(machine.context.agentId).toBeUndefined();
    });

    it('rejects invalid transition from in_progress', () => {
      const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      const result = machine.send({ type: 'APPROVE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_INVALID_TRANSITION');
      }
    });

    it('transitions to verified on APPROVE with diff', () => {
      const machine = createTaskWorkflowMachine({
        taskId: 'task-1',
        diffSummary: { filesChanged: 2 },
      });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      machine.send({ type: 'COMPLETE' });
      const result = machine.send({ type: 'APPROVE' });

      expect(result.state).toBe('verified');
      expect(result.ok).toBe(true);
    });

    it('rejects APPROVE without diff', () => {
      const machine = createTaskWorkflowMachine({
        taskId: 'task-1',
        diffSummary: null,
      });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      machine.send({ type: 'COMPLETE' });
      const result = machine.send({ type: 'APPROVE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_NO_DIFF');
      }
    });

    it('rejects APPROVE with zero files changed', () => {
      const machine = createTaskWorkflowMachine({
        taskId: 'task-1',
        diffSummary: { filesChanged: 0 },
      });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      machine.send({ type: 'COMPLETE' });
      const result = machine.send({ type: 'APPROVE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_NO_DIFF');
      }
    });

    it('transitions to in_progress on REJECT', () => {
      const machine = createTaskWorkflowMachine({
        taskId: 'task-1',
        diffSummary: { filesChanged: 2 },
      });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      machine.send({ type: 'COMPLETE' });
      const result = machine.send({ type: 'REJECT', reason: 'needs changes' });

      expect(result.state).toBe('in_progress');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from waiting_approval', () => {
      const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      machine.send({ type: 'COMPLETE' });
      const result = machine.send({ type: 'CANCEL' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_INVALID_TRANSITION');
      }
    });

    it('rejects any transition from verified', () => {
      const machine = createTaskWorkflowMachine({
        taskId: 'task-1',
        diffSummary: { filesChanged: 2 },
      });
      machine.send({ type: 'ASSIGN', agentId: 'agent-1' });
      machine.send({ type: 'COMPLETE' });
      machine.send({ type: 'APPROVE' });
      const result = machine.send({ type: 'REJECT' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TASK_INVALID_TRANSITION');
      }
    });

    it('can start with custom initial state', () => {
      const machine = createTaskWorkflowMachine({
        taskId: 'task-1',
        column: 'in_progress',
        agentId: 'agent-1',
      });

      expect(machine.state).toBe('in_progress');
      expect(machine.context.agentId).toBe('agent-1');
    });
  });

  describe('worktree lifecycle', () => {
    it('starts in creating', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      expect(machine.state).toBe('creating');
    });

    it('transitions to active on INIT_COMPLETE', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      const result = machine.send({ type: 'INIT_COMPLETE' });

      expect(result.state).toBe('active');
      expect(result.ok).toBe(true);
    });

    it('rejects INIT_COMPLETE when branch exists', () => {
      const machine = createWorktreeLifecycleMachine({
        branch: 'feature',
        branchExists: true,
      });
      const result = machine.send({ type: 'INIT_COMPLETE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('rejects INIT_COMPLETE when path unavailable', () => {
      const machine = createWorktreeLifecycleMachine({
        branch: 'feature',
        pathAvailable: false,
      });
      const result = machine.send({ type: 'INIT_COMPLETE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('rejects invalid transition from creating', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      const result = machine.send({ type: 'MODIFY' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('transitions to dirty on MODIFY from active', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      const result = machine.send({ type: 'MODIFY' });

      expect(result.state).toBe('dirty');
      expect(result.ok).toBe(true);
      expect(machine.context.hasUncommittedChanges).toBe(true);
    });

    it('transitions to merging on MERGE from active', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      const result = machine.send({ type: 'MERGE' });

      expect(result.state).toBe('merging');
      expect(result.ok).toBe(true);
    });

    it('rejects MERGE from active when dirty', () => {
      const machine = createWorktreeLifecycleMachine({
        branch: 'feature',
        hasUncommittedChanges: true,
      });
      machine.send({ type: 'INIT_COMPLETE' });
      const result = machine.send({ type: 'MERGE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_DIRTY');
      }
    });

    it('transitions to removing on REMOVE from active', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      const result = machine.send({ type: 'REMOVE' });

      expect(result.state).toBe('removing');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from active', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      const result = machine.send({ type: 'COMMIT' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('transitions to committing on COMMIT from dirty', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MODIFY' });
      const result = machine.send({ type: 'COMMIT' });

      expect(result.state).toBe('committing');
      expect(result.ok).toBe(true);
      expect(machine.context.hasUncommittedChanges).toBe(false);
    });

    it('rejects MERGE from dirty when has uncommitted changes', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MODIFY' });
      const result = machine.send({ type: 'MERGE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_DIRTY');
      }
    });

    it('rejects invalid transition from dirty', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MODIFY' });
      const result = machine.send({ type: 'REMOVE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('transitions to merging on MERGE from committing', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MODIFY' });
      machine.send({ type: 'COMMIT' });
      const result = machine.send({ type: 'MERGE' });

      expect(result.state).toBe('merging');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from committing', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MODIFY' });
      machine.send({ type: 'COMMIT' });
      const result = machine.send({ type: 'REMOVE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('transitions to active on RESOLVE_CONFLICT from merging', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MERGE' });
      const result = machine.send({ type: 'RESOLVE_CONFLICT' });

      expect(result.state).toBe('active');
      expect(result.ok).toBe(true);
      expect(machine.context.conflictFiles).toEqual([]);
    });

    it('transitions to conflict on MODIFY from merging when has conflicts', () => {
      const machine = createWorktreeLifecycleMachine({
        branch: 'feature',
        conflictFiles: ['file1.ts', 'file2.ts'],
      });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MERGE' });
      const result = machine.send({ type: 'MODIFY' });

      expect(result.state).toBe('conflict');
      expect(result.ok).toBe(true);
    });

    it('rejects MODIFY from merging when no conflicts', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MERGE' });
      const result = machine.send({ type: 'MODIFY' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('rejects invalid transition from merging', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MERGE' });
      const result = machine.send({ type: 'COMMIT' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('transitions to active on RESOLVE_CONFLICT from conflict', () => {
      const machine = createWorktreeLifecycleMachine({
        branch: 'feature',
        conflictFiles: ['file1.ts'],
      });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MERGE' });
      machine.send({ type: 'MODIFY' });
      const result = machine.send({ type: 'RESOLVE_CONFLICT' });

      expect(result.state).toBe('active');
      expect(result.ok).toBe(true);
      expect(machine.context.conflictFiles).toEqual([]);
    });

    it('rejects invalid transition from conflict', () => {
      const machine = createWorktreeLifecycleMachine({
        branch: 'feature',
        conflictFiles: ['file1.ts'],
      });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'MERGE' });
      machine.send({ type: 'MODIFY' });
      const result = machine.send({ type: 'COMMIT' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('transitions to removed on REMOVE from removing', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'REMOVE' });
      const result = machine.send({ type: 'REMOVE' });

      expect(result.state).toBe('removed');
      expect(result.ok).toBe(true);
    });

    it('rejects invalid transition from removing', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'REMOVE' });
      const result = machine.send({ type: 'MERGE' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('transitions to error on ERROR event', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      const result = machine.send({ type: 'ERROR' });

      expect(result.state).toBe('error');
      expect(result.ok).toBe(false);
    });

    it('allows ERROR from any state', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      const result = machine.send({ type: 'ERROR' });

      expect(result.state).toBe('error');
      expect(result.ok).toBe(false);
    });

    it('rejects invalid transition from removed', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'INIT_COMPLETE' });
      machine.send({ type: 'REMOVE' });
      machine.send({ type: 'REMOVE' });
      const result = machine.send({ type: 'MODIFY' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('rejects invalid transition from error', () => {
      const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
      machine.send({ type: 'ERROR' });
      const result = machine.send({ type: 'MODIFY' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WORKTREE_INVALID_TRANSITION');
      }
    });

    it('can be initialized with custom context', () => {
      const machine = createWorktreeLifecycleMachine({
        branch: 'feature',
        path: '/custom/path',
        branchExists: false,
        pathAvailable: true,
      });

      expect(machine.context.branch).toBe('feature');
      expect(machine.context.path).toBe('/custom/path');
    });
  });
});
