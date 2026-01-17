import { createError } from './base.js';

export const SessionErrors = {
  NOT_FOUND: createError('SESSION_NOT_FOUND', 'Session not found', 404),
  CLOSED: createError('SESSION_CLOSED', 'Session is closed', 400),
  CONNECTION_FAILED: (error: string) =>
    createError('SESSION_CONNECTION_FAILED', 'Failed to connect to session', 502, { error }),
  SYNC_FAILED: (error: string) =>
    createError('SESSION_SYNC_FAILED', 'Session sync failed', 500, { error }),
} as const;

export type SessionError =
  | typeof SessionErrors.NOT_FOUND
  | typeof SessionErrors.CLOSED
  | ReturnType<typeof SessionErrors.CONNECTION_FAILED>
  | ReturnType<typeof SessionErrors.SYNC_FAILED>;
