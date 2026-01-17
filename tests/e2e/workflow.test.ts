import { describe, expect, it } from 'vitest';
import { click, drag, exists, fill, getUrl, goto, serverRunning, waitForSelector } from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

e2e('E2E: Task Workflow', () => {
  it('E2E-001: Create project from local path', async () => {
    await goto('/');

    await click('text=New Project');
    await fill('input[placeholder="/path/to/project"]', '/tmp/test-project');
    await waitForSelector('svg.text-green-500', { timeout: 10000 });
    await fill('input[placeholder="My Project"]', 'E2E Test Project');
    await click('text=Create Project');

    const url = await getUrl();
    expect(url).toMatch(/\/projects\/\w+/);
  });

  it('E2E-002: Create task in backlog', async () => {
    await goto('/projects/test-project-id');

    await click('text=New Task');
    await fill('input[placeholder="Task title..."]', 'New E2E Task');
    await fill('textarea', 'Task description');
    await click('text=Save');

    const visible = await exists('.kanban-column:has-text("Backlog") >> text=New E2E Task');
    expect(visible).toBe(true);
  });

  it('E2E-003: Drag task to in_progress starts agent', async () => {
    await goto('/projects/test-project-id');

    await drag('.kanban-card:has-text("Test Task")', '.kanban-column:has-text("In Progress")');

    const hasRunning = await exists('.kanban-card .border-l-status-running');
    expect(hasRunning).toBe(true);
  });

  it('E2E-005: Open approval dialog shows diff', async () => {
    await goto('/projects/test-project-id');

    await click('.kanban-column:has-text("Waiting Approval") .kanban-card >> nth=0');

    const isVisible = await exists('text=Change Summary');
    expect(isVisible).toBe(true);
  });

  it('E2E-006: Approve task merges changes', async () => {
    await goto('/projects/test-project-id');

    await click('.kanban-column:has-text("Waiting Approval") .kanban-card >> nth=0');
    await click('text=Approve & Merge');

    const visible = await exists('.kanban-column:has-text("Verified") .kanban-card');
    expect(visible).toBe(true);
  });
});
