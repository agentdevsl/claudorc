import { describe, expect, it } from 'vitest';
import {
  click,
  drag,
  exists,
  fill,
  getText,
  getUrl,
  goto,
  serverRunning,
  waitForSelector,
} from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

let projectId = '';

e2e('E2E: Task Workflow', () => {
  it('E2E-001: Create project from local path', async () => {
    await goto('/');

    await click('[data-testid="new-project-button"]');
    await fill('[data-testid="project-path-input"]', process.cwd());
    await click('[data-testid="validate-path-button"]');
    await waitForSelector('[data-testid="validation-success"]', { timeout: 10000 }).catch(() => {});
    await fill('[data-testid="project-name-input"]', 'E2E Test Project');
    await click('[data-testid="create-project-button"]');

    const url = await getUrl();
    const match = url.match(/\/projects\/(\w+)/);
    expect(match).toBeTruthy();
    if (match) {
      projectId = match[1];
    }
  });

  it('E2E-002: Create task in backlog', async () => {
    await goto(`/projects/${projectId}`);

    await click('[data-testid="add-task-button"]');
    await fill('[data-testid="task-title-input"]', 'New E2E Task');
    await fill('[data-testid="task-description-input"]', 'Task description');
    await click('[data-testid="save-task-button"]');

    await waitForSelector('[data-testid="column-backlog"] [data-testid="task-card"]', {
      timeout: 5000,
    }).catch(() => {});
    const visible = await exists('[data-testid="column-backlog"] [data-testid="task-card"]');
    expect(visible).toBe(true);
  });

  it('E2E-003: Navigate to tasks page', async () => {
    await goto(`/projects/${projectId}`);

    const url = await getUrl();
    expect(url).toContain(`/projects/${projectId}`);
  });

  it('E2E-004: Verify kanban columns exist', async () => {
    await goto(`/projects/${projectId}`);

    const backlogExists = await exists('[data-testid="column-backlog"]');
    const inProgressExists = await exists('[data-testid="column-in_progress"]');
    const waitingApprovalExists = await exists('[data-testid="column-waiting_approval"]');
    const verifiedExists = await exists('[data-testid="column-verified"]');

    expect(backlogExists).toBe(true);
    expect(inProgressExists).toBe(true);
    expect(waitingApprovalExists).toBe(true);
    expect(verifiedExists).toBe(true);
  });

  it('E2E-005: Check sidebar navigation elements', async () => {
    await goto('/');

    const sidebar = await exists('[data-testid="sidebar"]');
    const projectList = await exists('[data-testid="project-list"]');
    const navProjects = await exists('[data-testid="nav-projects"]');
    const navAgents = await exists('[data-testid="nav-agents"]');
    const navQueue = await exists('[data-testid="nav-queue"]');
    const navSessions = await exists('[data-testid="nav-sessions"]');
    const navWorktrees = await exists('[data-testid="nav-worktrees"]');
    const navSettings = await exists('[data-testid="nav-settings"]');

    expect(sidebar).toBe(true);
    expect(projectList).toBe(true);
    expect(navProjects).toBe(true);
    expect(navAgents).toBe(true);
    expect(navQueue).toBe(true);
    expect(navSessions).toBe(true);
    expect(navWorktrees).toBe(true);
    expect(navSettings).toBe(true);
  });
});
