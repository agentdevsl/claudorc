import { vi } from 'vitest';

// External mocks
export { mockClaudeSDK, mockDurableStreams, mockOctokit } from './external';

// Git mocks
export {
  type GitCommandResult,
  type MockGitCommands,
  mockGitCommands,
} from './git';
// Service mocks
export {
  createMockAgentService,
  createMockProjectService,
  createMockSessionService,
  createMockTaskService,
  createMockWorktreeService,
  type MockAgentService,
  type MockProjectService,
  type MockSessionService,
  type MockTaskService,
  type MockWorktreeService,
} from './services';

// Reset all mocks utility
export function resetMocks(): void {
  vi.clearAllMocks();
}

// Helper to create all service mocks at once
export function createAllServiceMocks() {
  const { createMockProjectService } = require('./services');
  const { createMockTaskService } = require('./services');
  const { createMockAgentService } = require('./services');
  const { createMockSessionService } = require('./services');
  const { createMockWorktreeService } = require('./services');

  return {
    projectService: createMockProjectService(),
    taskService: createMockTaskService(),
    agentService: createMockAgentService(),
    sessionService: createMockSessionService(),
    worktreeService: createMockWorktreeService(),
  };
}

// Helper to create all external mocks at once
export function createAllExternalMocks() {
  const { mockClaudeSDK } = require('./external');
  const { mockDurableStreams } = require('./external');
  const { mockOctokit } = require('./external');

  return {
    claudeSDK: mockClaudeSDK,
    durableStreams: mockDurableStreams,
    octokit: mockOctokit,
  };
}
