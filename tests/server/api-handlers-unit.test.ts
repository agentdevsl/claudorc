/**
 * Unit Tests for API Handler Functions (src/server/api-handlers.ts)
 *
 * These tests verify the extracted handler functions with dependency injection,
 * using the test database infrastructure from tests/helpers/database.ts.
 *
 * Coverage targets 80+ tests across handler categories:
 * - Project handlers (20 tests)
 * - Task handlers (20 tests)
 * - Template handlers (15 tests)
 * - Session handlers (10 tests)
 * - API Key handlers (10 tests)
 * - Sandbox Config handlers (10 tests)
 * - Marketplace handlers (15 tests)
 * - Utility functions (5 tests)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent } from '../../src/db/schema/agents';
import type { Project } from '../../src/db/schema/projects';
import type { Session } from '../../src/db/schema/sessions';
import type { Task } from '../../src/db/schema/tasks';
import { err, ok } from '../../src/lib/utils/result';
import {
  createHandlers,
  createMarketplace,
  createProject,
  createSandboxConfig,
  createTask,
  createTemplate,
  deleteApiKey,
  deleteMarketplace,
  deleteProject,
  deleteSandboxConfig,
  deleteTask,
  deleteTemplate,
  getApiKey,
  getCategories,
  getMarketplace,
  getProject,
  getSandboxConfig,
  getSession,
  getSessionEvents,
  getSessionSummary,
  getTask,
  getTemplate,
  isValidId,
  listMarketplaces,
  listPlugins,
  listProjects,
  listProjectsWithSummaries,
  listSandboxConfigs,
  listSessions,
  listTasks,
  listTemplates,
  saveApiKey,
  seedDefaultMarketplace,
  syncMarketplace,
  syncTemplate,
  updateProject,
  updateSandboxConfig,
  updateTask,
  updateTemplate,
} from '../../src/server/api-handlers';
import { TaskService } from '../../src/services/task.service';
import { createRunningAgent, createTestAgent } from '../factories/agent.factory';
import { createTestProject, createTestProjects } from '../factories/project.factory';
import { createTestSession } from '../factories/session.factory';
import { createTasksInColumns, createTestTask, createTestTasks } from '../factories/task.factory';
import { clearTestDatabase, getTestDb, setupTestDatabase } from '../helpers/database';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(async () => {
  await setupTestDatabase();
  await clearTestDatabase();
});

afterEach(async () => {
  await clearTestDatabase();
});

// =============================================================================
// 1. Project Handler Tests (20 tests)
// =============================================================================

describe('Project Handlers', () => {
  describe('listProjects', () => {
    it('returns empty list when no projects exist', async () => {
      const db = getTestDb();
      const result = await listProjects(db);

      expect(result.ok).toBe(true);
      expect(result.data?.items).toHaveLength(0);
      expect(result.data?.totalCount).toBe(0);
    });

    it('returns projects with default limit', async () => {
      const db = getTestDb();
      await createTestProjects(3);

      const result = await listProjects(db);

      expect(result.ok).toBe(true);
      expect(result.data?.items).toHaveLength(3);
    });

    it('respects custom limit parameter', async () => {
      const db = getTestDb();
      await createTestProjects(5);

      const result = await listProjects(db, { limit: 2 });

      expect(result.ok).toBe(true);
      expect(result.data?.items).toHaveLength(2);
    });

    it('returns projects ordered by updatedAt descending', async () => {
      const db = getTestDb();
      const [p1, p2] = await createTestProjects(2);

      // Update p1 to be more recent
      const { projects } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      await db
        .update(projects)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(projects.id, p1!.id));

      const result = await listProjects(db);

      expect(result.ok).toBe(true);
      expect(result.data?.items[0]?.id).toBe(p1!.id);
    });

    it('includes project fields in response', async () => {
      const db = getTestDb();
      const project = await createTestProject({
        name: 'Test Project',
        path: '/test/path',
        description: 'A description',
      });

      const result = await listProjects(db);

      expect(result.ok).toBe(true);
      const item = result.data?.items[0] as Record<string, unknown>;
      expect(item).toHaveProperty('id', project.id);
      expect(item).toHaveProperty('name', 'Test Project');
      expect(item).toHaveProperty('path', '/test/path');
      expect(item).toHaveProperty('description', 'A description');
    });
  });

  describe('getProject', () => {
    it('returns project by id', async () => {
      const db = getTestDb();
      const project = await createTestProject({ name: 'Find Me' });

      const result = await getProject(db, project.id);

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe(project.id);
      expect(result.data?.name).toBe('Find Me');
    });

    it('returns NOT_FOUND error for non-existent project', async () => {
      const db = getTestDb();

      const result = await getProject(db, 'non-existent-id');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.status).toBe(404);
    });

    it('includes all project fields', async () => {
      const db = getTestDb();
      const project = await createTestProject({
        name: 'Complete Project',
        description: 'Full description',
      });

      const result = await getProject(db, project.id);

      expect(result.ok).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data).toHaveProperty('name');
      expect(result.data).toHaveProperty('path');
      expect(result.data).toHaveProperty('description');
      expect(result.data).toHaveProperty('createdAt');
      expect(result.data).toHaveProperty('updatedAt');
    });
  });

  describe('createProject', () => {
    it('creates a project with valid data', async () => {
      const db = getTestDb();

      const result = await createProject(db, {
        name: 'New Project',
        path: '/tmp/new-project',
        description: 'A new project',
      });

      expect(result.ok).toBe(true);
      expect(result.data?.name).toBe('New Project');
      expect(result.data?.path).toBe('/tmp/new-project');
      expect(result.data?.description).toBe('A new project');
    });

    it('returns error when name is missing', async () => {
      const db = getTestDb();

      const result = await createProject(db, {
        name: '',
        path: '/tmp/project',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('returns error when path is missing', async () => {
      const db = getTestDb();

      const result = await createProject(db, {
        name: 'Project',
        path: '',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('returns DUPLICATE error for existing path', async () => {
      const db = getTestDb();
      await createTestProject({ path: '/duplicate/path' });

      const result = await createProject(db, {
        name: 'Another Project',
        path: '/duplicate/path',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DUPLICATE');
    });

    it('creates project without description', async () => {
      const db = getTestDb();

      const result = await createProject(db, {
        name: 'No Description',
        path: '/tmp/no-desc',
      });

      expect(result.ok).toBe(true);
      expect(result.data?.description).toBeNull();
    });
  });

  describe('updateProject', () => {
    it('updates project name', async () => {
      const db = getTestDb();
      const project = await createTestProject({ name: 'Original' });

      const result = await updateProject(db, project.id, { name: 'Updated' });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.name).toBe('Updated');
    });

    it('updates project description', async () => {
      const db = getTestDb();
      const project = await createTestProject({ description: 'Old' });

      const result = await updateProject(db, project.id, { description: 'New' });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.description).toBe('New');
    });

    it('updates maxConcurrentAgents', async () => {
      const db = getTestDb();
      const project = await createTestProject({ maxConcurrentAgents: 3 });

      const result = await updateProject(db, project.id, { maxConcurrentAgents: 10 });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.maxConcurrentAgents).toBe(10);
    });

    it('returns NOT_FOUND for non-existent project', async () => {
      const db = getTestDb();

      const result = await updateProject(db, 'non-existent', { name: 'Updated' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('updates updatedAt timestamp', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      const originalUpdatedAt = project.updatedAt;

      // Wait a moment to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await updateProject(db, project.id, { name: 'Changed' });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('deleteProject', () => {
    it('deletes project without running agents', async () => {
      const db = getTestDb();
      const project = await createTestProject();

      const result = await deleteProject(db, project.id);

      expect(result.ok).toBe(true);
      expect(result.data?.deleted).toBe(true);

      // Verify deletion
      const check = await getProject(db, project.id);
      expect(check.ok).toBe(false);
    });

    it('returns NOT_FOUND for non-existent project', async () => {
      const db = getTestDb();

      const result = await deleteProject(db, 'non-existent');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('prevents deletion with running agents', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id);
      await createRunningAgent(project.id, task.id, session.id);

      const result = await deleteProject(db, project.id);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('PROJECT_HAS_RUNNING_AGENTS');
      expect(result.error?.status).toBe(409);
    });

    it('deletes associated tasks', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      await createTestTasks(project.id, 3);

      const result = await deleteProject(db, project.id);

      expect(result.ok).toBe(true);

      // Verify tasks deleted
      const { tasks } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      const remainingTasks = await db.query.tasks.findMany({
        where: eq(tasks.projectId, project.id),
      });
      expect(remainingTasks).toHaveLength(0);
    });
  });

  describe('listProjectsWithSummaries', () => {
    it('returns project summaries with task counts', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      await createTasksInColumns(project.id, {
        backlog: 3,
        in_progress: 2,
        waiting_approval: 1,
      });

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      const taskCounts = summary?.taskCounts as Record<string, number>;
      expect(taskCounts?.backlog).toBe(3);
      expect(taskCounts?.inProgress).toBe(2);
      expect(taskCounts?.waitingApproval).toBe(1);
      expect(taskCounts?.total).toBe(6);
    });

    it('includes running agents in summary', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id);
      await createRunningAgent(project.id, task.id, session.id);

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      const runningAgents = summary?.runningAgents as unknown[];
      expect(runningAgents?.length).toBe(1);
    });

    it('calculates status as running when agents active', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id);
      await createRunningAgent(project.id, task.id, session.id);

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      expect(summary?.status).toBe('running');
    });

    it('calculates status as needs-approval when tasks waiting', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      await createTestTask(project.id, { column: 'waiting_approval' });

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      expect(summary?.status).toBe('needs-approval');
    });

    it('calculates status as idle when no activity', async () => {
      const db = getTestDb();
      await createTestProject();

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      expect(summary?.status).toBe('idle');
    });
  });
});

// =============================================================================
// 2. Task Handler Tests (20 tests)
// =============================================================================

describe('Task Handlers', () => {
  let mockWorktreeService: {
    getDiff: ReturnType<typeof vi.fn>;
    merge: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let taskService: TaskService;
  let testProject: Project;

  beforeEach(async () => {
    mockWorktreeService = {
      getDiff: vi
        .fn()
        .mockResolvedValue(ok({ files: [], stats: { added: 0, removed: 0, modified: 0 } })),
      merge: vi.fn().mockResolvedValue(ok(undefined)),
      remove: vi.fn().mockResolvedValue(ok(undefined)),
    };
    const db = getTestDb();
    taskService = new TaskService(db, mockWorktreeService);
    testProject = await createTestProject();
  });

  describe('listTasks', () => {
    it('returns tasks for a project', async () => {
      await createTestTasks(testProject.id, 3);

      const result = await listTasks(taskService, { projectId: testProject.id });

      expect(result.ok).toBe(true);
      expect(result.data?.items.length).toBe(3);
    });

    it('returns error when projectId missing', async () => {
      const result = await listTasks(taskService, { projectId: '' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('filters by column', async () => {
      await createTasksInColumns(testProject.id, {
        backlog: 2,
        in_progress: 3,
      });

      const result = await listTasks(taskService, {
        projectId: testProject.id,
        column: 'in_progress',
      });

      expect(result.ok).toBe(true);
      expect(result.data?.items.length).toBe(3);
    });

    it('respects limit parameter', async () => {
      await createTestTasks(testProject.id, 10);

      const result = await listTasks(taskService, {
        projectId: testProject.id,
        limit: 5,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.items.length).toBe(5);
    });

    it('respects offset parameter', async () => {
      const tasks = await createTestTasks(testProject.id, 10);

      const result = await listTasks(taskService, {
        projectId: testProject.id,
        limit: 5,
        offset: 5,
      });

      expect(result.ok).toBe(true);
      expect(result.data?.items.length).toBe(5);
    });
  });

  describe('getTask', () => {
    it('returns task by id', async () => {
      const task = await createTestTask(testProject.id, { title: 'Find Me' });

      const result = await getTask(taskService, task.id);

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.id).toBe(task.id);
      expect(data?.title).toBe('Find Me');
    });

    it('returns error for non-existent task', async () => {
      const result = await getTask(taskService, 'non-existent');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('TASK_NOT_FOUND');
    });
  });

  describe('createTask', () => {
    it('creates task with valid data', async () => {
      const result = await createTask(taskService, {
        projectId: testProject.id,
        title: 'New Task',
        description: 'Task description',
      });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.title).toBe('New Task');
      expect(data?.description).toBe('Task description');
    });

    it('returns error when projectId missing', async () => {
      const result = await createTask(taskService, {
        projectId: '',
        title: 'Task',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('returns error when title missing', async () => {
      const result = await createTask(taskService, {
        projectId: testProject.id,
        title: '',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('creates task with labels', async () => {
      const result = await createTask(taskService, {
        projectId: testProject.id,
        title: 'Labeled Task',
        labels: ['bug', 'urgent'],
      });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.labels as string[]).toContain('bug');
      expect(data?.labels as string[]).toContain('urgent');
    });

    it('creates task with priority', async () => {
      const result = await createTask(taskService, {
        projectId: testProject.id,
        title: 'Priority Task',
        priority: 'high',
      });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.priority).toBe('high');
    });

    it('defaults to backlog column', async () => {
      const result = await createTask(taskService, {
        projectId: testProject.id,
        title: 'New Task',
      });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.column).toBe('backlog');
    });
  });

  describe('updateTask', () => {
    it('updates task title', async () => {
      const task = await createTestTask(testProject.id, { title: 'Original' });

      const result = await updateTask(taskService, task.id, { title: 'Updated' });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.title).toBe('Updated');
    });

    it('updates task description', async () => {
      const task = await createTestTask(testProject.id, { description: 'Old' });

      const result = await updateTask(taskService, task.id, { description: 'New' });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.description).toBe('New');
    });

    it('updates task labels', async () => {
      const task = await createTestTask(testProject.id, { labels: ['old'] });

      const result = await updateTask(taskService, task.id, { labels: ['new', 'labels'] });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.labels as string[]).toContain('new');
      expect(data?.labels as string[]).toContain('labels');
    });

    it('updates task priority', async () => {
      const task = await createTestTask(testProject.id);

      const result = await updateTask(taskService, task.id, { priority: 'low' });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.priority).toBe('low');
    });

    it('returns error for non-existent task', async () => {
      const result = await updateTask(taskService, 'non-existent', { title: 'Updated' });

      expect(result.ok).toBe(false);
    });
  });

  describe('deleteTask', () => {
    it('deletes a task', async () => {
      const task = await createTestTask(testProject.id);

      const result = await deleteTask(taskService, task.id);

      expect(result.ok).toBe(true);

      // Verify deletion
      const check = await getTask(taskService, task.id);
      expect(check.ok).toBe(false);
    });

    it('returns error for non-existent task', async () => {
      const result = await deleteTask(taskService, 'non-existent');

      expect(result.ok).toBe(false);
    });
  });
});

// =============================================================================
// 3. Template Handler Tests (15 tests)
// =============================================================================

describe('Template Handlers', () => {
  // Mock TemplateService for testing
  const createMockTemplateService = () => ({
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    sync: vi.fn(),
  });

  describe('listTemplates', () => {
    it('returns templates list', async () => {
      const mockService = createMockTemplateService();
      mockService.list.mockResolvedValue(
        ok([
          { id: 't1', name: 'Template 1', scope: 'org' },
          { id: 't2', name: 'Template 2', scope: 'project' },
        ])
      );

      const result = await listTemplates(mockService as any);

      expect(result.ok).toBe(true);
      expect(result.data?.items.length).toBe(2);
    });

    it('filters by scope', async () => {
      const mockService = createMockTemplateService();
      mockService.list.mockResolvedValue(ok([{ id: 't1', name: 'Org Template', scope: 'org' }]));

      const result = await listTemplates(mockService as any, { scope: 'org' });

      expect(mockService.list).toHaveBeenCalledWith({
        scope: 'org',
        projectId: undefined,
        limit: 50,
      });
    });

    it('filters by projectId', async () => {
      const mockService = createMockTemplateService();
      mockService.list.mockResolvedValue(ok([]));

      const result = await listTemplates(mockService as any, { projectId: 'proj-1' });

      expect(mockService.list).toHaveBeenCalledWith({
        scope: undefined,
        projectId: 'proj-1',
        limit: 50,
      });
    });

    it('respects limit parameter', async () => {
      const mockService = createMockTemplateService();
      mockService.list.mockResolvedValue(ok([]));

      const result = await listTemplates(mockService as any, { limit: 10 });

      expect(mockService.list).toHaveBeenCalledWith({
        scope: undefined,
        projectId: undefined,
        limit: 10,
      });
    });

    it('returns error on service failure', async () => {
      const mockService = createMockTemplateService();
      mockService.list.mockResolvedValue(err({ code: 'DB_ERROR', message: 'Failed', status: 500 }));

      const result = await listTemplates(mockService as any);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });
  });

  describe('getTemplate', () => {
    it('returns template by id', async () => {
      const mockService = createMockTemplateService();
      mockService.getById.mockResolvedValue(ok({ id: 't1', name: 'My Template' }));

      const result = await getTemplate(mockService as any, 't1');

      expect(result.ok).toBe(true);
      expect((result.data as Record<string, unknown>)?.name).toBe('My Template');
    });

    it('returns error for non-existent template', async () => {
      const mockService = createMockTemplateService();
      mockService.getById.mockResolvedValue(
        err({ code: 'NOT_FOUND', message: 'Template not found', status: 404 })
      );

      const result = await getTemplate(mockService as any, 'non-existent');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('createTemplate', () => {
    it('creates template with valid data', async () => {
      const mockService = createMockTemplateService();
      mockService.create.mockResolvedValue(ok({ id: 't1', name: 'New Template' }));

      const result = await createTemplate(mockService as any, {
        name: 'New Template',
        githubUrl: 'https://github.com/org/repo',
      });

      expect(result.ok).toBe(true);
    });

    it('returns error on creation failure', async () => {
      const mockService = createMockTemplateService();
      mockService.create.mockResolvedValue(
        err({ code: 'INVALID_URL', message: 'Invalid GitHub URL', status: 400 })
      );

      const result = await createTemplate(mockService as any, {
        name: 'Template',
        githubUrl: 'invalid-url',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('INVALID_URL');
    });
  });

  describe('updateTemplate', () => {
    it('updates template fields', async () => {
      const mockService = createMockTemplateService();
      mockService.update.mockResolvedValue(ok({ id: 't1', name: 'Updated Name' }));

      const result = await updateTemplate(mockService as any, 't1', { name: 'Updated Name' });

      expect(result.ok).toBe(true);
    });

    it('returns error for non-existent template', async () => {
      const mockService = createMockTemplateService();
      mockService.update.mockResolvedValue(
        err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })
      );

      const result = await updateTemplate(mockService as any, 'non-existent', { name: 'Name' });

      expect(result.ok).toBe(false);
    });
  });

  describe('deleteTemplate', () => {
    it('deletes template', async () => {
      const mockService = createMockTemplateService();
      mockService.delete.mockResolvedValue(ok(undefined));

      const result = await deleteTemplate(mockService as any, 't1');

      expect(result.ok).toBe(true);
    });

    it('returns error for non-existent template', async () => {
      const mockService = createMockTemplateService();
      mockService.delete.mockResolvedValue(
        err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })
      );

      const result = await deleteTemplate(mockService as any, 'non-existent');

      expect(result.ok).toBe(false);
    });
  });

  describe('syncTemplate', () => {
    it('syncs template from GitHub', async () => {
      const mockService = createMockTemplateService();
      mockService.sync.mockResolvedValue(
        ok({
          templateId: 't1',
          skillCount: 5,
          commandCount: 3,
          agentCount: 2,
          sha: 'abc123',
          syncedAt: new Date().toISOString(),
        })
      );

      const result = await syncTemplate(mockService as any, 't1');

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.skillCount).toBe(5);
    });

    it('returns error on sync failure', async () => {
      const mockService = createMockTemplateService();
      mockService.sync.mockResolvedValue(
        err({ code: 'SYNC_FAILED', message: 'Failed', status: 500 })
      );

      const result = await syncTemplate(mockService as any, 't1');

      expect(result.ok).toBe(false);
    });
  });
});

// =============================================================================
// 4. Session Handler Tests (10 tests)
// =============================================================================

describe('Session Handlers', () => {
  const createMockSessionService = () => ({
    list: vi.fn(),
    getById: vi.fn(),
    getEventsBySession: vi.fn(),
    getSessionSummary: vi.fn(),
  });

  describe('listSessions', () => {
    it('returns sessions list', async () => {
      const mockService = createMockSessionService();
      mockService.list.mockResolvedValue(
        ok([
          { id: 's1', title: 'Session 1' },
          { id: 's2', title: 'Session 2' },
        ])
      );

      const result = await listSessions(mockService as any);

      expect(result.ok).toBe(true);
      expect((result.data as unknown[])?.length).toBe(2);
    });

    it('respects pagination parameters', async () => {
      const mockService = createMockSessionService();
      mockService.list.mockResolvedValue(ok([]));

      await listSessions(mockService as any, { limit: 10, offset: 5 });

      expect(mockService.list).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });

    it('returns error on service failure', async () => {
      const mockService = createMockSessionService();
      mockService.list.mockResolvedValue(err({ code: 'DB_ERROR', message: 'Failed', status: 500 }));

      const result = await listSessions(mockService as any);

      expect(result.ok).toBe(false);
    });
  });

  describe('getSession', () => {
    it('returns session by id', async () => {
      const mockService = createMockSessionService();
      mockService.getById.mockResolvedValue(ok({ id: 's1', title: 'My Session' }));

      const result = await getSession(mockService as any, 's1');

      expect(result.ok).toBe(true);
      expect((result.data as Record<string, unknown>)?.title).toBe('My Session');
    });

    it('returns error for non-existent session', async () => {
      const mockService = createMockSessionService();
      mockService.getById.mockResolvedValue(
        err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })
      );

      const result = await getSession(mockService as any, 'non-existent');

      expect(result.ok).toBe(false);
    });
  });

  describe('getSessionEvents', () => {
    it('returns session events', async () => {
      const mockService = createMockSessionService();
      mockService.getEventsBySession.mockResolvedValue(
        ok([
          { id: 'e1', type: 'chunk' },
          { id: 'e2', type: 'tool:start' },
        ])
      );

      const result = await getSessionEvents(mockService as any, 's1');

      expect(result.ok).toBe(true);
      expect((result.data as unknown[])?.length).toBe(2);
    });

    it('respects pagination', async () => {
      const mockService = createMockSessionService();
      mockService.getEventsBySession.mockResolvedValue(ok([]));

      await getSessionEvents(mockService as any, 's1', { limit: 50, offset: 10 });

      expect(mockService.getEventsBySession).toHaveBeenCalledWith('s1', { limit: 50, offset: 10 });
    });
  });

  describe('getSessionSummary', () => {
    it('returns session summary', async () => {
      const mockService = createMockSessionService();
      mockService.getSessionSummary.mockResolvedValue(
        ok({
          sessionId: 's1',
          turnsCount: 10,
          tokensUsed: 5000,
        })
      );

      const result = await getSessionSummary(mockService as any, 's1');

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.turnsCount).toBe(10);
    });

    it('returns default summary when none exists', async () => {
      const mockService = createMockSessionService();
      mockService.getSessionSummary.mockResolvedValue(ok(null));

      const result = await getSessionSummary(mockService as any, 's1');

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.turnsCount).toBe(0);
      expect(data?.tokensUsed).toBe(0);
    });
  });
});

// =============================================================================
// 5. API Key Handler Tests (10 tests)
// =============================================================================

describe('API Key Handlers', () => {
  const createMockApiKeyService = () => ({
    getKeyInfo: vi.fn(),
    saveKey: vi.fn(),
    deleteKey: vi.fn(),
  });

  describe('getApiKey', () => {
    it('returns key info for service', async () => {
      const mockService = createMockApiKeyService();
      mockService.getKeyInfo.mockResolvedValue(
        ok({
          service: 'anthropic',
          maskedKey: 'sk-ant-...xxxx',
          isValid: true,
        })
      );

      const result = await getApiKey(mockService as any, 'anthropic');

      expect(result.ok).toBe(true);
      const keyInfo = (result.data as Record<string, unknown>)?.keyInfo as Record<string, unknown>;
      expect(keyInfo?.service).toBe('anthropic');
      expect(keyInfo?.isValid).toBe(true);
    });

    it('returns null when no key exists', async () => {
      const mockService = createMockApiKeyService();
      mockService.getKeyInfo.mockResolvedValue(ok(null));

      const result = await getApiKey(mockService as any, 'anthropic');

      expect(result.ok).toBe(true);
      expect((result.data as Record<string, unknown>)?.keyInfo).toBeNull();
    });

    it('returns error on service failure', async () => {
      const mockService = createMockApiKeyService();
      mockService.getKeyInfo.mockResolvedValue(
        err({ code: 'STORAGE_ERROR', message: 'Failed', status: 500 })
      );

      const result = await getApiKey(mockService as any, 'anthropic');

      expect(result.ok).toBe(false);
    });
  });

  describe('saveApiKey', () => {
    it('saves API key', async () => {
      const mockService = createMockApiKeyService();
      mockService.saveKey.mockResolvedValue(
        ok({
          service: 'anthropic',
          maskedKey: 'sk-ant-...xxxx',
          isValid: true,
        })
      );

      const result = await saveApiKey(mockService as any, 'anthropic', 'sk-ant-api03-xxxxxxxx');

      expect(result.ok).toBe(true);
    });

    it('returns error when key is empty', async () => {
      const mockService = createMockApiKeyService();

      const result = await saveApiKey(mockService as any, 'anthropic', '');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });

    it('returns error on invalid format', async () => {
      const mockService = createMockApiKeyService();
      mockService.saveKey.mockResolvedValue(
        err({ code: 'INVALID_FORMAT', message: 'Invalid key format', status: 400 })
      );

      const result = await saveApiKey(mockService as any, 'anthropic', 'invalid-key');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('INVALID_FORMAT');
    });
  });

  describe('deleteApiKey', () => {
    it('deletes API key', async () => {
      const mockService = createMockApiKeyService();
      mockService.deleteKey.mockResolvedValue(ok(undefined));

      const result = await deleteApiKey(mockService as any, 'anthropic');

      expect(result.ok).toBe(true);
    });

    it('returns error on deletion failure', async () => {
      const mockService = createMockApiKeyService();
      mockService.deleteKey.mockResolvedValue(
        err({ code: 'NOT_FOUND', message: 'Key not found', status: 404 })
      );

      const result = await deleteApiKey(mockService as any, 'anthropic');

      expect(result.ok).toBe(false);
    });
  });
});

// =============================================================================
// 6. Sandbox Config Handler Tests (10 tests)
// =============================================================================

describe('Sandbox Config Handlers', () => {
  const createMockSandboxService = () => ({
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  });

  describe('listSandboxConfigs', () => {
    it('returns sandbox configs', async () => {
      const mockService = createMockSandboxService();
      mockService.list.mockResolvedValue(
        ok([
          { id: 'sc1', name: 'Default' },
          { id: 'sc2', name: 'Custom' },
        ])
      );

      const result = await listSandboxConfigs(mockService as any);

      expect(result.ok).toBe(true);
      expect(result.data?.items.length).toBe(2);
    });

    it('respects pagination', async () => {
      const mockService = createMockSandboxService();
      mockService.list.mockResolvedValue(ok([]));

      await listSandboxConfigs(mockService as any, { limit: 10, offset: 5 });

      expect(mockService.list).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });
  });

  describe('getSandboxConfig', () => {
    it('returns config by id', async () => {
      const mockService = createMockSandboxService();
      mockService.getById.mockResolvedValue(ok({ id: 'sc1', name: 'Default' }));

      const result = await getSandboxConfig(mockService as any, 'sc1');

      expect(result.ok).toBe(true);
      expect((result.data as Record<string, unknown>)?.name).toBe('Default');
    });

    it('returns error for non-existent config', async () => {
      const mockService = createMockSandboxService();
      mockService.getById.mockResolvedValue(
        err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })
      );

      const result = await getSandboxConfig(mockService as any, 'non-existent');

      expect(result.ok).toBe(false);
    });
  });

  describe('createSandboxConfig', () => {
    it('creates config with valid data', async () => {
      const mockService = createMockSandboxService();
      mockService.create.mockResolvedValue(ok({ id: 'sc1', name: 'New Config' }));

      const result = await createSandboxConfig(mockService as any, {
        name: 'New Config',
        memoryMb: 2048,
      });

      expect(result.ok).toBe(true);
    });

    it('returns error when name is missing', async () => {
      const mockService = createMockSandboxService();

      const result = await createSandboxConfig(mockService as any, { name: '' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_PARAMS');
    });
  });

  describe('updateSandboxConfig', () => {
    it('updates config fields', async () => {
      const mockService = createMockSandboxService();
      mockService.update.mockResolvedValue(ok({ id: 'sc1', name: 'Updated' }));

      const result = await updateSandboxConfig(mockService as any, 'sc1', { name: 'Updated' });

      expect(result.ok).toBe(true);
    });
  });

  describe('deleteSandboxConfig', () => {
    it('deletes config', async () => {
      const mockService = createMockSandboxService();
      mockService.delete.mockResolvedValue(ok(undefined));

      const result = await deleteSandboxConfig(mockService as any, 'sc1');

      expect(result.ok).toBe(true);
    });
  });
});

// =============================================================================
// 7. Marketplace Handler Tests (15 tests)
// =============================================================================

describe('Marketplace Handlers', () => {
  const createMockMarketplaceService = () => ({
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    sync: vi.fn(),
    listAllPlugins: vi.fn(),
    getCategories: vi.fn(),
    seedDefaultMarketplace: vi.fn(),
  });

  describe('listMarketplaces', () => {
    it('returns marketplaces', async () => {
      const mockService = createMockMarketplaceService();
      mockService.list.mockResolvedValue(ok([{ id: 'm1', name: 'Default', cachedPlugins: [] }]));

      const result = await listMarketplaces(mockService as any);

      expect(result.ok).toBe(true);
      expect(result.data?.items.length).toBe(1);
    });

    it('filters disabled marketplaces by default', async () => {
      const mockService = createMockMarketplaceService();
      mockService.list.mockResolvedValue(ok([]));

      await listMarketplaces(mockService as any);

      expect(mockService.list).toHaveBeenCalledWith({ limit: 20, includeDisabled: false });
    });

    it('can include disabled marketplaces', async () => {
      const mockService = createMockMarketplaceService();
      mockService.list.mockResolvedValue(ok([]));

      await listMarketplaces(mockService as any, { includeDisabled: true });

      expect(mockService.list).toHaveBeenCalledWith({ limit: 20, includeDisabled: true });
    });
  });

  describe('getMarketplace', () => {
    it('returns marketplace by id', async () => {
      const mockService = createMockMarketplaceService();
      mockService.getById.mockResolvedValue(
        ok({
          id: 'm1',
          name: 'Official',
          cachedPlugins: [{ id: 'p1', name: 'Plugin' }],
        })
      );

      const result = await getMarketplace(mockService as any, 'm1');

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.name).toBe('Official');
      expect((data?.plugins as unknown[])?.length).toBe(1);
    });

    it('returns error for non-existent marketplace', async () => {
      const mockService = createMockMarketplaceService();
      mockService.getById.mockResolvedValue(
        err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })
      );

      const result = await getMarketplace(mockService as any, 'non-existent');

      expect(result.ok).toBe(false);
    });
  });

  describe('createMarketplace', () => {
    it('creates marketplace with githubUrl', async () => {
      const mockService = createMockMarketplaceService();
      mockService.create.mockResolvedValue(ok({ id: 'm1', name: 'New Marketplace' }));

      const result = await createMarketplace(mockService as any, {
        name: 'New Marketplace',
        githubUrl: 'https://github.com/org/plugins',
      });

      expect(result.ok).toBe(true);
    });

    it('creates marketplace with owner/repo', async () => {
      const mockService = createMockMarketplaceService();
      mockService.create.mockResolvedValue(ok({ id: 'm1', name: 'New Marketplace' }));

      const result = await createMarketplace(mockService as any, {
        name: 'New Marketplace',
        githubOwner: 'org',
        githubRepo: 'plugins',
      });

      expect(result.ok).toBe(true);
    });

    it('returns error when name is missing', async () => {
      const mockService = createMockMarketplaceService();

      const result = await createMarketplace(mockService as any, {
        name: '',
        githubUrl: 'https://github.com/org/repo',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_NAME');
    });

    it('returns error when github info missing', async () => {
      const mockService = createMockMarketplaceService();

      const result = await createMarketplace(mockService as any, {
        name: 'Marketplace',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('MISSING_REPO');
    });
  });

  describe('deleteMarketplace', () => {
    it('deletes marketplace', async () => {
      const mockService = createMockMarketplaceService();
      mockService.delete.mockResolvedValue(ok(undefined));

      const result = await deleteMarketplace(mockService as any, 'm1');

      expect(result.ok).toBe(true);
      expect(result.data?.deleted).toBe(true);
    });
  });

  describe('syncMarketplace', () => {
    it('syncs marketplace plugins', async () => {
      const mockService = createMockMarketplaceService();
      mockService.sync.mockResolvedValue(ok({ pluginCount: 10, sha: 'abc123' }));

      const result = await syncMarketplace(mockService as any, 'm1');

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.pluginCount).toBe(10);
    });
  });

  describe('listPlugins', () => {
    it('returns all plugins', async () => {
      const mockService = createMockMarketplaceService();
      mockService.listAllPlugins.mockResolvedValue(
        ok([
          { id: 'p1', name: 'Plugin 1' },
          { id: 'p2', name: 'Plugin 2' },
        ])
      );

      const result = await listPlugins(mockService as any);

      expect(result.ok).toBe(true);
      expect(result.data?.items.length).toBe(2);
    });

    it('filters by search term', async () => {
      const mockService = createMockMarketplaceService();
      mockService.listAllPlugins.mockResolvedValue(ok([]));

      await listPlugins(mockService as any, { search: 'typescript' });

      expect(mockService.listAllPlugins).toHaveBeenCalledWith({
        search: 'typescript',
        category: undefined,
        marketplaceId: undefined,
      });
    });

    it('filters by category', async () => {
      const mockService = createMockMarketplaceService();
      mockService.listAllPlugins.mockResolvedValue(ok([]));

      await listPlugins(mockService as any, { category: 'development' });

      expect(mockService.listAllPlugins).toHaveBeenCalledWith({
        search: undefined,
        category: 'development',
        marketplaceId: undefined,
      });
    });
  });

  describe('getCategories', () => {
    it('returns category list', async () => {
      const mockService = createMockMarketplaceService();
      mockService.getCategories.mockResolvedValue(ok(['development', 'testing', 'documentation']));

      const result = await getCategories(mockService as any);

      expect(result.ok).toBe(true);
      expect(result.data?.categories).toContain('development');
    });
  });

  describe('seedDefaultMarketplace', () => {
    it('seeds default marketplace', async () => {
      const mockService = createMockMarketplaceService();
      mockService.seedDefaultMarketplace.mockResolvedValue(ok({ id: 'm1' }));

      const result = await seedDefaultMarketplace(mockService as any);

      expect(result.ok).toBe(true);
      expect(result.data?.seeded).toBe(true);
    });

    it('returns seeded false when already exists', async () => {
      const mockService = createMockMarketplaceService();
      mockService.seedDefaultMarketplace.mockResolvedValue(ok(null));

      const result = await seedDefaultMarketplace(mockService as any);

      expect(result.ok).toBe(true);
      expect(result.data?.seeded).toBe(false);
    });
  });
});

// =============================================================================
// 8. Utility Function Tests (5 tests)
// =============================================================================

describe('Utility Functions', () => {
  describe('isValidId', () => {
    it('accepts valid cuid2 IDs', () => {
      expect(isValidId('cku1abc123def456')).toBe(true);
    });

    it('accepts kebab-case IDs', () => {
      expect(isValidId('my-valid-id')).toBe(true);
    });

    it('accepts underscore IDs', () => {
      expect(isValidId('my_valid_id')).toBe(true);
    });

    it('rejects empty IDs', () => {
      expect(isValidId('')).toBe(false);
    });

    it('rejects IDs with special characters', () => {
      expect(isValidId('invalid/id')).toBe(false);
      expect(isValidId('invalid.id')).toBe(false);
      expect(isValidId('invalid@id')).toBe(false);
    });

    it('rejects IDs exceeding 100 characters', () => {
      expect(isValidId('a'.repeat(101))).toBe(false);
    });

    it('accepts IDs up to 100 characters', () => {
      expect(isValidId('a'.repeat(100))).toBe(true);
    });
  });

  describe('createHandlers factory', () => {
    it('creates handlers object with all methods', () => {
      const mockDeps = {
        db: {} as any,
        taskService: {} as any,
        templateService: {} as any,
        sessionService: {} as any,
        apiKeyService: {} as any,
        sandboxConfigService: {} as any,
        marketplaceService: {} as any,
      };

      const handlers = createHandlers(mockDeps);

      // Project handlers
      expect(handlers).toHaveProperty('listProjects');
      expect(handlers).toHaveProperty('getProject');
      expect(handlers).toHaveProperty('createProject');
      expect(handlers).toHaveProperty('updateProject');
      expect(handlers).toHaveProperty('deleteProject');

      // Task handlers
      expect(handlers).toHaveProperty('listTasks');
      expect(handlers).toHaveProperty('getTask');
      expect(handlers).toHaveProperty('createTask');
      expect(handlers).toHaveProperty('updateTask');
      expect(handlers).toHaveProperty('deleteTask');

      // Template handlers
      expect(handlers).toHaveProperty('listTemplates');
      expect(handlers).toHaveProperty('getTemplate');
      expect(handlers).toHaveProperty('createTemplate');
      expect(handlers).toHaveProperty('syncTemplate');

      // Session handlers
      expect(handlers).toHaveProperty('listSessions');
      expect(handlers).toHaveProperty('getSession');
      expect(handlers).toHaveProperty('getSessionEvents');

      // Marketplace handlers
      expect(handlers).toHaveProperty('listMarketplaces');
      expect(handlers).toHaveProperty('listPlugins');
      expect(handlers).toHaveProperty('getCategories');

      // Utility
      expect(handlers).toHaveProperty('isValidId');
    });
  });
});

// =============================================================================
// 9. Additional Coverage Tests - Error Paths and Edge Cases (30+ tests)
// =============================================================================

describe('Error Paths and Edge Cases', () => {
  describe('Project Handlers - Error Paths', () => {
    it('listProjects handles database error', async () => {
      // Create a mock db that throws on query
      const mockDb = {
        query: {
          projects: {
            findMany: vi.fn().mockRejectedValue(new Error('Database connection failed')),
          },
        },
      } as any;

      const result = await listProjects(mockDb);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
      expect(result.error?.status).toBe(500);
    });

    it('getProject handles database error', async () => {
      const mockDb = {
        query: {
          projects: {
            findFirst: vi.fn().mockRejectedValue(new Error('Query failed')),
          },
        },
      } as any;

      const result = await getProject(mockDb, 'some-id');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
      expect(result.error?.message).toBe('Failed to get project');
      expect(result.error?.status).toBe(500);
    });

    it('createProject handles database error during insert', async () => {
      const mockDb = {
        query: {
          projects: {
            findFirst: vi.fn().mockResolvedValue(null), // No duplicate
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Insert failed')),
          }),
        }),
      } as any;

      const result = await createProject(mockDb, {
        name: 'Test Project',
        path: '/test/path',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
      expect(result.error?.message).toBe('Failed to create project');
    });

    it('createProject handles empty returning array', async () => {
      const mockDb = {
        query: {
          projects: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // Empty array
          }),
        }),
      } as any;

      const result = await createProject(mockDb, {
        name: 'Test Project',
        path: '/test/path',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('updateProject merges config with existing config', async () => {
      const db = getTestDb();
      const project = await createTestProject();

      // First set some initial config
      await updateProject(db, project.id, {
        config: { setting1: 'value1' },
      });

      // Then merge with additional config
      const result = await updateProject(db, project.id, {
        config: { setting2: 'value2' },
      });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      const config = data?.config as Record<string, unknown>;
      expect(config?.setting1).toBe('value1');
      expect(config?.setting2).toBe('value2');
    });

    it('updateProject handles empty returning array', async () => {
      const mockDb = {
        query: {
          projects: {
            findFirst: vi.fn().mockResolvedValue({ id: 'proj-1', config: {} }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any;

      const result = await updateProject(mockDb, 'proj-1', { name: 'Updated' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('updateProject handles database error', async () => {
      const mockDb = {
        query: {
          projects: {
            findFirst: vi.fn().mockResolvedValue({ id: 'proj-1', config: {} }),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockRejectedValue(new Error('Update failed')),
            }),
          }),
        }),
      } as any;

      const result = await updateProject(mockDb, 'proj-1', { name: 'Updated' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('deleteProject handles database error', async () => {
      const mockDb = {
        query: {
          projects: {
            findFirst: vi.fn().mockResolvedValue({ id: 'proj-1' }),
          },
          agents: {
            findMany: vi.fn().mockRejectedValue(new Error('Query agents failed')),
          },
        },
      } as any;

      const result = await deleteProject(mockDb, 'proj-1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('listProjectsWithSummaries handles database error', async () => {
      const mockDb = {
        query: {
          projects: {
            findMany: vi.fn().mockRejectedValue(new Error('Database error')),
          },
        },
      } as any;

      const result = await listProjectsWithSummaries(mockDb);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
      expect(result.error?.message).toBe('Failed to list projects with summaries');
    });

    it('listProjectsWithSummaries handles agent without current task', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      const session = await createTestSession(project.id);

      // Create agent without currentTaskId
      await createTestAgent(project.id, session.id);

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      expect(summary?.status).toBe('idle');
    });
  });

  describe('Task Handlers - Error Paths', () => {
    let testProject: Project;

    beforeEach(async () => {
      testProject = await createTestProject();
    });

    it('listTasks handles service error', async () => {
      const mockTaskService = {
        list: vi
          .fn()
          .mockResolvedValue(
            err({ code: 'PROJECT_NOT_FOUND', message: 'Project not found', status: 404 })
          ),
      } as any;

      const result = await listTasks(mockTaskService, { projectId: 'non-existent' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('PROJECT_NOT_FOUND');
    });

    it('listTasks handles thrown exception', async () => {
      const mockTaskService = {
        list: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      } as any;

      const result = await listTasks(mockTaskService, { projectId: 'proj-1' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('getTask handles thrown exception', async () => {
      const mockTaskService = {
        getById: vi.fn().mockRejectedValue(new Error('Query failed')),
      } as any;

      const result = await getTask(mockTaskService, 'task-1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
      expect(result.error?.message).toBe('Failed to get task');
    });

    it('createTask handles service error', async () => {
      const mockTaskService = {
        create: vi
          .fn()
          .mockResolvedValue(err({ code: 'PROJECT_NOT_FOUND', message: 'Not found', status: 404 })),
      } as any;

      const result = await createTask(mockTaskService, {
        projectId: 'non-existent',
        title: 'Task',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('PROJECT_NOT_FOUND');
    });

    it('createTask handles thrown exception', async () => {
      const mockTaskService = {
        create: vi.fn().mockRejectedValue(new Error('Create failed')),
      } as any;

      const result = await createTask(mockTaskService, {
        projectId: 'proj-1',
        title: 'Task',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('updateTask handles thrown exception', async () => {
      const mockTaskService = {
        update: vi.fn().mockRejectedValue(new Error('Update failed')),
      } as any;

      const result = await updateTask(mockTaskService, 'task-1', { title: 'Updated' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('deleteTask handles thrown exception', async () => {
      const mockTaskService = {
        delete: vi.fn().mockRejectedValue(new Error('Delete failed')),
      } as any;

      const result = await deleteTask(mockTaskService, 'task-1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });
  });

  describe('Template Handlers - Error Paths', () => {
    it('listTemplates handles thrown exception', async () => {
      const mockService = {
        list: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any;

      const result = await listTemplates(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('getTemplate handles thrown exception', async () => {
      const mockService = {
        getById: vi.fn().mockRejectedValue(new Error('Query error')),
      } as any;

      const result = await getTemplate(mockService, 't1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('createTemplate handles thrown exception', async () => {
      const mockService = {
        create: vi.fn().mockRejectedValue(new Error('Create error')),
      } as any;

      const result = await createTemplate(mockService, { name: 'Template' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('updateTemplate handles thrown exception', async () => {
      const mockService = {
        update: vi.fn().mockRejectedValue(new Error('Update error')),
      } as any;

      const result = await updateTemplate(mockService, 't1', { name: 'Updated' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('deleteTemplate handles thrown exception', async () => {
      const mockService = {
        delete: vi.fn().mockRejectedValue(new Error('Delete error')),
      } as any;

      const result = await deleteTemplate(mockService, 't1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('syncTemplate handles thrown exception', async () => {
      const mockService = {
        sync: vi.fn().mockRejectedValue(new Error('Sync error')),
      } as any;

      const result = await syncTemplate(mockService, 't1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });
  });

  describe('Session Handlers - Error Paths', () => {
    it('listSessions handles thrown exception', async () => {
      const mockService = {
        list: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any;

      const result = await listSessions(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('SERVER_ERROR');
    });

    it('getSession handles thrown exception', async () => {
      const mockService = {
        getById: vi.fn().mockRejectedValue(new Error('Query error')),
      } as any;

      const result = await getSession(mockService, 's1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('SERVER_ERROR');
    });

    it('getSessionEvents handles service error', async () => {
      const mockService = {
        getEventsBySession: vi
          .fn()
          .mockResolvedValue(err({ code: 'SESSION_NOT_FOUND', message: 'Not found', status: 404 })),
      } as any;

      const result = await getSessionEvents(mockService, 's1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('SESSION_NOT_FOUND');
    });

    it('getSessionEvents handles thrown exception', async () => {
      const mockService = {
        getEventsBySession: vi.fn().mockRejectedValue(new Error('Query error')),
      } as any;

      const result = await getSessionEvents(mockService, 's1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('SERVER_ERROR');
    });

    it('getSessionSummary handles service error', async () => {
      const mockService = {
        getSessionSummary: vi
          .fn()
          .mockResolvedValue(err({ code: 'SESSION_NOT_FOUND', message: 'Not found', status: 404 })),
      } as any;

      const result = await getSessionSummary(mockService, 's1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('SESSION_NOT_FOUND');
    });

    it('getSessionSummary handles thrown exception', async () => {
      const mockService = {
        getSessionSummary: vi.fn().mockRejectedValue(new Error('Query error')),
      } as any;

      const result = await getSessionSummary(mockService, 's1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('SERVER_ERROR');
    });
  });

  describe('Sandbox Config Handlers - Error Paths', () => {
    it('listSandboxConfigs handles service error', async () => {
      const mockService = {
        list: vi.fn().mockResolvedValue(err({ code: 'DB_ERROR', message: 'Failed', status: 500 })),
      } as any;

      const result = await listSandboxConfigs(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('listSandboxConfigs handles thrown exception', async () => {
      const mockService = {
        list: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any;

      const result = await listSandboxConfigs(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('getSandboxConfig handles thrown exception', async () => {
      const mockService = {
        getById: vi.fn().mockRejectedValue(new Error('Query error')),
      } as any;

      const result = await getSandboxConfig(mockService, 'sc1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('createSandboxConfig handles service error', async () => {
      const mockService = {
        create: vi
          .fn()
          .mockResolvedValue(err({ code: 'DUPLICATE', message: 'Already exists', status: 400 })),
      } as any;

      const result = await createSandboxConfig(mockService, { name: 'Config' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DUPLICATE');
    });

    it('createSandboxConfig handles thrown exception', async () => {
      const mockService = {
        create: vi.fn().mockRejectedValue(new Error('Create error')),
      } as any;

      const result = await createSandboxConfig(mockService, { name: 'Config' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('updateSandboxConfig handles service error', async () => {
      const mockService = {
        update: vi
          .fn()
          .mockResolvedValue(err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })),
      } as any;

      const result = await updateSandboxConfig(mockService, 'sc1', { name: 'Updated' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('updateSandboxConfig handles thrown exception', async () => {
      const mockService = {
        update: vi.fn().mockRejectedValue(new Error('Update error')),
      } as any;

      const result = await updateSandboxConfig(mockService, 'sc1', { name: 'Updated' });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('deleteSandboxConfig handles service error', async () => {
      const mockService = {
        delete: vi
          .fn()
          .mockResolvedValue(err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })),
      } as any;

      const result = await deleteSandboxConfig(mockService, 'sc1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('deleteSandboxConfig handles thrown exception', async () => {
      const mockService = {
        delete: vi.fn().mockRejectedValue(new Error('Delete error')),
      } as any;

      const result = await deleteSandboxConfig(mockService, 'sc1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });
  });

  describe('Marketplace Handlers - Error Paths', () => {
    it('listMarketplaces handles service error', async () => {
      const mockService = {
        list: vi.fn().mockResolvedValue(err({ code: 'DB_ERROR', message: 'Failed', status: 500 })),
      } as any;

      const result = await listMarketplaces(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('listMarketplaces handles thrown exception', async () => {
      const mockService = {
        list: vi.fn().mockRejectedValue(new Error('Database error')),
      } as any;

      const result = await listMarketplaces(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('getMarketplace handles thrown exception', async () => {
      const mockService = {
        getById: vi.fn().mockRejectedValue(new Error('Query error')),
      } as any;

      const result = await getMarketplace(mockService, 'm1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('createMarketplace handles service error', async () => {
      const mockService = {
        create: vi
          .fn()
          .mockResolvedValue(err({ code: 'DUPLICATE', message: 'Already exists', status: 400 })),
      } as any;

      const result = await createMarketplace(mockService, {
        name: 'Marketplace',
        githubUrl: 'https://github.com/org/repo',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DUPLICATE');
    });

    it('createMarketplace handles thrown exception', async () => {
      const mockService = {
        create: vi.fn().mockRejectedValue(new Error('Create error')),
      } as any;

      const result = await createMarketplace(mockService, {
        name: 'Marketplace',
        githubUrl: 'https://github.com/org/repo',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('deleteMarketplace handles service error', async () => {
      const mockService = {
        delete: vi
          .fn()
          .mockResolvedValue(err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })),
      } as any;

      const result = await deleteMarketplace(mockService, 'm1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('deleteMarketplace handles thrown exception', async () => {
      const mockService = {
        delete: vi.fn().mockRejectedValue(new Error('Delete error')),
      } as any;

      const result = await deleteMarketplace(mockService, 'm1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('syncMarketplace handles service error', async () => {
      const mockService = {
        sync: vi
          .fn()
          .mockResolvedValue(err({ code: 'NOT_FOUND', message: 'Not found', status: 404 })),
      } as any;

      const result = await syncMarketplace(mockService, 'm1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('syncMarketplace handles thrown exception', async () => {
      const mockService = {
        sync: vi.fn().mockRejectedValue(new Error('Sync error')),
      } as any;

      const result = await syncMarketplace(mockService, 'm1');

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('SYNC_ERROR');
    });

    it('listPlugins handles service error', async () => {
      const mockService = {
        listAllPlugins: vi
          .fn()
          .mockResolvedValue(err({ code: 'DB_ERROR', message: 'Failed', status: 500 })),
      } as any;

      const result = await listPlugins(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('listPlugins handles thrown exception', async () => {
      const mockService = {
        listAllPlugins: vi.fn().mockRejectedValue(new Error('Query error')),
      } as any;

      const result = await listPlugins(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('getCategories handles service error', async () => {
      const mockService = {
        getCategories: vi
          .fn()
          .mockResolvedValue(err({ code: 'DB_ERROR', message: 'Failed', status: 500 })),
      } as any;

      const result = await getCategories(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('getCategories handles thrown exception', async () => {
      const mockService = {
        getCategories: vi.fn().mockRejectedValue(new Error('Query error')),
      } as any;

      const result = await getCategories(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('seedDefaultMarketplace handles service error', async () => {
      const mockService = {
        seedDefaultMarketplace: vi
          .fn()
          .mockResolvedValue(err({ code: 'DB_ERROR', message: 'Failed', status: 500 })),
      } as any;

      const result = await seedDefaultMarketplace(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });

    it('seedDefaultMarketplace handles thrown exception', async () => {
      const mockService = {
        seedDefaultMarketplace: vi.fn().mockRejectedValue(new Error('Seed error')),
      } as any;

      const result = await seedDefaultMarketplace(mockService);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('DB_ERROR');
    });
  });

  describe('createHandlers factory - wrapper functions', () => {
    it('project wrapper functions work correctly', async () => {
      const mockDb = getTestDb();
      const project = await createTestProject();

      const handlers = createHandlers({
        db: mockDb,
        taskService: {} as any,
        templateService: {} as any,
        sessionService: {} as any,
        apiKeyService: {} as any,
        sandboxConfigService: {} as any,
        marketplaceService: {} as any,
      });

      // Test listProjects wrapper
      const listResult = await handlers.listProjects();
      expect(listResult.ok).toBe(true);

      // Test getProject wrapper
      const getResult = await handlers.getProject(project.id);
      expect(getResult.ok).toBe(true);

      // Test createProject wrapper
      const createResult = await handlers.createProject({
        name: 'Wrapper Test',
        path: '/wrapper/test/path',
      });
      expect(createResult.ok).toBe(true);

      // Test updateProject wrapper
      const updateResult = await handlers.updateProject(project.id, {
        name: 'Updated Via Wrapper',
      });
      expect(updateResult.ok).toBe(true);

      // Test deleteProject wrapper
      const deleteResult = await handlers.deleteProject(project.id);
      expect(deleteResult.ok).toBe(true);

      // Test listProjectsWithSummaries wrapper
      const summariesResult = await handlers.listProjectsWithSummaries();
      expect(summariesResult.ok).toBe(true);
    });

    it('task wrapper functions work correctly', async () => {
      const mockWorktreeService = {
        getDiff: vi
          .fn()
          .mockResolvedValue(ok({ files: [], stats: { added: 0, removed: 0, modified: 0 } })),
        merge: vi.fn().mockResolvedValue(ok(undefined)),
        remove: vi.fn().mockResolvedValue(ok(undefined)),
      };
      const db = getTestDb();
      const taskService = new TaskService(db, mockWorktreeService);
      const project = await createTestProject();
      const task = await createTestTask(project.id);

      const handlers = createHandlers({
        db: db,
        taskService: taskService,
        templateService: {} as any,
        sessionService: {} as any,
        apiKeyService: {} as any,
        sandboxConfigService: {} as any,
        marketplaceService: {} as any,
      });

      // Test listTasks wrapper
      const listResult = await handlers.listTasks({ projectId: project.id });
      expect(listResult.ok).toBe(true);

      // Test getTask wrapper
      const getResult = await handlers.getTask(task.id);
      expect(getResult.ok).toBe(true);

      // Test createTask wrapper
      const createResult = await handlers.createTask({
        projectId: project.id,
        title: 'Wrapper Test Task',
      });
      expect(createResult.ok).toBe(true);

      // Test updateTask wrapper
      const updateResult = await handlers.updateTask(task.id, { title: 'Updated Via Wrapper' });
      expect(updateResult.ok).toBe(true);

      // Test deleteTask wrapper
      const deleteResult = await handlers.deleteTask(task.id);
      expect(deleteResult.ok).toBe(true);
    });

    it('template wrapper functions work correctly', async () => {
      const mockTemplateService = {
        list: vi.fn().mockResolvedValue(ok([{ id: 't1', name: 'Template' }])),
        getById: vi.fn().mockResolvedValue(ok({ id: 't1', name: 'Template' })),
        create: vi.fn().mockResolvedValue(ok({ id: 't2', name: 'New Template' })),
        update: vi.fn().mockResolvedValue(ok({ id: 't1', name: 'Updated' })),
        delete: vi.fn().mockResolvedValue(ok(undefined)),
        sync: vi.fn().mockResolvedValue(
          ok({
            templateId: 't1',
            skillCount: 5,
            commandCount: 3,
            agentCount: 2,
            sha: 'abc',
            syncedAt: new Date().toISOString(),
          })
        ),
      };

      const handlers = createHandlers({
        db: {} as any,
        taskService: {} as any,
        templateService: mockTemplateService as any,
        sessionService: {} as any,
        apiKeyService: {} as any,
        sandboxConfigService: {} as any,
        marketplaceService: {} as any,
      });

      // Test listTemplates wrapper
      const listResult = await handlers.listTemplates();
      expect(listResult.ok).toBe(true);

      // Test getTemplate wrapper
      const getResult = await handlers.getTemplate('t1');
      expect(getResult.ok).toBe(true);

      // Test createTemplate wrapper
      const createResult = await handlers.createTemplate({ name: 'New' });
      expect(createResult.ok).toBe(true);

      // Test updateTemplate wrapper
      const updateResult = await handlers.updateTemplate('t1', { name: 'Updated' });
      expect(updateResult.ok).toBe(true);

      // Test deleteTemplate wrapper
      const deleteResult = await handlers.deleteTemplate('t1');
      expect(deleteResult.ok).toBe(true);

      // Test syncTemplate wrapper
      const syncResult = await handlers.syncTemplate('t1');
      expect(syncResult.ok).toBe(true);
    });

    it('session wrapper functions work correctly', async () => {
      const mockSessionService = {
        list: vi.fn().mockResolvedValue(ok([{ id: 's1' }])),
        getById: vi.fn().mockResolvedValue(ok({ id: 's1' })),
        getEventsBySession: vi.fn().mockResolvedValue(ok([{ id: 'e1', type: 'chunk' }])),
        getSessionSummary: vi.fn().mockResolvedValue(ok({ sessionId: 's1', turnsCount: 10 })),
      };

      const handlers = createHandlers({
        db: {} as any,
        taskService: {} as any,
        templateService: {} as any,
        sessionService: mockSessionService as any,
        apiKeyService: {} as any,
        sandboxConfigService: {} as any,
        marketplaceService: {} as any,
      });

      // Test listSessions wrapper
      const listResult = await handlers.listSessions();
      expect(listResult.ok).toBe(true);

      // Test getSession wrapper
      const getResult = await handlers.getSession('s1');
      expect(getResult.ok).toBe(true);

      // Test getSessionEvents wrapper
      const eventsResult = await handlers.getSessionEvents('s1');
      expect(eventsResult.ok).toBe(true);

      // Test getSessionSummary wrapper
      const summaryResult = await handlers.getSessionSummary('s1');
      expect(summaryResult.ok).toBe(true);
    });

    it('api key wrapper functions work correctly', async () => {
      const mockApiKeyService = {
        getKeyInfo: vi
          .fn()
          .mockResolvedValue(
            ok({ service: 'anthropic', maskedKey: 'sk-ant-...xxxx', isValid: true })
          ),
        saveKey: vi
          .fn()
          .mockResolvedValue(
            ok({ service: 'anthropic', maskedKey: 'sk-ant-...xxxx', isValid: true })
          ),
        deleteKey: vi.fn().mockResolvedValue(ok(undefined)),
      };

      const handlers = createHandlers({
        db: {} as any,
        taskService: {} as any,
        templateService: {} as any,
        sessionService: {} as any,
        apiKeyService: mockApiKeyService as any,
        sandboxConfigService: {} as any,
        marketplaceService: {} as any,
      });

      // Test getApiKey wrapper
      const getResult = await handlers.getApiKey('anthropic');
      expect(getResult.ok).toBe(true);

      // Test saveApiKey wrapper
      const saveResult = await handlers.saveApiKey('anthropic', 'sk-ant-api03-xxxxxxxxxx');
      expect(saveResult.ok).toBe(true);

      // Test deleteApiKey wrapper
      const deleteResult = await handlers.deleteApiKey('anthropic');
      expect(deleteResult.ok).toBe(true);
    });

    it('sandbox config wrapper functions work correctly', async () => {
      const mockSandboxConfigService = {
        list: vi.fn().mockResolvedValue(ok([{ id: 'sc1', name: 'Default' }])),
        getById: vi.fn().mockResolvedValue(ok({ id: 'sc1', name: 'Default' })),
        create: vi.fn().mockResolvedValue(ok({ id: 'sc2', name: 'New' })),
        update: vi.fn().mockResolvedValue(ok({ id: 'sc1', name: 'Updated' })),
        delete: vi.fn().mockResolvedValue(ok(undefined)),
      };

      const handlers = createHandlers({
        db: {} as any,
        taskService: {} as any,
        templateService: {} as any,
        sessionService: {} as any,
        apiKeyService: {} as any,
        sandboxConfigService: mockSandboxConfigService as any,
        marketplaceService: {} as any,
      });

      // Test listSandboxConfigs wrapper
      const listResult = await handlers.listSandboxConfigs();
      expect(listResult.ok).toBe(true);

      // Test getSandboxConfig wrapper
      const getResult = await handlers.getSandboxConfig('sc1');
      expect(getResult.ok).toBe(true);

      // Test createSandboxConfig wrapper
      const createResult = await handlers.createSandboxConfig({ name: 'New' });
      expect(createResult.ok).toBe(true);

      // Test updateSandboxConfig wrapper
      const updateResult = await handlers.updateSandboxConfig('sc1', { name: 'Updated' });
      expect(updateResult.ok).toBe(true);

      // Test deleteSandboxConfig wrapper
      const deleteResult = await handlers.deleteSandboxConfig('sc1');
      expect(deleteResult.ok).toBe(true);
    });

    it('marketplace wrapper functions work correctly', async () => {
      const mockMarketplaceService = {
        list: vi.fn().mockResolvedValue(ok([{ id: 'm1', name: 'Default', cachedPlugins: [] }])),
        getById: vi.fn().mockResolvedValue(ok({ id: 'm1', name: 'Default', cachedPlugins: [] })),
        create: vi.fn().mockResolvedValue(ok({ id: 'm2', name: 'New' })),
        delete: vi.fn().mockResolvedValue(ok(undefined)),
        sync: vi.fn().mockResolvedValue(ok({ pluginCount: 10, sha: 'abc123' })),
        listAllPlugins: vi.fn().mockResolvedValue(ok([{ id: 'p1', name: 'Plugin' }])),
        getCategories: vi.fn().mockResolvedValue(ok(['development', 'testing'])),
        seedDefaultMarketplace: vi.fn().mockResolvedValue(ok({ id: 'm1' })),
      };

      const handlers = createHandlers({
        db: {} as any,
        taskService: {} as any,
        templateService: {} as any,
        sessionService: {} as any,
        apiKeyService: {} as any,
        sandboxConfigService: {} as any,
        marketplaceService: mockMarketplaceService as any,
      });

      // Test listMarketplaces wrapper
      const listResult = await handlers.listMarketplaces();
      expect(listResult.ok).toBe(true);

      // Test getMarketplace wrapper
      const getResult = await handlers.getMarketplace('m1');
      expect(getResult.ok).toBe(true);

      // Test createMarketplace wrapper
      const createResult = await handlers.createMarketplace({
        name: 'New',
        githubUrl: 'https://github.com/org/repo',
      });
      expect(createResult.ok).toBe(true);

      // Test deleteMarketplace wrapper
      const deleteResult = await handlers.deleteMarketplace('m1');
      expect(deleteResult.ok).toBe(true);

      // Test syncMarketplace wrapper
      const syncResult = await handlers.syncMarketplace('m1');
      expect(syncResult.ok).toBe(true);

      // Test listPlugins wrapper
      const pluginsResult = await handlers.listPlugins();
      expect(pluginsResult.ok).toBe(true);

      // Test getCategories wrapper
      const categoriesResult = await handlers.getCategories();
      expect(categoriesResult.ok).toBe(true);

      // Test seedDefaultMarketplace wrapper
      const seedResult = await handlers.seedDefaultMarketplace();
      expect(seedResult.ok).toBe(true);
    });

    it('isValidId utility is accessible via handlers', () => {
      const handlers = createHandlers({
        db: {} as any,
        taskService: {} as any,
        templateService: {} as any,
        sessionService: {} as any,
        apiKeyService: {} as any,
        sandboxConfigService: {} as any,
        marketplaceService: {} as any,
      });

      expect(handlers.isValidId('valid-id')).toBe(true);
      expect(handlers.isValidId('')).toBe(false);
    });
  });

  describe('isValidId - Edge Cases', () => {
    it('rejects null as id', () => {
      expect(isValidId(null as unknown as string)).toBe(false);
    });

    it('rejects undefined as id', () => {
      expect(isValidId(undefined as unknown as string)).toBe(false);
    });

    it('rejects non-string types', () => {
      expect(isValidId(123 as unknown as string)).toBe(false);
      expect(isValidId({} as unknown as string)).toBe(false);
      expect(isValidId([] as unknown as string)).toBe(false);
    });

    it('accepts single character id', () => {
      expect(isValidId('a')).toBe(true);
    });

    it('accepts mixed alphanumeric with hyphens and underscores', () => {
      expect(isValidId('abc-123_DEF')).toBe(true);
    });

    it('rejects whitespace in id', () => {
      expect(isValidId('id with space')).toBe(false);
      expect(isValidId('id\twith\ttab')).toBe(false);
      expect(isValidId('id\nwith\nnewline')).toBe(false);
    });

    it('rejects unicode characters', () => {
      expect(isValidId('id-with-emoji-🎉')).toBe(false);
      expect(isValidId('id-with-中文')).toBe(false);
    });
  });

  describe('Additional Branch Coverage', () => {
    it('updateProject merges config when existing.config is null', async () => {
      const db = getTestDb();
      const project = await createTestProject();

      // Ensure config starts as null
      const { projects } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      await db.update(projects).set({ config: null }).where(eq(projects.id, project.id));

      // Now update with new config
      const result = await updateProject(db, project.id, {
        config: { newSetting: 'value' },
      });

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      const config = data?.config as Record<string, unknown>;
      expect(config?.newSetting).toBe('value');
    });

    it('listProjectsWithSummaries handles running agent with currentTaskId', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      const task = await createTestTask(project.id, { title: 'Agent Task' });
      const session = await createTestSession(project.id);
      await createRunningAgent(project.id, task.id, session.id);

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      expect(summary?.status).toBe('running');
      const runningAgents = summary?.runningAgents as { currentTaskTitle?: string }[];
      expect(runningAgents?.[0]?.currentTaskTitle).toBe('Agent Task');
    });

    it('listProjectsWithSummaries handles agent with default name', async () => {
      const db = getTestDb();
      const project = await createTestProject();
      const task = await createTestTask(project.id);
      const session = await createTestSession(project.id);

      // Create an agent with empty string name (will fallback to 'Agent')
      const { agents } = await import('../../src/db/schema');
      const { createId } = await import('@paralleldrive/cuid2');
      await db.insert(agents).values({
        id: createId(),
        projectId: project.id,
        sessionId: session.id,
        currentTaskId: task.id,
        name: '', // Empty name, but the nullish coalescing handles undefined/null
        status: 'running',
      });

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      const runningAgents = summary?.runningAgents as { name: string }[];
      // Empty string is truthy for the nullish coalescing, so we get empty string
      expect(runningAgents?.[0]?.name).toBe('');
    });

    it('listProjectsWithSummaries handles task sorting with different dates', async () => {
      const db = getTestDb();
      const project = await createTestProject();

      // Create tasks with different updatedAt values
      const { tasks } = await import('../../src/db/schema');
      const { createId } = await import('@paralleldrive/cuid2');
      const now = new Date();
      const earlier = new Date(now.getTime() - 10000);
      await db.insert(tasks).values([
        {
          id: createId(),
          projectId: project.id,
          title: 'Task 1',
          column: 'backlog',
          updatedAt: earlier.toISOString(),
        },
        {
          id: createId(),
          projectId: project.id,
          title: 'Task 2',
          column: 'backlog',
          updatedAt: now.toISOString(),
        },
      ]);

      const result = await listProjectsWithSummaries(db);

      expect(result.ok).toBe(true);
      const summary = result.data?.items[0] as Record<string, unknown>;
      expect(summary?.lastActivityAt).toBeDefined();
      // The most recent task should determine lastActivityAt
      expect(new Date(summary?.lastActivityAt as string).getTime()).toBeGreaterThanOrEqual(
        earlier.getTime()
      );
    });

    it('listMarketplaces handles marketplace with null cachedPlugins', async () => {
      const mockService = {
        list: vi.fn().mockResolvedValue(
          ok([
            {
              id: 'm1',
              name: 'Marketplace',
              githubOwner: 'owner',
              githubRepo: 'repo',
              branch: 'main',
              pluginsPath: '/plugins',
              isDefault: false,
              isEnabled: true,
              status: 'synced',
              lastSyncedAt: new Date().toISOString(),
              syncError: null,
              cachedPlugins: null, // Explicitly null
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ])
        ),
      } as any;

      const result = await listMarketplaces(mockService);

      expect(result.ok).toBe(true);
      const item = result.data?.items[0] as Record<string, unknown>;
      expect(item?.pluginCount).toBe(0); // Should fallback to empty array, so length 0
    });

    it('getMarketplace handles marketplace with null cachedPlugins', async () => {
      const mockService = {
        getById: vi.fn().mockResolvedValue(
          ok({
            id: 'm1',
            name: 'Marketplace',
            githubOwner: 'owner',
            githubRepo: 'repo',
            branch: 'main',
            pluginsPath: '/plugins',
            isDefault: false,
            isEnabled: true,
            status: 'synced',
            lastSyncedAt: new Date().toISOString(),
            syncError: null,
            cachedPlugins: null, // Explicitly null
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        ),
      } as any;

      const result = await getMarketplace(mockService, 'm1');

      expect(result.ok).toBe(true);
      const data = result.data as Record<string, unknown>;
      expect(data?.plugins).toEqual([]); // Should fallback to empty array
    });
  });
});
