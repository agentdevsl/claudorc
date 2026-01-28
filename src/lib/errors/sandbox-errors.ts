import type { AppError } from './base.js';
import { createError } from './base.js';

export type SandboxError = AppError;

export const SandboxErrors = {
  // Container errors
  CONTAINER_NOT_FOUND: createError(
    'SANDBOX_CONTAINER_NOT_FOUND',
    'Sandbox container not found',
    404
  ),

  CONTAINER_ALREADY_EXISTS: (projectId: string) =>
    createError(
      'SANDBOX_CONTAINER_ALREADY_EXISTS',
      'Sandbox container already exists for project',
      409,
      {
        projectId,
      }
    ),

  CONTAINER_CREATION_FAILED: (message: string) =>
    createError('SANDBOX_CONTAINER_CREATION_FAILED', `Failed to create container: ${message}`, 500),

  CONTAINER_START_FAILED: (message: string) =>
    createError('SANDBOX_CONTAINER_START_FAILED', `Failed to start container: ${message}`, 500),

  CONTAINER_STOP_FAILED: (message: string) =>
    createError('SANDBOX_CONTAINER_STOP_FAILED', `Failed to stop container: ${message}`, 500),

  CONTAINER_NOT_RUNNING: createError(
    'SANDBOX_CONTAINER_NOT_RUNNING',
    'Container is not running',
    400
  ),

  // Image errors
  IMAGE_NOT_FOUND: (image: string) =>
    createError('SANDBOX_IMAGE_NOT_FOUND', `Docker image not found: ${image}`, 404, { image }),

  IMAGE_PULL_FAILED: (image: string, message: string) =>
    createError('SANDBOX_IMAGE_PULL_FAILED', `Failed to pull image ${image}: ${message}`, 500, {
      image,
    }),

  // Execution errors
  EXEC_FAILED: (command: string, message: string) =>
    createError('SANDBOX_EXEC_FAILED', `Command execution failed: ${message}`, 500, { command }),

  EXEC_TIMEOUT: (command: string, timeoutMs: number) =>
    createError('SANDBOX_EXEC_TIMEOUT', `Command timed out after ${timeoutMs}ms`, 408, {
      command,
      timeoutMs,
    }),

  // tmux errors
  TMUX_SESSION_NOT_FOUND: (sessionName: string) =>
    createError('SANDBOX_TMUX_SESSION_NOT_FOUND', `tmux session not found: ${sessionName}`, 404, {
      sessionName,
    }),

  TMUX_SESSION_ALREADY_EXISTS: (sessionName: string) =>
    createError('SANDBOX_TMUX_SESSION_EXISTS', `tmux session already exists: ${sessionName}`, 409, {
      sessionName,
    }),

  TMUX_CREATION_FAILED: (sessionName: string, message: string) =>
    createError('SANDBOX_TMUX_CREATION_FAILED', `Failed to create tmux session: ${message}`, 500, {
      sessionName,
    }),

  // Credentials errors
  CREDENTIALS_INJECTION_FAILED: (message: string) =>
    createError(
      'SANDBOX_CREDENTIALS_INJECTION_FAILED',
      `Failed to inject credentials: ${message}`,
      500
    ),

  CREDENTIALS_NOT_FOUND: createError(
    'SANDBOX_CREDENTIALS_NOT_FOUND',
    'OAuth credentials not found',
    401
  ),

  // Provider errors
  PROVIDER_NOT_AVAILABLE: (provider: string) =>
    createError(
      'SANDBOX_PROVIDER_NOT_AVAILABLE',
      `Sandbox provider not available: ${provider}`,
      503,
      {
        provider,
      }
    ),

  PROVIDER_HEALTH_CHECK_FAILED: (provider: string, message: string) =>
    createError(
      'SANDBOX_PROVIDER_HEALTH_CHECK_FAILED',
      `Provider health check failed: ${message}`,
      503,
      { provider }
    ),

  DOCKER_NOT_RUNNING: createError(
    'SANDBOX_DOCKER_NOT_RUNNING',
    'Docker daemon is not running',
    503
  ),

  // Project errors
  PROJECT_NOT_FOUND: createError('SANDBOX_PROJECT_NOT_FOUND', 'Project not found', 404),

  SANDBOX_NOT_ENABLED: (projectId: string) =>
    createError('SANDBOX_NOT_ENABLED', 'Sandbox is not enabled for this project', 400, {
      projectId,
    }),

  // State errors
  INVALID_STATE_TRANSITION: (from: string, to: string) =>
    createError(
      'SANDBOX_INVALID_STATE_TRANSITION',
      `Invalid state transition from ${from} to ${to}`,
      400,
      { from, to }
    ),

  SANDBOX_BUSY: (sandboxId: string) =>
    createError('SANDBOX_BUSY', 'Sandbox is busy with another operation', 409, { sandboxId }),

  // Resource errors
  RESOURCE_LIMIT_EXCEEDED: (resource: string, limit: number, requested: number) =>
    createError(
      'SANDBOX_RESOURCE_LIMIT_EXCEEDED',
      `Resource limit exceeded for ${resource}: requested ${requested}, limit ${limit}`,
      400,
      { resource, limit, requested }
    ),

  // Volume errors
  VOLUME_MOUNT_FAILED: (hostPath: string, containerPath: string, message: string) =>
    createError('SANDBOX_VOLUME_MOUNT_FAILED', `Failed to mount volume: ${message}`, 500, {
      hostPath,
      containerPath,
    }),

  // Generic errors
  INTERNAL_ERROR: (message: string) => createError('SANDBOX_INTERNAL_ERROR', message, 500),

  // Task errors
  TASK_NOT_FOUND: (taskId: string) =>
    createError('SANDBOX_TASK_NOT_FOUND', `Task not found: ${taskId}`, 404, { taskId }),

  // Container agent errors
  AGENT_ALREADY_RUNNING: (taskId: string) =>
    createError(
      'SANDBOX_AGENT_ALREADY_RUNNING',
      `Agent is already running for task: ${taskId}`,
      409,
      {
        taskId,
      }
    ),

  AGENT_NOT_RUNNING: (taskId: string) =>
    createError('SANDBOX_AGENT_NOT_RUNNING', `No agent running for task: ${taskId}`, 404, {
      taskId,
    }),

  AGENT_START_FAILED: (message: string) =>
    createError('SANDBOX_AGENT_START_FAILED', `Failed to start agent: ${message}`, 500),

  AGENT_STOP_FAILED: (message: string) =>
    createError('SANDBOX_AGENT_STOP_FAILED', `Failed to stop agent: ${message}`, 500),

  STREAMING_EXEC_NOT_SUPPORTED: createError(
    'SANDBOX_STREAMING_EXEC_NOT_SUPPORTED',
    'Sandbox provider does not support streaming exec',
    501
  ),

  SESSION_CREATE_FAILED: (message: string): SandboxError => ({
    code: 'SESSION_CREATE_FAILED',
    message: `Failed to create agent session: ${message}`,
    status: 500,
  }),

  STREAM_CREATE_FAILED: (message: string): SandboxError => ({
    code: 'STREAM_CREATE_FAILED',
    message: `Failed to create event stream: ${message}`,
    status: 500,
  }),
};
