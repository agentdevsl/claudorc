import { PassThrough, type Readable } from 'node:stream';
import { createId } from '@paralleldrive/cuid2';
import Docker from 'dockerode';
import { SandboxErrors } from '../../errors/sandbox-errors.js';
import type {
  ExecResult,
  SandboxConfig,
  SandboxHealthCheck,
  SandboxInfo,
  SandboxMetrics,
  SandboxStatus,
  TmuxSession,
} from '../types.js';
import { SANDBOX_DEFAULTS } from '../types.js';
import type {
  EventEmittingSandboxProvider,
  ExecStreamOptions,
  ExecStreamResult,
  Sandbox,
  SandboxProviderEvent,
  SandboxProviderEventListener,
} from './sandbox-provider.js';

/**
 * Docker-based sandbox implementation
 */
class DockerSandbox implements Sandbox {
  private container: Docker.Container;
  private _lastActivity: Date;

  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly containerId: string,
    public status: SandboxStatus,
    container: Docker.Container
  ) {
    this.container = container;
    this._lastActivity = new Date();
  }

  async exec(cmd: string, args: string[] = []): Promise<ExecResult> {
    return this.execInternal(cmd, args, false);
  }

  async execAsRoot(cmd: string, args: string[] = []): Promise<ExecResult> {
    return this.execInternal(cmd, args, true);
  }

  private async execInternal(cmd: string, args: string[], asRoot: boolean): Promise<ExecResult> {
    this.touch();

    const exec = await this.container.exec({
      Cmd: [cmd, ...args],
      AttachStdout: true,
      AttachStderr: true,
      User: asRoot ? 'root' : SANDBOX_DEFAULTS.userHome.split('/').pop(),
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let buffer = Buffer.alloc(0);

      stream.on('data', (chunk: Buffer) => {
        // Accumulate data for proper frame parsing
        buffer = Buffer.concat([buffer, chunk]);

        // Docker multiplexes stdout/stderr with 8-byte headers:
        // Byte 0: Stream type (1=stdout, 2=stderr)
        // Bytes 1-3: Unused
        // Bytes 4-7: Payload size (big-endian uint32)
        // Bytes 8+: Payload
        while (buffer.length >= 8) {
          const streamType = buffer[0];
          const payloadSize = buffer.readUInt32BE(4);

          // Check if we have the complete frame
          if (buffer.length < 8 + payloadSize) {
            break; // Wait for more data
          }

          const payload = buffer.subarray(8, 8 + payloadSize).toString();
          buffer = buffer.subarray(8 + payloadSize);

          if (streamType === 1) {
            stdout += payload;
          } else if (streamType === 2) {
            stderr += payload;
          }
        }
      });

      stream.on('end', async () => {
        try {
          const inspection = await exec.inspect();
          resolve({
            exitCode: inspection.ExitCode ?? 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        } catch (err) {
          reject(err);
        }
      });

      stream.on('error', reject);
    });
  }

  async createTmuxSession(sessionName: string, taskId?: string): Promise<TmuxSession> {
    this.touch();

    // Check if session already exists
    const listResult = await this.exec('tmux', ['list-sessions', '-F', '#{session_name}']);
    if (listResult.stdout.split('\n').includes(sessionName)) {
      throw SandboxErrors.TMUX_SESSION_ALREADY_EXISTS(sessionName);
    }

    // Create new tmux session
    const result = await this.exec('tmux', ['new-session', '-d', '-s', sessionName]);
    if (result.exitCode !== 0) {
      throw SandboxErrors.TMUX_CREATION_FAILED(sessionName, result.stderr);
    }

    return {
      name: sessionName,
      sandboxId: this.id,
      taskId,
      createdAt: new Date().toISOString(),
      windowCount: 1,
      attached: false,
    };
  }

  async listTmuxSessions(): Promise<TmuxSession[]> {
    this.touch();

    const result = await this.exec('tmux', [
      'list-sessions',
      '-F',
      '#{session_name}:#{session_windows}:#{session_attached}',
    ]);

    if (result.exitCode !== 0) {
      // Expected: no tmux server running = no sessions
      if (result.stderr.includes('no server running') || result.stderr.includes('no sessions')) {
        return [];
      }
      // Unexpected error - throw to surface the issue
      throw SandboxErrors.EXEC_FAILED('tmux list-sessions', result.stderr);
    }

    return result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(':');
        const name = parts[0] ?? '';
        const windows = parts[1] ?? '1';
        const attached = parts[2] ?? '0';
        return {
          name,
          sandboxId: this.id,
          createdAt: new Date().toISOString(),
          windowCount: parseInt(windows, 10) || 1,
          attached: attached === '1',
        };
      })
      .filter((session) => session.name !== '');
  }

  async killTmuxSession(sessionName: string): Promise<void> {
    this.touch();

    const result = await this.exec('tmux', ['kill-session', '-t', sessionName]);
    if (result.exitCode !== 0 && !result.stderr.includes('session not found')) {
      throw SandboxErrors.TMUX_SESSION_NOT_FOUND(sessionName);
    }
  }

  async sendKeysToTmux(sessionName: string, keys: string): Promise<void> {
    this.touch();

    const result = await this.exec('tmux', ['send-keys', '-t', sessionName, keys, 'Enter']);
    if (result.exitCode !== 0) {
      throw SandboxErrors.EXEC_FAILED(`tmux send-keys -t ${sessionName}`, result.stderr);
    }
  }

  async captureTmuxPane(sessionName: string, lines = 100): Promise<string> {
    this.touch();

    const result = await this.exec('tmux', [
      'capture-pane',
      '-t',
      sessionName,
      '-p',
      '-S',
      `-${lines}`,
    ]);

    if (result.exitCode !== 0) {
      throw SandboxErrors.EXEC_FAILED(`tmux capture-pane -t ${sessionName}`, result.stderr);
    }

    return result.stdout;
  }

  async stop(): Promise<void> {
    this.status = 'stopping';
    await this.container.stop({ t: 10 });
    this.status = 'stopped';
  }

  async getMetrics(): Promise<SandboxMetrics> {
    this.touch();

    const stats = await this.container.stats({ stream: false });

    // Safely access nested CPU stats with null checks (container may be in transitional state)
    const cpuUsage = stats.cpu_stats?.cpu_usage?.total_usage ?? 0;
    const precpuUsage = stats.precpu_stats?.cpu_usage?.total_usage ?? 0;
    const systemCpu = stats.cpu_stats?.system_cpu_usage ?? 0;
    const presystemCpu = stats.precpu_stats?.system_cpu_usage ?? 0;
    const onlineCpus = stats.cpu_stats?.online_cpus ?? 1;

    const cpuDelta = cpuUsage - precpuUsage;
    const systemDelta = systemCpu - presystemCpu;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0;

    const memoryUsage = stats.memory_stats?.usage ?? 0;
    const memoryLimit = stats.memory_stats?.limit ?? 0;

    return {
      cpuUsagePercent: Math.round(cpuPercent * 100) / 100,
      memoryUsageMb: Math.round(memoryUsage / (1024 * 1024)),
      memoryLimitMb: Math.round(memoryLimit / (1024 * 1024)),
      // Disk usage not collected to avoid exec overhead per metrics call
      diskUsageMb: 0,
      networkRxBytes: stats.networks?.eth0?.rx_bytes ?? 0,
      networkTxBytes: stats.networks?.eth0?.tx_bytes ?? 0,
      uptime: Date.now() - this._lastActivity.getTime(),
    };
  }

  touch(): void {
    this._lastActivity = new Date();
  }

  getLastActivity(): Date {
    return this._lastActivity;
  }

  /**
   * Execute a command with streaming output.
   * Returns readable streams for stdout/stderr, useful for long-running processes
   * like the agent-runner that emit events over time.
   */
  async execStream(options: ExecStreamOptions): Promise<ExecStreamResult> {
    this.touch();

    const { cmd, args = [], env = {}, cwd, asRoot = false } = options;

    // Build command with working directory if specified
    const fullCmd = cwd ? ['sh', '-c', `cd ${cwd} && ${cmd} ${args.join(' ')}`] : [cmd, ...args];

    // Build environment variables array
    const envArray = Object.entries(env).map(([k, v]) => `${k}=${v}`);

    const exec = await this.container.exec({
      Cmd: fullCmd,
      AttachStdout: true,
      AttachStderr: true,
      Env: envArray,
      User: asRoot ? 'root' : SANDBOX_DEFAULTS.userHome.split('/').pop(),
    });

    const dockerStream = await exec.start({ hijack: true, stdin: false });

    // Create pass-through streams for stdout and stderr
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    let buffer = Buffer.alloc(0);
    let killed = false;

    // Process the multiplexed Docker stream
    dockerStream.on('data', (chunk: Buffer) => {
      if (killed) return;

      buffer = Buffer.concat([buffer, chunk]);

      // Parse Docker multiplexed stream (8-byte headers)
      while (buffer.length >= 8) {
        const streamType = buffer[0];
        const payloadSize = buffer.readUInt32BE(4);

        if (buffer.length < 8 + payloadSize) {
          break; // Wait for more data
        }

        const payload = buffer.subarray(8, 8 + payloadSize);
        buffer = buffer.subarray(8 + payloadSize);

        if (streamType === 1) {
          stdoutStream.write(payload);
        } else if (streamType === 2) {
          stderrStream.write(payload);
        }
      }
    });

    dockerStream.on('end', () => {
      stdoutStream.end();
      stderrStream.end();
    });

    dockerStream.on('error', (err) => {
      stdoutStream.destroy(err);
      stderrStream.destroy(err);
    });

    return {
      stdout: stdoutStream as Readable,
      stderr: stderrStream as Readable,

      async wait(): Promise<{ exitCode: number }> {
        return new Promise((resolve, reject) => {
          dockerStream.on('end', async () => {
            try {
              const inspection = await exec.inspect();
              resolve({ exitCode: inspection.ExitCode ?? 0 });
            } catch (err) {
              reject(err);
            }
          });

          dockerStream.on('error', reject);
        });
      },

      kill(): void {
        killed = true;
        stdoutStream.end();
        stderrStream.end();
        // Note: Docker exec doesn't have a direct kill method.
        // The process will be killed when the container stops or via a separate exec call.
      },
    };
  }
}

/**
 * Docker-based sandbox provider
 */
export class DockerProvider implements EventEmittingSandboxProvider {
  readonly name = 'docker';

  private docker: Docker;
  private sandboxes = new Map<string, DockerSandbox>();
  private projectToSandbox = new Map<string, string>();
  private listeners = new Set<SandboxProviderEventListener>();

  constructor(options?: Docker.DockerOptions) {
    this.docker = new Docker(options);
  }

  async create(config: SandboxConfig): Promise<Sandbox> {
    // Check if sandbox already exists for project
    const existing = this.projectToSandbox.get(config.projectId);
    if (existing) {
      const sandbox = this.sandboxes.get(existing);
      if (sandbox && sandbox.status !== 'stopped') {
        throw SandboxErrors.CONTAINER_ALREADY_EXISTS(config.projectId);
      }
    }

    const sandboxId = createId();

    this.emit({
      type: 'sandbox:creating',
      sandboxId,
      projectId: config.projectId,
    });

    try {
      // Build volume mounts
      const binds = [
        `${config.projectPath}:/workspace:rw`,
        ...config.volumeMounts.map(
          (v) => `${v.hostPath}:${v.containerPath}:${v.readonly ? 'ro' : 'rw'}`
        ),
      ];

      // Create container
      const container = await this.docker.createContainer({
        Image: config.image,
        name: `agentpane-${config.projectId}-${sandboxId.slice(0, 8)}`,
        Hostname: 'sandbox',
        WorkingDir: '/workspace',
        Env: Object.entries(config.env ?? {}).map(([k, v]) => `${k}=${v}`),
        HostConfig: {
          Binds: binds,
          Memory: config.memoryMb * 1024 * 1024,
          NanoCpus: config.cpuCores * 1e9,
          NetworkMode: 'bridge',
          AutoRemove: false,
        },
        Tty: true,
        OpenStdin: true,
      });

      // Start container
      await container.start();

      const sandbox = new DockerSandbox(
        sandboxId,
        config.projectId,
        container.id,
        'running',
        container
      );

      this.sandboxes.set(sandboxId, sandbox);
      this.projectToSandbox.set(config.projectId, sandboxId);

      this.emit({
        type: 'sandbox:created',
        sandboxId,
        projectId: config.projectId,
        containerId: container.id,
      });

      this.emit({ type: 'sandbox:started', sandboxId });

      return sandbox;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit({
        type: 'sandbox:error',
        sandboxId,
        error: error instanceof Error ? error : new Error(message),
      });
      throw SandboxErrors.CONTAINER_CREATION_FAILED(message);
    }
  }

  async get(projectId: string): Promise<Sandbox | null> {
    // First check for project-specific sandbox
    const sandboxId = this.projectToSandbox.get(projectId);
    if (sandboxId) {
      return this.sandboxes.get(sandboxId) ?? null;
    }

    // Fall back to global default sandbox (projectId = 'default')
    const defaultSandboxId = this.projectToSandbox.get('default');
    if (defaultSandboxId) {
      return this.sandboxes.get(defaultSandboxId) ?? null;
    }

    return null;
  }

  async getById(sandboxId: string): Promise<Sandbox | null> {
    return this.sandboxes.get(sandboxId) ?? null;
  }

  async list(): Promise<SandboxInfo[]> {
    const infos: SandboxInfo[] = [];

    for (const [sandboxId, sandbox] of this.sandboxes) {
      infos.push({
        id: sandboxId,
        projectId: sandbox.projectId,
        containerId: sandbox.containerId,
        status: sandbox.status,
        image: 'unknown', // Would need to store this
        createdAt: new Date().toISOString(),
        lastActivityAt: sandbox.getLastActivity().toISOString(),
        memoryMb: 0,
        cpuCores: 0,
      });
    }

    return infos;
  }

  async pullImage(image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          reject(SandboxErrors.IMAGE_PULL_FAILED(image, err.message));
          return;
        }

        this.docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) {
              reject(SandboxErrors.IMAGE_PULL_FAILED(image, err.message));
            } else {
              resolve();
            }
          },
          () => {
            // Progress callback - could emit events here
          }
        );
      });
    });
  }

  async isImageAvailable(image: string): Promise<boolean> {
    try {
      await this.docker.getImage(image).inspect();
      return true;
    } catch (error) {
      // Only treat 404 (not found) as "image not available"
      // Other errors (Docker daemon down, network issues) should propagate
      if (error && typeof error === 'object' && 'statusCode' in error) {
        if ((error as { statusCode: number }).statusCode === 404) {
          return false;
        }
      }
      // Re-throw other errors - these indicate Docker connectivity issues
      throw error;
    }
  }

  async healthCheck(): Promise<SandboxHealthCheck> {
    try {
      await this.docker.ping();
      const info = await this.docker.info();

      return {
        healthy: true,
        details: {
          serverVersion: info.ServerVersion,
          containers: info.Containers,
          containersRunning: info.ContainersRunning,
          images: info.Images,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        message: `Docker health check failed: ${message}`,
      };
    }
  }

  async cleanup(options?: { olderThan?: Date; status?: string[] }): Promise<number> {
    let cleaned = 0;

    for (const [sandboxId, sandbox] of this.sandboxes) {
      const shouldClean =
        (options?.status?.includes(sandbox.status) ?? sandbox.status === 'stopped') &&
        (!options?.olderThan || sandbox.getLastActivity() < options.olderThan);

      if (shouldClean) {
        try {
          if (sandbox.status !== 'stopped') {
            await sandbox.stop();
          }
          this.sandboxes.delete(sandboxId);
          this.projectToSandbox.delete(sandbox.projectId);
          cleaned++;
        } catch (error) {
          // Log cleanup errors for debugging - don't fail the entire cleanup operation
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[DockerProvider] Failed to cleanup sandbox ${sandboxId}:`, message);
        }
      }
    }

    return cleaned;
  }

  on(listener: SandboxProviderEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  off(listener: SandboxProviderEventListener): void {
    this.listeners.delete(listener);
  }

  private emit(event: SandboxProviderEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[DockerProvider] Event listener error:', error);
      }
    }
  }
}

/**
 * Create a Docker provider
 */
export function createDockerProvider(options?: Docker.DockerOptions): DockerProvider {
  return new DockerProvider(options);
}
