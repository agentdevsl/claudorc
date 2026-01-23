import { Writable } from 'node:stream';
import * as k8s from '@kubernetes/client-node';
import { K8sErrors } from '../../errors/k8s-errors.js';
import type { ExecResult, SandboxMetrics, SandboxStatus, TmuxSession } from '../types.js';
import { SANDBOX_DEFAULTS } from '../types.js';
import type { Sandbox } from './sandbox-provider.js';

/**
 * Kubernetes-based sandbox implementation
 */
export class K8sSandbox implements Sandbox {
  private _lastActivity: Date;
  private _status: SandboxStatus;

  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public readonly containerId: string, // Pod UID
    private readonly podName: string,
    private readonly namespace: string,
    private readonly coreApi: k8s.CoreV1Api,
    private readonly kc: k8s.KubeConfig,
    initialStatus: SandboxStatus = 'running'
  ) {
    this._lastActivity = new Date();
    this._status = initialStatus;
  }

  get status(): SandboxStatus {
    return this._status;
  }

  set status(value: SandboxStatus) {
    this._status = value;
  }

  async exec(cmd: string, args: string[] = []): Promise<ExecResult> {
    return this.execInternal(cmd, args);
  }

  async execAsRoot(cmd: string, args: string[] = []): Promise<ExecResult> {
    // K8s pods run with securityContext.runAsNonRoot=true by default.
    // Root execution would require either:
    // 1. A privileged init container or sidecar
    // 2. A separate pod with elevated privileges
    // 3. Using nsenter from a privileged container
    //
    // For security reasons, we execute as the container's default user (UID 1000).
    // Most operations that need "root" inside a sandbox (like apt install) can be
    // handled by configuring the base image with sudo or by pre-installing packages.
    console.warn(
      `[K8sSandbox] execAsRoot called but K8s pods run as non-root. Executing as default user.`
    );
    return this.execInternal(cmd, args);
  }

  private async execInternal(cmd: string, args: string[]): Promise<ExecResult> {
    this.touch();

    // Build the full command
    const fullCommand = [cmd, ...args];

    return new Promise<ExecResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      const stdoutStream = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          stdout += chunk.toString();
          callback();
        },
      });

      const stderrStream = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          stderr += chunk.toString();
          callback();
        },
      });

      const exec = new k8s.Exec(this.kc);

      exec
        .exec(
          this.namespace,
          this.podName,
          'sandbox', // container name
          fullCommand,
          stdoutStream,
          stderrStream,
          null, // stdin
          false, // tty
          (status: k8s.V1Status) => {
            // Parse exit code from status
            if (status.status === 'Success') {
              exitCode = 0;
            } else if (status.details?.causes) {
              const exitCause = status.details.causes.find((c) => c.reason === 'ExitCode');
              if (exitCause?.message) {
                exitCode = parseInt(exitCause.message, 10) || 1;
              } else {
                exitCode = 1;
              }
            } else {
              exitCode = 1;
            }

            resolve({
              exitCode,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
            });
          }
        )
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          reject(K8sErrors.EXEC_FAILED(cmd, message));
        });
    });
  }

  async createTmuxSession(sessionName: string, taskId?: string): Promise<TmuxSession> {
    this.touch();

    // Check if session already exists
    const listResult = await this.exec('tmux', ['list-sessions', '-F', '#{session_name}']);
    if (listResult.stdout.split('\n').includes(sessionName)) {
      throw K8sErrors.TMUX_SESSION_ALREADY_EXISTS(sessionName);
    }

    // Create new tmux session
    const result = await this.exec('tmux', ['new-session', '-d', '-s', sessionName]);
    if (result.exitCode !== 0) {
      throw K8sErrors.TMUX_CREATION_FAILED(sessionName, result.stderr);
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
      throw K8sErrors.EXEC_FAILED('tmux list-sessions', result.stderr);
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
      throw K8sErrors.TMUX_SESSION_NOT_FOUND(sessionName);
    }
  }

  async sendKeysToTmux(sessionName: string, keys: string): Promise<void> {
    this.touch();

    const result = await this.exec('tmux', ['send-keys', '-t', sessionName, keys, 'Enter']);
    if (result.exitCode !== 0) {
      throw K8sErrors.EXEC_FAILED(`tmux send-keys -t ${sessionName}`, result.stderr);
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
      throw K8sErrors.EXEC_FAILED(`tmux capture-pane -t ${sessionName}`, result.stderr);
    }

    return result.stdout;
  }

  async stop(): Promise<void> {
    this._status = 'stopping';

    try {
      await this.coreApi.deleteNamespacedPod({
        name: this.podName,
        namespace: this.namespace,
        gracePeriodSeconds: 10,
      });
      this._status = 'stopped';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._status = 'error';
      throw K8sErrors.POD_DELETION_FAILED(this.podName, message);
    }
  }

  async getMetrics(): Promise<SandboxMetrics> {
    this.touch();

    // K8s doesn't provide direct container stats like Docker
    // You'd need metrics-server or a custom sidecar for accurate metrics
    // For now, we return placeholder values

    // Try to get basic info from the pod
    try {
      const response = await this.coreApi.readNamespacedPod({
        name: this.podName,
        namespace: this.namespace,
      });

      const containerStatus = response.status?.containerStatuses?.find(
        (cs) => cs.name === 'sandbox'
      );

      // Calculate uptime from container start time
      const startTime = containerStatus?.state?.running?.startedAt;
      const uptime = startTime ? Date.now() - new Date(startTime).getTime() : 0;

      return {
        cpuUsagePercent: 0, // Would need metrics-server
        memoryUsageMb: 0, // Would need metrics-server
        memoryLimitMb: SANDBOX_DEFAULTS.memoryMb,
        diskUsageMb: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        uptime,
      };
    } catch {
      // Return default metrics on error
      return {
        cpuUsagePercent: 0,
        memoryUsageMb: 0,
        memoryLimitMb: 0,
        diskUsageMb: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
        uptime: Date.now() - this._lastActivity.getTime(),
      };
    }
  }

  touch(): void {
    this._lastActivity = new Date();
  }

  getLastActivity(): Date {
    return this._lastActivity;
  }
}
