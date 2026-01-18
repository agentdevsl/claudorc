import { describe, expect, it } from 'vitest';
import { click, exists, getText, getUrl, goto, serverRunning, waitForSelector } from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

const projectId = '';

e2e('E2E: Task Workflow', () => {
  it('E2E-001: Navigate to homepage and verify page structure', async () => {
    await goto('/');
    await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});

    const sidebar = await exists('[data-testid="sidebar"]');
    expect(sidebar).toBe(true);
  });

  it('E2E-002: Find and navigate to first project', async () => {
    await goto('/');
    await waitForSelector('[data-testid="project-card"]', { timeout: 10000 }).catch(() => {});

    // Check if project list has projects
    const projectCardExists = await exists('[data-testid="project-card"]');
    expect(projectCardExists).toBe(true);

    // Get first project ID from URL after clicking
    if (projectCardExists) {
      // Navigate to projects list page first
      await click('[data-testid="nav-projects"]');

      // Wait for projects page to load
      await waitForSelector('[data-testid="projects-page"]', { timeout: 5000 }).catch(() => {});

      const url = await getUrl();
      expect(url).toContain('/projects');
    }
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
