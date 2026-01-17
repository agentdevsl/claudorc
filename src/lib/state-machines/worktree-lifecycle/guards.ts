import type { WorktreeLifecycleContext } from './types.js';

export const canCreate = (ctx: WorktreeLifecycleContext) => !ctx.branchExists && ctx.pathAvailable;

export const canMerge = (ctx: WorktreeLifecycleContext) =>
  !ctx.hasUncommittedChanges && ctx.conflictFiles.length === 0;

export const canRemove = (ctx: WorktreeLifecycleContext) =>
  !['creating', 'merging', 'committing'].includes(ctx.status);

export const isStale = (ctx: WorktreeLifecycleContext) =>
  Date.now() - ctx.lastActivity > 7 * 24 * 60 * 60 * 1000;

export const hasConflicts = (ctx: WorktreeLifecycleContext) => ctx.conflictFiles.length > 0;
