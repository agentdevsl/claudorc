import type { CliSession, DaemonInfo, DaemonRegisterPayload } from './types.js';
import { DAEMON_TIMEOUT_MS } from './types.js';

// DurableStreamsServer interface (from session.service.ts)
interface StreamsServer {
  publish(id: string, type: string, data: unknown): Promise<number>;
  addRealtimeSubscriber(
    id: string,
    callback: (event: { type: string; data: unknown; offset: number }) => void
  ): () => void;
  getEvents(id: string): Array<{ type: string; data: unknown; offset: number; timestamp: number }>;
}

const CLI_MONITOR_STREAM_ID = 'cli-monitor';

export class CliMonitorService {
  private static readonly MAX_SESSIONS = 10_000;

  private sessions = new Map<string, CliSession>();
  private daemon: DaemonInfo | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private streamsServer: StreamsServer) {}

  // ── Daemon Registration ──

  registerDaemon(payload: DaemonRegisterPayload): void {
    // If a different daemon was connected, clear it
    if (this.daemon && this.daemon.daemonId !== payload.daemonId) {
      console.log(`[CliMonitor] Replacing daemon ${this.daemon.daemonId} with ${payload.daemonId}`);
      this.sessions.clear();
    }

    this.daemon = {
      daemonId: payload.daemonId,
      pid: payload.pid,
      version: payload.version,
      watchPath: payload.watchPath,
      capabilities: payload.capabilities,
      registeredAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    };

    this.startHeartbeatCheck();
    this.publish('cli-monitor:daemon-connected', { daemon: this.daemon });
    console.log(
      `[CliMonitor] Daemon registered: ${payload.daemonId} (PID ${payload.pid}, v${payload.version})`
    );
  }

  handleHeartbeat(daemonId: string, _sessionCount: number): boolean {
    if (this.daemon?.daemonId !== daemonId) {
      return false;
    }
    this.daemon.lastHeartbeatAt = Date.now();
    return true;
  }

  deregisterDaemon(daemonId: string): boolean {
    if (this.daemon?.daemonId !== daemonId) {
      return false;
    }
    const id = this.daemon.daemonId;
    this.daemon = null;
    this.sessions.clear();
    this.stopHeartbeatCheck();
    this.publish('cli-monitor:daemon-disconnected', {});
    console.log(`[CliMonitor] Daemon deregistered: ${id}`);
    return true;
  }

  // ── Session Ingestion (from daemon) ──

  ingestSessions(daemonId: string, sessions: CliSession[], removedIds: string[]): boolean {
    if (this.daemon?.daemonId !== daemonId) {
      return false;
    }

    // Evict oldest sessions if adding would exceed limit
    const newSessionCount = sessions.filter((s) => !this.sessions.has(s.sessionId)).length;
    if (this.sessions.size + newSessionCount > CliMonitorService.MAX_SESSIONS) {
      const sorted = Array.from(this.sessions.entries()).sort(
        (a, b) => a[1].lastActivityAt - b[1].lastActivityAt
      );
      const toEvict = this.sessions.size + newSessionCount - CliMonitorService.MAX_SESSIONS;
      for (let i = 0; i < toEvict && i < sorted.length; i++) {
        const entry = sorted[i];
        if (!entry) continue;
        const [id] = entry;
        this.sessions.delete(id);
        this.publish('cli-monitor:session-removed', { sessionId: id });
      }
    }

    for (const session of sessions) {
      const existing = this.sessions.get(session.sessionId);
      const previousStatus = existing?.status;
      this.sessions.set(session.sessionId, session);

      // Publish update
      this.publish('cli-monitor:session-update', {
        session,
        previousStatus,
      });

      // Publish status change event (for alerts)
      if (previousStatus && previousStatus !== session.status) {
        this.publish('cli-monitor:status-change', {
          sessionId: session.sessionId,
          previousStatus,
          newStatus: session.status,
          timestamp: Date.now(),
        });
      }
    }

    for (const id of removedIds) {
      if (this.sessions.has(id)) {
        this.sessions.delete(id);
        this.publish('cli-monitor:session-removed', { sessionId: id });
      }
    }

    return true;
  }

  // ── Queries ──

  isDaemonConnected(): boolean {
    return this.daemon !== null;
  }

  getDaemon(): DaemonInfo | null {
    return this.daemon;
  }

  getSessions(): CliSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getStatus(): {
    connected: boolean;
    daemon: DaemonInfo | null;
    sessionCount: number;
  } {
    return {
      connected: this.daemon !== null,
      daemon: this.daemon,
      sessionCount: this.sessions.size,
    };
  }

  // ── SSE Subscription ──

  addRealtimeSubscriber(
    callback: (event: { type: string; data: unknown; offset: number }) => void
  ): () => void {
    return this.streamsServer.addRealtimeSubscriber(CLI_MONITOR_STREAM_ID, callback);
  }

  // ── Cleanup ──

  destroy(): void {
    this.stopHeartbeatCheck();
    this.sessions.clear();
    this.daemon = null;
  }

  // ── Internal ──

  private publish(type: string, data: unknown): void {
    this.streamsServer.publish(CLI_MONITOR_STREAM_ID, type, data).catch((publishErr) => {
      console.error(
        `[CliMonitor] Failed to publish ${type}:`,
        publishErr instanceof Error ? publishErr.message : String(publishErr)
      );
    });
  }

  private startHeartbeatCheck(): void {
    this.stopHeartbeatCheck();
    this.heartbeatTimer = setInterval(() => {
      if (this.daemon && Date.now() - this.daemon.lastHeartbeatAt > DAEMON_TIMEOUT_MS) {
        console.warn(
          `[CliMonitor] Daemon heartbeat timeout (${DAEMON_TIMEOUT_MS}ms), marking disconnected`
        );
        this.deregisterDaemon(this.daemon.daemonId);
      }
    }, 10_000);
  }

  private stopHeartbeatCheck(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
