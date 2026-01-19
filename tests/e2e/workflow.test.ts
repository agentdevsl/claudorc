import { describe, expect, it } from 'vitest';
import { exists, getUrl, goto, serverRunning, waitForSelector } from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

e2e('E2E: Task Workflow', () => {
  it('E2E-001: Navigate to homepage and verify page structure', async () => {
    await goto('/');
    await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});

    const layoutShell = await exists('[data-testid="layout-shell"]');
    expect(layoutShell).toBe(true);
  });

  it('E2E-002: Navigate directly to projects page', async () => {
    await goto('/projects');
    await waitForSelector('[data-testid="projects-page"]', { timeout: 10000 }).catch(() => {});

    const url = await getUrl();
    expect(url).toContain('/projects');
  });

  it('E2E-003: Verify homepage has new project button', async () => {
    await goto('/');
    await waitForSelector('[data-testid="new-project-button"]', { timeout: 10000 }).catch(() => {});

    // The new project button should always be visible
    const newProjectButton = await exists('[data-testid="new-project-button"]');
    expect(newProjectButton).toBe(true);
  });

  it('E2E-004: Verify projects page has create button', async () => {
    await goto('/projects');
    await waitForSelector('[data-testid="create-project-button"]', { timeout: 10000 }).catch(
      () => {}
    );

    // The create project button should always be visible on projects page
    const createButton = await exists('[data-testid="create-project-button"]');
    expect(createButton).toBe(true);
  });

  it('E2E-005: Verify layout shell contains main content area', async () => {
    await goto('/');
    await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});

    // Layout shell should contain main content area
    const layoutMain = await exists('[data-testid="layout-main"]');
    expect(layoutMain).toBe(true);
  });
});
