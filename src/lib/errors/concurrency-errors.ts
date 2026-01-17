import { createError } from './base.js';

export const ConcurrencyErrors = {
  LIMIT_EXCEEDED: (current: number, max: number) =>
    createError(
      'CONCURRENCY_LIMIT_EXCEEDED',
      `Maximum concurrent agents reached (${current}/${max})`,
      429,
      { currentAgents: current, maxAgents: max }
    ),
  QUEUE_FULL: (queueSize: number, maxSize: number) =>
    createError('QUEUE_FULL', `Task queue is full (${queueSize}/${maxSize})`, 429, {
      queueSize,
      maxSize,
    }),
  RESOURCE_LOCKED: (resource: string, lockedBy: string) =>
    createError('RESOURCE_LOCKED', `Resource "${resource}" is locked by another operation`, 423, {
      resource,
      lockedBy,
    }),
} as const;

export type ConcurrencyError =
  | ReturnType<typeof ConcurrencyErrors.LIMIT_EXCEEDED>
  | ReturnType<typeof ConcurrencyErrors.QUEUE_FULL>
  | ReturnType<typeof ConcurrencyErrors.RESOURCE_LOCKED>;
