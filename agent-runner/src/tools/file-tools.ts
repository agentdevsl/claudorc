/**
 * File operation tools for the agent-runner.
 */
import { readFile as fsReadFile, writeFile as fsWriteFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import type { ToolContext, ToolResponse } from './types.js';

export interface ReadFileArgs {
  path: string;
  offset?: number;
  limit?: number;
}

export interface WriteFileArgs {
  path: string;
  content: string;
}

export interface EditFileArgs {
  path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

/**
 * Resolve a path relative to the working directory.
 */
function resolvePath(path: string, cwd: string): string {
  if (isAbsolute(path)) {
    return path;
  }
  return resolve(cwd, path);
}

/**
 * Read file contents with optional line range.
 */
export async function readFileTool(
  args: ReadFileArgs,
  context: ToolContext
): Promise<ToolResponse> {
  try {
    const filePath = resolvePath(args.path, context.cwd);

    // Check file exists and get stats
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      return {
        content: [{ type: 'text', text: `Error: ${args.path} is a directory, not a file` }],
        is_error: true,
      };
    }

    const content = await fsReadFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const offset = args.offset ?? 0;
    const limit = args.limit ?? 2000;
    const selectedLines = lines.slice(offset, offset + limit);

    // Format with line numbers (cat -n style)
    const formatted = selectedLines
      .map((line, idx) => {
        const lineNum = offset + idx + 1;
        const truncated = line.length > 2000 ? `${line.slice(0, 2000)}...` : line;
        return `${String(lineNum).padStart(6)}\t${truncated}`;
      })
      .join('\n');

    return {
      content: [{ type: 'text', text: formatted }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error reading file: ${message}` }],
      is_error: true,
    };
  }
}

/**
 * Write content to a file.
 */
export async function writeFileTool(
  args: WriteFileArgs,
  context: ToolContext
): Promise<ToolResponse> {
  try {
    const filePath = resolvePath(args.path, context.cwd);
    await fsWriteFile(filePath, args.content, 'utf-8');

    return {
      content: [
        { type: 'text', text: `Successfully wrote ${args.content.length} bytes to ${args.path}` },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error writing file: ${message}` }],
      is_error: true,
    };
  }
}

/**
 * Edit a file by replacing specific text.
 */
export async function editFileTool(
  args: EditFileArgs,
  context: ToolContext
): Promise<ToolResponse> {
  try {
    const filePath = resolvePath(args.path, context.cwd);
    const content = await fsReadFile(filePath, 'utf-8');

    if (args.old_string === args.new_string) {
      return {
        content: [{ type: 'text', text: 'Error: old_string and new_string are identical' }],
        is_error: true,
      };
    }

    if (!content.includes(args.old_string)) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: old_string not found in file. Make sure it matches exactly including whitespace.`,
          },
        ],
        is_error: true,
      };
    }

    // Check if old_string is unique (unless replace_all is true)
    if (!args.replace_all) {
      const occurrences = content.split(args.old_string).length - 1;
      if (occurrences > 1) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: old_string appears ${occurrences} times. Use replace_all: true or provide more context to make it unique.`,
            },
          ],
          is_error: true,
        };
      }
    }

    const newContent = args.replace_all
      ? content.replaceAll(args.old_string, args.new_string)
      : content.replace(args.old_string, args.new_string);

    await fsWriteFile(filePath, newContent, 'utf-8');

    return {
      content: [{ type: 'text', text: `Successfully edited ${args.path}` }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error editing file: ${message}` }],
      is_error: true,
    };
  }
}
