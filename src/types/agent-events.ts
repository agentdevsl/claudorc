/**
 * Canonical type for file change events from agent execution.
 * Used by durable-streams.service.ts. The agent-runner package has a matching
 * interface that must be kept in sync (build boundary prevents shared import).
 */
export interface AgentFileChangedData {
  path: string;
  action: 'create' | 'modify' | 'delete';
  toolName: string;
  additions?: number;
  deletions?: number;
}
