# AgentPane Sandbox Specification

## Overview

The AgentPane Sandbox provides isolated execution environments for AI agents. This specification defines a 3-tier isolation model supporting Docker containers, DevContainers, and git worktrees to ensure agents operate within controlled boundaries while maintaining development flexibility.

**Design Philosophy**: Defense in depth through container isolation, resource limits, path restrictions, and filesystem isolation via git worktrees. The sandbox assumes agents execute untrusted code that must be constrained to designated workspaces with bounded resource consumption.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AgentPane Host                                │
├─────────────────────────────────────────────────────────────────────────┤
│  SandboxService                                                         │
│  ├── DockerSandboxProvider (default, recommended)                       │
│  │   └── Docker Engine API / docker-compose                             │
│  ├── DevContainerProvider (IDE integration)                             │
│  │   └── devcontainer CLI                                               │
│  └── LocalProvider (development only, not for production)               │
│      └── Direct execution with path restrictions                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Per-Agent Sandbox Container                                            │
│  ├── Resource Limits (CPU, memory, PIDs, disk)                          │
│  ├── Network Policy (none, restricted, full)                            │
│  ├── Non-root User Execution                                            │
│  ├── Named Volumes (isolated from host)                                 │
│  ├── Path Restrictions (ALLOWED_ROOT_DIRECTORY)                         │
│  └── Git Worktree (per-task filesystem isolation)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Interface Definition

```typescript
// lib/sandbox/types.ts
import type { Result } from '@/lib/utils/result';

/**
 * Sandbox provider type
 */
export type SandboxProvider = 'docker' | 'devcontainer' | 'local';

/**
 * Network isolation mode
 */
export type NetworkMode = 'none' | 'restricted' | 'full';

/**
 * Sandbox resource limits
 */
export interface ResourceLimits {
  /** Memory limit in MB (default: 4096) */
  memoryMb: number;
  /** CPU limit as decimal (default: 2.0 = 2 cores) */
  cpus: number;
  /** Maximum number of processes (default: 256) */
  pidsLimit: number;
  /** Disk quota in MB (default: 10240) */
  diskMb: number;
  /** Execution timeout in ms (default: 3600000 = 1 hour) */
  timeoutMs: number;
}

/**
 * Network policy configuration
 */
export interface NetworkPolicy {
  /** Network isolation mode */
  mode: NetworkMode;
  /** Allowed hosts for 'restricted' mode (e.g., ['github.com', 'npm.org']) */
  allowedHosts?: string[];
  /** Allowed ports for 'restricted' mode (e.g., [443, 80]) */
  allowedPorts?: number[];
}

/**
 * Environment variable passthrough configuration
 */
export interface EnvironmentConfig {
  /** Variables to pass from host to sandbox (e.g., ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN']) */
  passthrough: string[];
  /** Additional variables to set inside sandbox (key-value pairs) */
  set?: Record<string, string>;
  /** Variables that must NEVER be passed (safety blocklist) */
  blocked?: string[];
  /** Inherit all allowed env vars from host (default: false, use passthrough list) */
  inheritAll?: boolean;
}

/**
 * Docker-specific sandbox configuration
 *
 * Note: Environment passthrough is now handled via EnvironmentConfig
 * at the SandboxConfig level, not here.
 */
export interface DockerSandboxConfig {
  /** Base image (default: 'node:22-slim') */
  image: string;
  /** Additional Docker run arguments */
  runArgs?: string[];
  /** Volume mounts (source:target format) */
  volumes?: string[];
  /** Docker Compose file path (optional, for complex setups) */
  composeFile?: string;
}

/**
 * DevContainer-specific configuration
 */
export interface DevContainerConfig {
  /** Path to devcontainer.json (default: '.devcontainer/devcontainer.json') */
  configPath: string;
  /** Additional devcontainer features to install */
  features?: Record<string, Record<string, unknown>>;
  /** Workspace folder inside container */
  workspaceFolder?: string;
}

/**
 * Complete sandbox configuration
 */
export interface SandboxConfig {
  /** Sandbox provider type */
  provider: SandboxProvider;
  /** Resource limits */
  resources: ResourceLimits;
  /** Network policy */
  network: NetworkPolicy;
  /** Environment variable passthrough */
  environment: EnvironmentConfig;
  /** Allowed root directory inside sandbox */
  allowedRootDirectory: string;
  /** Docker-specific config (when provider = 'docker') */
  docker?: DockerSandboxConfig;
  /** DevContainer-specific config (when provider = 'devcontainer') */
  devcontainer?: DevContainerConfig;
}

/**
 * Sandbox instance state
 */
export type SandboxStatus =
  | 'creating'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'removed';

/**
 * Sandbox instance information
 */
export interface SandboxInstance {
  id: string;
  agentId: string;
  projectId: string;
  status: SandboxStatus;
  provider: SandboxProvider;
  containerId?: string;
  workspacePath: string;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  resourceUsage?: ResourceUsage;
}

/**
 * Current resource usage
 */
export interface ResourceUsage {
  memoryMb: number;
  cpuPercent: number;
  pids: number;
  diskMb: number;
}

/**
 * Command execution result
 */
export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/**
 * Sandbox service interface
 */
export interface ISandboxService {
  // Lifecycle
  create(agentId: string, projectId: string, config: SandboxConfig): Promise<Result<SandboxInstance, SandboxError>>;
  start(sandboxId: string): Promise<Result<void, SandboxError>>;
  stop(sandboxId: string): Promise<Result<void, SandboxError>>;
  remove(sandboxId: string): Promise<Result<void, SandboxError>>;

  // Execution
  exec(sandboxId: string, command: string, options?: ExecOptions): Promise<Result<ExecResult, SandboxError>>;
  execStream(sandboxId: string, command: string, options?: ExecOptions): AsyncGenerator<ExecStreamEvent, void, unknown>;

  // File operations
  readFile(sandboxId: string, path: string): Promise<Result<string, SandboxError>>;
  writeFile(sandboxId: string, path: string, content: string): Promise<Result<void, SandboxError>>;
  copyToSandbox(sandboxId: string, hostPath: string, sandboxPath: string): Promise<Result<void, SandboxError>>;
  copyFromSandbox(sandboxId: string, sandboxPath: string, hostPath: string): Promise<Result<void, SandboxError>>;

  // Status
  getStatus(sandboxId: string): Promise<Result<SandboxInstance, SandboxError>>;
  getResourceUsage(sandboxId: string): Promise<Result<ResourceUsage, SandboxError>>;
  list(projectId?: string): Promise<Result<SandboxInstance[], SandboxError>>;

  // Health
  healthCheck(sandboxId: string): Promise<Result<boolean, SandboxError>>;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  user?: string;
}

export type ExecStreamEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number; durationMs: number };
```

---

## Default Configuration

```typescript
// lib/sandbox/defaults.ts

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  memoryMb: 4096,        // 4 GB
  cpus: 2.0,             // 2 cores
  pidsLimit: 256,        // 256 processes
  diskMb: 10240,         // 10 GB
  timeoutMs: 3600000,    // 1 hour
};

export const DEFAULT_NETWORK_POLICY: NetworkPolicy = {
  mode: 'restricted',
  allowedHosts: [
    'github.com',
    'api.github.com',
    'raw.githubusercontent.com',
    'registry.npmjs.org',
    'cdn.jsdelivr.net',
  ],
  allowedPorts: [443, 80],
};

/**
 * Default environment passthrough configuration
 *
 * IMPORTANT: Environment variables are the primary way to pass
 * credentials and configuration to sandboxed agents. This config
 * must be carefully managed to prevent credential leakage while
 * allowing necessary access.
 */
export const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
  // Variables passed from host to sandbox
  passthrough: [
    // AI Provider Credentials
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_AUTH_TOKEN',

    // GitHub Access
    'GITHUB_TOKEN',
    'GH_TOKEN',

    // System essentials
    'PATH',
    'HOME',
    'SHELL',
    'TERM',
    'USER',
    'LANG',
    'LC_ALL',

    // Node.js / npm
    'NODE_ENV',
    'npm_config_registry',
    'NPM_TOKEN',

    // Optional: Cloud provider (read-only access recommended)
    // 'AWS_ACCESS_KEY_ID',  // Uncomment if needed
    // 'AWS_REGION',         // Uncomment if needed
  ],

  // Additional variables set inside sandbox
  set: {
    IS_SANDBOXED: 'true',
    SANDBOX_VERSION: '1.0.0',
  },

  // Variables that must NEVER be passed (safety blocklist)
  blocked: [
    // AWS secrets
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',

    // Database credentials
    'DATABASE_URL',
    'DB_PASSWORD',
    'POSTGRES_PASSWORD',
    'MYSQL_PASSWORD',
    'REDIS_PASSWORD',

    // Encryption/signing keys
    'PRIVATE_KEY',
    'SSH_PRIVATE_KEY',
    'ENCRYPTION_KEY',
    'JWT_SECRET',
    'SECRET_KEY',
    'SIGNING_KEY',

    // Other sensitive
    'STRIPE_SECRET_KEY',
    'SENDGRID_API_KEY',
    'TWILIO_AUTH_TOKEN',
  ],

  inheritAll: false,
};

export const DEFAULT_DOCKER_CONFIG: DockerSandboxConfig = {
  image: 'node:22-slim',
  runArgs: [
    '--read-only',
    '--tmpfs=/tmp:rw,noexec,nosuid,size=512m',
  ],
};

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  provider: 'docker',
  resources: DEFAULT_RESOURCE_LIMITS,
  network: DEFAULT_NETWORK_POLICY,
  environment: DEFAULT_ENVIRONMENT_CONFIG,
  allowedRootDirectory: '/workspace',
  docker: DEFAULT_DOCKER_CONFIG,
};
```

---

## Docker Sandbox Provider

### Implementation

```typescript
// lib/sandbox/providers/docker-provider.ts
import { $ } from 'bun';
import { createId } from '@paralleldrive/cuid2';
import { ok, err, type Result } from '@/lib/utils/result';
import { SandboxErrors } from '@/lib/errors/sandbox-errors';
import type {
  SandboxConfig,
  SandboxInstance,
  SandboxStatus,
  ExecResult,
  ExecOptions,
  ResourceUsage,
  ISandboxService,
  SandboxError,
} from './types';
import { ALLOWED_ENV_VARS, BLOCKED_ENV_VARS } from './defaults';

export class DockerSandboxProvider implements ISandboxService {
  private instances = new Map<string, SandboxInstance>();

  /**
   * Create a new Docker sandbox for an agent
   */
  async create(
    agentId: string,
    projectId: string,
    config: SandboxConfig
  ): Promise<Result<SandboxInstance, SandboxError>> {
    const sandboxId = createId();
    const containerName = `agentpane-${agentId}-${sandboxId}`;

    // Build docker run command
    const runArgs = this.buildDockerRunArgs(containerName, config);

    try {
      // Create container (don't start yet)
      const result = await $`docker create ${runArgs}`.quiet();
      const containerId = result.stdout.toString().trim();

      const instance: SandboxInstance = {
        id: sandboxId,
        agentId,
        projectId,
        status: 'creating',
        provider: 'docker',
        containerId,
        workspacePath: config.allowedRootDirectory,
        createdAt: new Date(),
      };

      this.instances.set(sandboxId, instance);

      return ok(instance);
    } catch (error) {
      return err(SandboxErrors.CREATION_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  /**
   * Build docker run arguments from config
   */
  private buildDockerRunArgs(containerName: string, config: SandboxConfig): string[] {
    const { resources, network, environment, docker, allowedRootDirectory } = config;
    const args: string[] = [];

    // Container name
    args.push('--name', containerName);

    // Resource limits
    args.push('--memory', `${resources.memoryMb}m`);
    args.push('--cpus', String(resources.cpus));
    args.push('--pids-limit', String(resources.pidsLimit));

    // Network mode
    if (network.mode === 'none') {
      args.push('--network', 'none');
    } else if (network.mode === 'restricted') {
      // Use custom network with egress rules (created separately)
      args.push('--network', 'agentpane-restricted');
    }
    // 'full' mode uses default bridge network

    // Non-root user
    args.push('--user', '1000:1000');

    // Environment variables (filtered through EnvironmentConfig)
    const env = this.buildSafeEnv(environment);
    for (const [key, value] of Object.entries(env)) {
      args.push('-e', `${key}=${value}`);
    }

    // Set ALLOWED_ROOT_DIRECTORY inside container
    args.push('-e', `ALLOWED_ROOT_DIRECTORY=${allowedRootDirectory}`);

    // Working directory
    args.push('-w', allowedRootDirectory);

    // Workspace volume (named volume for isolation)
    args.push('-v', `agentpane-workspace-${containerName}:${allowedRootDirectory}`);

    // Additional run args from config
    if (docker?.runArgs) {
      args.push(...docker.runArgs);
    }

    // Image
    args.push(docker?.image ?? 'node:22-slim');

    // Keep container running
    args.push('tail', '-f', '/dev/null');

    return args;
  }

  /**
   * Build safe environment variables from EnvironmentConfig
   *
   * Order of precedence:
   * 1. Blocked variables are NEVER passed
   * 2. Passthrough variables are read from host process.env
   * 3. Set variables override/add to the environment
   */
  private buildSafeEnv(envConfig: EnvironmentConfig): Record<string, string> {
    const env: Record<string, string> = {};
    const blockList = new Set(envConfig.blocked ?? []);

    // 1. Pass through allowed variables from host
    for (const key of envConfig.passthrough) {
      // Skip if blocked
      if (blockList.has(key)) {
        console.warn(`[Sandbox] Blocked env var requested in passthrough: ${key}`);
        continue;
      }

      const value = process.env[key];
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // 2. Add/override with explicitly set variables
    if (envConfig.set) {
      for (const [key, value] of Object.entries(envConfig.set)) {
        // Skip if blocked
        if (blockList.has(key)) {
          console.warn(`[Sandbox] Blocked env var in set config: ${key}`);
          continue;
        }
        env[key] = value;
      }
    }

    return env;
  }

  /**
   * Start a sandbox container
   */
  async start(sandboxId: string): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    if (!instance.containerId) {
      return err(SandboxErrors.INVALID_STATE('No container ID'));
    }

    try {
      await $`docker start ${instance.containerId}`.quiet();

      instance.status = 'running';
      instance.startedAt = new Date();

      return ok(undefined);
    } catch (error) {
      instance.status = 'error';
      return err(SandboxErrors.START_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  /**
   * Stop a sandbox container
   */
  async stop(sandboxId: string): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    if (!instance.containerId) {
      return err(SandboxErrors.INVALID_STATE('No container ID'));
    }

    try {
      await $`docker stop -t 10 ${instance.containerId}`.quiet();

      instance.status = 'stopped';
      instance.stoppedAt = new Date();

      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.STOP_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  /**
   * Remove a sandbox container and its volumes
   */
  async remove(sandboxId: string): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    if (!instance.containerId) {
      this.instances.delete(sandboxId);
      return ok(undefined);
    }

    try {
      // Stop if running
      if (instance.status === 'running') {
        await $`docker stop -t 5 ${instance.containerId}`.quiet().nothrow();
      }

      // Remove container
      await $`docker rm -f ${instance.containerId}`.quiet();

      // Remove associated volume
      const volumeName = `agentpane-workspace-agentpane-${instance.agentId}-${sandboxId}`;
      await $`docker volume rm ${volumeName}`.quiet().nothrow();

      instance.status = 'removed';
      this.instances.delete(sandboxId);

      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.REMOVAL_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  /**
   * Execute a command in the sandbox
   */
  async exec(
    sandboxId: string,
    command: string,
    options?: ExecOptions
  ): Promise<Result<ExecResult, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    if (instance.status !== 'running') {
      return err(SandboxErrors.INVALID_STATE(`Sandbox is ${instance.status}`));
    }

    const execArgs = this.buildExecArgs(instance, options);
    const startTime = Date.now();

    try {
      const timeoutMs = options?.timeoutMs ?? 120000;
      const result = await $`docker exec ${execArgs} ${instance.containerId} sh -c ${command}`
        .quiet()
        .timeout(timeoutMs)
        .nothrow();

      return ok({
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        durationMs: Date.now() - startTime,
        timedOut: false,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        return ok({
          exitCode: 124,
          stdout: '',
          stderr: 'Command timed out',
          durationMs: Date.now() - startTime,
          timedOut: true,
        });
      }

      return err(SandboxErrors.EXEC_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  /**
   * Build docker exec arguments
   */
  private buildExecArgs(instance: SandboxInstance, options?: ExecOptions): string[] {
    const args: string[] = [];

    // Working directory
    if (options?.cwd) {
      args.push('-w', options.cwd);
    }

    // Environment variables
    if (options?.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('-e', `${key}=${value}`);
      }
    }

    // User
    if (options?.user) {
      args.push('-u', options.user);
    }

    return args;
  }

  /**
   * Execute command with streaming output
   */
  async *execStream(
    sandboxId: string,
    command: string,
    options?: ExecOptions
  ): AsyncGenerator<ExecStreamEvent, void, unknown> {
    const instance = this.instances.get(sandboxId);
    if (!instance || instance.status !== 'running' || !instance.containerId) {
      return;
    }

    const execArgs = this.buildExecArgs(instance, options);
    const startTime = Date.now();

    const proc = Bun.spawn(
      ['docker', 'exec', ...execArgs, instance.containerId, 'sh', '-c', command],
      { stdout: 'pipe', stderr: 'pipe' }
    );

    // Stream stdout
    const stdoutReader = proc.stdout.getReader();
    const stderrReader = proc.stderr.getReader();

    const decoder = new TextDecoder();

    // Read both streams concurrently
    const readStream = async function* (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      type: 'stdout' | 'stderr'
    ): AsyncGenerator<ExecStreamEvent> {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield { type, data: decoder.decode(value) };
      }
    };

    // Interleave stdout and stderr
    for await (const event of this.mergeStreams(
      readStream(stdoutReader, 'stdout'),
      readStream(stderrReader, 'stderr')
    )) {
      yield event;
    }

    // Wait for exit
    const exitCode = await proc.exited;
    yield { type: 'exit', code: exitCode, durationMs: Date.now() - startTime };
  }

  /**
   * Merge two async generators
   */
  private async *mergeStreams<T>(
    ...streams: AsyncGenerator<T>[]
  ): AsyncGenerator<T> {
    const pending = new Set(streams.map((s, i) => ({ stream: s, index: i })));

    while (pending.size > 0) {
      const promises = [...pending].map(async ({ stream, index }) => {
        const result = await stream.next();
        return { result, index };
      });

      const { result, index } = await Promise.race(promises);

      if (result.done) {
        for (const p of pending) {
          if (p.index === index) {
            pending.delete(p);
            break;
          }
        }
      } else {
        yield result.value;
      }
    }
  }

  /**
   * Read file from sandbox
   */
  async readFile(sandboxId: string, path: string): Promise<Result<string, SandboxError>> {
    const result = await this.exec(sandboxId, `cat ${path}`);
    if (!result.ok) return result;

    if (result.value.exitCode !== 0) {
      return err(SandboxErrors.FILE_NOT_FOUND(path));
    }

    return ok(result.value.stdout);
  }

  /**
   * Write file to sandbox
   */
  async writeFile(
    sandboxId: string,
    path: string,
    content: string
  ): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance?.containerId) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      // Use docker cp with stdin
      const proc = Bun.spawn(
        ['docker', 'exec', '-i', instance.containerId, 'sh', '-c', `cat > ${path}`],
        { stdin: 'pipe' }
      );

      proc.stdin.write(content);
      proc.stdin.end();

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        return err(SandboxErrors.WRITE_FAILED(path));
      }

      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.WRITE_FAILED(path));
    }
  }

  /**
   * Copy file from host to sandbox
   */
  async copyToSandbox(
    sandboxId: string,
    hostPath: string,
    sandboxPath: string
  ): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance?.containerId) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      await $`docker cp ${hostPath} ${instance.containerId}:${sandboxPath}`.quiet();
      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.COPY_FAILED(hostPath, sandboxPath));
    }
  }

  /**
   * Copy file from sandbox to host
   */
  async copyFromSandbox(
    sandboxId: string,
    sandboxPath: string,
    hostPath: string
  ): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance?.containerId) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      await $`docker cp ${instance.containerId}:${sandboxPath} ${hostPath}`.quiet();
      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.COPY_FAILED(sandboxPath, hostPath));
    }
  }

  /**
   * Get sandbox status
   */
  async getStatus(sandboxId: string): Promise<Result<SandboxInstance, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    // Refresh status from Docker
    if (instance.containerId) {
      try {
        const result = await $`docker inspect --format='{{.State.Status}}' ${instance.containerId}`.quiet();
        const dockerStatus = result.stdout.toString().trim();

        instance.status = this.mapDockerStatus(dockerStatus);
      } catch {
        instance.status = 'error';
      }
    }

    return ok(instance);
  }

  /**
   * Map Docker status to SandboxStatus
   */
  private mapDockerStatus(dockerStatus: string): SandboxStatus {
    switch (dockerStatus) {
      case 'created': return 'creating';
      case 'running': return 'running';
      case 'paused': return 'paused';
      case 'exited':
      case 'dead': return 'stopped';
      default: return 'error';
    }
  }

  /**
   * Get resource usage
   */
  async getResourceUsage(sandboxId: string): Promise<Result<ResourceUsage, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance?.containerId) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      const result = await $`docker stats --no-stream --format='{{json .}}' ${instance.containerId}`.quiet();
      const stats = JSON.parse(result.stdout.toString());

      return ok({
        memoryMb: this.parseMemory(stats.MemUsage),
        cpuPercent: parseFloat(stats.CPUPerc) || 0,
        pids: parseInt(stats.PIDs) || 0,
        diskMb: 0, // Would need additional call to get disk usage
      });
    } catch (error) {
      return err(SandboxErrors.STATS_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  /**
   * Parse Docker memory string (e.g., "1.5GiB / 4GiB")
   */
  private parseMemory(memStr: string): number {
    const match = memStr.match(/^([\d.]+)(\w+)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'kib': return value / 1024;
      case 'mib': return value;
      case 'gib': return value * 1024;
      default: return value;
    }
  }

  /**
   * List all sandboxes
   */
  async list(projectId?: string): Promise<Result<SandboxInstance[], SandboxError>> {
    let instances = [...this.instances.values()];

    if (projectId) {
      instances = instances.filter(i => i.projectId === projectId);
    }

    return ok(instances);
  }

  /**
   * Health check
   */
  async healthCheck(sandboxId: string): Promise<Result<boolean, SandboxError>> {
    const result = await this.exec(sandboxId, 'echo ok', { timeoutMs: 5000 });

    if (!result.ok) {
      return ok(false);
    }

    return ok(result.value.exitCode === 0 && result.value.stdout.trim() === 'ok');
  }
}
```

---

## DevContainer Provider

### devcontainer.json Template

```json
// .devcontainer/devcontainer.json
{
  "name": "AgentPane Sandbox",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:22",

  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },

  "runArgs": [
    "--memory=4g",
    "--cpus=2",
    "--pids-limit=256",
    "--network=agentpane-restricted",
    "--read-only",
    "--tmpfs=/tmp:rw,noexec,nosuid,size=512m"
  ],

  "containerEnv": {
    "ALLOWED_ROOT_DIRECTORY": "/workspace",
    "NODE_ENV": "development"
  },

  "mounts": [
    "source=agentpane-workspace-${localWorkspaceFolderBasename},target=/workspace,type=volume"
  ],

  "workspaceFolder": "/workspace",
  "workspaceMount": "",

  "remoteUser": "node",

  "postCreateCommand": "npm install --ignore-scripts",

  "customizations": {
    "vscode": {
      "settings": {
        "terminal.integrated.cwd": "/workspace"
      }
    }
  }
}
```

### Implementation

```typescript
// lib/sandbox/providers/devcontainer-provider.ts
import { $ } from 'bun';
import { createId } from '@paralleldrive/cuid2';
import { ok, err, type Result } from '@/lib/utils/result';
import { SandboxErrors } from '@/lib/errors/sandbox-errors';
import type {
  SandboxConfig,
  SandboxInstance,
  ExecResult,
  ExecOptions,
  ResourceUsage,
  ISandboxService,
  SandboxError,
} from './types';

export class DevContainerProvider implements ISandboxService {
  private instances = new Map<string, SandboxInstance>();

  /**
   * Create a devcontainer sandbox
   */
  async create(
    agentId: string,
    projectId: string,
    config: SandboxConfig
  ): Promise<Result<SandboxInstance, SandboxError>> {
    const sandboxId = createId();
    const workspaceFolder = config.devcontainer?.workspaceFolder ?? '/workspace';
    const configPath = config.devcontainer?.configPath ?? '.devcontainer/devcontainer.json';

    try {
      // Build devcontainer
      const result = await $`devcontainer up --workspace-folder ${workspaceFolder} --config ${configPath}`.quiet();

      // Parse container ID from output
      const output = JSON.parse(result.stdout.toString());
      const containerId = output.containerId;

      const instance: SandboxInstance = {
        id: sandboxId,
        agentId,
        projectId,
        status: 'running',
        provider: 'devcontainer',
        containerId,
        workspacePath: workspaceFolder,
        createdAt: new Date(),
        startedAt: new Date(),
      };

      this.instances.set(sandboxId, instance);

      return ok(instance);
    } catch (error) {
      return err(SandboxErrors.CREATION_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  /**
   * Execute command in devcontainer
   */
  async exec(
    sandboxId: string,
    command: string,
    options?: ExecOptions
  ): Promise<Result<ExecResult, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    const startTime = Date.now();
    const cwd = options?.cwd ?? instance.workspacePath;

    try {
      const result = await $`devcontainer exec --workspace-folder ${instance.workspacePath} sh -c "cd ${cwd} && ${command}"`.quiet().nothrow();

      return ok({
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        durationMs: Date.now() - startTime,
        timedOut: false,
      });
    } catch (error) {
      return err(SandboxErrors.EXEC_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  // ... implement remaining ISandboxService methods similar to DockerSandboxProvider

  async start(sandboxId: string): Promise<Result<void, SandboxError>> {
    // DevContainers start automatically with 'up'
    return ok(undefined);
  }

  async stop(sandboxId: string): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      await $`devcontainer stop --workspace-folder ${instance.workspacePath}`.quiet();
      instance.status = 'stopped';
      instance.stoppedAt = new Date();
      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.STOP_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  async remove(sandboxId: string): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      await $`devcontainer down --workspace-folder ${instance.workspacePath}`.quiet();
      instance.status = 'removed';
      this.instances.delete(sandboxId);
      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.REMOVAL_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  // File operations delegate to Docker provider via container ID
  async readFile(sandboxId: string, path: string): Promise<Result<string, SandboxError>> {
    const result = await this.exec(sandboxId, `cat ${path}`);
    if (!result.ok) return result;
    if (result.value.exitCode !== 0) {
      return err(SandboxErrors.FILE_NOT_FOUND(path));
    }
    return ok(result.value.stdout);
  }

  async writeFile(sandboxId: string, path: string, content: string): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance?.containerId) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      const proc = Bun.spawn(
        ['docker', 'exec', '-i', instance.containerId, 'sh', '-c', `cat > ${path}`],
        { stdin: 'pipe' }
      );
      proc.stdin.write(content);
      proc.stdin.end();
      await proc.exited;
      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.WRITE_FAILED(path));
    }
  }

  async copyToSandbox(sandboxId: string, hostPath: string, sandboxPath: string): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance?.containerId) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      await $`docker cp ${hostPath} ${instance.containerId}:${sandboxPath}`.quiet();
      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.COPY_FAILED(hostPath, sandboxPath));
    }
  }

  async copyFromSandbox(sandboxId: string, sandboxPath: string, hostPath: string): Promise<Result<void, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance?.containerId) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      await $`docker cp ${instance.containerId}:${sandboxPath} ${hostPath}`.quiet();
      return ok(undefined);
    } catch (error) {
      return err(SandboxErrors.COPY_FAILED(sandboxPath, hostPath));
    }
  }

  async getStatus(sandboxId: string): Promise<Result<SandboxInstance, SandboxError>> {
    const instance = this.instances.get(sandboxId);
    if (!instance) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }
    return ok(instance);
  }

  async getResourceUsage(sandboxId: string): Promise<Result<ResourceUsage, SandboxError>> {
    // Delegate to docker stats
    const instance = this.instances.get(sandboxId);
    if (!instance?.containerId) {
      return err(SandboxErrors.NOT_FOUND(sandboxId));
    }

    try {
      const result = await $`docker stats --no-stream --format='{{json .}}' ${instance.containerId}`.quiet();
      const stats = JSON.parse(result.stdout.toString());

      return ok({
        memoryMb: parseFloat(stats.MemUsage?.split('/')[0]) || 0,
        cpuPercent: parseFloat(stats.CPUPerc) || 0,
        pids: parseInt(stats.PIDs) || 0,
        diskMb: 0,
      });
    } catch (error) {
      return err(SandboxErrors.STATS_FAILED(
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  async list(projectId?: string): Promise<Result<SandboxInstance[], SandboxError>> {
    let instances = [...this.instances.values()];
    if (projectId) {
      instances = instances.filter(i => i.projectId === projectId);
    }
    return ok(instances);
  }

  async healthCheck(sandboxId: string): Promise<Result<boolean, SandboxError>> {
    const result = await this.exec(sandboxId, 'echo ok', { timeoutMs: 5000 });
    if (!result.ok) return ok(false);
    return ok(result.value.exitCode === 0);
  }

  async *execStream(sandboxId: string, command: string, options?: ExecOptions): AsyncGenerator<any> {
    // Simplified streaming implementation
    const result = await this.exec(sandboxId, command, options);
    if (result.ok) {
      if (result.value.stdout) yield { type: 'stdout', data: result.value.stdout };
      if (result.value.stderr) yield { type: 'stderr', data: result.value.stderr };
      yield { type: 'exit', code: result.value.exitCode, durationMs: result.value.durationMs };
    }
  }
}
```

---

## Sandbox Service Factory

```typescript
// lib/sandbox/index.ts
import { DockerSandboxProvider } from './providers/docker-provider';
import { DevContainerProvider } from './providers/devcontainer-provider';
import type { SandboxConfig, ISandboxService, SandboxProvider } from './types';
import { DEFAULT_SANDBOX_CONFIG } from './defaults';

const providers = new Map<SandboxProvider, ISandboxService>();

/**
 * Get or create a sandbox provider
 */
export function getSandboxProvider(type: SandboxProvider): ISandboxService {
  let provider = providers.get(type);

  if (!provider) {
    switch (type) {
      case 'docker':
        provider = new DockerSandboxProvider();
        break;
      case 'devcontainer':
        provider = new DevContainerProvider();
        break;
      case 'local':
        throw new Error('Local provider not recommended for production');
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
    providers.set(type, provider);
  }

  return provider;
}

/**
 * Get the default sandbox service (Docker)
 */
export function getDefaultSandboxService(): ISandboxService {
  return getSandboxProvider('docker');
}

/**
 * Merge user config with defaults
 */
export function resolveSandboxConfig(userConfig: Partial<SandboxConfig>): SandboxConfig {
  return {
    ...DEFAULT_SANDBOX_CONFIG,
    ...userConfig,
    resources: {
      ...DEFAULT_SANDBOX_CONFIG.resources,
      ...userConfig.resources,
    },
    network: {
      ...DEFAULT_SANDBOX_CONFIG.network,
      ...userConfig.network,
    },
    environment: {
      ...DEFAULT_SANDBOX_CONFIG.environment,
      // Merge passthrough arrays (user additions take precedence)
      passthrough: [
        ...DEFAULT_SANDBOX_CONFIG.environment.passthrough,
        ...(userConfig.environment?.passthrough ?? []),
      ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
      // Merge set objects
      set: {
        ...DEFAULT_SANDBOX_CONFIG.environment.set,
        ...userConfig.environment?.set,
      },
      // Merge blocked arrays
      blocked: [
        ...(DEFAULT_SANDBOX_CONFIG.environment.blocked ?? []),
        ...(userConfig.environment?.blocked ?? []),
      ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
    },
    docker: userConfig.docker ? {
      ...DEFAULT_SANDBOX_CONFIG.docker,
      ...userConfig.docker,
    } : DEFAULT_SANDBOX_CONFIG.docker,
  };
}

// Re-export types
export * from './types';
export * from './defaults';
```

---

## Network Isolation Setup

### Restricted Network Creation

```bash
#!/bin/bash
# scripts/create-sandbox-network.sh

# Create restricted network for sandboxes
docker network create \
  --driver bridge \
  --opt com.docker.network.bridge.enable_icc=false \
  agentpane-restricted 2>/dev/null || true

# Note: For egress filtering, use iptables rules on the Docker host
# or deploy a proxy container that enforces allowlist
```

### Docker Compose for Network Setup

```yaml
# docker/sandbox-network.yml
version: '3.8'

networks:
  agentpane-restricted:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.enable_icc: 'false'
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

---

## Error Definitions

```typescript
// lib/errors/sandbox-errors.ts
import { createError } from './base';

export const SandboxErrors = {
  NOT_FOUND: (sandboxId: string) => createError(
    'SANDBOX_NOT_FOUND',
    `Sandbox not found: ${sandboxId}`,
    404,
    { sandboxId }
  ),

  CREATION_FAILED: (reason: string) => createError(
    'SANDBOX_CREATION_FAILED',
    `Failed to create sandbox: ${reason}`,
    500,
    { reason }
  ),

  START_FAILED: (reason: string) => createError(
    'SANDBOX_START_FAILED',
    `Failed to start sandbox: ${reason}`,
    500,
    { reason }
  ),

  STOP_FAILED: (reason: string) => createError(
    'SANDBOX_STOP_FAILED',
    `Failed to stop sandbox: ${reason}`,
    500,
    { reason }
  ),

  REMOVAL_FAILED: (reason: string) => createError(
    'SANDBOX_REMOVAL_FAILED',
    `Failed to remove sandbox: ${reason}`,
    500,
    { reason }
  ),

  EXEC_FAILED: (reason: string) => createError(
    'SANDBOX_EXEC_FAILED',
    `Command execution failed: ${reason}`,
    500,
    { reason }
  ),

  INVALID_STATE: (state: string) => createError(
    'SANDBOX_INVALID_STATE',
    `Invalid sandbox state: ${state}`,
    400,
    { state }
  ),

  FILE_NOT_FOUND: (path: string) => createError(
    'SANDBOX_FILE_NOT_FOUND',
    `File not found in sandbox: ${path}`,
    404,
    { path }
  ),

  WRITE_FAILED: (path: string) => createError(
    'SANDBOX_WRITE_FAILED',
    `Failed to write file: ${path}`,
    500,
    { path }
  ),

  COPY_FAILED: (src: string, dest: string) => createError(
    'SANDBOX_COPY_FAILED',
    `Failed to copy ${src} to ${dest}`,
    500,
    { src, dest }
  ),

  STATS_FAILED: (reason: string) => createError(
    'SANDBOX_STATS_FAILED',
    `Failed to get resource stats: ${reason}`,
    500,
    { reason }
  ),

  RESOURCE_LIMIT_EXCEEDED: (resource: string, limit: number, actual: number) => createError(
    'SANDBOX_RESOURCE_LIMIT_EXCEEDED',
    `Resource limit exceeded: ${resource} (limit: ${limit}, actual: ${actual})`,
    429,
    { resource, limit, actual }
  ),

  TIMEOUT: (timeoutMs: number) => createError(
    'SANDBOX_TIMEOUT',
    `Sandbox operation timed out after ${timeoutMs}ms`,
    408,
    { timeoutMs }
  ),
} as const;

export type SandboxError = ReturnType<typeof SandboxErrors[keyof typeof SandboxErrors]>;
```

---

## Integration with AgentService

```typescript
// lib/services/agent-service.ts (updated excerpt)
import { getSandboxProvider, resolveSandboxConfig, type SandboxConfig } from '@/lib/sandbox';

export class AgentService {
  /**
   * Start an agent with sandbox isolation
   */
  async start(
    agentId: string,
    taskId: string,
    sandboxConfig?: Partial<SandboxConfig>
  ): Promise<Result<AgentRunResult, AgentError>> {
    const agent = await this.getById(agentId);
    if (!agent.ok) return agent;

    // Resolve sandbox configuration
    const config = resolveSandboxConfig({
      ...sandboxConfig,
      provider: agent.value.project.sandboxProvider ?? 'docker',
    });

    // Get sandbox provider
    const sandbox = getSandboxProvider(config.provider);

    // Create sandbox for this agent
    const sandboxResult = await sandbox.create(agentId, agent.value.projectId, config);
    if (!sandboxResult.ok) {
      return err(AgentErrors.EXECUTION_ERROR(sandboxResult.error.message));
    }

    // Start sandbox
    const startResult = await sandbox.start(sandboxResult.value.id);
    if (!startResult.ok) {
      await sandbox.remove(sandboxResult.value.id);
      return err(AgentErrors.EXECUTION_ERROR(startResult.error.message));
    }

    // Copy worktree to sandbox
    const worktree = await worktreeService.create({
      projectId: agent.value.projectId,
      taskId,
      branch: `agent/${agentId}/${taskId}`,
    });

    if (worktree.ok) {
      await sandbox.copyToSandbox(
        sandboxResult.value.id,
        worktree.value.path,
        config.allowedRootDirectory
      );
    }

    // Execute agent in sandbox context
    // ... rest of agent execution using sandbox.exec() instead of direct $``
  }
}
```

---

## Configuration Schema

```typescript
// db/schema/sandbox-config.ts
import { z } from 'zod';

export const sandboxConfigSchema = z.object({
  provider: z.enum(['docker', 'devcontainer', 'local']).default('docker'),

  resources: z.object({
    memoryMb: z.number().min(512).max(32768).default(4096),
    cpus: z.number().min(0.5).max(16).default(2),
    pidsLimit: z.number().min(32).max(4096).default(256),
    diskMb: z.number().min(1024).max(102400).default(10240),
    timeoutMs: z.number().min(60000).max(86400000).default(3600000),
  }).default({}),

  network: z.object({
    mode: z.enum(['none', 'restricted', 'full']).default('restricted'),
    allowedHosts: z.array(z.string()).optional(),
    allowedPorts: z.array(z.number()).optional(),
  }).default({}),

  allowedRootDirectory: z.string().default('/workspace'),

  docker: z.object({
    image: z.string().default('node:22-slim'),
    runArgs: z.array(z.string()).optional(),
    envPassthrough: z.array(z.string()).optional(),
  }).optional(),

  devcontainer: z.object({
    configPath: z.string().default('.devcontainer/devcontainer.json'),
    features: z.record(z.record(z.unknown())).optional(),
    workspaceFolder: z.string().optional(),
  }).optional(),
});

export type SandboxConfigInput = z.input<typeof sandboxConfigSchema>;
export type SandboxConfigOutput = z.output<typeof sandboxConfigSchema>;
```

---

## Durable Sessions Integration

The sandbox integrates with Durable Sessions for real-time terminal I/O streaming. Instead of maintaining persistent PTY processes (like tmux/node-pty), command execution emits events to durable streams that are:

- **Persisted** to Postgres for history replay
- **Synced** to all connected clients in real-time
- **Resumable** after disconnection or server restart

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Sandbox Container                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  sandbox.execStream("npm test")                      │   │
│  │       ↓                                              │   │
│  │  stdout/stderr chunks (AsyncGenerator)               │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  SandboxStreamBridge                                        │
│  - Transforms exec events to terminal events                │
│  - Publishes to durable streams                             │
│  - Handles backpressure                                     │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Durable Streams (@durable-streams/server)                  │
│  - Persists to Postgres                                     │
│  - Broadcasts via Electric sync                             │
│  - Supports replay from any point                           │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Clients (useTerminal hook)                                 │
│  - Real-time event subscription                             │
│  - Terminal UI rendering                                    │
│  - Input sent back through streams                          │
└─────────────────────────────────────────────────────────────┘
```

### Stream Bridge Implementation

```typescript
// lib/sandbox/stream-bridge.ts
import { publishTerminalEvent, publishAgentStep } from '@/lib/streams/server';
import type { ISandboxService, ExecStreamEvent } from './types';

export interface StreamBridgeOptions {
  sessionId: string;
  agentId: string;
  sandboxId: string;
}

/**
 * Bridges sandbox execution to durable sessions
 *
 * Transforms sandbox exec events into terminal events that are
 * persisted and broadcast through durable streams.
 */
export class SandboxStreamBridge {
  private sessionId: string;
  private agentId: string;
  private sandboxId: string;
  private sandbox: ISandboxService;

  constructor(sandbox: ISandboxService, options: StreamBridgeOptions) {
    this.sandbox = sandbox;
    this.sessionId = options.sessionId;
    this.agentId = options.agentId;
    this.sandboxId = options.sandboxId;
  }

  /**
   * Execute command with output streamed to durable sessions
   */
  async execWithStream(
    command: string,
    options?: { cwd?: string; env?: Record<string, string> }
  ): Promise<{ exitCode: number; durationMs: number }> {
    const startTime = Date.now();

    // Publish command start
    publishTerminalEvent(
      this.sessionId,
      'input',
      `$ ${command}`,
      'agent'
    );

    // Stream execution output
    let exitCode = 0;
    for await (const event of this.sandbox.execStream(this.sandboxId, command, options)) {
      switch (event.type) {
        case 'stdout':
          publishTerminalEvent(this.sessionId, 'output', event.data, 'agent');
          break;

        case 'stderr':
          publishTerminalEvent(this.sessionId, 'error', event.data, 'agent');
          break;

        case 'exit':
          exitCode = event.code;
          break;
      }
    }

    const durationMs = Date.now() - startTime;

    // Publish completion
    publishTerminalEvent(
      this.sessionId,
      'output',
      `\n[Process exited with code ${exitCode} in ${durationMs}ms]\n`,
      'system'
    );

    return { exitCode, durationMs };
  }

  /**
   * Execute tool call with streaming and publish to tool channel
   */
  async execToolWithStream(
    toolName: string,
    toolId: string,
    command: string,
    options?: { cwd?: string; env?: Record<string, string> }
  ): Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    // Publish tool start
    publishAgentStep(this.agentId, {
      type: 'tool:invoke',
      sessionId: this.sessionId,
      toolId,
      tool: toolName,
      input: { command, ...options },
      timestamp: Date.now(),
    });

    // Stream execution
    let exitCode = 0;
    for await (const event of this.sandbox.execStream(this.sandboxId, command, options)) {
      switch (event.type) {
        case 'stdout':
          stdout += event.data;
          publishTerminalEvent(this.sessionId, 'output', event.data, 'agent');
          break;

        case 'stderr':
          stderr += event.data;
          publishTerminalEvent(this.sessionId, 'error', event.data, 'agent');
          break;

        case 'exit':
          exitCode = event.code;
          break;
      }
    }

    const durationMs = Date.now() - startTime;

    // Publish tool result
    publishAgentStep(this.agentId, {
      type: 'tool:result',
      sessionId: this.sessionId,
      tool: toolName,
      input: { command, ...options },
      output: { exitCode, stdout, stderr },
      duration: durationMs,
      timestamp: Date.now(),
    });

    return { exitCode, stdout, stderr, durationMs };
  }

  /**
   * Handle user input from terminal UI
   */
  async handleUserInput(input: string): Promise<void> {
    // Log user input
    publishTerminalEvent(this.sessionId, 'input', input, 'user');

    // Execute in sandbox (for interactive sessions)
    await this.execWithStream(input);
  }
}

/**
 * Factory to create stream bridge for a sandbox
 */
export function createStreamBridge(
  sandbox: ISandboxService,
  options: StreamBridgeOptions
): SandboxStreamBridge {
  return new SandboxStreamBridge(sandbox, options);
}
```

### Agent Service Integration

```typescript
// lib/services/agent-service.ts (extended excerpt)
import { getSandboxProvider, resolveSandboxConfig } from '@/lib/sandbox';
import { createStreamBridge } from '@/lib/sandbox/stream-bridge';
import { sessionService } from '@/lib/services/session-service';

export class AgentService {
  /**
   * Start agent with sandbox and durable session streaming
   */
  async start(
    agentId: string,
    taskId: string,
    sandboxConfig?: Partial<SandboxConfig>
  ): Promise<Result<AgentRunResult, AgentError>> {
    // ... sandbox creation (existing code) ...

    // Create session for this agent run
    const sessionResult = await sessionService.createSession({
      projectId: agent.value.projectId,
      taskId,
      agentId,
      title: `Agent run: ${taskId}`,
    });

    if (!sessionResult.ok) {
      await sandbox.remove(sandboxResult.value.id);
      return err(AgentErrors.EXECUTION_ERROR('Failed to create session'));
    }

    // Create stream bridge to connect sandbox to durable sessions
    const streamBridge = createStreamBridge(sandbox, {
      sessionId: sessionResult.value.id,
      agentId,
      sandboxId: sandboxResult.value.id,
    });

    // Execute agent with streaming
    const result = await this.executeAgentWithBridge(
      agent.value,
      taskId,
      sandbox,
      sandboxResult.value.id,
      streamBridge
    );

    return result;
  }

  /**
   * Execute agent loop with stream bridge for all tool calls
   */
  private async executeAgentWithBridge(
    agent: Agent,
    taskId: string,
    sandbox: ISandboxService,
    sandboxId: string,
    streamBridge: SandboxStreamBridge
  ): Promise<Result<AgentRunResult, AgentError>> {
    // Define tools that use the stream bridge
    const tools = {
      Bash: async (input: { command: string }) => {
        const result = await streamBridge.execToolWithStream(
          'Bash',
          `bash-${Date.now()}`,
          input.command
        );
        return result.stdout || result.stderr;
      },

      Read: async (input: { file_path: string }) => {
        const result = await sandbox.readFile(sandboxId, input.file_path);
        if (!result.ok) throw new Error(result.error.message);
        return result.value;
      },

      Write: async (input: { file_path: string; content: string }) => {
        const result = await sandbox.writeFile(sandboxId, input.file_path, input.content);
        if (!result.ok) throw new Error(result.error.message);
        return 'File written successfully';
      },

      // ... other tools
    };

    // Run agent query with these tools
    // (integrates with Claude Agent SDK)
    // ...
  }
}
```

### React Hook for Sandbox Terminal

```typescript
// lib/sandbox/hooks/use-sandbox-terminal.ts
import { useCallback } from 'react';
import { useTerminal } from '@/lib/sessions/hooks/use-terminal';
import { useSession } from '@/lib/sessions/hooks/use-session';

export interface UseSandboxTerminalResult {
  // Terminal data (from durable sessions)
  lines: TerminalEvent[];
  inputHistory: string[];

  // Agent state
  agentStatus: AgentStateEvent['status'] | null;
  isExecuting: boolean;

  // Actions
  sendCommand: (command: string) => void;

  // Connection status
  isConnected: boolean;
  error: Error | null;
}

/**
 * Hook for sandbox terminal with durable session backing
 *
 * Provides real-time terminal output from sandbox execution
 * with full history replay on reconnect.
 */
export function useSandboxTerminal(sessionId: string, userId: string): UseSandboxTerminalResult {
  const { terminal, agentState, isConnected, error, sendInput } = useSession(sessionId, userId);
  const { lines, inputHistory } = useTerminal(sessionId);

  const isExecuting = agentState?.status === 'running';

  const sendCommand = useCallback((command: string) => {
    if (!isExecuting) {
      sendInput(command);
    }
  }, [isExecuting, sendInput]);

  return {
    lines,
    inputHistory,
    agentStatus: agentState?.status ?? null,
    isExecuting,
    sendCommand,
    isConnected,
    error,
  };
}
```

### Benefits Over tmux/node-pty

| Feature | tmux/node-pty | Durable Sessions |
|---------|---------------|------------------|
| **Persistence** | Lost on restart | Survives restarts |
| **History** | Limited scrollback | Full replay from DB |
| **Multi-viewer** | Complex (tmux attach) | Native subscription |
| **Reconnection** | Lost context | Seamless resume |
| **Audit trail** | Requires logging | Built-in (Postgres) |
| **Sandbox integration** | Needs PTY forwarding | Event emission only |
| **Scalability** | Per-server sessions | Distributed via Electric |

### Event Flow Example

```typescript
// 1. User requests agent to run tests
// → Agent starts in sandbox

// 2. Sandbox executes: npm test
streamBridge.execWithStream('npm test');

// 3. Events published to durable stream:
// { channel: 'terminal', type: 'input', data: '$ npm test', source: 'agent' }
// { channel: 'terminal', type: 'output', data: '> project@1.0.0 test\n', source: 'agent' }
// { channel: 'terminal', type: 'output', data: '> vitest run\n', source: 'agent' }
// { channel: 'terminal', type: 'output', data: '\n ✓ src/test.ts (3 tests) 45ms\n', source: 'agent' }
// { channel: 'terminal', type: 'output', data: '\n[Process exited with code 0 in 1234ms]\n', source: 'system' }

// 4. All events persisted to Postgres
// 5. All connected clients receive events in real-time
// 6. New clients joining get full history replay
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Security Model](./security-model.md) | Path validation, tool whitelist enforcement |
| [Durable Sessions](../integrations/durable-sessions.md) | Terminal I/O streaming, event persistence |
| [Agent Service](../services/agent-service.md) | Agent execution within sandbox |
| [Worktree Service](../services/worktree-service.md) | Worktree creation copied into sandbox |
| [Error Catalog](../errors/error-catalog.md) | Sandbox error codes |
| [Configuration](../configuration/config-management.md) | Sandbox config in project settings |
| [Database Schema](../database/schema.md) | Sandbox instance tracking |

---

## Implementation Checklist

### Phase 1: Docker Sandbox
- [ ] Implement `DockerSandboxProvider`
- [ ] Create restricted network setup script
- [ ] Add sandbox config to project schema
- [ ] Integrate with AgentService

### Phase 2: DevContainer Support
- [ ] Create devcontainer.json template
- [ ] Implement `DevContainerProvider`
- [ ] Add VS Code integration documentation

### Phase 3: Resource Monitoring
- [ ] Add real-time resource usage tracking
- [ ] Implement resource limit enforcement
- [ ] Add UI for resource visualization

### Phase 4: Durable Sessions Integration
- [ ] Implement `SandboxStreamBridge`
- [ ] Connect `execStream` to terminal event publishing
- [ ] Add `useSandboxTerminal` React hook
- [ ] Test session persistence and replay

### Phase 5: Network Policies
- [ ] Implement egress proxy for restricted mode
- [ ] Add allowlist configuration UI
- [ ] Log network access attempts
