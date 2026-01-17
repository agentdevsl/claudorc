import { err, ok } from '../../utils/result.js';
import type { Result } from '../../utils/result.js';
import type { AppError } from '../../errors/base.js';
import { createError } from '../../errors/base.js';
import type {
  SessionLifecycleContext,
  SessionLifecycleEvent,
  SessionLifecycleState,
} from './types.js';
import { canClose, hasCapacity, isParticipant, isStale } from './guards.js';

export type SessionMachine = {
  state: SessionLifecycleState;
  context: SessionLifecycleContext;
  send: (event: SessionLifecycleEvent) => SessionMachineResult;
};

export type SessionMachineResult = Result<SessionMachine, AppError> & {
  state: SessionLifecycleState;
  send: (event: SessionLifecycleEvent) => SessionMachineResult;
};

type SessionMachineInternal = SessionMachine & { lastResult: Result<SessionMachine, AppError> };

const createMachineResult = (
  machine: SessionMachine,
  result: Result<SessionMachine, AppError>
): SessionMachineResult => ({
  ...result,
  state: machine.state,
  send: machine.send,
});

export const createSessionLifecycleMachine = (
  initial?: Partial<SessionLifecycleContext>
): SessionMachine => {
  const context: SessionLifecycleContext = {
    status: 'idle',
    participants: [],
    maxParticipants: 4,
    lastActivity: Date.now(),
    ...initial,
  };

  const machine: SessionMachineInternal = {
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

  const update = (next: SessionMachineInternal) => {
    machine.state = next.state;
    machine.context = next.context;
    machine.lastResult = next.lastResult;
  };

  return machine;
};

const transition = (machine: SessionMachineInternal, event: SessionLifecycleEvent) => {
  const ctx = machine.context;

  switch (machine.state) {
    case 'idle':
      if (event.type === 'INITIALIZE') {
        const next = { ...ctx, status: 'initializing' };
        return {
          ...machine,
          state: 'initializing',
          context: next,
          lastResult: ok({ ...machine, state: 'initializing', context: next }),
        };
      }
      break;
    case 'initializing':
      if (event.type === 'READY') {
        const next = { ...ctx, status: 'active' };
        return {
          ...machine,
          state: 'active',
          context: next,
          lastResult: ok({ ...machine, state: 'active', context: next }),
        };
      }
      break;
    case 'active':
      if (event.type === 'JOIN') {
        if (!hasCapacity(ctx)) {
          return {
            ...machine,
            lastResult: err(createError('SESSION_CAPACITY_REACHED', 'Session full', 409)),
          };
        }
        const nextParticipants = ctx.participants.concat(event.userId);
        const next = { ...ctx, participants: nextParticipants, lastActivity: Date.now() };
        return {
          ...machine,
          context: next,
          lastResult: ok({ ...machine, context: next }),
        };
      }
      if (event.type === 'LEAVE') {
        if (!isParticipant(ctx, event.userId)) {
          return {
            ...machine,
            lastResult: err(createError('SESSION_NOT_PARTICIPANT', 'User not in session', 400)),
          };
        }
        const nextParticipants = ctx.participants.filter((id) => id !== event.userId);
        const next = { ...ctx, participants: nextParticipants, lastActivity: Date.now() };
        return {
          ...machine,
          context: next,
          lastResult: ok({ ...machine, context: next }),
        };
      }
      if (event.type === 'HEARTBEAT') {
        const next = { ...ctx, lastActivity: Date.now() };
        return {
          ...machine,
          context: next,
          lastResult: ok({ ...machine, context: next }),
        };
      }
      if (event.type === 'PAUSE') {
        const next = { ...ctx, status: 'paused' };
        return {
          ...machine,
          state: 'paused',
          context: next,
          lastResult: ok({ ...machine, state: 'paused', context: next }),
        };
      }
      if (event.type === 'TIMEOUT' && isStale(ctx)) {
        const next = { ...ctx, status: 'closing' };
        return {
          ...machine,
          state: 'closing',
          context: next,
          lastResult: ok({ ...machine, state: 'closing', context: next }),
        };
      }
      if (event.type === 'CLOSE' && canClose(ctx)) {
        const next = { ...ctx, status: 'closing' };
        return {
          ...machine,
          state: 'closing',
          context: next,
          lastResult: ok({ ...machine, state: 'closing', context: next }),
        };
      }
      break;
    case 'paused':
      if (event.type === 'RESUME') {
        const next = { ...ctx, status: 'active' };
        return {
          ...machine,
          state: 'active',
          context: next,
          lastResult: ok({ ...machine, state: 'active', context: next }),
        };
      }
      if (event.type === 'CLOSE' && canClose(ctx)) {
        const next = { ...ctx, status: 'closing' };
        return {
          ...machine,
          state: 'closing',
          context: next,
          lastResult: ok({ ...machine, state: 'closing', context: next }),
        };
      }
      break;
    case 'closing':
      if (event.type === 'CLOSE') {
        const next = { ...ctx, status: 'closed' };
        return {
          ...machine,
          state: 'closed',
          context: next,
          lastResult: ok({ ...machine, state: 'closed', context: next }),
        };
      }
      break;
    case 'error':
      if (event.type === 'CLOSE') {
        const next = { ...ctx, status: 'closed' };
        return {
          ...machine,
          state: 'closed',
          context: next,
          lastResult: ok({ ...machine, state: 'closed', context: next }),
        };
      }
      break;
    default:
      break;
  }

  if (event.type === 'ERROR') {
    const next = { ...ctx, status: 'error', error: event.error };
    return { ...machine, state: 'error', context: next, lastResult: err(event.error) };
  }

  return {
    ...machine,
    lastResult: err(
      createError('SESSION_INVALID_TRANSITION', 'Invalid session transition', 400, {
        state: machine.state,
        event: event.type,
      })
    ),
  };
};
