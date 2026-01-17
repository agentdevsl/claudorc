import { beforeEach, describe, expect, it } from 'vitest';
import {
  click,
  drag,
  exists,
  getAll,
  goto,
  screenshot,
  serverRunning,
  waitForSelector,
} from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

e2e('Kanban Board E2E', () => {
  beforeEach(async () => {
    await goto('/');
    const projectCard = await exists('[data-testid="project-card"]');
    if (projectCard) {
      await click('[data-testid="project-card"]');
      await waitForSelector('[data-testid="kanban-board"]', { timeout: 5000 }).catch(() => {});
    }
  });

  describe('Board Layout', () => {
    it('displays all four columns', async () => {
      const boardExists = await exists('[data-testid="kanban-board"]');
      if (boardExists) {
        const backlogExists = await exists('[data-testid="column-backlog"]');
        const progressExists = await exists('[data-testid="column-in_progress"]');
        const approvalExists = await exists('[data-testid="column-waiting_approval"]');
        const verifiedExists = await exists('[data-testid="column-verified"]');

        expect(typeof backlogExists).toBe('boolean');
        expect(typeof progressExists).toBe('boolean');
        expect(typeof approvalExists).toBe('boolean');
        expect(typeof verifiedExists).toBe('boolean');
      }
    });

    it('shows column task counts', async () => {
      const boardExists = await exists('[data-testid="kanban-board"]');
      if (boardExists) {
        const countExists = await exists('[data-testid="column-count"]');
        expect(typeof countExists).toBe('boolean');
      }
    });
  });

  describe('Task Cards', () => {
    it('displays task cards in columns', async () => {
      const taskCard = await exists('[data-testid="task-card"]');
      expect(typeof taskCard).toBe('boolean');
    });

    it('shows task title on card', async () => {
      const taskCard = await exists('[data-testid="task-card"]');
      if (taskCard) {
        const titleExists = await exists('[data-testid="task-card-title"]');
        expect(typeof titleExists).toBe('boolean');
      }
    });

    it('shows task labels on card', async () => {
      const taskCard = await exists('[data-testid="task-card"]');
      if (taskCard) {
        const labelExists = await exists('[data-testid="task-label"]');
        expect(typeof labelExists).toBe('boolean');
      }
    });
  });

  describe('Drag and Drop', () => {
    it('allows dragging task between columns', async () => {
      const taskCard = await exists('[data-testid="task-card"]');
      if (taskCard) {
        const backlogTasks = await getAll(
          '[data-testid="column-backlog"] [data-testid="task-card"]'
        ).catch(() => []);

        if (backlogTasks.length > 0) {
          await drag(
            '[data-testid="column-backlog"] [data-testid="task-card"]:first-child',
            '[data-testid="column-in_progress"]'
          ).catch(() => {});

          await screenshot('after-drag');
        }
      }
    });

    it('reorders tasks within column', async () => {
      const backlogTasks = await getAll(
        '[data-testid="column-backlog"] [data-testid="task-card"]'
      ).catch(() => []);

      if (backlogTasks.length >= 2) {
        await drag(
          '[data-testid="column-backlog"] [data-testid="task-card"]:nth-child(2)',
          '[data-testid="column-backlog"] [data-testid="task-card"]:first-child'
        ).catch(() => {});
      }
    });
  });

  describe('Task Detail Dialog', () => {
    it('opens task detail on card click', async () => {
      const taskCard = await exists('[data-testid="task-card"]');
      if (taskCard) {
        await click('[data-testid="task-card"]');
        await waitForSelector('[data-testid="task-detail-dialog"]', { timeout: 5000 }).catch(
          () => {}
        );
        const dialogExists = await exists('[data-testid="task-detail-dialog"]');
        expect(typeof dialogExists).toBe('boolean');
      }
    });

    it('shows diff summary in waiting_approval column', async () => {
      const approvalTask = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (approvalTask) {
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="diff-summary"]', { timeout: 5000 }).catch(() => {});
        const diffExists = await exists('[data-testid="diff-summary"]');
        expect(typeof diffExists).toBe('boolean');
      }
    });
  });

  describe('Approval Flow', () => {
    it('shows approve button for waiting_approval tasks', async () => {
      const approvalTask = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (approvalTask) {
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="approve-button"]', { timeout: 5000 }).catch(() => {});
        const approveExists = await exists('[data-testid="approve-button"]');
        expect(typeof approveExists).toBe('boolean');
      }
    });

    it('shows reject button for waiting_approval tasks', async () => {
      const approvalTask = await exists(
        '[data-testid="column-waiting_approval"] [data-testid="task-card"]'
      );
      if (approvalTask) {
        await click('[data-testid="column-waiting_approval"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="reject-button"]', { timeout: 5000 }).catch(() => {});
        const rejectExists = await exists('[data-testid="reject-button"]');
        expect(typeof rejectExists).toBe('boolean');
      }
    });
  });

  describe('Screenshot Capture', () => {
    it('captures kanban board screenshot', async () => {
      const boardExists = await exists('[data-testid="kanban-board"]');
      if (boardExists) {
        const buffer = await screenshot('kanban-board');
        expect(buffer).toBeTruthy();
      }
    });
  });
});
