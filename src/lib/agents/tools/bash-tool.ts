import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolContext, ToolResponse } from '../types.js';

const execAsync = promisify(exec);

export interface BashArgs {
  command: string;
  cwd?: string;
  timeout?: number;
}

// Dangerous commands that require explicit approval
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,
  /git\s+push\s+--force/,
  /git\s+reset\s+--hard/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /TRUNCATE\s+TABLE/i,
  /chmod\s+-R\s+777/,
  /mkfs\./,
  /dd\s+if=/,
];

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

export async function bashTool(args: BashArgs, context: ToolContext): Promise<ToolResponse> {
  // Check for dangerous commands
  if (isDangerousCommand(args.command)) {
    return {
      content: [
        {
          type: 'text',
          text: `Dangerous command blocked: ${args.command}. Requires explicit user approval.`,
        },
      ],
      is_error: true,
    };
  }

  const cwd = args.cwd ?? context.cwd;
  const timeout = args.timeout ?? 120000;

  try {
    const { stdout, stderr } = await execAsync(args.command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const output = stdout || stderr || '(no output)';

    return {
      content: [{ type: 'text', text: output }],
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const errorOutput = err.stderr || err.stdout || err.message || String(error);

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
