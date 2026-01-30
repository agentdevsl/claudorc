import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { AgentPaneClient } from './agentpane-client.js';
import { printError, printStatusBox } from './display.js';
import { logger } from './logger.js';
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
  // Fork to background if --daemon flag is set
  if (options.background) {
    const childArgs = ['start', '--port', String(options.port)];
    if (options.watchPath) childArgs.push('--path', options.watchPath);
    const scriptPath = process.argv[1] ?? '';
    const child = spawn(process.execPath, [scriptPath, ...childArgs], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    console.log(`Daemon started in background (PID ${child.pid}).`);
    return;
  }

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
    logger.info('Shutting down...');

    if (ingestTimer) clearInterval(ingestTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (watcher) watcher.close();

    try {
      await client.deregister(daemonId);
    } catch (err) {
      logger.error('Deregister on shutdown failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await releaseLock();
    process.exit(0);
  };

  // Signal handlers must handle the async shutdown properly.
  // Use a forced exit timeout to prevent hanging if cleanup stalls.
  const handleSignal = () => {
    shutdown().finally(() => {
      // shutdown() calls process.exit(0) on success,
      // but if it somehow doesn't exit, force it after 5s
    });
    setTimeout(() => {
      logger.error('Forced exit after shutdown timeout');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
  process.on('SIGHUP', handleSignal);

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: String(error) });
    handleSignal();
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { error: String(reason) });
    handleSignal();
  });

  // Acquire PID lock
  const lockAcquired = await acquireLock();
  if (!lockAcquired) {
    logger.error('Another daemon instance is already running. Exiting.');
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

  // Heartbeat every 10s (unref to not block exit)
  heartbeatTimer = setInterval(async () => {
    try {
      await client.heartbeat(daemonId, store.getSessionCount());
    } catch (err) {
      logger.error('Heartbeat failed', { error: err instanceof Error ? err.message : String(err) });
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
        logger.error('Re-register failed', {
          error: retryErr instanceof Error ? retryErr.message : String(retryErr),
        });
      }
    }
  }, 10_000);
  if (heartbeatTimer.unref) heartbeatTimer.unref();

  // Ingest batch every 500ms
  let ingestInFlight = false;
  let idleCheckCounter = 0;

  ingestTimer = setInterval(async () => {
    // D5: Idle check every 30s (60 * 500ms)
    idleCheckCounter++;
    if (idleCheckCounter >= 60) {
      idleCheckCounter = 0;
      store.markIdleSessions(5 * 60 * 1000);
      const evicted = store.evictIdleSessions(30 * 60 * 1000);
      if (evicted > 0) logger.info('Evicted idle sessions', { count: evicted });
    }

    if (ingestInFlight) return;
    const { updated, removed } = store.flushChanges();
    if (updated.length === 0 && removed.length === 0) return;

    ingestInFlight = true;
    try {
      await client.ingest(daemonId, updated, removed);
    } catch (err) {
      logger.error('Ingest failed', { error: err instanceof Error ? err.message : String(err) });
      store.markPendingRetry(updated, removed);
    } finally {
      ingestInFlight = false;
    }
  }, 500);
  if (ingestTimer.unref) ingestTimer.unref();
}
