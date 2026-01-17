import type { SessionLifecycleContext } from './types.js';

export const hasCapacity = (ctx: SessionLifecycleContext) =>
  ctx.participants.length < ctx.maxParticipants;

export const isParticipant = (ctx: SessionLifecycleContext, userId: string) =>
  ctx.participants.includes(userId);

export const isStale = (ctx: SessionLifecycleContext) => Date.now() - ctx.lastActivity > 60000;

export const canClose = (ctx: SessionLifecycleContext) =>
  ctx.status !== 'closed' && ctx.status !== 'closing';
