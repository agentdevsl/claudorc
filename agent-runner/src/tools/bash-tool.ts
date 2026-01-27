/**
 * Bash command execution tool for the agent-runner.
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolContext, ToolResponse } from './types.js';

const execAsync = promisify(exec);

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

  const cwd = args.cwd ?? context.cwd;
  const timeout = args.timeout ?? 120000; // 2 minute default

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
      output = stdout + '\n\nStderr:\n' + stderr;
    }

    if (!output.trim()) {
      output = '(command completed with no output)';
    }

    // Truncate very long output
    if (output.length > 100000) {
      output = output.slice(0, 100000) + '\n\n[Output truncated - exceeded 100KB limit]';
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
