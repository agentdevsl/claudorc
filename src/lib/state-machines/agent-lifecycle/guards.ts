import type { AgentLifecycleContext, AgentLifecycleEvent } from './types.js';

export const canStart = (ctx: AgentLifecycleContext) => ctx.status === 'idle' && !!ctx.taskId;

export const withinTurnLimit = (ctx: AgentLifecycleContext) => ctx.currentTurn < ctx.maxTurns;

export const isToolAllowed = (ctx: AgentLifecycleContext, event: AgentLifecycleEvent) => {
  if (event.type !== 'TOOL') {
    return true;
  }
  return ctx.allowedTools.includes(event.tool);
};

export const canPause = (ctx: AgentLifecycleContext) => ctx.status === 'running';

export const canResume = (ctx: AgentLifecycleContext) => ctx.status === 'paused';
