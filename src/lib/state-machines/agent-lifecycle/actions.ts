import type { AgentLifecycleContext, AgentLifecycleEvent } from './types.js';

export const incrementTurn = (ctx: AgentLifecycleContext): AgentLifecycleContext => ({
  ...ctx,
  currentTurn: ctx.currentTurn + 1,
});

export const setError = (
  ctx: AgentLifecycleContext,
  event: AgentLifecycleEvent
): AgentLifecycleContext => {
  if (event.type !== 'ERROR') {
    return ctx;
  }

  return {
    ...ctx,
    error: event.error,
    status: 'error',
  };
};

export const clearTask = (ctx: AgentLifecycleContext): AgentLifecycleContext => ({
  ...ctx,
  taskId: undefined,
  currentTurn: 0,
});
