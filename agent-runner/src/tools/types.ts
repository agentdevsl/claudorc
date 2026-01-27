/**
 * Tool types for the agent-runner.
 */

export interface ToolResponse {
  content: Array<{ type: 'text' | 'image'; text?: string }>;
  is_error?: boolean;
}

export interface ToolContext {
  cwd: string;
}

export type ToolHandler<T> = (args: T, context: ToolContext) => Promise<ToolResponse>;
