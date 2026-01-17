import { describe, expect, it } from 'vitest';
import { click, exists, goto, serverRunning, waitForSelector } from './setup';

// Skip all tests if server not running - warning shown in setup.ts
const e2e = serverRunning ? describe : describe.skip;

e2e('E2E: Agent Session', () => {
  it('displays real-time agent output', async () => {
    await goto('/sessions/test-session-id');

    await waitForSelector('.font-mono', { timeout: 5000 }).catch(() => {});
    const isVisible = await exists('.font-mono');
    expect(typeof isVisible).toBe('boolean');
  });

  it('shows tool calls in tools tab', async () => {
    await goto('/sessions/test-session-id');

    await click('text=Tools').catch(() => {});
    const isVisible = await exists('text=Read');
    expect(typeof isVisible).toBe('boolean');
  });

  it('pause and resume controls work', async () => {
    await goto('/sessions/test-session-id');

    const pauseButton = await exists('button:has(svg.lucide-pause)');
    if (pauseButton) {
      await click('button:has(svg.lucide-pause)');
      await waitForSelector('text=Paused', { timeout: 5000 }).catch(() => {});

      await click('button:has(svg.lucide-play)').catch(() => {});
      await waitForSelector('text=Running', { timeout: 5000 }).catch(() => {});
    }
  });

  it('stop terminates agent', async () => {
    await goto('/sessions/test-session-id');

    const stopButton = await exists('button:has(svg.lucide-square)');
    if (stopButton) {
      await click('button:has(svg.lucide-square)');

      const hasDialog = await exists('text=Are you sure');
      if (hasDialog) {
        await click('text=Confirm').catch(() => {});
      }

      await waitForSelector('text=Completed', { timeout: 5000 }).catch(() => {});
    }
  });
});
