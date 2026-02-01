#!/usr/bin/env node

import fsp from 'node:fs/promises';
import { isProcessRunning, LOCK_FILE, releaseLock, startDaemon } from './daemon.js';
import { VERSION } from './version.js';

const args = process.argv.slice(2);
const command = args[0] || 'start';

// Parse flags
const flags: Record<string, string | boolean> = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg?.startsWith('--')) {
    const key = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
}

if (flags.help || command === 'help') {
  printUsage();
  process.exit(0);
}

if (flags.version) {
  console.log(VERSION);
  process.exit(0);
}

const port = typeof flags.port === 'string' ? parseInt(flags.port, 10) : 3001;
const watchPath = typeof flags.path === 'string' ? flags.path : undefined;
const retentionDays =
  typeof flags.retention === 'string' ? parseInt(flags.retention, 10) : undefined;

switch (command) {
  case 'start':
    await startDaemon({ port, watchPath, background: flags.daemon === true, retentionDays });
    break;
  case 'stop':
    await stopDaemon(port);
    break;
  case 'status':
    await showStatus(port);
    break;
  case 'version':
    console.log(VERSION);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}

function printUsage() {
  console.log(`
  Usage: cli-monitor [command] [options]

  Commands:
    start          Start the monitor daemon (default)
    stop           Stop a running daemon
    status         Show daemon status
    version        Print version and exit

  Options:
    --port <n>       AgentPane server port (default: 3001)
    --path <dir>     Custom watch path (default: ~/.claude/projects/)
    --retention <n>  Session retention in days (default: 7)
    --daemon         Run in background (detached)
  `);
}

async function stopDaemon(serverPort: number) {
  try {
    const res = await fetch(`http://localhost:${serverPort}/api/cli-monitor/status`);
    const json: unknown = await res.json();
    const data =
      typeof json === 'object' && json !== null && 'data' in json
        ? (json as { data?: { daemon?: { daemonId?: string } } })
        : undefined;
    if (data?.data?.daemon?.daemonId) {
      await fetch(`http://localhost:${serverPort}/api/cli-monitor/deregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daemonId: data.data.daemon.daemonId }),
      });
      console.log('Daemon stopped.');
      return;
    }
  } catch {
    // Server unreachable — try PID lock file fallback
  }

  // Fallback: read PID from lock file and send SIGTERM
  try {
    const content = await fsp.readFile(LOCK_FILE, 'utf-8');
    const pid = parseInt(content, 10);
    if (pid && isProcessRunning(pid)) {
      process.kill(pid, 'SIGTERM');
      await releaseLock();
      console.log(`Daemon stopped (PID ${pid}).`);
      return;
    }
  } catch {
    // No lock file
  }

  console.log('No daemon is running.');
}

async function showStatus(serverPort: number) {
  try {
    const res = await fetch(`http://localhost:${serverPort}/api/cli-monitor/status`);
    const data = (await res.json()) as {
      data?: { connected?: boolean; daemon?: unknown; sessionCount?: number };
    };
    if (data.data?.connected) {
      console.log(`Daemon connected. ${data.data.sessionCount} active sessions.`);
    } else {
      console.log('No daemon connected.');
    }
  } catch {
    console.log('Could not connect to AgentPane server.');
  }
}
