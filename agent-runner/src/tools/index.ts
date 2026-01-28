/**
 * Tool registry for the agent-runner.
 * Exports all tool handlers and provides a unified interface for tool execution.
 */

import type { BashArgs } from './bash-tool.js';
import { bashTool } from './bash-tool.js';
import type { EditFileArgs, ReadFileArgs, WriteFileArgs } from './file-tools.js';
import { editFileTool, readFileTool, writeFileTool } from './file-tools.js';
import type { GlobArgs, GrepArgs } from './search-tools.js';
import { globTool, grepTool } from './search-tools.js';
import type { ToolContext, ToolHandler, ToolResponse } from './types.js';

export type ToolName = 'read_file' | 'edit_file' | 'write_file' | 'bash' | 'glob' | 'grep';

export type ToolArgs = ReadFileArgs | EditFileArgs | WriteFileArgs | BashArgs | GlobArgs | GrepArgs;

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  handler: ToolHandler<ToolArgs>;
}

/**
 * Tool definitions for the Claude SDK.
 * These match the tool schemas expected by the Anthropic API.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'read_file',
    description:
      'Read the contents of a file at the specified path. Returns lines with line numbers.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to read' },
        offset: { type: 'number', description: 'Line number to start from (0-indexed)' },
        limit: { type: 'number', description: 'Maximum number of lines to read' },
      },
      required: ['path'],
    },
    handler: (args, ctx) => readFileTool(args as ReadFileArgs, ctx),
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file with the specified content',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to write' },
        content: { type: 'string', description: 'The content to write' },
      },
      required: ['path', 'content'],
    },
    handler: (args, ctx) => writeFileTool(args as WriteFileArgs, ctx),
  },
  {
    name: 'edit_file',
    description:
      'Replace specific text in a file. The old_string must match exactly including whitespace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The file path to edit' },
        old_string: { type: 'string', description: 'The exact text to replace' },
        new_string: { type: 'string', description: 'The replacement text' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    handler: (args, ctx) => editFileTool(args as EditFileArgs, ctx),
  },
  {
    name: 'bash',
    description: 'Execute a bash command. Dangerous commands (rm -rf /, etc.) are blocked.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The bash command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional)' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default: 120000)' },
      },
      required: ['command'],
    },
    handler: (args, ctx) => bashTool(args as BashArgs, ctx),
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The glob pattern to match' },
        path: { type: 'string', description: 'Directory to search in (optional)' },
      },
      required: ['pattern'],
    },
    handler: (args, ctx) => globTool(args as GlobArgs, ctx),
  },
  {
    name: 'grep',
    description: 'Search for text patterns in files using regex',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The regex pattern to search for' },
        path: { type: 'string', description: 'File or directory to search (optional)' },
        glob: { type: 'string', description: 'Glob pattern to filter files (optional)' },
        output_mode: {
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
          description: 'Output mode (default: files_with_matches)',
        },
        context_before: { type: 'number', description: 'Lines to show before match' },
        context_after: { type: 'number', description: 'Lines to show after match' },
      },
      required: ['pattern'],
    },
    handler: (args, ctx) => grepTool(args as GrepArgs, ctx),
  },
];

/**
 * Tool registry for quick lookup.
 */
const TOOL_REGISTRY = new Map<ToolName, ToolDefinition>(
  TOOL_DEFINITIONS.map((tool) => [tool.name, tool])
);

/**
 * Get a tool handler by name.
 */
export function getToolHandler(toolName: string): ToolHandler<ToolArgs> | undefined {
  return TOOL_REGISTRY.get(toolName as ToolName)?.handler;
}

/**
 * Execute a tool by name with the given arguments.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResponse> {
  const handler = getToolHandler(toolName);

  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
      is_error: true,
    };
  }

  return handler(args as unknown as ToolArgs, context);
}

/**
 * Get tool schemas for the Claude SDK.
 */
export function getToolSchemas(): Array<{
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}> {
  return TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

export type { BashArgs } from './bash-tool.js';
export type { EditFileArgs, ReadFileArgs, WriteFileArgs } from './file-tools.js';
export type { GlobArgs, GrepArgs } from './search-tools.js';
export type { ToolContext, ToolResponse } from './types.js';
