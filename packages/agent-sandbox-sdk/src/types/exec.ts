import type { Readable } from 'node:stream';

/**
 * Result of a buffered exec command
 */
export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Options for buffered exec
 */
export interface ExecOptions {
  /** Sandbox name */
  sandboxName: string;
  /** Namespace */
  namespace: string;
  /** Container name (defaults to first container) */
  container?: string;
  /** Command to execute */
  command: string[];
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Options for streaming exec
 */
export interface ExecStreamOptions extends ExecOptions {
  /** Optional stdin stream */
  stdin?: Readable;
  /** Whether to allocate a TTY */
  tty?: boolean;
}

/**
 * Result of a streaming exec
 */
export interface ExecStreamResult {
  /** Readable stream for stdout */
  stdout: Readable;
  /** Readable stream for stderr */
  stderr: Readable;
  /** Promise that resolves when the process exits */
  wait(): Promise<{ exitCode: number }>;
  /** Kill the process */
  kill(): void | Promise<void>;
}
