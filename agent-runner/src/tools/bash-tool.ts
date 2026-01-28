/**
 * Bash command execution tool for the agent-runner.
 */
import { exec } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { ToolContext, ToolResponse } from './types.js';

const execAsync = promisify(exec);
const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT ?? '/workspace';
const DEFAULT_TIMEOUT_MS = 120000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 300000;

export interface BashArgs {
  command: string;
  cwd?: string;
  timeout?: number;
}

// Dangerous commands that require explicit approval
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,
  /rm\s+-rf\s+~\//,
  /git\s+push\s+--force/,
  /git\s+reset\s+--hard/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /TRUNCATE\s+TABLE/i,
  /chmod\s+-R\s+777/,
  /mkfs\./,
  /dd\s+if=/,
  /:(){ :|:& };:/, // Fork bomb
];

/**
 * Check if a command is potentially dangerous.
 */
function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

function resolveWorkspacePath(path: string, cwd: string): string {
  const resolved = isAbsolute(path) ? path : resolve(cwd, path);
  const normalized = resolve(resolved);

  if (!normalized.startsWith(`${WORKSPACE_ROOT}/`) && normalized !== WORKSPACE_ROOT) {
    throw new Error(`Access denied: path '${path}' resolves outside workspace`);
  }

  return normalized;
}

function normalizeTimeout(timeout: number | undefined): number {
  if (!Number.isFinite(timeout) || typeof timeout !== 'number') {
    return DEFAULT_TIMEOUT_MS;
  }

  const clamped = Math.min(Math.max(Math.trunc(timeout), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
  return clamped;
}

/**
 * Execute a bash command.
 */
export async function bashTool(args: BashArgs, context: ToolContext): Promise<ToolResponse> {
  // Check for dangerous commands
  if (isDangerousCommand(args.command)) {
    return {
      content: [
        {
          type: 'text',
          text: `Dangerous command blocked: ${args.command}. This command requires explicit user approval.`,
        },
      ],
      is_error: true,
    };
  }

  let cwd: string;
  try {
    cwd = resolveWorkspacePath(args.cwd ?? context.cwd, context.cwd);
    const stats = await stat(cwd);
    if (!stats.isDirectory()) {
      return {
        content: [{ type: 'text', text: `Error: ${cwd} is not a directory` }],
        is_error: true,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: invalid working directory: ${message}` }],
      is_error: true,
    };
  }

  const timeout = normalizeTimeout(args.timeout);

  try {
    const { stdout, stderr } = await execAsync(args.command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      shell: '/bin/bash',
    });

    let output = stdout || '';
    if (stderr && !stdout) {
      output = stderr;
    } else if (stderr) {
      output = `${stdout}\n\nStderr:\n${stderr}`;
    }

    if (!output.trim()) {
      output = '(command completed with no output)';
    }

    // Truncate very long output
    if (output.length > 100000) {
      output = `${output.slice(0, 100000)}\n\n[Output truncated - exceeded 100KB limit]`;
    }

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: number };

    let errorOutput = '';
    if (err.stderr) {
      errorOutput = err.stderr;
    } else if (err.stdout) {
      errorOutput = err.stdout;
    } else if (err.message) {
      errorOutput = err.message;
    } else {
      errorOutput = String(error);
    }

    // Include exit code if available
    if (err.code !== undefined) {
      errorOutput = `Exit code: ${err.code}\n${errorOutput}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: `Command failed: ${errorOutput}`,
        },
      ],
      is_error: true,
    };
  }
}
