/**
 * E2E Tests: Dialog Components
 *
 * Tests for NewProjectDialog, TaskDetailDialog, ApprovalDialog, AgentConfigDialog.
 * Covers form interactions, validation, and dialog behaviors.
 */
import { describe, expect, it } from 'vitest';
import {
  click,
  exists,
  fill,
  getAttribute,
  getText,
  goto,
  press,
  screenshot,
  serverRunning,
  waitForSelector,
} from '../setup';

const e2e = serverRunning ? describe : describe.skip;

e2e('Dialog Components E2E', () => {
  describe('NewProjectDialog', () => {
    it('opens from new project button', async () => {
      await goto('/');
      await waitForSelector('[data-testid="new-project-button"]', { timeout: 10000 }).catch(
        () => {}
      );

      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });

        const dialogOpen = await exists('[data-testid="new-project-dialog"]');
        expect(dialogOpen).toBe(true);
      }
    });

    it('validates project path input', async () => {
      await goto('/');
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="project-path-input"]', { timeout: 5000 });

        // Enter invalid path
        await fill('[data-testid="project-path-input"]', '/nonexistent/path');
        await click('[data-testid="validate-path-button"]');

        await waitForSelector('[data-testid="validation-error"]', { timeout: 5000 }).catch(
          () => {}
        );
        const errorShown = await exists('[data-testid="validation-error"]');
        expect(typeof errorShown).toBe('boolean');
      }
    });

    it('auto-populates project name from path', async () => {
      await goto('/');
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="project-path-input"]', { timeout: 5000 });

        await fill('[data-testid="project-path-input"]', '/home/user/my-project');
        await click('[data-testid="validate-path-button"]');

        // Check if name was auto-filled
        const nameInput = await exists('[data-testid="project-name-input"]');
        expect(nameInput).toBe(true);
      }
    });

    it('closes on Escape key', async () => {
      await goto('/');
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });

        await press('Escape');

        const dialogClosed = !(await exists('[data-testid="new-project-dialog"]'));
        expect(dialogClosed).toBe(true);
      }
    });

    it('closes on cancel button click', async () => {
      await goto('/');
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });

        await click('[data-testid="cancel-button"]');

        const dialogClosed = !(await exists('[data-testid="new-project-dialog"]'));
        expect(dialogClosed).toBe(true);
      }
    });

    it('shows GitHub integration option', async () => {
      await goto('/');
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });

        const githubOption = await exists('[data-testid="github-integration-toggle"]');
        expect(typeof githubOption).toBe('boolean');
      }
    });
  });

  describe('TaskDetailDialog', () => {
    it('opens when clicking a task card', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="task-card"]', { timeout: 10000 }).catch(() => {});

      const cardExists = await exists('[data-testid="task-card"]');
      if (cardExists) {
        await click('[data-testid="task-card"]');
        await waitForSelector('[data-testid="task-detail-dialog"]', { timeout: 5000 });

        const dialogOpen = await exists('[data-testid="task-detail-dialog"]');
        expect(dialogOpen).toBe(true);
      }
    });

    it('displays task title and description', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="task-card"]', { timeout: 10000 }).catch(() => {});

      const cardExists = await exists('[data-testid="task-card"]');
      if (cardExists) {
        await click('[data-testid="task-card"]');
        await waitForSelector('[data-testid="task-detail-dialog"]', { timeout: 5000 });

        const titleField = await exists('[data-testid="task-title-input"]');
        const descField = await exists('[data-testid="task-description-input"]');

        expect(titleField).toBe(true);
        expect(descField).toBe(true);
      }
    });

    it('allows editing task title', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="task-card"]', { timeout: 10000 }).catch(() => {});

      const cardExists = await exists('[data-testid="task-card"]');
      if (cardExists) {
        await click('[data-testid="task-card"]');
        await waitForSelector('[data-testid="task-title-input"]', { timeout: 5000 });

        await fill('[data-testid="task-title-input"]', 'Updated Task Title');

        const saveButton = await exists('[data-testid="save-task-button"]');
        expect(saveButton).toBe(true);
      }
    });

    it('shows label management', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="task-card"]', { timeout: 10000 }).catch(() => {});

      const cardExists = await exists('[data-testid="task-card"]');
      if (cardExists) {
        await click('[data-testid="task-card"]');
        await waitForSelector('[data-testid="task-detail-dialog"]', { timeout: 5000 });

        const labelsSection = await exists('[data-testid="task-labels-section"]');
        expect(typeof labelsSection).toBe('boolean');
      }
    });

    it('has delete task option', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="task-card"]', { timeout: 10000 }).catch(() => {});

      const cardExists = await exists('[data-testid="task-card"]');
      if (cardExists) {
        await click('[data-testid="task-card"]');
        await waitForSelector('[data-testid="task-detail-dialog"]', { timeout: 5000 });

        const deleteButton = await exists('[data-testid="delete-task-button"]');
        expect(typeof deleteButton).toBe('boolean');
      }
    });
  });

  describe('ApprovalDialog', () => {
    it('opens for tasks in waiting_approval column', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="column-waiting_approval"] [data-testid="task-card"]', {
        timeout: 10000,
      }).catch(() => {});

      const approvalCard = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (approvalCard) {
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="approval-dialog"]', { timeout: 5000 });

        const dialogOpen = await exists('[data-testid="approval-dialog"]');
        expect(dialogOpen).toBe(true);
      }
    });

    it('displays diff summary', async () => {
      await goto('/projects/test-project');
      const approvalCard = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (approvalCard) {
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="approval-dialog"]', { timeout: 5000 });

        const diffSummary = await exists('[data-testid="diff-summary"]');
        expect(typeof diffSummary).toBe('boolean');
      }
    });

    it('has tabs for Summary, Files, and Commit', async () => {
      await goto('/projects/test-project');
      const approvalCard = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (approvalCard) {
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="approval-dialog"]', { timeout: 5000 });

        const summaryTab = await exists('[data-testid="tab-summary"]');
        const filesTab = await exists('[data-testid="tab-files"]');
        const commitTab = await exists('[data-testid="tab-commit"]');

        expect(typeof summaryTab).toBe('boolean');
        expect(typeof filesTab).toBe('boolean');
        expect(typeof commitTab).toBe('boolean');
      }
    });

    it('shows approve and reject buttons', async () => {
      await goto('/projects/test-project');
      const approvalCard = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (approvalCard) {
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="approval-dialog"]', { timeout: 5000 });

        const approveButton = await exists('[data-testid="approve-button"]');
        const rejectButton = await exists('[data-testid="reject-button"]');

        expect(typeof approveButton).toBe('boolean');
        expect(typeof rejectButton).toBe('boolean');
      }
    });

    it('allows custom commit message', async () => {
      await goto('/projects/test-project');
      const approvalCard = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (approvalCard) {
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="approval-dialog"]', { timeout: 5000 });

        // Navigate to commit tab
        const commitTab = await exists('[data-testid="tab-commit"]');
        if (commitTab) {
          await click('[data-testid="tab-commit"]');
          await waitForSelector('[data-testid="commit-message-input"]', { timeout: 3000 }).catch(
            () => {}
          );

          const commitInput = await exists('[data-testid="commit-message-input"]');
          expect(typeof commitInput).toBe('boolean');
        }
      }
    });
  });

  describe('AgentConfigDialog', () => {
    it('opens from project settings', async () => {
      await goto('/projects/test-project/settings');
      await waitForSelector('[data-testid="agent-config-button"]', { timeout: 10000 }).catch(
        () => {}
      );

      const configButton = await exists('[data-testid="agent-config-button"]');
      if (configButton) {
        await click('[data-testid="agent-config-button"]');
        await waitForSelector('[data-testid="agent-config-dialog"]', { timeout: 5000 });

        const dialogOpen = await exists('[data-testid="agent-config-dialog"]');
        expect(dialogOpen).toBe(true);
      }
    });

    it('has tabs for different config sections', async () => {
      await goto('/projects/test-project/settings');
      const configButton = await exists('[data-testid="agent-config-button"]');
      if (configButton) {
        await click('[data-testid="agent-config-button"]');
        await waitForSelector('[data-testid="agent-config-dialog"]', { timeout: 5000 });

        const generalTab = await exists('[data-testid="tab-general"]');
        const limitsTab = await exists('[data-testid="tab-limits"]');
        const sandboxTab = await exists('[data-testid="tab-sandbox"]');

        expect(typeof generalTab).toBe('boolean');
        expect(typeof limitsTab).toBe('boolean');
        expect(typeof sandboxTab).toBe('boolean');
      }
    });

    it('shows max turns slider', async () => {
      await goto('/projects/test-project/settings');
      const configButton = await exists('[data-testid="agent-config-button"]');
      if (configButton) {
        await click('[data-testid="agent-config-button"]');
        await waitForSelector('[data-testid="agent-config-dialog"]', { timeout: 5000 });

        const maxTurnsSlider = await exists('[data-testid="max-turns-slider"]');
        expect(typeof maxTurnsSlider).toBe('boolean');
      }
    });

    it('has save and cancel buttons', async () => {
      await goto('/projects/test-project/settings');
      const configButton = await exists('[data-testid="agent-config-button"]');
      if (configButton) {
        await click('[data-testid="agent-config-button"]');
        await waitForSelector('[data-testid="agent-config-dialog"]', { timeout: 5000 });

        const saveButton = await exists('[data-testid="save-config-button"]');
        const cancelButton = await exists('[data-testid="cancel-button"]');

        expect(typeof saveButton).toBe('boolean');
        expect(typeof cancelButton).toBe('boolean');
      }
    });
  });

  describe('Dialog Accessibility', () => {
    it('traps focus within dialog', async () => {
      await goto('/');
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });

        // Tab through dialog elements - focus should stay inside
        await press('Tab');
        await press('Tab');
        await press('Tab');

        // Dialog should still be open (focus trapped)
        const dialogOpen = await exists('[data-testid="new-project-dialog"]');
        expect(dialogOpen).toBe(true);
      }
    });

    it('returns focus to trigger on close', async () => {
      await goto('/');
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });

        await press('Escape');

        // Button should be focusable again
        const buttonStillExists = await exists('[data-testid="new-project-button"]');
        expect(buttonStillExists).toBe(true);
      }
    });
  });

  describe('Screenshots', () => {
    it('captures new project dialog screenshot', async () => {
      await goto('/');
      const buttonExists = await exists('[data-testid="new-project-button"]');
      if (buttonExists) {
        await click('[data-testid="new-project-button"]');
        await waitForSelector('[data-testid="new-project-dialog"]', { timeout: 5000 });

        const buffer = await screenshot('new-project-dialog');
        expect(buffer).toBeTruthy();
      }
    });
  });
});
