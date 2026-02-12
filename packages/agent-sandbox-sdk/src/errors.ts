/**
 * Base SDK error
 */
export class AgentSandboxError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentSandboxError';
  }
}

/**
 * Resource not found
 */
export class NotFoundError extends AgentSandboxError {
  constructor(kind: string, name: string, namespace?: string) {
    super(
      `${kind} "${name}" not found${namespace ? ` in namespace "${namespace}"` : ''}`,
      'NOT_FOUND',
      404,
      { kind, name, namespace }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Resource already exists
 */
export class AlreadyExistsError extends AgentSandboxError {
  constructor(kind: string, name: string) {
    super(`${kind} "${name}" already exists`, 'ALREADY_EXISTS', 409, { kind, name });
    this.name = 'AlreadyExistsError';
  }
}

/**
 * Timeout waiting for condition
 */
export class TimeoutError extends AgentSandboxError {
  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms`, 'TIMEOUT', 408, {
      operation,
      timeoutMs,
    });
    this.name = 'TimeoutError';
  }
}

/**
 * Exec operation failed
 */
export class ExecError extends AgentSandboxError {
  constructor(command: string, message: string, exitCode?: number) {
    super(`Exec failed for "${command}": ${message}`, 'EXEC_FAILED', 500, {
      command,
      exitCode,
    });
    this.name = 'ExecError';
  }
}

/**
 * CRD controller not installed
 */
export class ControllerNotInstalledError extends AgentSandboxError {
  constructor() {
    super(
      'Agent Sandbox CRD controller is not installed in the cluster',
      'CONTROLLER_NOT_INSTALLED',
      503
    );
    this.name = 'ControllerNotInstalledError';
  }
}

/**
 * KubeConfig errors
 */
export class KubeConfigError extends AgentSandboxError {
  constructor(message: string) {
    super(message, 'KUBECONFIG_ERROR', 500);
    this.name = 'KubeConfigError';
  }
}
