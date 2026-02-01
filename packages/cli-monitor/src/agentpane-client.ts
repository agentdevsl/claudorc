import { logger } from './logger.js';

export interface RegisterPayload {
  daemonId: string;
  pid: number;
  version: string;
  watchPath: string;
  capabilities: string[];
  startedAt: number;
}

// ── Circuit Breaker ──

type CircuitState = 'closed' | 'open' | 'half-open';

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT_MS = 60_000;

export class AgentPaneClient {
  private baseUrl: string;

  // Circuit breaker state
  private circuitState: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private circuitOpenedAt = 0;

  constructor(port: number) {
    this.baseUrl = `http://localhost:${port}`;
  }

  /** Exposed for testing */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  private checkCircuit(): void {
    if (this.circuitState === 'open') {
      if (Date.now() - this.circuitOpenedAt >= CIRCUIT_RESET_TIMEOUT_MS) {
        this.circuitState = 'half-open';
      } else {
        throw new Error('Circuit breaker is open — requests blocked');
      }
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitState = 'closed';
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      this.circuitState = 'open';
      this.circuitOpenedAt = Date.now();
      logger.error('Circuit breaker opened', {
        consecutiveFailures: CIRCUIT_FAILURE_THRESHOLD,
      });
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs = 10_000
  ): Promise<Response> {
    this.checkCircuit();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      this.recordSuccess();
      return res;
    } catch (err) {
      this.recordFailure();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private async postJson(path: string, body: unknown): Promise<Response> {
    return this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async readErrorDetail(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return '';
    }
  }

  async register(payload: RegisterPayload): Promise<void> {
    const res = await this.postJson('/api/cli-monitor/register', payload);
    if (!res.ok) {
      const detail = await this.readErrorDetail(res);
      throw new Error(`Registration failed: ${res.status}${detail ? ` — ${detail}` : ''}`);
    }
  }

  async heartbeat(daemonId: string, sessionCount: number): Promise<'ok' | 'reregister'> {
    const res = await this.postJson('/api/cli-monitor/heartbeat', { daemonId, sessionCount });
    if (res.ok) return 'ok';
    if (res.status === 409) return 'reregister';
    throw new Error(`Heartbeat failed: ${res.status}`);
  }

  async ingest(daemonId: string, sessions: unknown[], removedSessionIds: string[]): Promise<void> {
    const res = await this.postJson('/api/cli-monitor/ingest', {
      daemonId,
      sessions,
      removedSessionIds,
    });
    if (!res.ok) {
      const detail = await this.readErrorDetail(res);
      throw new Error(`Ingest failed: ${res.status}${detail ? ` — ${detail}` : ''}`);
    }
  }

  async deregister(daemonId: string): Promise<void> {
    const res = await this.postJson('/api/cli-monitor/deregister', { daemonId });
    if (!res.ok) {
      throw new Error(`Deregister failed: ${res.status}`);
    }
  }
}
