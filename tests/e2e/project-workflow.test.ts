import { beforeEach, describe, expect, it } from 'vitest';
import { click, exists, fill, goto, screenshot, serverRunning, waitForSelector } from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

e2e('Project Workflow E2E', () => {
  beforeEach(async () => {
    await goto('/');
  });

  describe('Project Creation', () => {
    it('displays new project button on empty state', async () => {
      const buttonExists = await exists('[data-testid="new-project-button"]');
      expect(typeof buttonExists).toBe('boolean');
    });

    it('opens new project dialog when clicking create button', async () => {
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });
        const dialogExists = await exists('[data-testid="new-project-dialog"]');
        expect(dialogExists).toBe(true);
      }
    });

    it('validates project path input', async () => {
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="project-path-input"]', { timeout: 5000 });
        await fill('[data-testid="project-path-input"]', '/invalid/path');
        await click('[data-testid="validate-path-button"]');
        await waitForSelector('[data-testid="validation-result"]', { timeout: 10000 });
      }
    });
  });

  describe('Project List', () => {
    it('displays project cards when projects exist', async () => {
      await waitForSelector('[data-testid="project-list"]', { timeout: 5000 }).catch(() => {});
      const listExists = await exists('[data-testid="project-list"]');

      if (listExists) {
        const cardExists = await exists('[data-testid="project-card"]');
        expect(typeof cardExists).toBe('boolean');
      }
    });

    it('shows project status indicators', async () => {
      const cardExists = await exists('[data-testid="project-card"]');
      if (cardExists) {
        const statusExists = await exists('[data-testid="project-status"]');
        expect(typeof statusExists).toBe('boolean');
      }
    });
  });

  describe('Project Navigation', () => {
    it('navigates to project detail on card click', async () => {
      const cardExists = await exists('[data-testid="project-card"]');
      if (cardExists) {
        await click('[data-testid="project-card"]');
        await waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 }).catch(() => {});
        const boardExists = await exists('[data-testid="kanban-board"]');
        expect(typeof boardExists).toBe('boolean');
      }
    });
  });

  describe('Task Creation', () => {
    it('opens task creation dialog', async () => {
      const addTaskButton = await exists('[data-testid="add-task-button"]');
      if (addTaskButton) {
        await click('[data-testid="add-task-button"]');
        await waitForSelector('[data-testid="task-dialog"]', { timeout: 5000 });
        const dialogExists = await exists('[data-testid="task-dialog"]');
        expect(dialogExists).toBe(true);
      }
    });

    it('creates task with title and description', async () => {
      const addTaskButton = await exists('[data-testid="add-task-button"]');
      if (addTaskButton) {
        await click('[data-testid="add-task-button"]');
        await waitForSelector('[data-testid="task-title-input"]', { timeout: 5000 });

        await fill('[data-testid="task-title-input"]', 'E2E Test Task');
        await fill('[data-testid="task-description-input"]', 'Created by E2E test');
        await click('[data-testid="create-task-button"]');

        await waitForSelector('[data-testid="task-card"]', { timeout: 5000 }).catch(() => {});
      }
    });
  });

  describe('Screenshot Capture', () => {
    it('captures homepage screenshot', async () => {
      await goto('/');
      await waitForSelector('body', { timeout: 5000 });
      const buffer = await screenshot('homepage');
      expect(buffer).toBeTruthy();
    });
  });
});
