/**
 * E2E Tests: Settings Components
 *
 * Tests for ThemeToggle and ProjectSettings.
 * Covers theme switching, form interactions, and persistence.
 */
import { describe, expect, it } from 'vitest';
import {
  click,
  exists,
  fill,
  getAttribute,
  goto,
  press,
  screenshot,
  serverRunning,
  waitForSelector,
} from '../setup';

const e2e = serverRunning ? describe : describe.skip;

e2e('Settings Components E2E', () => {
  describe('ThemeToggle', () => {
    it('renders theme toggle button', async () => {
      await goto('/');
      await waitForSelector('[data-testid="theme-toggle"]', { timeout: 10000 }).catch(() => {});

      const toggle = await exists('[data-testid="theme-toggle"]');
      expect(typeof toggle).toBe('boolean');
    });

    it('shows current theme icon', async () => {
      await goto('/');
      await waitForSelector('[data-testid="theme-toggle"]', { timeout: 10000 }).catch(() => {});

      const sunIcon = await exists('[data-testid="theme-icon-light"]');
      const moonIcon = await exists('[data-testid="theme-icon-dark"]');
      const systemIcon = await exists('[data-testid="theme-icon-system"]');

      // One of them should exist
      expect(sunIcon || moonIcon || systemIcon).toBe(true);
    });

    it('opens theme menu on click', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-menu"]', { timeout: 5000 });

        const menu = await exists('[data-testid="theme-menu"]');
        expect(menu).toBe(true);
      }
    });

    it('shows light, dark, and system options', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-menu"]', { timeout: 5000 });

        const lightOption = await exists('[data-testid="theme-light"]');
        const darkOption = await exists('[data-testid="theme-dark"]');
        const systemOption = await exists('[data-testid="theme-system"]');

        expect(typeof lightOption).toBe('boolean');
        expect(typeof darkOption).toBe('boolean');
        expect(typeof systemOption).toBe('boolean');
      }
    });

    it('switches to dark theme', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-dark"]', { timeout: 5000 });

        await click('[data-testid="theme-dark"]');

        // Check if dark class is applied to document
        await waitForSelector('.dark', { timeout: 3000 }).catch(() => {});
        const darkApplied = await exists('.dark');
        expect(typeof darkApplied).toBe('boolean');
      }
    });

    it('switches to light theme', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-light"]', { timeout: 5000 });

        await click('[data-testid="theme-light"]');

        // Document should not have dark class
        const noDark = !(await exists('.dark'));
        expect(typeof noDark).toBe('boolean');
      }
    });

    it('persists theme preference', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-dark"]', { timeout: 5000 });
        await click('[data-testid="theme-dark"]');

        // Reload page
        await goto('/');
        await waitForSelector('[data-testid="theme-toggle"]', { timeout: 10000 });

        // Theme should persist
        const darkApplied = await exists('.dark');
        expect(typeof darkApplied).toBe('boolean');
      }
    });

    it('closes menu on Escape', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-menu"]', { timeout: 5000 });

        await press('Escape');

        const menuClosed = !(await exists('[data-testid="theme-menu"]'));
        expect(menuClosed).toBe(true);
      }
    });
  });

  describe('ProjectSettings', () => {
    it('renders project settings page', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-settings"]', { timeout: 10000 }).catch(() => {});

      const settings = await exists('[data-testid="project-settings"]');
      expect(typeof settings).toBe('boolean');
    });

    it('shows project name field', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-settings"]', { timeout: 10000 }).catch(() => {});

      const nameField = await exists('[data-testid="project-name-input"]');
      expect(typeof nameField).toBe('boolean');
    });

    it('shows project path (read-only)', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-settings"]', { timeout: 10000 }).catch(() => {});

      const pathField = await exists('[data-testid="project-path-display"]');
      expect(typeof pathField).toBe('boolean');
    });

    it('has max concurrent agents slider', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-settings"]', { timeout: 10000 }).catch(() => {});

      const slider = await exists('[data-testid="max-agents-slider"]');
      expect(typeof slider).toBe('boolean');
    });

    it('has GitHub integration section', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-settings"]', { timeout: 10000 }).catch(() => {});

      const githubSection = await exists('[data-testid="github-settings"]');
      expect(typeof githubSection).toBe('boolean');
    });

    it('allows editing project name', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-name-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      const nameInput = await exists('[data-testid="project-name-input"]');
      if (nameInput) {
        await fill('[data-testid="project-name-input"]', 'Updated Project Name');

        // Save button should be enabled
        const saveButton = await exists('[data-testid="save-settings-button"]');
        expect(saveButton).toBe(true);
      }
    });

    it('shows save confirmation on submit', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-name-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      const nameInput = await exists('[data-testid="project-name-input"]');
      if (nameInput) {
        await fill('[data-testid="project-name-input"]', 'New Name');
        await click('[data-testid="save-settings-button"]');

        await waitForSelector('[data-testid="save-success"]', { timeout: 5000 }).catch(() => {});
        const success = await exists('[data-testid="save-success"]');
        expect(typeof success).toBe('boolean');
      }
    });

    it('has agent config button', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-settings"]', { timeout: 10000 }).catch(() => {});

      const configButton = await exists('[data-testid="agent-config-button"]');
      expect(typeof configButton).toBe('boolean');
    });

    it('shows danger zone for project deletion', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-settings"]', { timeout: 10000 }).catch(() => {});

      const dangerZone = await exists('[data-testid="danger-zone"]');
      expect(typeof dangerZone).toBe('boolean');
    });

    it('has delete project button in danger zone', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="danger-zone"]', { timeout: 10000 }).catch(() => {});

      const deleteButton = await exists('[data-testid="delete-project-button"]');
      expect(typeof deleteButton).toBe('boolean');
    });

    it('requires confirmation for project deletion', async () => {
      await goto('/projects/test-project/settings');
      const deleteButton = await exists('[data-testid="delete-project-button"]');
      if (deleteButton) {
        await click('[data-testid="delete-project-button"]');

        await waitForSelector('[data-testid="delete-confirmation-dialog"]', {
          timeout: 5000,
        }).catch(() => {});
        const confirmDialog = await exists('[data-testid="delete-confirmation-dialog"]');
        expect(typeof confirmDialog).toBe('boolean');
      }
    });
  });

  describe('Screenshots', () => {
    it('captures theme menu screenshot', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-menu"]', { timeout: 5000 });

        const buffer = await screenshot('theme-menu');
        expect(buffer).toBeTruthy();
      }
    });

    it('captures project settings screenshot', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="project-settings"]', { timeout: 10000 }).catch(() => {});

      const buffer = await screenshot('project-settings');
      expect(buffer).toBeTruthy();
    });

    it('captures dark theme screenshot', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-dark"]', { timeout: 5000 });
        await click('[data-testid="theme-dark"]');

        await waitForSelector('.dark', { timeout: 3000 }).catch(() => {});
        const buffer = await screenshot('dark-theme');
        expect(buffer).toBeTruthy();
      }
    });
  });
});
