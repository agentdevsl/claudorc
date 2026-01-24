/**
 * Agent service module - barrel file for agent-related services.
 *
 * This module exports:
 * - AgentCrudService: CRUD operations for agents
 * - AgentExecutionService: Agent lifecycle and execution management
 * - AgentQueueService: Queue management for agent execution
 * - All shared types for agent operations
 */

export { AgentCrudService } from './agent-crud.service.js';
export { AgentExecutionService } from './agent-execution.service.js';
export { AgentQueueService } from './agent-queue.service.js';

// Re-export all types
export type {
  Agent,
  AgentConfig,
  AgentExecutionContext,
  AgentRunResult,
  AgentServiceError,
  AgentStartResult,
  NewAgent,
  PostToolUseHook,
  PreToolUseHook,
  QueuePosition,
  QueueStats,
  SessionServiceInterface,
  TaskService,
  WorktreeService,
} from './types.js';
