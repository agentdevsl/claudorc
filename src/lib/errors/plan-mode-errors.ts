import type { AppError } from './base.js';
import { createError } from './base.js';

export type PlanModeError = AppError;

export const PlanModeErrors = {
  SESSION_NOT_FOUND: createError('PLAN_SESSION_NOT_FOUND', 'Plan session not found', 404),

  SESSION_ALREADY_ACTIVE: (sessionId: string) =>
    createError('PLAN_SESSION_ALREADY_ACTIVE', 'Plan session is already active', 409, {
      sessionId,
    }),

  SESSION_COMPLETED: (sessionId: string) =>
    createError('PLAN_SESSION_COMPLETED', 'Plan session has already been completed', 400, {
      sessionId,
    }),

  SESSION_CANCELLED: (sessionId: string) =>
    createError('PLAN_SESSION_CANCELLED', 'Plan session has been cancelled', 400, { sessionId }),

  INTERACTION_NOT_FOUND: (interactionId: string) =>
    createError('PLAN_INTERACTION_NOT_FOUND', 'Interaction not found in session', 404, {
      interactionId,
    }),

  INTERACTION_ALREADY_ANSWERED: (interactionId: string) =>
    createError('PLAN_INTERACTION_ALREADY_ANSWERED', 'Interaction has already been answered', 400, {
      interactionId,
    }),

  NOT_WAITING_FOR_USER: createError(
    'PLAN_NOT_WAITING_FOR_USER',
    'Session is not waiting for user input',
    400
  ),

  CREDENTIALS_NOT_FOUND: createError(
    'PLAN_CREDENTIALS_NOT_FOUND',
    'OAuth credentials not found. Please authenticate with Claude first.',
    401
  ),

  CREDENTIALS_EXPIRED: createError(
    'PLAN_CREDENTIALS_EXPIRED',
    'OAuth credentials have expired. Please re-authenticate.',
    401
  ),

  API_ERROR: (message: string, status?: number) =>
    createError('PLAN_API_ERROR', message, status ?? 500),

  STREAM_ERROR: (message: string) => createError('PLAN_STREAM_ERROR', message, 500),

  GITHUB_ERROR: (message: string) =>
    createError('PLAN_GITHUB_ERROR', `GitHub operation failed: ${message}`, 500),

  TASK_NOT_FOUND: createError('PLAN_TASK_NOT_FOUND', 'Task not found', 404),

  PROJECT_NOT_FOUND: createError('PLAN_PROJECT_NOT_FOUND', 'Project not found', 404),

  INVALID_TURN_ROLE: (role: string) =>
    createError('PLAN_INVALID_TURN_ROLE', `Invalid turn role: ${role}`, 400, { role }),

  MAX_TURNS_EXCEEDED: (maxTurns: number) =>
    createError('PLAN_MAX_TURNS_EXCEEDED', `Maximum turns (${maxTurns}) exceeded`, 400, {
      maxTurns,
    }),

  PARSING_ERROR: (message: string) =>
    createError('PLAN_PARSING_ERROR', `Failed to parse response: ${message}`, 500),

  DATABASE_ERROR: (operation: string, message: string) =>
    createError('PLAN_DATABASE_ERROR', `Database ${operation} failed: ${message}`, 500, {
      operation,
    }),

  TOOL_INPUT_PARSE_ERROR: (toolName: string, message: string) =>
    createError(
      'PLAN_TOOL_INPUT_PARSE_ERROR',
      `Failed to parse ${toolName} input: ${message}`,
      500,
      {
        toolName,
      }
    ),
};
