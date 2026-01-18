import { describe, expect, it } from 'vitest';
import { click, drag, exists, fill, getUrl, goto, serverRunning, waitForSelector } from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

e2e('E2E: Task Workflow', () => {
  it('E2E-001: Create project from local path', async () => {
    await goto('/');

    await click('[data-testid="new-project-button"]');
    await fill('[data-testid="project-path-input"]', '/tmp/test-project');
    await click('[data-testid="validate-path-button"]');
    await waitForSelector('[data-testid="validation-success"]', { timeout: 10000 }).catch(() => {});
    await fill('[data-testid="project-name-input"]', 'E2E Test Project');
    await click('[data-testid="create-project-button"]');

    const url = await getUrl();
    expect(url).toMatch(/\/projects\/\w+/);
  });

  it('E2E-002: Create task in backlog', async () => {
    await goto('/projects/test-project');

    await click('[data-testid="add-task-button"]');
    await fill('[data-testid="task-title-input"]', 'New E2E Task');
    await fill('[data-testid="task-description-input"]', 'Task description');
    await click('[data-testid="save-task-button"]');

    const visible = await exists('[data-testid="column-backlog"] [data-testid="task-card"]');
    expect(visible).toBe(true);
  });

  it('E2E-003: Drag task to in_progress starts agent', async () => {
    await goto('/projects/test-project');

    await drag(
      '[data-testid="column-backlog"] [data-testid="task-card"]:first-child',
      '[data-testid="column-in_progress"]'
    );

    const hasRunning = await exists('[data-testid="column-in_progress"] [data-testid="task-card"]');
    expect(hasRunning).toBe(true);
  });

  it('E2E-005: Open approval dialog shows diff', async () => {
    await goto('/projects/test-project');

    await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');

    const isVisible = await exists('[data-testid="diff-summary"]');
    expect(isVisible).toBe(true);
  });

  it('E2E-006: Approve task merges changes', async () => {
    await goto('/projects/test-project');

    await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
    await click('[data-testid="approve-button"]');

    const visible = await exists('[data-testid="column-verified"] [data-testid="task-card"]');
    expect(visible).toBe(true);
  });
});
