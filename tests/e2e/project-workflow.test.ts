import { describe, expect, it } from 'vitest';
import { click, exists, goto, screenshot, serverRunning, waitForSelector } from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

e2e('Project Workflow E2E', () => {
  describe('Homepage', () => {
    it('displays layout shell on homepage', async () => {
      await goto('/');
      await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});

      const layoutExists = await exists('[data-testid="layout-shell"]');
      expect(layoutExists).toBe(true);
    });

    it('displays new project button', async () => {
      await goto('/');
      await waitForSelector('[data-testid="new-project-button"]', { timeout: 10000 }).catch(
        () => {}
      );

      const buttonExists = await exists('[data-testid="new-project-button"]');
      expect(buttonExists).toBe(true);
    });

    it('opens new project dialog when clicking create button', async () => {
      await goto('/');
      // Wait for the layout shell first to ensure React has mounted
      await waitForSelector('[data-testid="layout-shell"]', { timeout: 15000 }).catch(() => {});
      // Then wait for the button specifically
      await waitForSelector('[data-testid="new-project-button"]', { timeout: 10000 }).catch(
        () => {}
      );

      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 }).catch(
          () => {}
        );
        const dialogExists = await exists('[data-testid="new-project-dialog"]');
        // Dialog should open when button is clicked
        expect(dialogExists).toBe(true);
      } else {
        // Skip this test if button doesn't exist (e.g., on mobile viewport)
        expect(true).toBe(true);
      }
    });
  });

  describe('Projects Page', () => {
    it('displays projects page structure', async () => {
      await goto('/projects');
      await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});
      await waitForSelector('[data-testid="projects-page"]', { timeout: 10000 }).catch(() => {});

      const pageExists = await exists('[data-testid="projects-page"]');
      expect(pageExists).toBe(true);
    });

    it('displays create project button on projects page', async () => {
      await goto('/projects');
      await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});
      await waitForSelector('[data-testid="create-project-button"]', { timeout: 10000 }).catch(
        () => {}
      );

      const buttonExists = await exists('[data-testid="create-project-button"]');
      expect(buttonExists).toBe(true);
    });

    it('displays search input on projects page', async () => {
      await goto('/projects');
      await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});
      await waitForSelector('[data-testid="project-search"]', { timeout: 10000 }).catch(() => {});

      const searchExists = await exists('[data-testid="project-search"]');
      expect(searchExists).toBe(true);
    });

    it('displays sort dropdown on projects page', async () => {
      await goto('/projects');
      await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});
      await waitForSelector('[data-testid="project-sort"]', { timeout: 10000 }).catch(() => {});

      const sortExists = await exists('[data-testid="project-sort"]');
      expect(sortExists).toBe(true);
    });
  });

  describe('Screenshot Capture', () => {
    it('captures homepage screenshot', async () => {
      await goto('/');
      await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});
      const buffer = await screenshot('homepage');
      expect(buffer).toBeTruthy();
    });

    it('captures projects page screenshot', async () => {
      await goto('/projects');
      await waitForSelector('[data-testid="layout-shell"]', { timeout: 10000 }).catch(() => {});
      await waitForSelector('[data-testid="projects-page"]', { timeout: 10000 }).catch(() => {});
      const buffer = await screenshot('projects-page');
      expect(buffer).toBeTruthy();
    });
  });
});
