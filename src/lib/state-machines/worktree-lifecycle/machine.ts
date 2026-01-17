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

const nextState = <S extends WorktreeLifecycleState>(
  machine: WorktreeMachineInternal,
  state: S,
  context: WorktreeLifecycleContext
): WorktreeMachineInternal => ({
  ...machine,
  state,
  context,
  lastResult: ok({ state, context, send: machine.send }),
});

const nextError = (machine: WorktreeMachineInternal, error: AppError): WorktreeMachineInternal => ({
  ...machine,
  lastResult: err(error),
});

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
  const { branch, ...rest } = initial;
  const context: WorktreeLifecycleContext = {
    status: 'creating',
    branch,
    path: rest.path,
    lastActivity: Date.now(),
    branchExists: false,
    pathAvailable: true,
    hasUncommittedChanges: false,
    conflictFiles: [],
    ...rest,
  };

  const machine: WorktreeMachineInternal = {
    state: context.status,
    context,
    send: null as unknown as WorktreeMachine['send'],
    lastResult: null as unknown as Result<WorktreeMachine, AppError>,
  };

  machine.send = (event) => {
    const next = transition(machine, event);
    update(next);
    return createMachineResult(next, next.lastResult);
  };

  machine.lastResult = ok({
    state: context.status,
    context,
    send: machine.send,
  });

  const update = (next: WorktreeMachineInternal) => {
    machine.state = next.state;
    machine.context = next.context;
    machine.lastResult = next.lastResult;
  };

  return machine;
};

const transition = (
  machine: WorktreeMachineInternal,
  event: WorktreeLifecycleEvent
): WorktreeMachineInternal => {
  const ctx = machine.context;

  switch (machine.state) {
    case 'creating':
      if (event.type === 'INIT_COMPLETE' && canCreate(ctx)) {
        return nextState(machine, 'active', {
          ...ctx,
          status: 'active',
          lastActivity: Date.now(),
        });
      }
      break;
    case 'active':
      if (event.type === 'MODIFY') {
        return nextState(machine, 'dirty', {
          ...ctx,
          status: 'dirty',
          hasUncommittedChanges: true,
        });
      }
      if (event.type === 'MERGE') {
        if (!canMerge(ctx)) {
          return nextError(machine, createError('WORKTREE_DIRTY', 'Worktree dirty', 400));
        }
        return nextState(machine, 'merging', { ...ctx, status: 'merging' });
      }
      if (event.type === 'REMOVE' && canRemove(ctx)) {
        return nextState(machine, 'removing', { ...ctx, status: 'removing' });
      }
      break;
    case 'dirty':
      if (event.type === 'COMMIT') {
        return nextState(machine, 'committing', {
          ...ctx,
          status: 'committing',
          hasUncommittedChanges: false,
        });
      }
      if (event.type === 'MERGE') {
        if (!canMerge(ctx)) {
          return nextError(machine, createError('WORKTREE_DIRTY', 'Worktree dirty', 400));
        }
        return nextState(machine, 'merging', { ...ctx, status: 'merging' });
      }
      break;
    case 'committing':
      if (event.type === 'MERGE') {
        return nextState(machine, 'merging', { ...ctx, status: 'merging' });
      }
      break;
    case 'merging':
      if (event.type === 'RESOLVE_CONFLICT') {
        return nextState(machine, 'active', {
          ...ctx,
          status: 'active',
          conflictFiles: [],
        });
      }
      if (event.type === 'MODIFY' && hasConflicts(ctx)) {
        return nextState(machine, 'conflict', { ...ctx, status: 'conflict' });
      }
      break;
    case 'conflict':
      if (event.type === 'RESOLVE_CONFLICT') {
        return nextState(machine, 'active', {
          ...ctx,
          status: 'active',
          conflictFiles: [],
        });
      }
      break;
    case 'removing':
      if (event.type === 'REMOVE') {
        return nextState(machine, 'removed', { ...ctx, status: 'removed' });
      }
      break;
    default:
      break;
  }

  if (event.type === 'ERROR') {
    return {
      ...machine,
      state: 'error',
      context: { ...ctx, status: 'error' },
      lastResult: err(createError('WORKTREE_ERROR', 'Worktree error', 500)),
    };
  }

  return nextError(
    machine,
    createError('WORKTREE_INVALID_TRANSITION', 'Invalid worktree transition', 400, {
      state: machine.state,
      event: event.type,
    })
  );
};
