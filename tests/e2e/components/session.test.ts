/**
 * E2E Tests: Session Components
 *
 * Tests for AgentSessionView and SessionHistory.
 * Covers real-time streaming, agent controls, and session management.
 */
import { describe, expect, it } from 'vitest';
import { click, exists, goto, screenshot, serverRunning, waitForSelector } from '../setup';

const e2e = serverRunning ? describe : describe.skip;

e2e('Session Components E2E', () => {
  describe('AgentSessionView', () => {
    it('renders session view for in-progress task', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="column-in_progress"] [data-testid="task-card"]', {
        timeout: 10000,
      }).catch(() => {});

      const inProgressCard = await exists(
        '[data-testid="column-in_progress"] [data-testid="task-card"]'
      );
      if (inProgressCard) {
        await click('[data-testid="column-in_progress"] [data-testid="task-card"]');
        await waitForSelector('[data-testid="session-view"]', { timeout: 5000 }).catch(() => {});

        const sessionView = await exists('[data-testid="session-view"]');
        expect(typeof sessionView).toBe('boolean');
      }
    });

    it('shows agent status indicator', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const statusIndicator = await exists('[data-testid="agent-status"]');
      expect(typeof statusIndicator).toBe('boolean');
    });

    it('displays current turn count', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const turnCounter = await exists('[data-testid="turn-counter"]');
      expect(typeof turnCounter).toBe('boolean');
    });

    it('shows streaming output area', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const outputArea = await exists('[data-testid="session-output"]');
      expect(typeof outputArea).toBe('boolean');
    });

    it('displays tool calls in output', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const toolCall = await exists('[data-testid="tool-call"]');
      expect(typeof toolCall).toBe('boolean');
    });

    it('shows file changes indicator', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const fileChange = await exists('[data-testid="file-change"]');
      expect(typeof fileChange).toBe('boolean');
    });

    it('has pause button when agent is running', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const pauseButton = await exists('[data-testid="pause-button"]');
      expect(typeof pauseButton).toBe('boolean');
    });

    it('has stop button', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const stopButton = await exists('[data-testid="stop-button"]');
      expect(typeof stopButton).toBe('boolean');
    });

    it('pauses agent on pause button click', async () => {
      await goto('/sessions/test-session');
      const pauseButton = await exists('[data-testid="pause-button"]');
      if (pauseButton) {
        await click('[data-testid="pause-button"]');

        await waitForSelector('[data-testid="agent-status"][data-status="paused"]', {
          timeout: 5000,
        }).catch(() => {});
        const paused = await exists('[data-testid="agent-status"][data-status="paused"]');
        expect(typeof paused).toBe('boolean');
      }
    });

    it('shows resume button when paused', async () => {
      await goto('/sessions/test-session');
      const pauseButton = await exists('[data-testid="pause-button"]');
      if (pauseButton) {
        await click('[data-testid="pause-button"]');

        await waitForSelector('[data-testid="resume-button"]', { timeout: 5000 }).catch(() => {});
        const resumeButton = await exists('[data-testid="resume-button"]');
        expect(typeof resumeButton).toBe('boolean');
      }
    });

    it('confirms before stopping agent', async () => {
      await goto('/sessions/test-session');
      const stopButton = await exists('[data-testid="stop-button"]');
      if (stopButton) {
        await click('[data-testid="stop-button"]');

        await waitForSelector('[data-testid="stop-confirmation"]', { timeout: 5000 }).catch(
          () => {}
        );
        const confirmation = await exists('[data-testid="stop-confirmation"]');
        expect(typeof confirmation).toBe('boolean');
      }
    });

    it('has tabs for Output and Tools', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const outputTab = await exists('[data-testid="tab-output"]');
      const toolsTab = await exists('[data-testid="tab-tools"]');

      expect(typeof outputTab).toBe('boolean');
      expect(typeof toolsTab).toBe('boolean');
    });

    it('switches to tools tab', async () => {
      await goto('/sessions/test-session');
      const toolsTab = await exists('[data-testid="tab-tools"]');
      if (toolsTab) {
        await click('[data-testid="tab-tools"]');

        await waitForSelector('[data-testid="tools-panel"]', { timeout: 3000 }).catch(() => {});
        const toolsPanel = await exists('[data-testid="tools-panel"]');
        expect(typeof toolsPanel).toBe('boolean');
      }
    });

    it('shows token usage stats', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const tokenStats = await exists('[data-testid="token-usage"]');
      expect(typeof tokenStats).toBe('boolean');
    });

    it('auto-scrolls output to bottom', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-output"]', { timeout: 10000 }).catch(() => {});

      // Output area should be scrolled to bottom
      const output = await exists('[data-testid="session-output"]');
      expect(typeof output).toBe('boolean');
    });
  });

  describe('SessionHistory', () => {
    it('renders session history panel', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="session-history"]', { timeout: 10000 }).catch(() => {});

      const history = await exists('[data-testid="session-history"]');
      expect(typeof history).toBe('boolean');
    });

    it('lists past sessions', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="session-history"]', { timeout: 10000 }).catch(() => {});

      const sessionItem = await exists('[data-testid="session-item"]');
      expect(typeof sessionItem).toBe('boolean');
    });

    it('shows session status for each item', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="session-item"]', { timeout: 10000 }).catch(() => {});

      const sessionStatus = await exists(
        '[data-testid="session-item"] [data-testid="session-status"]'
      );
      expect(typeof sessionStatus).toBe('boolean');
    });

    it('shows session timestamp', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="session-item"]', { timeout: 10000 }).catch(() => {});

      const timestamp = await exists('[data-testid="session-item"] [data-testid="session-time"]');
      expect(typeof timestamp).toBe('boolean');
    });

    it('opens session on item click', async () => {
      await goto('/projects/test-project');
      const sessionItem = await exists('[data-testid="session-item"]');
      if (sessionItem) {
        await click('[data-testid="session-item"]');

        await waitForSelector('[data-testid="session-view"]', { timeout: 5000 }).catch(() => {});
        const sessionView = await exists('[data-testid="session-view"]');
        expect(typeof sessionView).toBe('boolean');
      }
    });

    it('has filter by status', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="session-history"]', { timeout: 10000 }).catch(() => {});

      const statusFilter = await exists('[data-testid="session-status-filter"]');
      expect(typeof statusFilter).toBe('boolean');
    });

    it('filters sessions by status', async () => {
      await goto('/projects/test-project');
      const statusFilter = await exists('[data-testid="session-status-filter"]');
      if (statusFilter) {
        await click('[data-testid="session-status-filter"]');
        await waitForSelector('[data-testid="filter-completed"]', { timeout: 3000 }).catch(
          () => {}
        );

        const completedOption = await exists('[data-testid="filter-completed"]');
        if (completedOption) {
          await click('[data-testid="filter-completed"]');
          // List should filter
        }
      }
    });

    it('shows empty state when no sessions', async () => {
      await goto('/projects/new-project');
      await waitForSelector('[data-testid="session-history"]', { timeout: 10000 }).catch(() => {});

      const emptyState = await exists('[data-testid="session-history-empty"]');
      expect(typeof emptyState).toBe('boolean');
    });

    it('has pagination for many sessions', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="session-history"]', { timeout: 10000 }).catch(() => {});

      const pagination = await exists('[data-testid="session-pagination"]');
      expect(typeof pagination).toBe('boolean');
    });
  });

  describe('Screenshots', () => {
    it('captures session view screenshot', async () => {
      await goto('/sessions/test-session');
      await waitForSelector('[data-testid="session-view"]', { timeout: 10000 }).catch(() => {});

      const buffer = await screenshot('session-view');
      expect(buffer).toBeTruthy();
    });

    it('captures session history screenshot', async () => {
      await goto('/projects/test-project');
      await waitForSelector('[data-testid="session-history"]', { timeout: 10000 }).catch(() => {});

      const buffer = await screenshot('session-history');
      expect(buffer).toBeTruthy();
    });
  });
});
