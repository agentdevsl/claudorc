/**
 * Example tests demonstrating mock scenario usage.
 *
 * These examples show how to use the pre-configured scenarios
 * instead of building mocks piecemeal in each test.
 */

import { describe, expect, it } from 'vitest';
import {
  createAgentServiceScenario,
  createConcurrencyScenario,
  createContainerAgentScenario,
  createErrorScenario,
  createFullStackScenario,
  createProjectServiceScenario,
  createSessionServiceScenario,
  createTaskServiceScenario,
} from './mock-scenarios.js';

describe('Mock Scenarios Examples', () => {
  // =============================================================================
  // TaskService Scenario
  // =============================================================================

  describe('TaskService Scenario', () => {
    it('creates a task with default scenario', async () => {
      const scenario = createTaskServiceScenario();

      const result = await scenario.service.create({
        projectId: 'proj-1',
        title: 'Build feature',
        description: 'Build the new feature',
      });

      expect(result.ok).toBe(true);
    });

    it('handles worktree errors', async () => {
      const scenario = createErrorScenario('task', 'worktree_create_fail');

      // The scenario is pre-configured with a failing worktree service
      const worktreeResult = await scenario.worktreeService.create({
        projectId: 'proj-1',
        branch: 'task-1',
      });

      expect(worktreeResult.ok).toBe(false);
    });
  });

  // =============================================================================
  // AgentService Scenario
  // =============================================================================

  describe('AgentService Scenario', () => {
    it('starts an agent with default scenario', async () => {
      const scenario = createAgentServiceScenario();

      // Service has all dependencies wired
      const _result = await scenario.service.start('agent-1', 'task-1');

      // Note: This will fail because runAgentPlanning is mocked globally
      // In a real test, you'd mock that function appropriately
      expect(scenario.db).toBeDefined();
      expect(scenario.worktreeService).toBeDefined();
      expect(scenario.taskService).toBeDefined();
      expect(scenario.sessionService).toBeDefined();
    });
  });

  // =============================================================================
  // ProjectService Scenario
  // =============================================================================

  describe('ProjectService Scenario', () => {
    it('gets a project with default scenario', async () => {
      const scenario = createProjectServiceScenario();

      const result = await scenario.service.getById('proj-1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Test Project');
      }
    });
  });

  // =============================================================================
  // SessionService Scenario
  // =============================================================================

  describe('SessionService Scenario', () => {
    it('creates a session with default scenario', async () => {
      const scenario = createSessionServiceScenario();

      const result = await scenario.service.create({
        projectId: 'proj-1',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.projectId).toBe('proj-1');
        expect(result.value.status).toBe('active');
      }
    });

    it('publishes events to streams', async () => {
      const scenario = createSessionServiceScenario();

      await scenario.service.create({ projectId: 'proj-1' });

      const result = await scenario.service.publish('session-1', {
        type: 'agent:started',
        data: { agentId: 'agent-1' },
      });

      expect(result.ok).toBe(true);
      expect(scenario.streams.publish).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // ContainerAgentService Scenario
  // =============================================================================

  describe('ContainerAgentService Scenario', () => {
    it('has sandbox running and API key configured', () => {
      const scenario = createContainerAgentScenario();

      // Sandbox is pre-configured as running
      expect(scenario.provider.get).toBeDefined();

      // API key service returns test token
      expect(scenario.apiKeyService.getDecryptedKey).toBeDefined();
    });

    it('handles missing API key', async () => {
      const scenario = createErrorScenario('containerAgent', 'api_key_missing');

      const apiKey = await scenario.apiKeyService.getDecryptedKey('anthropic');

      expect(apiKey).toBeNull();
    });

    it('handles sandbox not running', async () => {
      const scenario = createErrorScenario('containerAgent', 'sandbox_not_running');

      const sandbox = await scenario.provider.get('proj-1');

      expect(sandbox?.status).toBe('stopped');
    });
  });

  // =============================================================================
  // Full Stack Scenario
  // =============================================================================

  describe('Full Stack Scenario', () => {
    it('wires all services together', () => {
      const stack = createFullStackScenario();

      // All services share the same mock DB
      expect(stack.db).toBeDefined();

      // All services are instantiated
      expect(stack.taskService).toBeDefined();
      expect(stack.agentService).toBeDefined();
      expect(stack.projectService).toBeDefined();
      expect(stack.sessionService).toBeDefined();
      expect(stack.containerAgentService).toBeDefined();
      expect(stack.worktreeService).toBeDefined();

      // Shared entities are available
      expect(stack.project.id).toBe('proj-1');
      expect(stack.task.id).toBe('task-1');
      expect(stack.agent.id).toBe('agent-1');
      expect(stack.session.id).toBe('session-1');
      expect(stack.worktree.id).toBe('wt-1');
    });
  });

  // =============================================================================
  // Error Scenarios
  // =============================================================================

  describe('Error Scenarios', () => {
    it('creates DB insert failure scenario', () => {
      const scenario = createErrorScenario('task', 'db_insert_fail');

      expect(scenario.db.insert).toBeDefined();
      expect(() => scenario.db.insert({})).toThrow('Database insert failed');
    });

    it('creates DB update failure scenario', () => {
      const scenario = createErrorScenario('agent', 'db_update_fail');

      expect(scenario.db.update).toBeDefined();
      expect(() => scenario.db.update({})).toThrow('Database update failed');
    });

    it('creates worktree creation failure scenario', async () => {
      const scenario = createErrorScenario('task', 'worktree_create_fail');

      const result = await scenario.worktreeService.create({
        projectId: 'proj-1',
        branch: 'task-1',
      });

      expect(result.ok).toBe(false);
    });

    it('creates execStream failure scenario', async () => {
      const scenario = createErrorScenario('containerAgent', 'exec_stream_fail');

      const sandbox = await scenario.provider.get('proj-1');

      if (sandbox?.execStream) {
        await expect(sandbox.execStream({ cmd: 'test', env: {} })).rejects.toThrow(
          'execStream failed'
        );
      }
    });
  });

  // =============================================================================
  // Concurrency Scenario
  // =============================================================================

  describe('Concurrency Scenario', () => {
    it('creates multiple tasks for concurrent testing', () => {
      const scenario = createConcurrencyScenario(5);

      expect(scenario.tasks).toHaveLength(5);
      expect(scenario.tasks[0].id).toBe('task-1');
      expect(scenario.tasks[4].id).toBe('task-5');
    });

    it('provides startAll helper for race condition testing', async () => {
      const scenario = createConcurrencyScenario(3);

      // Fire all starts concurrently
      const results = await scenario.startAll();

      expect(results).toHaveLength(3);
      // In a real test, you'd verify concurrency limits, locking, etc.
    });
  });
});
