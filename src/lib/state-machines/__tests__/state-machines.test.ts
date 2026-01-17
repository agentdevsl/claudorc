import { describe, expect, it } from 'vitest';
import { createAgentLifecycleMachine } from '../agent-lifecycle/machine.js';
import { createSessionLifecycleMachine } from '../session-lifecycle/machine.js';
import { createTaskWorkflowMachine } from '../task-workflow/machine.js';
import { createWorktreeLifecycleMachine } from '../worktree-lifecycle/machine.js';

describe('state machines', () => {
  it('agent lifecycle starts in idle', () => {
    const machine = createAgentLifecycleMachine();
    expect(machine.state).toBe('idle');
  });

  it('agent lifecycle transitions to running', () => {
    const machine = createAgentLifecycleMachine();
    const result = machine.send({ type: 'START', taskId: 'task-1' });

    expect(result.state).toBe('running');
  });

  it('task workflow moves from backlog to in_progress', () => {
    const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
    const result = machine.send({ type: 'ASSIGN', agentId: 'agent-1' });

    expect(result.state).toBe('in_progress');
  });

  it('task workflow rejects invalid transition', () => {
    const machine = createTaskWorkflowMachine({ taskId: 'task-1' });
    const result = machine.send({ type: 'APPROVE' });

    expect(result.ok).toBe(false);
  });

  it('session lifecycle starts in idle', () => {
    const machine = createSessionLifecycleMachine();
    expect(machine.state).toBe('idle');
  });

  it('session lifecycle initializes and activates', () => {
    const machine = createSessionLifecycleMachine();
    const initialize = machine.send({ type: 'INITIALIZE' });
    const ready = initialize.send({ type: 'READY' });

    expect(ready.state).toBe('active');
  });

  it('worktree lifecycle starts in creating', () => {
    const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
    expect(machine.state).toBe('creating');
  });

  it('worktree lifecycle can move to active', () => {
    const machine = createWorktreeLifecycleMachine({ branch: 'feature' });
    const result = machine.send({ type: 'INIT_COMPLETE' });

    expect(result.state).toBe('active');
  });
});
