import { err, ok } from '../../utils/result.js';
import type { Result } from '../../utils/result.js';
import type { AppError } from '../../errors/base.js';
import { createError } from '../../errors/base.js';
import type { TaskWorkflowContext, TaskWorkflowEvent, TaskWorkflowState } from './types.js';
import { canApprove, canAssign, canReject, hasDiff, withinConcurrencyLimit } from './guards.js';

export type TaskMachine = {
  state: TaskWorkflowState;
  context: TaskWorkflowContext;
  send: (event: TaskWorkflowEvent) => TaskMachineResult;
};

export type TaskMachineResult = Result<TaskMachine, AppError> & {
  state: TaskWorkflowState;
  send: (event: TaskWorkflowEvent) => TaskMachineResult;
};

type TaskMachineInternal = TaskMachine & { lastResult: Result<TaskMachine, AppError> };

const createMachineResult = (
  machine: TaskMachine,
  result: Result<TaskMachine, AppError>
): TaskMachineResult => ({
  ...result,
  state: machine.state,
  send: machine.send,
});

export const createTaskWorkflowMachine = (
  initial: Partial<TaskWorkflowContext> & { taskId: string }
): TaskMachine => {
  const context: TaskWorkflowContext = {
    taskId: initial.taskId,
    column: 'backlog',
    runningAgents: 0,
    maxConcurrentAgents: 3,
    diffSummary: null,
    ...initial,
  };

  const machine: TaskMachineInternal = {
    state: context.column,
    context,
    send: (event) => {
      const next = transition(machine, event);
      update(next);
      return createMachineResult(next, next.lastResult);
    },
    lastResult: ok({
      state: context.column,
      context,
      send: () => ({
        ok: true,
        value: machine,
        state: machine.state,
        send: machine.send,
      }),
    }),
  };

  const update = (next: TaskMachineInternal) => {
    machine.state = next.state;
    machine.context = next.context;
    machine.lastResult = next.lastResult;
  };

  return machine;
};

const transition = (machine: TaskMachineInternal, event: TaskWorkflowEvent) => {
  const ctx = machine.context;

  switch (machine.state) {
    case 'backlog':
      if (event.type === 'ASSIGN') {
        if (!canAssign(ctx)) {
          return {
            ...machine,
            lastResult: err(createError('TASK_ALREADY_ASSIGNED', 'Task already assigned', 409)),
          };
        }
        if (!withinConcurrencyLimit(ctx)) {
          return {
            ...machine,
            lastResult: err(
              createError('CONCURRENCY_LIMIT_EXCEEDED', 'Concurrency limit exceeded', 429)
            ),
          };
        }
        const nextContext = { ...ctx, column: 'in_progress', agentId: event.agentId };
        return {
          ...machine,
          state: 'in_progress',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'in_progress', context: nextContext }),
        };
      }
      break;
    case 'in_progress':
      if (event.type === 'COMPLETE') {
        const nextContext = { ...ctx, column: 'waiting_approval' };
        return {
          ...machine,
          state: 'waiting_approval',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'waiting_approval', context: nextContext }),
        };
      }
      if (event.type === 'CANCEL') {
        const nextContext = { ...ctx, column: 'backlog', agentId: undefined };
        return {
          ...machine,
          state: 'backlog',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'backlog', context: nextContext }),
        };
      }
      break;
    case 'waiting_approval':
      if (event.type === 'APPROVE') {
        if (!canApprove(ctx)) {
          return {
            ...machine,
            lastResult: err(createError('TASK_NOT_WAITING_APPROVAL', 'Not waiting approval', 400)),
          };
        }
        if (!hasDiff(ctx)) {
          return {
            ...machine,
            lastResult: err(createError('TASK_NO_DIFF', 'No changes to approve', 400)),
          };
        }
        const nextContext = { ...ctx, column: 'verified' };
        return {
          ...machine,
          state: 'verified',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'verified', context: nextContext }),
        };
      }
      if (event.type === 'REJECT') {
        if (!canReject(ctx)) {
          return {
            ...machine,
            lastResult: err(createError('TASK_NOT_WAITING_APPROVAL', 'Not waiting approval', 400)),
          };
        }
        const nextContext = { ...ctx, column: 'in_progress' };
        return {
          ...machine,
          state: 'in_progress',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'in_progress', context: nextContext }),
        };
      }
      break;
    case 'verified':
      break;
    default:
      break;
  }

  return {
    ...machine,
    lastResult: err(
      createError('TASK_INVALID_TRANSITION', 'Invalid task transition', 400, {
        state: machine.state,
        event: event.type,
      })
    ),
  };
};
