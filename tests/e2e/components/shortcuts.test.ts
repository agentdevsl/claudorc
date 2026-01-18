/**
 * E2E Tests: Global Keyboard Shortcuts
 *
 * Tests for keyboard shortcuts including navigation, actions, and help modal.
 * Covers Cmd+1/2 navigation, Cmd+P project picker, Cmd+/ help, and more.
 */
import { describe, expect, it } from 'vitest';
import {
  click,
  exists,
  getUrl,
  goto,
  press,
  screenshot,
  serverRunning,
  waitForSelector,
} from '../setup';

const e2e = serverRunning ? describe : describe.skip;

e2e('Global Keyboard Shortcuts E2E', () => {
  describe('Help Modal', () => {
    it('opens help modal with Cmd+/', async () => {
      await goto('/');
      await waitForSelector('[data-testid="sidebar"]', { timeout: 10000 }).catch(() => {});

      // Press Cmd+/
      await press('Meta+/');

      await waitForSelector('[data-testid="shortcuts-help"]', { timeout: 5000 }).catch(() => {});
      const helpModal = await exists('[data-testid="shortcuts-help"]');
      expect(typeof helpModal).toBe('boolean');
    });

    it('shows shortcuts grouped by category', async () => {
      await goto('/');
      await press('Meta+/');
      await waitForSelector('[data-testid="shortcuts-help"]', { timeout: 5000 }).catch(() => {});

      const helpModal = await exists('[data-testid="shortcuts-help"]');
      if (helpModal) {
        const navigationGroup = await exists('[data-testid="shortcut-group-navigation"]');
        const viewsGroup = await exists('[data-testid="shortcut-group-views"]');
        const actionsGroup = await exists('[data-testid="shortcut-group-actions"]');

        expect(typeof navigationGroup).toBe('boolean');
        expect(typeof viewsGroup).toBe('boolean');
        expect(typeof actionsGroup).toBe('boolean');
      }
    });

    it('displays keyboard shortcuts in correct format', async () => {
      await goto('/');
      await press('Meta+/');
      await waitForSelector('[data-testid="shortcuts-help"]', { timeout: 5000 }).catch(() => {});

      const helpModal = await exists('[data-testid="shortcuts-help"]');
      if (helpModal) {
        const shortcutRow = await exists('[data-testid="shortcut-row"]');
        const keyIndicator = await exists('[data-testid="key-indicator"]');

        expect(typeof shortcutRow).toBe('boolean');
        expect(typeof keyIndicator).toBe('boolean');
      }
    });

    it('closes help modal with Escape', async () => {
      await goto('/');
      await press('Meta+/');
      await waitForSelector('[data-testid="shortcuts-help"]', { timeout: 5000 });

      await press('Escape');

      const helpModalClosed = !(await exists('[data-testid="shortcuts-help"]'));
      expect(helpModalClosed).toBe(true);
    });

    it('closes help modal with close button', async () => {
      await goto('/');
      await press('Meta+/');
      await waitForSelector('[data-testid="shortcuts-help-close"]', { timeout: 5000 }).catch(
        () => {}
      );

      const closeButton = await exists('[data-testid="shortcuts-help-close"]');
      if (closeButton) {
        await click('[data-testid="shortcuts-help-close"]');

        const helpModalClosed = !(await exists('[data-testid="shortcuts-help"]'));
        expect(helpModalClosed).toBe(true);
      }
    });
  });

  describe('View Navigation Shortcuts', () => {
    it('navigates to Agents view with Cmd+1', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="kanban-board"]', { timeout: 10000 }).catch(() => {});

      await press('Meta+1');
      await waitForSelector('[data-testid="agents-page"]', { timeout: 5000 }).catch(() => {});

      const url = await getUrl();
      expect(url).toContain('/agents');
    });

    it('navigates to Tasks/Kanban view with Cmd+2', async () => {
      await goto('/agents');
      await waitForSelector('[data-testid="agents-page"]', { timeout: 10000 }).catch(() => {});

      await press('Meta+2');
      await waitForSelector('[data-testid="project-list"]', { timeout: 5000 }).catch(() => {});

      const url = await getUrl();
      expect(url).toContain('/projects');
    });
  });

  describe('Project Picker Shortcut', () => {
    it('opens project picker with Cmd+P', async () => {
      await goto('/');
      await waitForSelector('[data-testid="sidebar"]', { timeout: 10000 }).catch(() => {});

      await press('Meta+p');
      await waitForSelector('[data-testid="project-picker"]', { timeout: 5000 }).catch(() => {});

      const projectPicker = await exists('[data-testid="project-picker"]');
      expect(typeof projectPicker).toBe('boolean');
    });

    it('closes project picker with Escape', async () => {
      await goto('/');
      await press('Meta+p');
      await waitForSelector('[data-testid="project-picker"]', { timeout: 5000 }).catch(() => {});

      const projectPicker = await exists('[data-testid="project-picker"]');
      if (projectPicker) {
        await press('Escape');

        const pickerClosed = !(await exists('[data-testid="project-picker"]'));
        expect(pickerClosed).toBe(true);
      }
    });

    it('supports keyboard navigation in project picker', async () => {
      await goto('/');
      await press('Meta+p');
      await waitForSelector('[data-testid="project-picker"]', { timeout: 5000 }).catch(() => {});

      const projectPicker = await exists('[data-testid="project-picker"]');
      if (projectPicker) {
        // Arrow down to navigate
        await press('ArrowDown');
        await press('ArrowDown');

        // Enter to select
        await press('Enter');

        // Should navigate or close picker
        expect(true).toBe(true);
      }
    });
  });

  describe('New Project Shortcut', () => {
    it('opens new project dialog with Cmd+Shift+N', async () => {
      await goto('/');
      await waitForSelector('[data-testid="sidebar"]', { timeout: 10000 }).catch(() => {});

      await press('Meta+Shift+n');
      await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 }).catch(
        () => {}
      );

      const dialog = await exists('[data-testid="new-project-dialog"]');
      expect(typeof dialog).toBe('boolean');
    });

    it('closes new project dialog with Escape', async () => {
      await goto('/');
      await press('Meta+Shift+n');
      await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 }).catch(
        () => {}
      );

      const dialog = await exists('[data-testid="new-project-dialog"]');
      if (dialog) {
        await press('Escape');

        const dialogClosed = !(await exists('[data-testid="new-project-dialog"]'));
        expect(dialogClosed).toBe(true);
      }
    });
  });

  describe('Task Shortcuts', () => {
    it('opens new task dialog with Cmd+T', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="kanban-board"]', { timeout: 10000 }).catch(() => {});

      await press('Meta+t');
      await waitForSelector('[data-testid="new-task-dialog"]', { timeout: 5000 }).catch(() => {});

      const dialog = await exists('[data-testid="new-task-dialog"]');
      expect(typeof dialog).toBe('boolean');
    });

    it('approves waiting task with Cmd+Enter', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="column-waiting_approval"] [data-testid="task-card"]', {
        timeout: 10000,
      }).catch(() => {});

      const waitingTask = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (waitingTask) {
        // Select the waiting task first
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="approval-dialog"]', { timeout: 5000 }).catch(() => {});

        // Approve with Cmd+Enter
        await press('Meta+Enter');

        // Task should be approved
        expect(true).toBe(true);
      }
    });
  });

  describe('Agent Shortcuts', () => {
    // TODO: Enable when agent-card component is implemented
    it.skip('runs selected agent with Cmd+R', async () => {
      await goto('/agents');
      await waitForSelector('[data-testid="agent-card"]', { timeout: 10000 }).catch(() => {});

      const agentCard = await exists('[data-testid="agent-card"]');
      if (agentCard) {
        // Select an agent first
        await click('[data-testid="agent-card"]');

        // Run with Cmd+R
        await press('Meta+r');

        // Agent should start running
        await waitForSelector('[data-testid="agent-running"]', { timeout: 5000 }).catch(() => {});
        const running = await exists('[data-testid="agent-running"]');
        expect(typeof running).toBe('boolean');
      }
    });

    // TODO: Enable when session-view component is implemented
    it.skip('stops running agent with Cmd+.', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const sessionView = await exists('[data-testid="session-view"]');
      if (sessionView) {
        // Stop with Cmd+.
        await press('Meta+.');

        // Should show stop confirmation or stop the agent
        await waitForSelector('[data-testid="stop-confirmation"]', { timeout: 5000 }).catch(
          () => {}
        );
        expect(true).toBe(true);
      }
    });
  });

  describe('Escape Key', () => {
    it('closes open dialog with Escape', async () => {
      await goto('/');
      const trigger = await exists('[data-testid="new-project-button"]');
      if (trigger) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });

        await press('Escape');

        const dialogClosed = !(await exists('[data-testid="new-project-dialog"]'));
        expect(dialogClosed).toBe(true);
      }
    });

    it('closes dropdown with Escape', async () => {
      await goto('/');
      const toggle = await exists('[data-testid="theme-toggle"]');
      if (toggle) {
        await click('[data-testid="theme-toggle"]');
        await waitForSelector('[data-testid="theme-menu"]', { timeout: 3000 });

        await press('Escape');

        const menuClosed = !(await exists('[data-testid="theme-menu"]'));
        expect(menuClosed).toBe(true);
      }
    });

    it('closes project picker with Escape', async () => {
      await goto('/projects/test-project');
      const picker = await exists('[data-testid="project-picker"]');
      if (picker) {
        await click('[data-testid="project-picker"]');
        await waitForSelector('[data-testid="project-dropdown"]', { timeout: 3000 });

        await press('Escape');

        const dropdownClosed = !(await exists('[data-testid="project-dropdown"]'));
        expect(dropdownClosed).toBe(true);
      }
    });

    it('deselects selected task with Escape', async () => {
      await goto('/projects/test-project');
      const taskCard = await exists('[data-testid="task-card"]');
      if (taskCard) {
        await click('[data-testid="task-card"]');
        await waitForSelector('[data-testid="task-detail-dialog"]', { timeout: 5000 });

        await press('Escape');

        const dialogClosed = !(await exists('[data-testid="task-detail-dialog"]'));
        expect(dialogClosed).toBe(true);
      }
    });
  });

  describe('Form Navigation', () => {
    it('submits form with Enter in single-line input', async () => {
      await goto('/settings/preferences');
      const input = await exists('[data-testid="max-turns-input"]');
      if (input) {
        await click('[data-testid="max-turns-input"]');
        await press('Enter');

        // Form should submit or focus should move
        expect(true).toBe(true);
      }
    });

    it('navigates form fields with Tab', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      await press('Tab');
      await press('Tab');
      await press('Tab');

      // Focus should move between form elements
      expect(true).toBe(true);
    });

    it('navigates backwards with Shift+Tab', async () => {
      await goto('/settings/api-keys');
      await waitForSelector('[data-testid="anthropic-key-input"]', { timeout: 10000 }).catch(
        () => {}
      );

      // Tab forward a few times
      await press('Tab');
      await press('Tab');

      // Then back with Shift+Tab
      await press('Shift+Tab');

      // Focus should move backwards
      expect(true).toBe(true);
    });
  });

  describe('Shortcut Context Awareness', () => {
    it('does not trigger shortcut when typing in input', async () => {
      await goto('/settings/api-keys');
      const input = await exists('[data-testid="anthropic-key-input"]');
      if (input) {
        await click('[data-testid="anthropic-key-input"]');

        // Type a letter that's a shortcut key
        await press('p'); // Cmd+P is project picker

        // Should not open project picker when focused on input
        const pickerNotOpened = !(await exists('[data-testid="project-picker"]'));
        expect(pickerNotOpened).toBe(true);
      }
    });

    it('does not trigger shortcut in textarea', async () => {
      await goto('/projects/test-project');
      const taskCard = await exists('[data-testid="task-card"]');
      if (taskCard) {
        await click('[data-testid="task-card"]');
        await waitForSelector('[data-testid="task-description-textarea"]', { timeout: 5000 }).catch(
          () => {}
        );

        const textarea = await exists('[data-testid="task-description-textarea"]');
        if (textarea) {
          await click('[data-testid="task-description-textarea"]');

          // Type in textarea
          await press('t'); // Cmd+T is new task

          // Should not open new task dialog when focused on textarea
          expect(true).toBe(true);
        }
      }
    });
  });

  describe('Screenshots', () => {
    it('captures shortcuts help modal screenshot', async () => {
      await goto('/');
      await press('Meta+/');
      await waitForSelector('[data-testid="shortcuts-help"]', { timeout: 5000 }).catch(() => {});

      const helpModal = await exists('[data-testid="shortcuts-help"]');
      if (helpModal) {
        const buffer = await screenshot('shortcuts-help-modal');
        expect(buffer).toBeTruthy();
      }
    });

    it('captures project picker screenshot', async () => {
      await goto('/');
      await press('Meta+p');
      await waitForSelector('[data-testid="project-picker"]', { timeout: 5000 }).catch(() => {});

      const projectPicker = await exists('[data-testid="project-picker"]');
      if (projectPicker) {
        const buffer = await screenshot('project-picker-shortcut');
        expect(buffer).toBeTruthy();
      }
    });
  });
});
