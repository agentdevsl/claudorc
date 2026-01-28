/**
 * Search tools (glob and grep) for the agent-runner.
 */
import { exec } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { ToolContext, ToolResponse } from './types.js';

const execAsync = promisify(exec);
const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT ?? '/workspace';

/**
 * Escape a string for safe use in single-quoted shell arguments.
 * Handles the edge case of single quotes within the string.
 */
function shellEscape(str: string): string {
  // Replace single quotes with: end quote, escaped quote, start quote
  // 'foo'bar' becomes 'foo'\''bar'
  return str.replace(/'/g, "'\\''");
}

/**
 * Validate and sanitize numeric parameters for shell commands.
 * Returns undefined if invalid, otherwise the clamped value.
 */
function validateNumericParam(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    return undefined;
  }
  return Math.min(value, max);
}

function resolvePath(path: string, cwd: string): string {
  const resolved = isAbsolute(path) ? path : resolve(cwd, path);
  const normalized = resolve(resolved);

  if (!normalized.startsWith(`${WORKSPACE_ROOT}/`) && normalized !== WORKSPACE_ROOT) {
    throw new Error(`Access denied: path '${path}' resolves outside workspace`);
  }

  return normalized;
}

async function validateRealPath(path: string, allowMissing = false): Promise<void> {
  try {
    const real = await realpath(path);
    if (!real.startsWith(`${WORKSPACE_ROOT}/`) && real !== WORKSPACE_ROOT) {
      throw new Error('Access denied: path resolves outside workspace via symlink');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Access denied')) {
      throw error;
    }

    if (
      allowMissing &&
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return;
    }

    throw error instanceof Error ? error : new Error(String(error));
  }
}

export interface GlobArgs {
  pattern: string;
  path?: string;
}

export interface GrepArgs {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: 'content' | 'files_with_matches' | 'count';
  context_before?: number;
  context_after?: number;
}

/**
 * Find files matching a glob pattern using fd (or find as fallback).
 */
export async function globTool(args: GlobArgs, context: ToolContext): Promise<ToolResponse> {
  let searchPath: string;

  try {
    searchPath = args.path
      ? resolvePath(args.path, context.cwd)
      : resolvePath(context.cwd, context.cwd);
    await validateRealPath(searchPath, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error searching for files: ${message}` }],
      is_error: true,
    };
  }

  try {
    // Escape shell arguments to prevent command injection
    const escapedPattern = shellEscape(args.pattern);
    const escapedPath = shellEscape(searchPath);

    // Try fd first (fast, respects .gitignore)
    const { stdout } = await execAsync(
      `fd --glob '${escapedPattern}' --type f '${escapedPath}' 2>/dev/null || find '${escapedPath}' -type f -name '${escapedPattern}' 2>/dev/null`,
      {
        cwd: context.cwd,
        timeout: 30000,
        maxBuffer: 5 * 1024 * 1024,
      }
    );

    const files = stdout.trim().split('\n').filter(Boolean);

    if (files.length === 0) {
      return {
        content: [{ type: 'text', text: `No files found matching pattern: ${args.pattern}` }],
      };
    }

    // Limit output
    const maxFiles = 100;
    const truncated = files.length > maxFiles;
    const displayFiles = truncated ? files.slice(0, maxFiles) : files;

    let result = displayFiles.join('\n');
    if (truncated) {
      result += `\n\n[Showing ${maxFiles} of ${files.length} matching files]`;
    }

    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error searching for files: ${message}` }],
      is_error: true,
    };
  }
}

/**
 * Search for text patterns using ripgrep (or grep as fallback).
 */
export async function grepTool(args: GrepArgs, context: ToolContext): Promise<ToolResponse> {
  let searchPath: string;
  try {
    searchPath = args.path
      ? resolvePath(args.path, context.cwd)
      : resolvePath(context.cwd, context.cwd);
    await validateRealPath(searchPath, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error searching: ${message}` }],
      is_error: true,
    };
  }

  const outputMode = args.output_mode ?? 'files_with_matches';

  if (args.output_mode && !['content', 'files_with_matches', 'count'].includes(args.output_mode)) {
    return {
      content: [
        {
          type: 'text',
          text: `Error searching: invalid output_mode '${args.output_mode}'. Expected 'content', 'files_with_matches', or 'count'.`,
        },
      ],
      is_error: true,
    };
  }

  try {
    // Build ripgrep command
    let rgFlags = '--color=never';

    if (outputMode === 'files_with_matches') {
      rgFlags += ' -l';
    } else if (outputMode === 'count') {
      rgFlags += ' -c';
    } else {
      // content mode - show matching lines with line numbers
      rgFlags += ' -n';
      // Validate context parameters as positive integers, clamp to reasonable max
      const contextBefore = validateNumericParam(args.context_before, 1, 100);
      const contextAfter = validateNumericParam(args.context_after, 1, 100);
      if (contextBefore !== undefined) {
        rgFlags += ` -B ${contextBefore}`;
      }
      if (contextAfter !== undefined) {
        rgFlags += ` -A ${contextAfter}`;
      }
    }

    // Escape all shell arguments to prevent command injection
    if (args.glob) {
      const escapedGlob = shellEscape(args.glob);
      rgFlags += ` --glob '${escapedGlob}'`;
    }

    const escapedPattern = shellEscape(args.pattern);
    const escapedPath = shellEscape(searchPath);

    // Try ripgrep first, fall back to grep
    const grepFlags =
      outputMode === 'files_with_matches' ? '-l' : outputMode === 'count' ? '-c' : '-n';
    const command = `rg ${rgFlags} '${escapedPattern}' '${escapedPath}' 2>/dev/null || grep -r ${grepFlags} '${escapedPattern}' '${escapedPath}' 2>/dev/null`;

    const { stdout } = await execAsync(command, {
      cwd: context.cwd,
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = stdout.trim();

    if (!output) {
      return {
        content: [{ type: 'text', text: `No matches found for pattern: ${args.pattern}` }],
      };
    }

    // Limit output
    const lines = output.split('\n');
    const maxLines = outputMode === 'content' ? 500 : 100;
    const truncated = lines.length > maxLines;
    const displayLines = truncated ? lines.slice(0, maxLines) : lines;

    let result = displayLines.join('\n');
    if (truncated) {
      result += `\n\n[Showing ${maxLines} of ${lines.length} results]`;
    }

    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    // grep returns exit code 1 when no matches found, which is not an error
    const err = error as { code?: number; stdout?: string };
    if (err.code === 1 && !err.stdout) {
      return {
        content: [{ type: 'text', text: `No matches found for pattern: ${args.pattern}` }],
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error searching: ${message}` }],
      is_error: true,
    };
  }
}
