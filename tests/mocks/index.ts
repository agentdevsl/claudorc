/**
 * Mock infrastructure barrel export
 *
 * This module consolidates all mock builders, factories, and utilities for testing.
 * Organized by category for easy discovery and consistent naming.
 */

import { vi } from 'vitest';

// ── Factories (DB-backed) ──
export {
  type Agent,
  type AgentRun,
  createTestAgent,
  createTestAgentRun,
  createTestProject,
  createTestSession,
  createTestTask,
  createTestWorktree,
  type PartialBy,
  type Project,
  type Session,
  type Task,
  type Worktree,
} from '../factories/index.js';
// ── External Mocks ──
export { mockClaudeSDK, mockDurableStreams, mockOctokit } from './external.js';
// ── Git Operations ──
export {
  type GitCommandResult,
  type MockGitCommands,
  mockGitCommands,
} from './git.js';
// ── Agent Lifecycle ──
// ── Scenarios ──
// Note: Scenario builders are exported from mock-agent-lifecycle.js
// Re-export for convenience:
export {
  type AgentLifecycleScenario,
  createMockAgent,
  createMockAgentConfig,
  createMockAgentLifecycleScenario,
  createMockProject,
  createMockProjectConfig,
  createMockRunningAgent,
  createMockSession,
  createMockStartAgentInput,
  createMockTask,
  createMockWorktreeRecord,
  type MockContainerBridge,
  type MockExecResult,
  type RunningAgent,
} from './mock-agent-lifecycle.js';
// ── API / Routes ──
export {
  createMockAuthContext,
  createMockHonoContext,
  createMockMiddleware,
  createMockRateLimiter,
  createMockRequest,
  createMockResponse as createMockApiResponse,
  createMockSSEStream,
  createRouteTestHarness,
  type MockHonoContextOptions,
  type MockMiddleware,
  type MockRateLimiter,
  type MockRateLimiterOptions,
  type MockRequestOptions,
  type MockResponse,
  type MockSSEStream,
  type RouteTestHarness,
  type RouteTestOptions,
  type RouteTestResult,
} from './mock-api.js';
// ── Database ──
export {
  createDeleteChain,
  createInsertChain,
  createMockDatabase,
  createSelectChain,
  createTableQuery,
  createUpdateChain,
  type DeepPartial,
  type MockDatabase,
  type MockDeleteChain,
  type MockDeleteWhere,
  type MockFn,
  type MockInsertChain,
  type MockInsertReturning,
  type MockSelectAll,
  type MockSelectChain,
  type MockSelectWhere,
  type MockTableQuery,
  type MockUpdateChain,
  type MockUpdateReturning,
  type MockUpdateWhere,
  vi,
} from './mock-builders.js';
// ── Container Bridge Events ──
export {
  createAgentCompleteEvent,
  createAgentErrorEvent,
  createAgentFileChangedEvent,
  createAgentPlanReadyEvent,
  createAgentStartedEvent,
  createAgentTokenEvent,
  createAgentToolResultEvent,
  createAgentToolStartEvent,
  createAgentTurnEvent,
  createErrorAgentSession,
  createFullAgentSession,
  createMockEventStream,
  createPlanningAgentSession,
  createTurnLimitAgentSession,
} from './mock-container-bridge.js';
// ── Sandbox ──
export {
  createMockExecResult,
  createMockExecStreamResult,
  createMockReadableStream,
  createMockSandbox,
  createMockSandboxConfig,
  createMockSandboxInfo,
  createMockSandboxProvider,
  createMockSandboxWithEvents,
} from './mock-sandbox.js';
// ── Services ──
export {
  type ApiKeyService,
  type CommandRunner,
  createMockApiKeyService,
  createMockCommandRunner,
  createMockDurableStreamsServer as createMockDurableStreamsServerFromServices,
  createMockDurableStreamsService as createMockDurableStreamsServiceFromServices,
  createMockSandbox as createMockSandboxFromServices,
  createMockSandboxProvider as createMockSandboxProviderFromServices,
  createMockSessionService,
  createMockTaskService,
  createMockWorktreeService,
  createMockWorktreeServiceForProject,
  createMockWorktreeServiceForTask,
  type DurableStreamsServer,
  type DurableStreamsService,
  type SessionServiceInterface,
  type TaskServiceInterface,
  type WorktreeServiceForProject,
  type WorktreeServiceForTask,
  type WorktreeServiceFull,
} from './mock-services.js';
// ── Streams ──
export {
  createAgentEvent,
  createContainerAgentEvent,
  createMockDurableStreamsServer,
  createMockDurableStreamsService,
  createMockEventCollector,
  createMockSSEResponse,
  type MockEventCollector,
  type MockSSEResponse,
} from './mock-streams.js';
// ── Service Mocks (Legacy from services.ts) ──
export {
  createMockAgentService,
  createMockProjectService,
  createMockSessionService as createMockSessionServiceLegacy,
  createMockTaskService as createMockTaskServiceLegacy,
  createMockWorktreeService as createMockWorktreeServiceLegacy,
  type MockAgentService,
  type MockProjectService,
  type MockSessionService as MockSessionServiceLegacy,
  type MockTaskService as MockTaskServiceLegacy,
  type MockWorktreeService as MockWorktreeServiceLegacy,
} from './services.js';

// ── Utility Functions ──

/**
 * Reset all vitest mocks
 */
export function resetMocks(): void {
  vi.clearAllMocks();
}

/**
 * Create all service mocks at once
 */
export function createAllServiceMocks() {
  return {
    projectService: createMockProjectService(),
    taskService: createMockTaskServiceLegacy(),
    agentService: createMockAgentService(),
    sessionService: createMockSessionServiceLegacy(),
    worktreeService: createMockWorktreeServiceLegacy(),
  };
}

/**
 * Create all external mocks at once
 */
export function createAllExternalMocks() {
  return {
    claudeSDK: mockClaudeSDK,
    durableStreams: mockDurableStreams,
    octokit: mockOctokit,
  };
}
