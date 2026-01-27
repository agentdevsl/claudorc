/**
 * Search tools (glob and grep) for the agent-runner.
 */
import { exec } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { ToolContext, ToolResponse } from './types.js';

const execAsync = promisify(exec);

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
  const searchPath = args.path
    ? isAbsolute(args.path)
      ? args.path
      : resolve(context.cwd, args.path)
    : context.cwd;

  try {
    // Try fd first (fast, respects .gitignore)
    const { stdout } = await execAsync(
      `fd --glob '${args.pattern}' --type f '${searchPath}' 2>/dev/null || find '${searchPath}' -type f -name '${args.pattern}' 2>/dev/null`,
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
  const searchPath = args.path
    ? isAbsolute(args.path)
      ? args.path
      : resolve(context.cwd, args.path)
    : context.cwd;

  const outputMode = args.output_mode ?? 'files_with_matches';

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
      if (args.context_before) {
        rgFlags += ` -B ${args.context_before}`;
      }
      if (args.context_after) {
        rgFlags += ` -A ${args.context_after}`;
      }
    }

    if (args.glob) {
      rgFlags += ` --glob '${args.glob}'`;
    }

    // Escape single quotes in pattern
    const escapedPattern = args.pattern.replace(/'/g, "'\\''");

    // Try ripgrep first, fall back to grep
    const command = `rg ${rgFlags} '${escapedPattern}' '${searchPath}' 2>/dev/null || grep -r ${outputMode === 'files_with_matches' ? '-l' : '-n'} '${escapedPattern}' '${searchPath}' 2>/dev/null`;

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
