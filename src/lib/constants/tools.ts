/**
 * Tool groups and defaults for agent configurations.
 */

/** Tool categories with their member tools */
export const TOOL_GROUPS = {
  Files: ['Read', 'Edit', 'Write', 'Glob', 'Grep'],
  System: ['Bash'],
  Web: ['WebFetch'],
  Agent: ['Task'],
} as const;

/** All available tools flattened */
export const ALL_TOOLS = Object.values(TOOL_GROUPS).flat();

/** Tool type */
export type ToolName = (typeof ALL_TOOLS)[number];

/** Default tools for agent execution (all tools) */
export const DEFAULT_AGENT_TOOLS: string[] = [...ALL_TOOLS];

/** Default tools for task creation AI (read-only, no execution) */
export const DEFAULT_TASK_CREATION_TOOLS: string[] = ['Read', 'Glob', 'Grep'];

/** Default tools for workflow designer AI (read-only) */
export const DEFAULT_WORKFLOW_TOOLS: string[] = ['Read', 'Glob', 'Grep'];

/**
 * Get tools for agent execution from localStorage or default.
 */
export function getAgentTools(): string[] {
  if (typeof window === 'undefined') return DEFAULT_AGENT_TOOLS;
  const stored = localStorage.getItem('agent_tools');
  return stored ? JSON.parse(stored) : DEFAULT_AGENT_TOOLS;
}

/**
 * Get tools for task creation from localStorage or default.
 */
export function getTaskCreationTools(): string[] {
  if (typeof window === 'undefined') return DEFAULT_TASK_CREATION_TOOLS;
  const stored = localStorage.getItem('task_creation_tools');
  return stored ? JSON.parse(stored) : DEFAULT_TASK_CREATION_TOOLS;
}

/**
 * Get tools for workflow designer from localStorage or default.
 */
export function getWorkflowTools(): string[] {
  if (typeof window === 'undefined') return DEFAULT_WORKFLOW_TOOLS;
  const stored = localStorage.getItem('workflow_tools');
  return stored ? JSON.parse(stored) : DEFAULT_WORKFLOW_TOOLS;
}
