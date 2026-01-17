import type { AppError } from '../../errors/base.js';
import { createError } from '../../errors/base.js';
import type { Result } from '../../utils/result.js';
import { err, ok } from '../../utils/result.js';
import { canCreate, canMerge, canRemove, hasConflicts } from './guards.js';
import type {
  WorktreeLifecycleContext,
  WorktreeLifecycleEvent,
  WorktreeLifecycleState,
} from './types.js';

export type WorktreeMachine = {
  state: WorktreeLifecycleState;
  context: WorktreeLifecycleContext;
  send: (event: WorktreeLifecycleEvent) => WorktreeMachineResult;
};

export type WorktreeMachineResult = Result<WorktreeMachine, AppError> & {
  state: WorktreeLifecycleState;
  send: (event: WorktreeLifecycleEvent) => WorktreeMachineResult;
};

type WorktreeMachineInternal = WorktreeMachine & { lastResult: Result<WorktreeMachine, AppError> };

const createMachineResult = (
  machine: WorktreeMachine,
  result: Result<WorktreeMachine, AppError>
): WorktreeMachineResult => ({
  ...result,
  state: machine.state,
  send: machine.send,
});

export const createWorktreeLifecycleMachine = (
  initial: Partial<WorktreeLifecycleContext> & { branch: string }
): WorktreeMachine => {
  const context: WorktreeLifecycleContext = {
    status: 'creating',
    branch: initial.branch,
    path: initial.path,
    lastActivity: Date.now(),
    branchExists: false,
    pathAvailable: true,
    hasUncommittedChanges: false,
    conflictFiles: [],
    ...initial,
  };

  const machine: WorktreeMachineInternal = {
    state: context.status,
    context,
    send: (event) => {
      const next = transition(machine, event);
      update(next);
      return createMachineResult(next, next.lastResult);
    },
    lastResult: ok({
      state: context.status,
      context,
      send: () => ({
        ok: true,
        value: machine,
        state: machine.state,
        send: machine.send,
      }),
    }),
  };

  const update = (next: WorktreeMachineInternal) => {
    machine.state = next.state;
    machine.context = next.context;
    machine.lastResult = next.lastResult;
  };

  return machine;
};

const transition = (machine: WorktreeMachineInternal, event: WorktreeLifecycleEvent) => {
  const ctx = machine.context;

  switch (machine.state) {
    case 'creating':
      if (event.type === 'INIT_COMPLETE' && canCreate(ctx)) {
        const next = { ...ctx, status: 'active', lastActivity: Date.now() };
        return {
          ...machine,
          state: 'active',
          context: next,
          lastResult: ok({ ...machine, state: 'active', context: next }),
        };
      }
      break;
    case 'active':
      if (event.type === 'MODIFY') {
        const next = { ...ctx, status: 'dirty', hasUncommittedChanges: true };
        return {
          ...machine,
          state: 'dirty',
          context: next,
          lastResult: ok({ ...machine, state: 'dirty', context: next }),
        };
      }
      if (event.type === 'MERGE') {
        if (!canMerge(ctx)) {
          return {
            ...machine,
            lastResult: err(createError('WORKTREE_DIRTY', 'Worktree dirty', 400)),
          };
        }
        const next = { ...ctx, status: 'merging' };
        return {
          ...machine,
          state: 'merging',
          context: next,
          lastResult: ok({ ...machine, state: 'merging', context: next }),
        };
      }
      if (event.type === 'REMOVE' && canRemove(ctx)) {
        const next = { ...ctx, status: 'removing' };
        return {
          ...machine,
          state: 'removing',
          context: next,
          lastResult: ok({ ...machine, state: 'removing', context: next }),
        };
      }
      break;
    case 'dirty':
      if (event.type === 'COMMIT') {
        const next = { ...ctx, status: 'committing', hasUncommittedChanges: false };
        return {
          ...machine,
          state: 'committing',
          context: next,
          lastResult: ok({ ...machine, state: 'committing', context: next }),
        };
      }
      if (event.type === 'MERGE') {
        if (!canMerge(ctx)) {
          return {
            ...machine,
            lastResult: err(createError('WORKTREE_DIRTY', 'Worktree dirty', 400)),
          };
        }
        const next = { ...ctx, status: 'merging' };
        return {
          ...machine,
          state: 'merging',
          context: next,
          lastResult: ok({ ...machine, state: 'merging', context: next }),
        };
      }
      break;
    case 'committing':
      if (event.type === 'MERGE') {
        const next = { ...ctx, status: 'merging' };
        return {
          ...machine,
          state: 'merging',
          context: next,
          lastResult: ok({ ...machine, state: 'merging', context: next }),
        };
      }
      break;
    case 'merging':
      if (event.type === 'RESOLVE_CONFLICT') {
        const next = { ...ctx, status: 'active', conflictFiles: [] };
        return {
          ...machine,
          state: 'active',
          context: next,
          lastResult: ok({ ...machine, state: 'active', context: next }),
        };
      }
      if (event.type === 'MODIFY' && hasConflicts(ctx)) {
        const next = { ...ctx, status: 'conflict' };
        return { ...machine, state: 'conflict', context: next, lastResult: ok(machine) };
      }
      break;
    case 'conflict':
      if (event.type === 'RESOLVE_CONFLICT') {
        const next = { ...ctx, status: 'active', conflictFiles: [] };
        return {
          ...machine,
          state: 'active',
          context: next,
          lastResult: ok({ ...machine, state: 'active', context: next }),
        };
      }
      break;
    case 'removing':
      if (event.type === 'REMOVE') {
        const next = { ...ctx, status: 'removed' };
        return {
          ...machine,
          state: 'removed',
          context: next,
          lastResult: ok({ ...machine, state: 'removed', context: next }),
        };
      }
      break;
    default:
      break;
  }

  if (event.type === 'ERROR') {
    const next = { ...ctx, status: 'error' };
    return {
      ...machine,
      state: 'error',
      context: next,
      lastResult: err(createError('WORKTREE_ERROR', 'Worktree error', 500)),
    };
  }

  return {
    ...machine,
    lastResult: err(
      createError('WORKTREE_INVALID_TRANSITION', 'Invalid worktree transition', 400, {
        state: machine.state,
        event: event.type,
      })
    ),
  };
};
