import type { AppError } from './base.js';
import { createError } from './base.js';

export type K8sError = AppError;

export const K8sErrors = {
  // Cluster connectivity errors
  CLUSTER_UNREACHABLE: (message: string) =>
    createError('K8S_CLUSTER_UNREACHABLE', `Kubernetes cluster is unreachable: ${message}`, 503),

  KUBECONFIG_NOT_FOUND: (path?: string) =>
    createError(
      'K8S_KUBECONFIG_NOT_FOUND',
      path ? `Kubeconfig not found at: ${path}` : 'Kubeconfig not found',
      404,
      { path }
    ),

  KUBECONFIG_INVALID: (message: string) =>
    createError('K8S_KUBECONFIG_INVALID', `Invalid kubeconfig: ${message}`, 400),

  CONTEXT_NOT_FOUND: (context: string) =>
    createError('K8S_CONTEXT_NOT_FOUND', `Kubernetes context not found: ${context}`, 404, {
      context,
    }),

  // Namespace errors
  NAMESPACE_NOT_FOUND: (namespace: string) =>
    createError('K8S_NAMESPACE_NOT_FOUND', `Namespace not found: ${namespace}`, 404, { namespace }),

  NAMESPACE_CREATION_FAILED: (namespace: string, message: string) =>
    createError(
      'K8S_NAMESPACE_CREATION_FAILED',
      `Failed to create namespace ${namespace}: ${message}`,
      500,
      { namespace }
    ),

  NAMESPACE_ACCESS_DENIED: (namespace: string) =>
    createError('K8S_NAMESPACE_ACCESS_DENIED', `Access denied to namespace: ${namespace}`, 403, {
      namespace,
    }),

  // Pod lifecycle errors
  POD_NOT_FOUND: (podName: string, namespace: string) =>
    createError('K8S_POD_NOT_FOUND', `Pod not found: ${podName} in namespace ${namespace}`, 404, {
      podName,
      namespace,
    }),

  POD_CREATION_FAILED: (podName: string, message: string) =>
    createError('K8S_POD_CREATION_FAILED', `Failed to create pod ${podName}: ${message}`, 500, {
      podName,
    }),

  POD_STARTUP_TIMEOUT: (podName: string, timeoutSeconds: number) =>
    createError(
      'K8S_POD_STARTUP_TIMEOUT',
      `Pod ${podName} failed to start within ${timeoutSeconds}s`,
      408,
      { podName, timeoutSeconds }
    ),

  POD_DELETION_FAILED: (podName: string, message: string) =>
    createError('K8S_POD_DELETION_FAILED', `Failed to delete pod ${podName}: ${message}`, 500, {
      podName,
    }),

  POD_NOT_RUNNING: (podName: string, currentPhase: string) =>
    createError(
      'K8S_POD_NOT_RUNNING',
      `Pod ${podName} is not running (current phase: ${currentPhase})`,
      400,
      { podName, currentPhase }
    ),

  POD_ALREADY_EXISTS: (projectId: string) =>
    createError('K8S_POD_ALREADY_EXISTS', 'Pod already exists for project', 409, { projectId }),

  // Exec errors
  EXEC_FAILED: (command: string, message: string) =>
    createError('K8S_EXEC_FAILED', `Command execution failed: ${message}`, 500, { command }),

  EXEC_TIMEOUT: (command: string, timeoutMs: number) =>
    createError('K8S_EXEC_TIMEOUT', `Command timed out after ${timeoutMs}ms`, 408, {
      command,
      timeoutMs,
    }),

  EXEC_CONNECTION_FAILED: (podName: string, message: string) =>
    createError(
      'K8S_EXEC_CONNECTION_FAILED',
      `Failed to establish exec connection to pod ${podName}: ${message}`,
      503,
      { podName }
    ),

  // Image errors
  IMAGE_PULL_FAILED: (image: string, message: string) =>
    createError('K8S_IMAGE_PULL_FAILED', `Failed to pull image ${image}: ${message}`, 500, {
      image,
    }),

  IMAGE_PULL_BACKOFF: (image: string, reason: string) =>
    createError(
      'K8S_IMAGE_PULL_BACKOFF',
      `Image pull backoff for ${image}: ${reason}`,
      500,
      { image, reason }
    ),

  IMAGE_NOT_FOUND: (image: string) =>
    createError('K8S_IMAGE_NOT_FOUND', `Image not found: ${image}`, 404, { image }),

  // tmux errors (reuse sandbox pattern)
  TMUX_SESSION_NOT_FOUND: (sessionName: string) =>
    createError('K8S_TMUX_SESSION_NOT_FOUND', `tmux session not found: ${sessionName}`, 404, {
      sessionName,
    }),

  TMUX_SESSION_ALREADY_EXISTS: (sessionName: string) =>
    createError('K8S_TMUX_SESSION_EXISTS', `tmux session already exists: ${sessionName}`, 409, {
      sessionName,
    }),

  TMUX_CREATION_FAILED: (sessionName: string, message: string) =>
    createError('K8S_TMUX_CREATION_FAILED', `Failed to create tmux session: ${message}`, 500, {
      sessionName,
    }),

  // Resource errors
  INSUFFICIENT_RESOURCES: (resource: string, requested: string, available: string) =>
    createError(
      'K8S_INSUFFICIENT_RESOURCES',
      `Insufficient ${resource}: requested ${requested}, available ${available}`,
      400,
      { resource, requested, available }
    ),

  // API errors
  API_ERROR: (statusCode: number, message: string) =>
    createError('K8S_API_ERROR', `Kubernetes API error (${statusCode}): ${message}`, statusCode),

  // Generic internal error
  INTERNAL_ERROR: (message: string) => createError('K8S_INTERNAL_ERROR', message, 500),
};
