export interface RegisterPayload {
  daemonId: string;
  pid: number;
  version: string;
  watchPath: string;
  capabilities: string[];
  startedAt: number;
}

export class AgentPaneClient {
  private baseUrl: string;

  constructor(port: number) {
    this.baseUrl = `http://localhost:${port}`;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs = 5000
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
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
