# Phase 2: Sandbox Plugin Ecosystem

> **STATUS: ROADMAP ONLY - NOT FOR IMPLEMENTATION**
>
> This document captures research and design thinking for future phases.
> Do not implement any features described here until Phase 2 is officially started.

---

## Overview

Phase 2 extends the sandbox system with a plugin architecture supporting multiple execution environments and connectivity layers. This enables:

- Third-party sandbox providers (E2B, Modal, Fly.io, etc.)
- Enterprise connectivity (HashiCorp Boundary, Tailscale)
- Local Kubernetes (minikube, kind)
- Advanced isolation (Firecracker microVMs, V8 isolates)

---

## Architecture

### Two Plugin Dimensions

| Dimension | Concern | Examples |
|-----------|---------|----------|
| **Sandbox** | Where code executes | Docker, K8s, E2B, Modal, Fly.io Sprites |
| **Connectivity** | How clients reach sandboxes | Direct, Boundary, Tailscale, Cloudflare Tunnel |

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  AgentPane Client (Browser)                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Connectivity Layer (Plugin)                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   Direct    │ │  Boundary   │ │  Tailscale  │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Sandbox Layer (Plugin)                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Docker  │ │   K8s   │ │   E2B   │ │  Modal  │ │  Fly.io │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Research: Sandbox Providers

### Provider Comparison

| Provider | Isolation | Boot Time | Key Feature |
|----------|-----------|-----------|-------------|
| Cloudflare Workers | V8 Isolates + seccomp | <5ms | Trust cordons, memory protection keys |
| E2B | Firecracker microVM | ~150ms | Long-running sessions (24h), Desktop GUI |
| Modal | gVisor containers | ~1s | GPU support, custom filesystem |
| Fly.io Sprites | Firecracker microVM | ~300ms | Persistent storage, REST API |
| SlicerVM | Firecracker microVM | <1s | GPU passthrough, ZFS snapshots |
| Minikube/Kind | K8s pods | ~2-5s | Production-like, NetworkPolicies |

### Capability Matrix

| Capability | Docker | K8s | E2B | Modal | Fly.io | V8 Isolates |
|------------|--------|-----|-----|-------|--------|-------------|
| GPU passthrough | Limited | Yes | No | Yes | No | No |
| Network isolation | Yes | Yes | Yes | Yes | Yes | Yes |
| Snapshot/restore | No | No | Yes | No | Yes | No |
| Warm pools | Manual | Yes | Yes | Yes | Yes | Native |
| Long-running (24h+) | Yes | Yes | Yes | Yes | Yes | No |
| Desktop GUI | No | No | Yes | No | No | No |
| Sub-second boot | No | No | Yes | Yes | Yes | Yes |

---

## Sandbox Plugin Interface

```typescript
/**
 * Core interface all sandbox plugins must implement
 */
interface SandboxPlugin {
  // ─────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────

  readonly name: string;
  readonly version: string;
  readonly capabilities: SandboxCapability[];

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  initialize(config: unknown): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // ─────────────────────────────────────────────────────────────
  // Sandbox Management
  // ─────────────────────────────────────────────────────────────

  create(
    agentId: string,
    projectId: string,
    config: SandboxConfig
  ): Promise<Result<SandboxInstance, SandboxError>>;

  start(sandboxId: string): Promise<Result<void, SandboxError>>;
  stop(sandboxId: string): Promise<Result<void, SandboxError>>;
  remove(sandboxId: string): Promise<Result<void, SandboxError>>;

  getStatus(sandboxId: string): Promise<Result<SandboxInstance, SandboxError>>;
  list(projectId?: string): Promise<Result<SandboxInstance[], SandboxError>>;

  // ─────────────────────────────────────────────────────────────
  // Execution
  // ─────────────────────────────────────────────────────────────

  exec(
    sandboxId: string,
    command: string,
    options?: ExecOptions
  ): Promise<Result<ExecResult, SandboxError>>;

  execStream(
    sandboxId: string,
    command: string,
    options?: ExecOptions
  ): AsyncGenerator<ExecStreamEvent, void, unknown>;

  // ─────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────

  readFile(sandboxId: string, path: string): Promise<Result<string, SandboxError>>;
  writeFile(sandboxId: string, path: string, content: string): Promise<Result<void, SandboxError>>;
  copyToSandbox(sandboxId: string, hostPath: string, sandboxPath: string): Promise<Result<void, SandboxError>>;
  copyFromSandbox(sandboxId: string, sandboxPath: string, hostPath: string): Promise<Result<void, SandboxError>>;

  // ─────────────────────────────────────────────────────────────
  // Resource Monitoring
  // ─────────────────────────────────────────────────────────────

  getResourceUsage(sandboxId: string): Promise<Result<ResourceUsage, SandboxError>>;
}

/**
 * Optional extensions for advanced features
 */
interface SandboxPluginExtensions {
  // Warm pool for fast starts
  warmPool?: {
    prewarm(count: number): Promise<void>;
    getWarm(): Promise<SandboxInstance | null>;
    drain(): Promise<void>;
  };

  // State persistence
  snapshot?(sandboxId: string): Promise<Result<SnapshotId, SandboxError>>;
  restore?(snapshotId: SnapshotId): Promise<Result<SandboxInstance, SandboxError>>;
  listSnapshots?(projectId: string): Promise<Result<Snapshot[], SandboxError>>;

  // GPU support
  gpu?: {
    listAvailable(): Promise<GpuInfo[]>;
    attach(sandboxId: string, gpuId: string): Promise<Result<void, SandboxError>>;
    detach(sandboxId: string): Promise<Result<void, SandboxError>>;
  };
}

/**
 * Capability flags for feature discovery
 */
type SandboxCapability =
  | 'gpu-passthrough'
  | 'network-isolation'
  | 'snapshot'
  | 'warm-pool'
  | 'desktop-gui'
  | 'long-running'      // 24h+ sessions
  | 'v8-isolate'        // JS-only fast path
  | 'nested-containers'
  | 'persistent-storage'
  | 'live-migration';

/**
 * Trust levels for multi-tenant isolation
 */
type TrustLevel = 'free' | 'pro' | 'enterprise';
```

---

## Connectivity Plugin Interface

```typescript
/**
 * Interface for connectivity/access plugins (e.g., Boundary, Tailscale)
 */
interface ConnectivityPlugin {
  // ─────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────

  readonly name: string;
  readonly version: string;

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  initialize(config: unknown): Promise<void>;
  shutdown(): Promise<void>;

  // ─────────────────────────────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────────────────────────────

  authenticate(identity: UserIdentity): Promise<Result<Session, AuthError>>;
  refreshSession(session: Session): Promise<Result<Session, AuthError>>;
  revokeSession(sessionId: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────
  // Target Discovery
  // ─────────────────────────────────────────────────────────────

  discoverTargets(filter?: TargetFilter): Promise<Target[]>;

  // ─────────────────────────────────────────────────────────────
  // Connection
  // ─────────────────────────────────────────────────────────────

  connect(targetId: string, session: Session): Promise<ProxiedConnection>;

  /**
   * Get client-side connection config for browser
   * Returns WebSocket URL and auth tokens for client to connect
   */
  getClientConfig(sandboxId: string, session: Session): Promise<ClientConnectionConfig>;
}

interface ClientConnectionConfig {
  wsUrl: string;
  authToken: string;
  expiresAt: Date;
  tunnelParams?: Record<string, unknown>;
}

interface ProxiedConnection {
  readonly id: string;
  readonly status: 'connecting' | 'connected' | 'disconnected';

  // Proxied streams
  terminal: {
    input: WritableStream<Uint8Array>;
    output: ReadableStream<Uint8Array>;
  };

  // Proxied operations
  exec(cmd: string): Promise<ExecResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;

  // Lifecycle
  close(): Promise<void>;
}
```

---

## Plugin Registry

```typescript
// plugins/registry.ts

type PluginType = 'sandbox' | 'connectivity';

interface PluginManifest {
  name: string;
  version: string;
  type: PluginType;
  entrypoint: string;
  config?: z.ZodSchema;
}

class PluginRegistry {
  private sandboxPlugins = new Map<string, SandboxPlugin>();
  private connectivityPlugins = new Map<string, ConnectivityPlugin>();

  /**
   * Register a built-in plugin
   */
  registerBuiltin(plugin: SandboxPlugin | ConnectivityPlugin): void;

  /**
   * Load external plugin from path or npm package
   */
  async loadExternal(source: string): Promise<void>;

  /**
   * Get sandbox plugin by name
   */
  getSandbox(name: string): SandboxPlugin | undefined;

  /**
   * Get connectivity plugin by name
   */
  getConnectivity(name: string): ConnectivityPlugin | undefined;

  /**
   * List all registered plugins
   */
  list(): { sandbox: string[]; connectivity: string[] };
}

// Singleton registry
export const pluginRegistry = new PluginRegistry();

// Register built-in plugins
pluginRegistry.registerBuiltin(new DockerSandboxPlugin());
pluginRegistry.registerBuiltin(new DirectConnectivityPlugin());
```

---

## Configuration

### Project-Level Config

```typescript
// Project sandbox configuration
interface ProjectSandboxConfig {
  sandbox: {
    provider: string;              // Plugin name or npm package
    config: Record<string, unknown>;
  };
  connectivity?: {
    provider: string;
    config: Record<string, unknown>;
  };
}

// Example: Local Docker (Phase 1)
{
  "sandbox": {
    "provider": "docker",
    "config": {
      "image": "node:22-slim",
      "resources": { "memoryMb": 4096, "cpus": 2 }
    }
  }
}

// Example: K8s with Boundary (Phase 2)
{
  "sandbox": {
    "provider": "k8s",
    "config": {
      "namespace": "agents",
      "kubeconfig": "~/.kube/config",
      "podTemplate": ".agentpane/pod-template.yaml"
    }
  },
  "connectivity": {
    "provider": "boundary",
    "config": {
      "addr": "https://boundary.example.com",
      "authMethodId": "ampw_1234",
      "scopeId": "p_agents"
    }
  }
}

// Example: E2B Cloud
{
  "sandbox": {
    "provider": "@e2b/agentpane-plugin",
    "config": {
      "apiKey": "${E2B_API_KEY}",
      "template": "base",
      "timeout": 3600000
    }
  }
}
```

---

## Kubernetes Sandbox Provider

### Overview

Local K8s (minikube/kind) as a stepping stone to production K8s.

### Implementation Sketch

```typescript
class K8sSandboxPlugin implements SandboxPlugin {
  name = 'k8s';
  version = '1.0.0';
  capabilities: SandboxCapability[] = [
    'network-isolation',
    'gpu-passthrough',
    'warm-pool',
    'long-running',
  ];

  private kubeconfig: string;
  private namespace: string;
  private k8sApi: CoreV1Api;

  async initialize(config: K8sConfig): Promise<void> {
    this.kubeconfig = config.kubeconfig ?? '~/.kube/config';
    this.namespace = config.namespace ?? 'agentpane';

    const kc = new KubeConfig();
    kc.loadFromFile(this.kubeconfig);
    this.k8sApi = kc.makeApiClient(CoreV1Api);

    // Ensure namespace exists
    await this.ensureNamespace();
  }

  async create(agentId: string, projectId: string, config: SandboxConfig) {
    const podName = `agent-${agentId}-${createId()}`;

    const pod: V1Pod = {
      metadata: {
        name: podName,
        namespace: this.namespace,
        labels: {
          'agentpane.io/agent-id': agentId,
          'agentpane.io/project-id': projectId,
        },
      },
      spec: {
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 1000,
          seccompProfile: { type: 'RuntimeDefault' },
        },
        containers: [{
          name: 'sandbox',
          image: config.docker?.image ?? 'node:22-slim',
          resources: {
            limits: {
              memory: `${config.resources.memoryMb}Mi`,
              cpu: `${config.resources.cpus}`,
            },
          },
          securityContext: {
            allowPrivilegeEscalation: false,
            capabilities: { drop: ['ALL'] },
          },
        }],
        restartPolicy: 'Never',
      },
    };

    await this.k8sApi.createNamespacedPod(this.namespace, pod);

    return ok({
      id: podName,
      agentId,
      projectId,
      status: 'creating',
      provider: 'k8s',
      workspacePath: '/workspace',
      createdAt: new Date(),
    });
  }

  async exec(sandboxId: string, command: string, options?: ExecOptions) {
    const exec = new Exec(this.kc);
    // Use K8s exec API...
  }
}
```

### Network Policies

```yaml
# Restrict agent pod network access
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-sandbox-policy
  namespace: agentpane
spec:
  podSelector:
    matchLabels:
      agentpane.io/sandbox: "true"
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              app: agentpane-api
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - port: 443
        - port: 80
```

---

## HashiCorp Boundary Integration

### Overview

Boundary provides identity-based access to sandboxes without exposing them directly.

### Flow

```
1. User authenticates via OIDC (Okta, Azure AD, etc.)
2. Boundary authorizes access based on role
3. Boundary discovers available sandbox targets
4. Client connects through Boundary proxy
5. All access is logged for audit
```

### Implementation Sketch

```typescript
class BoundaryConnectivityPlugin implements ConnectivityPlugin {
  name = 'boundary';
  version = '1.0.0';

  private client: BoundaryClient;

  async initialize(config: BoundaryConfig): Promise<void> {
    this.client = new BoundaryClient({
      addr: config.addr,
      authMethodId: config.authMethodId,
    });
  }

  async authenticate(identity: UserIdentity): Promise<Result<Session, AuthError>> {
    const authResult = await this.client.authenticate({
      authMethodId: this.config.authMethodId,
      credentials: identity.token,
    });

    return ok({
      id: authResult.id,
      token: authResult.token,
      expiresAt: new Date(authResult.expirationTime),
    });
  }

  async discoverTargets(filter?: TargetFilter): Promise<Target[]> {
    const targets = await this.client.targets.list({
      scopeId: this.config.scopeId,
    });

    return targets.items.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      address: t.address,
    }));
  }

  async getClientConfig(sandboxId: string, session: Session) {
    // Create authorized session to target
    const authzSession = await this.client.sessions.create({
      targetId: sandboxId,
      token: session.token,
    });

    return {
      wsUrl: `wss://${this.config.addr}/v1/proxy/${authzSession.id}`,
      authToken: authzSession.credentials.token,
      expiresAt: new Date(authzSession.expirationTime),
    };
  }
}
```

---

## Migration Path

### Phase 1 (Current)

- Docker sandbox (built-in)
- Direct connectivity
- Single-machine deployment

### Phase 2 (This Spec)

- Plugin architecture
- K8s sandbox (minikube/kind)
- Boundary connectivity
- Multi-provider support

### Phase 3 (Future)

- Cloud providers (E2B, Modal, Fly.io)
- Production K8s
- GPU workloads
- V8 isolates for lightweight JS

---

## References

### Sandbox Providers

- [Cloudflare Workers Security Model](https://developers.cloudflare.com/workers/reference/security-model/)
- [E2B Documentation](https://e2b.dev/docs)
- [Modal Labs](https://modal.com/)
- [Fly.io Machines](https://fly.io/docs/machines/)
- [Fly.io Sprites](https://devclass.com/2026/01/13/fly-io-introduces-sprites-lightweight-persistent-vms-to-isolate-agentic-ai/)
- [SlicerVM](https://slicervm.com/)

### Connectivity

- [HashiCorp Boundary](https://developer.hashicorp.com/boundary/docs)
- [Tailscale](https://tailscale.com/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)

### Kubernetes

- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [gVisor](https://gvisor.dev/)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-18 | Initial roadmap spec created |
