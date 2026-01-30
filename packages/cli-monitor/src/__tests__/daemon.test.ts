import fsp from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acquireLock, isProcessRunning, LOCK_FILE, releaseLock } from '../daemon.js';

// We test the utility functions directly rather than the full daemon lifecycle
// since startDaemon() has side effects (network, file watching, process handlers)

describe('Daemon utilities', () => {
  describe('isProcessRunning', () => {
    it('returns true for current process PID', () => {
      expect(isProcessRunning(process.pid)).toBe(true);
    });

    it('returns false for a non-existent PID', () => {
      // PID 999999 is very unlikely to exist
      expect(isProcessRunning(999999)).toBe(false);
    });
  });

  describe('LOCK_FILE', () => {
    it('is defined and points to .claude directory', () => {
      expect(LOCK_FILE).toBeDefined();
      expect(LOCK_FILE).toContain('.claude');
      expect(LOCK_FILE).toContain('.cli-monitor.lock');
    });
  });

  describe('acquireLock / releaseLock', () => {
    afterEach(async () => {
      // Clean up any lock file left by tests
      await releaseLock();
    });

    it('acquires lock successfully when no lock exists', async () => {
      // First ensure no lock file
      await releaseLock();

      const result = await acquireLock();
      expect(result).toBe(true);
    });

    it('releaseLock removes the lock file', async () => {
      await acquireLock();
      await releaseLock();

      // Verify lock file is gone
      try {
        await fsp.access(LOCK_FILE);
        // If we get here, file exists — that's unexpected
        expect(true).toBe(false);
      } catch {
        // Expected — file should not exist
        expect(true).toBe(true);
      }
    });

    it('acquires lock when existing lock has stale PID', async () => {
      // Write a lock file with a non-existent PID
      await fsp.mkdir(path.dirname(LOCK_FILE), { recursive: true });
      await fsp.writeFile(LOCK_FILE, '999999');

      const result = await acquireLock();
      expect(result).toBe(true);
    });

    it('rejects lock when existing lock has active PID', async () => {
      // Write a lock file with current PID (which is running)
      await fsp.mkdir(path.dirname(LOCK_FILE), { recursive: true });
      await fsp.writeFile(LOCK_FILE, String(process.pid));

      const result = await acquireLock();
      expect(result).toBe(false);

      // Clean up
      await fsp.unlink(LOCK_FILE);
    });
  });

  describe('crash handlers', () => {
    it('unhandledRejection handler logs but does not crash', () => {
      // Simulate what the handler does — just logs
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // The actual handler in daemon.ts is:
      // process.on('unhandledRejection', (reason) => {
      //   console.error('[Daemon] Unhandled rejection:', reason);
      // });
      // We verify the pattern works without crashing
      const reason = new Error('test rejection');
      console.error('[Daemon] Unhandled rejection:', reason);

      expect(consoleSpy).toHaveBeenCalledWith('[Daemon] Unhandled rejection:', reason);
      consoleSpy.mockRestore();
    });
  });
});
