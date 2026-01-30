import fsp from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { AgentPaneClient } from './agentpane-client.js';
import { printError, printStatusBox } from './display.js';
import { SessionStore } from './session-store.js';
import { createId } from './utils.js';
import { VERSION } from './version.js';
import { FileWatcher } from './watcher.js';

// ── PID Lock ──

const LOCK_FILE = path.join(homedir(), '.claude', '.cli-monitor.lock');

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireLock(): Promise<boolean> {
  try {
    try {
      const content = await fsp.readFile(LOCK_FILE, 'utf-8');
      const pid = parseInt(content, 10);
      if (pid && isProcessRunning(pid)) {
        return false; // Another daemon is running
      }
    } catch {
      // No lock file exists
    }
    await fsp.mkdir(path.dirname(LOCK_FILE), { recursive: true });
    await fsp.writeFile(LOCK_FILE, String(process.pid));
    return true;
  } catch {
    return false;
  }
}

async function releaseLock(): Promise<void> {
  try {
    await fsp.unlink(LOCK_FILE);
  } catch {
    /* ok */
  }
}

export { LOCK_FILE, acquireLock, releaseLock, isProcessRunning };

export interface DaemonOptions {
  port: number;
  watchPath?: string;
  background?: boolean;
}

export async function startDaemon(options: DaemonOptions): Promise<void> {
  const daemonId = `dm_${createId()}`;
  const watchDir = options.watchPath || path.join(homedir(), '.claude', 'projects');
  const client = new AgentPaneClient(options.port);
  const store = new SessionStore();
  let watcher: FileWatcher | null = null;
  let ingestTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let isShuttingDown = false;

  // Graceful shutdown
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\nShutting down...');

    if (ingestTimer) clearInterval(ingestTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (watcher) watcher.close();

    try {
      await client.deregister(daemonId);
    } catch (err) {
      console.error(
        '[Daemon] Deregister on shutdown failed:',
        err instanceof Error ? err.message : err
      );
    }
    await releaseLock();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('uncaughtException', (error) => {
    console.error('[Daemon] Uncaught exception:', error);
    shutdown();
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Daemon] Unhandled rejection:', reason);
  });

  // Acquire PID lock
  const lockAcquired = await acquireLock();
  if (!lockAcquired) {
    console.error('[Daemon] Another daemon instance is already running. Exiting.');
    process.exit(1);
  }

  // Connect to AgentPane with retry
  let connected = false;
  let retryDelay = 1000;
  const maxRetryDelay = 30000;

  while (!connected && !isShuttingDown) {
    try {
      await client.register({
        daemonId,
        pid: process.pid,
        version: VERSION,
        watchPath: watchDir,
        capabilities: ['watch', 'parse', 'subagents'],
        startedAt: Date.now(),
      });
      connected = true;
      retryDelay = 1000; // Reset on success
    } catch {
      printError(
        `Could not connect to AgentPane at localhost:${options.port}. Retrying in ${retryDelay / 1000}s...`
      );
      await new Promise((r) => setTimeout(r, retryDelay));
      retryDelay = Math.min(retryDelay * 2, maxRetryDelay);
    }
  }

  if (isShuttingDown) return;

  // Start file watcher
  watcher = new FileWatcher(watchDir, store);
  await watcher.start();

  // Print status
  const fileCount = store.getSessionCount();
  printStatusBox({
    version: VERSION,
    serverUrl: `http://localhost:${options.port}`,
    watchPath: watchDir,
    sessionCount: fileCount,
  });

  // Heartbeat every 10s
  heartbeatTimer = setInterval(async () => {
    try {
      await client.heartbeat(daemonId, store.getSessionCount());
    } catch (err) {
      console.error('[Daemon] Heartbeat failed:', err instanceof Error ? err.message : err);
      // Server may have restarted — try to re-register
      try {
        await client.register({
          daemonId,
          pid: process.pid,
          version: VERSION,
          watchPath: watchDir,
          capabilities: ['watch', 'parse', 'subagents'],
          startedAt: Date.now(),
        });
      } catch (retryErr) {
        console.error(
          '[Daemon] Re-register failed:',
          retryErr instanceof Error ? retryErr.message : retryErr
        );
      }
    }
  }, 10_000);

  // Ingest batch every 500ms
  let ingestInFlight = false;
  let idleCheckCounter = 0;

  ingestTimer = setInterval(async () => {
    // D5: Idle check every 30s (60 * 500ms)
    idleCheckCounter++;
    if (idleCheckCounter >= 60) {
      idleCheckCounter = 0;
      store.markIdleSessions(5 * 60 * 1000);
    }

    if (ingestInFlight) return;
    const { updated, removed } = store.flushChanges();
    if (updated.length === 0 && removed.length === 0) return;

    ingestInFlight = true;
    try {
      await client.ingest(daemonId, updated, removed);
    } catch (err) {
      console.error('[Daemon] Ingest failed:', err instanceof Error ? err.message : err);
      store.markPendingRetry(updated, removed);
    } finally {
      ingestInFlight = false;
    }
  }, 500);
}
