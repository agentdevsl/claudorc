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
      console.error(
        `[AgentPaneClient] Circuit breaker opened after ${CIRCUIT_FAILURE_THRESHOLD} consecutive failures`
      );
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

  async register(payload: RegisterPayload): Promise<void> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/api/cli-monitor/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Registration failed: ${res.status} ${res.statusText}`);
    }
  }

  async heartbeat(daemonId: string, sessionCount: number): Promise<void> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/api/cli-monitor/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daemonId, sessionCount }),
    });
    if (!res.ok) {
      throw new Error(`Heartbeat failed: ${res.status}`);
    }
  }

  async ingest(daemonId: string, sessions: unknown[], removedSessionIds: string[]): Promise<void> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/api/cli-monitor/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daemonId, sessions, removedSessionIds }),
    });
    if (!res.ok) {
      throw new Error(`Ingest failed: ${res.status}`);
    }
  }

  async deregister(daemonId: string): Promise<void> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}/api/cli-monitor/deregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daemonId }),
    });
    if (!res.ok) {
      throw new Error(`Deregister failed: ${res.status}`);
    }
  }
}
