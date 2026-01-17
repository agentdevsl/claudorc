import type { AppError } from '../../errors/base.js';
import { createError } from '../../errors/base.js';
import type { Result } from '../../utils/result.js';
import { err, ok } from '../../utils/result.js';
import { clearTask, incrementTurn, setError } from './actions.js';
import { canPause, canResume, canStart, isToolAllowed, withinTurnLimit } from './guards.js';
import type { AgentLifecycleContext, AgentLifecycleEvent, AgentLifecycleState } from './types.js';

export type AgentMachine = {
  state: AgentLifecycleState;
  context: AgentLifecycleContext;
  send: (event: AgentLifecycleEvent) => AgentMachineResult;
};

export type AgentMachineResult = Result<AgentMachine, AppError> & {
  state: AgentLifecycleState;
  send: (event: AgentLifecycleEvent) => AgentMachineResult;
};

type AgentMachineInternal = AgentMachine & { lastResult: Result<AgentMachine, AppError> };

const createMachineResult = (
  machine: AgentMachine,
  result: Result<AgentMachine, AppError>
): AgentMachineResult => ({
  ...result,
  state: machine.state,
  send: machine.send,
});

export const createAgentLifecycleMachine = (
  initial?: Partial<AgentLifecycleContext>
): AgentMachine => {
  const context: AgentLifecycleContext = {
    status: 'idle',
    currentTurn: 0,
    maxTurns: 50,
    allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
    ...initial,
  };

  const machine: AgentMachineInternal = {
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

  const update = (next: AgentMachineInternal) => {
    machine.state = next.state;
    machine.context = next.context;
    machine.lastResult = next.lastResult;
  };

  return machine;
};

const transition = (machine: AgentMachineInternal, event: AgentLifecycleEvent) => {
  const ctx = machine.context;

  if (!isToolAllowed(ctx, event)) {
    const error = createError('AGENT_TOOL_NOT_ALLOWED', 'Tool not allowed', 403);
    return { ...machine, lastResult: err(error) };
  }

  switch (machine.state) {
    case 'idle': {
      if (event.type === 'START' && canStart({ ...ctx, taskId: event.taskId })) {
        const nextContext = { ...ctx, status: 'running', taskId: event.taskId };
        return {
          ...machine,
          state: 'running',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'running', context: nextContext }),
        };
      }
      break;
    }
    case 'running': {
      if (event.type === 'STEP') {
        const nextContext = incrementTurn(ctx);
        const updated = { ...machine, context: nextContext };
        if (!withinTurnLimit(nextContext)) {
          const error = createError('AGENT_TURN_LIMIT_EXCEEDED', 'Turn limit exceeded', 200);
          return { ...updated, lastResult: err(error) };
        }
        return { ...updated, lastResult: ok(updated) };
      }
      if (event.type === 'PAUSE' && canPause(ctx)) {
        const nextContext = { ...ctx, status: 'paused' };
        return {
          ...machine,
          state: 'paused',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'paused', context: nextContext }),
        };
      }
      if (event.type === 'COMPLETE') {
        const cleared = clearTask({ ...ctx, status: 'completed' });
        return {
          ...machine,
          state: 'completed',
          context: cleared,
          lastResult: ok({ ...machine, state: 'completed', context: cleared }),
        };
      }
      if (event.type === 'ERROR') {
        const errored = setError(ctx, event);
        return { ...machine, state: 'error', context: errored, lastResult: err(event.error) };
      }
      if (event.type === 'ABORT') {
        const cleared = clearTask({ ...ctx, status: 'idle' });
        return {
          ...machine,
          state: 'idle',
          context: cleared,
          lastResult: ok({ ...machine, state: 'idle', context: cleared }),
        };
      }
      break;
    }
    case 'paused': {
      if (event.type === 'RESUME' && canResume(ctx)) {
        const nextContext = { ...ctx, status: 'running' };
        return {
          ...machine,
          state: 'running',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'running', context: nextContext }),
        };
      }
      if (event.type === 'ABORT') {
        const cleared = clearTask({ ...ctx, status: 'idle' });
        return {
          ...machine,
          state: 'idle',
          context: cleared,
          lastResult: ok({ ...machine, state: 'idle', context: cleared }),
        };
      }
      break;
    }
    case 'completed':
    case 'error': {
      if (event.type === 'START' && canStart(ctx)) {
        const nextContext = { ...ctx, status: 'running' };
        return {
          ...machine,
          state: 'running',
          context: nextContext,
          lastResult: ok({ ...machine, state: 'running', context: nextContext }),
        };
      }
      break;
    }
    default:
      break;
  }

  const error = createError('AGENT_INVALID_TRANSITION', 'Invalid agent transition', 400, {
    state: machine.state,
    event: event.type,
  });
  return { ...machine, lastResult: err(error) };
};
