import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectConfig } from '../../src/db/schema/projects';
import { ProjectErrors } from '../../src/lib/errors/project-errors';
import { err, ok } from '../../src/lib/utils/result';
import { ProjectService } from '../../src/services/project.service';
import { createRunningAgent, createTestAgent } from '../factories/agent.factory';
import { createTestProject, createTestProjects } from '../factories/project.factory';
import { createTestSession } from '../factories/session.factory';
import { createTasksInColumns, createTestTask } from '../factories/task.factory';
import { clearTestDatabase, getTestDb, setupTestDatabase } from '../helpers/database';

describe('ProjectService', () => {
  let projectService: ProjectService;
  const mockWorktreeService = {
    prune: vi.fn().mockResolvedValue(ok({ pruned: 0, failed: [] })),
  };

  const mockCommandRunner = {
    exec: vi.fn(),
  };

  beforeEach(async () => {
    await setupTestDatabase();
    const db = getTestDb();
    projectService = new ProjectService(db, mockWorktreeService, mockCommandRunner);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  // =============================================================================
  // Project CRUD Operations (6 tests)
  // =============================================================================

  describe('Project CRUD Operations', () => {
    it('creates a project with all fields', async () => {
      mockCommandRunner.exec.mockImplementation((cmd: string) => {
        if (cmd.includes('git rev-parse')) return Promise.resolve({ stdout: '.git', stderr: '' });
        if (cmd.includes('git remote'))
          return Promise.resolve({ stdout: 'https://github.com/test/repo.git', stderr: '' });
        if (cmd.includes('git symbolic-ref'))
          return Promise.resolve({ stdout: 'main', stderr: '' });
        if (cmd.includes('test -d .claude')) return Promise.resolve({ stdout: 'yes', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await projectService.create({
        path: '/tmp/test-project-full',
        name: 'Full Project',
        description: 'A project with all fields',
        config: {
          worktreeRoot: '.custom-worktrees',
          defaultBranch: 'develop',
          allowedTools: ['Read', 'Write'],
          maxTurns: 100,
        },
        maxConcurrentAgents: 5,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('test-project-full');
        expect(result.value.path).toBe('/tmp/test-project-full');
        expect(result.value.maxConcurrentAgents).toBe(5);
        expect(result.value.config.worktreeRoot).toBe('.custom-worktrees');
        expect(result.value.config.defaultBranch).toBe('develop');
        expect(result.value.config.allowedTools).toEqual(['Read', 'Write']);
        expect(result.value.config.maxTurns).toBe(100);
      }
    });

    it('updates project settings', async () => {
      const project = await createTestProject({
        maxConcurrentAgents: 3,
        configPath: '.claude',
      });

      const result = await projectService.update(project.id, {
        maxConcurrentAgents: 5,
        configPath: '.agent-config',
        githubOwner: 'test-org',
        githubRepo: 'test-repo',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.maxConcurrentAgents).toBe(5);
        expect(result.value.configPath).toBe('.agent-config');
        expect(result.value.githubOwner).toBe('test-org');
        expect(result.value.githubRepo).toBe('test-repo');
        expect(result.value.updatedAt).not.toBe(project.updatedAt);
      }
    });

    it('deletes a project and prunes worktrees', async () => {
      const project = await createTestProject();

      const result = await projectService.delete(project.id);

      expect(result.ok).toBe(true);
      expect(mockWorktreeService.prune).toHaveBeenCalledWith(project.id);

      const getResult = await projectService.getById(project.id);
      expect(getResult.ok).toBe(false);
      if (!getResult.ok) {
        expect(getResult.error.code).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('prevents deleting a project with running agents', async () => {
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id, { taskId: task.id });
      await createRunningAgent(project.id, task.id, session.id);

      const result = await projectService.delete(project.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_HAS_RUNNING_AGENTS');
        expect(result.error.details?.runningAgentCount).toBe(1);
      }
    });

    it('retrieves a project by ID', async () => {
      const project = await createTestProject({ name: 'Get By ID Test' });

      const result = await projectService.getById(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(project.id);
        expect(result.value.name).toBe('Get By ID Test');
      }
    });

    it('lists projects with pagination options', async () => {
      await createTestProjects(5);

      const result = await projectService.list({
        limit: 3,
        offset: 1,
        orderBy: 'name',
        orderDirection: 'asc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeLessThanOrEqual(3);
      }
    });
  });

  // =============================================================================
  // Project Configuration (5 tests)
  // =============================================================================

  describe('Project Configuration', () => {
    it('gets project config', async () => {
      const project = await createTestProject({
        config: {
          worktreeRoot: '.test-worktrees',
          defaultBranch: 'main',
          allowedTools: ['Read', 'Write', 'Edit'],
          maxTurns: 75,
        },
      });

      const result = await projectService.getById(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.config.worktreeRoot).toBe('.test-worktrees');
        expect(result.value.config.maxTurns).toBe(75);
        expect(result.value.config.allowedTools).toContain('Read');
      }
    });

    it('updates project config', async () => {
      const project = await createTestProject();

      const newConfig: Partial<ProjectConfig> = {
        worktreeRoot: '.updated-worktrees',
        defaultBranch: 'develop',
        allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
        maxTurns: 150,
        model: 'claude-sonnet-4-20250514',
        temperature: 0.7,
      };

      const result = await projectService.updateConfig(project.id, newConfig);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.config.worktreeRoot).toBe('.updated-worktrees');
        expect(result.value.config.defaultBranch).toBe('develop');
        expect(result.value.config.maxTurns).toBe(150);
        expect(result.value.config.model).toBe('claude-sonnet-4-20250514');
        expect(result.value.config.temperature).toBe(0.7);
      }
    });

    it('validates config schema with invalid maxTurns', async () => {
      const invalidConfig = {
        worktreeRoot: '.worktrees',
        defaultBranch: 'main',
        allowedTools: ['Read'],
        maxTurns: 1000, // Max is 500
      };

      const result = projectService.validateConfig(invalidConfig);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_CONFIG_INVALID');
      }
    });

    it('applies config defaults for missing fields', async () => {
      const partialConfig = {
        worktreeRoot: '.custom-worktrees',
      };

      const result = projectService.validateConfig(partialConfig as Partial<ProjectConfig>);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.worktreeRoot).toBe('.custom-worktrees');
        expect(result.value.defaultBranch).toBe('main');
        expect(result.value.maxTurns).toBe(50);
        expect(result.value.allowedTools).toEqual(['Read', 'Edit', 'Bash', 'Glob', 'Grep']);
      }
    });

    it('rejects config containing secrets', async () => {
      const configWithSecrets = {
        worktreeRoot: '.worktrees',
        defaultBranch: 'main',
        allowedTools: ['Read'],
        maxTurns: 50,
        DB_PASSWORD: 'secret123',
      };

      const result = projectService.validateConfig(
        configWithSecrets as unknown as Partial<ProjectConfig>
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_CONFIG_INVALID');
        // Secrets are reported in the details.validationErrors array
        expect(result.error.details?.validationErrors).toBeDefined();
        const errors = result.error.details?.validationErrors as string[];
        expect(errors.some((e) => e.includes('Secrets detected'))).toBe(true);
      }
    });
  });

  // =============================================================================
  // Project Statistics (4 tests)
  // =============================================================================

  describe('Project Statistics', () => {
    it('gets project summaries with task counts', async () => {
      const project = await createTestProject();
      await createTasksInColumns(project.id, {
        backlog: 3,
        in_progress: 2,
        waiting_approval: 1,
        verified: 4,
      });

      const result = await projectService.listWithSummaries();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const summary = result.value.find((s) => s.project.id === project.id);
        expect(summary).toBeDefined();
        expect(summary?.taskCounts.backlog).toBe(3);
        expect(summary?.taskCounts.inProgress).toBe(2);
        expect(summary?.taskCounts.waitingApproval).toBe(1);
        expect(summary?.taskCounts.verified).toBe(4);
        expect(summary?.taskCounts.total).toBe(10);
      }
    });

    it('determines project status based on running agents', async () => {
      const project = await createTestProject();
      const task = await createTestTask(project.id, { column: 'in_progress' });
      const session = await createTestSession(project.id, { taskId: task.id });
      await createRunningAgent(project.id, task.id, session.id);

      const result = await projectService.listWithSummaries();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const summary = result.value.find((s) => s.project.id === project.id);
        expect(summary?.status).toBe('running');
        expect(summary?.runningAgents.length).toBe(1);
      }
    });

    it('determines project status based on waiting approvals', async () => {
      const project = await createTestProject();
      await createTestTask(project.id, { column: 'waiting_approval' });

      const result = await projectService.listWithSummaries();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const summary = result.value.find((s) => s.project.id === project.id);
        expect(summary?.status).toBe('needs-approval');
      }
    });

    it('calculates last activity from task updates', async () => {
      const project = await createTestProject();
      const oldDate = new Date('2025-01-01T00:00:00Z');
      const recentDate = new Date('2025-06-15T12:00:00Z');

      await createTestTask(project.id, { title: 'Old Task' });
      // Create a more recent task
      const recentTask = await createTestTask(project.id, { title: 'Recent Task' });

      // Update the recent task to have a more recent updatedAt
      const db = getTestDb();
      const { tasks } = await import('../../src/db/schema/tasks');
      const { eq } = await import('drizzle-orm');
      await db
        .update(tasks)
        .set({ updatedAt: recentDate.toISOString() })
        .where(eq(tasks.id, recentTask.id));

      const result = await projectService.listWithSummaries();

      expect(result.ok).toBe(true);
      if (result.ok) {
        const summary = result.value.find((s) => s.project.id === project.id);
        expect(summary?.lastActivityAt).toBeTruthy();
      }
    });
  });

  // =============================================================================
  // Error Handling (5 tests)
  // =============================================================================

  describe('Error Handling', () => {
    it('handles not found error for non-existent project', async () => {
      const result = await projectService.getById('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_NOT_FOUND');
        expect(result.error.status).toBe(404);
      }
    });

    it('handles not found error when updating non-existent project', async () => {
      const result = await projectService.update('non-existent-id', {
        maxConcurrentAgents: 5,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('handles not found error when deleting non-existent project', async () => {
      const result = await projectService.delete('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('handles validation error for invalid config', async () => {
      const invalidConfig = {
        maxTurns: -5, // Invalid: min is 1
      };

      const result = projectService.validateConfig(invalidConfig as Partial<ProjectConfig>);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_CONFIG_INVALID');
        expect(result.error.status).toBe(400);
      }
    });

    it('handles path already exists error', async () => {
      mockCommandRunner.exec.mockImplementation((cmd: string) => {
        if (cmd.includes('git rev-parse')) return Promise.resolve({ stdout: '.git', stderr: '' });
        if (cmd.includes('git remote')) return Promise.resolve({ stdout: '', stderr: '' });
        if (cmd.includes('git symbolic-ref'))
          return Promise.resolve({ stdout: 'main', stderr: '' });
        if (cmd.includes('test -d .claude')) return Promise.resolve({ stdout: 'no', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      // Create a project first
      const firstResult = await projectService.create({
        path: '/tmp/duplicate-path',
      });
      expect(firstResult.ok).toBe(true);

      // Try to create another project with the same path
      const result = await projectService.create({
        path: '/tmp/duplicate-path',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_PATH_EXISTS');
        expect(result.error.status).toBe(409);
      }
    });
  });

  // =============================================================================
  // Path Validation (3 tests)
  // =============================================================================

  describe('Path Validation', () => {
    it('validates a valid git repository path', async () => {
      mockCommandRunner.exec.mockImplementation((cmd: string) => {
        if (cmd.includes('git rev-parse')) return Promise.resolve({ stdout: '.git', stderr: '' });
        if (cmd.includes('git remote'))
          return Promise.resolve({ stdout: 'git@github.com:test/repo.git', stderr: '' });
        if (cmd.includes('git symbolic-ref'))
          return Promise.resolve({ stdout: 'develop', stderr: '' });
        if (cmd.includes('test -d .claude')) return Promise.resolve({ stdout: 'yes', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await projectService.validatePath('/tmp/valid-repo');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('valid-repo');
        expect(result.value.path).toBe('/tmp/valid-repo');
        expect(result.value.defaultBranch).toBe('develop');
        expect(result.value.remoteUrl).toBe('git@github.com:test/repo.git');
        expect(result.value.hasClaudeConfig).toBe(true);
      }
    });

    it('rejects non-git repository path', async () => {
      mockCommandRunner.exec.mockImplementation((cmd: string) => {
        if (cmd.includes('git rev-parse')) {
          return Promise.reject(new Error('fatal: not a git repository'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await projectService.validatePath('/tmp/not-a-repo');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_NOT_A_GIT_REPO');
      }
    });

    it('handles missing remote URL gracefully', async () => {
      mockCommandRunner.exec.mockImplementation((cmd: string) => {
        if (cmd.includes('git rev-parse')) return Promise.resolve({ stdout: '.git', stderr: '' });
        if (cmd.includes('git remote')) return Promise.reject(new Error('No remote configured'));
        if (cmd.includes('git symbolic-ref'))
          return Promise.resolve({ stdout: 'main', stderr: '' });
        if (cmd.includes('test -d .claude')) return Promise.resolve({ stdout: 'no', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await projectService.validatePath('/tmp/local-repo');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.remoteUrl).toBeUndefined();
        expect(result.value.defaultBranch).toBe('main');
      }
    });
  });

  // =============================================================================
  // Clone Repository (3 tests)
  // =============================================================================

  describe('Clone Repository', () => {
    it('clones a repository to a destination', async () => {
      mockCommandRunner.exec.mockImplementation((cmd: string) => {
        if (cmd.includes('mkdir -p')) return Promise.resolve({ stdout: '', stderr: '' });
        if (cmd.includes('test -d')) return Promise.reject(new Error('Directory not found'));
        if (cmd.includes('git clone')) return Promise.resolve({ stdout: '', stderr: '' });
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await projectService.cloneRepository(
        'https://github.com/test/my-repo.git',
        '/tmp/clones'
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('my-repo');
        expect(result.value.path).toBe('/tmp/clones/my-repo');
      }
    });

    it('handles path already exists when cloning', async () => {
      mockCommandRunner.exec.mockImplementation((cmd: string) => {
        if (cmd.includes('mkdir -p')) return Promise.resolve({ stdout: '', stderr: '' });
        if (cmd.includes('test -d')) return Promise.resolve({ stdout: '', stderr: '' }); // Directory exists
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await projectService.cloneRepository(
        'https://github.com/test/existing-repo.git',
        '/tmp/clones'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_PATH_EXISTS');
      }
    });

    it('handles clone failure gracefully', async () => {
      mockCommandRunner.exec.mockImplementation((cmd: string) => {
        if (cmd.includes('mkdir -p')) return Promise.resolve({ stdout: '', stderr: '' });
        if (cmd.includes('test -d')) return Promise.reject(new Error('Directory not found'));
        if (cmd.includes('git clone')) return Promise.reject(new Error('Authentication failed'));
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await projectService.cloneRepository(
        'https://github.com/test/private-repo.git',
        '/tmp/clones'
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_CONFIG_INVALID');
        // The error details contain the validation errors with clone failure message
        expect(result.error.details?.validationErrors).toBeDefined();
        const errors = result.error.details?.validationErrors as string[];
        expect(errors.some((e) => e.includes('Failed to clone repository'))).toBe(true);
      }
    });
  });

  // =============================================================================
  // Update Config for Non-Existent Project
  // =============================================================================

  describe('Update Config Edge Cases', () => {
    it('handles updateConfig for non-existent project', async () => {
      const result = await projectService.updateConfig('non-existent-id', {
        maxTurns: 100,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_NOT_FOUND');
      }
    });
  });
});
