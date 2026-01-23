import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { KubeConfig } from '@kubernetes/client-node';
import { K8sErrors } from '../../errors/k8s-errors.js';

/**
 * Kubernetes provider configuration options
 */
export interface K8sProviderOptions {
  /** Path to kubeconfig file (overrides auto-discovery) */
  kubeconfigPath?: string;

  /** Kubernetes context to use (defaults to current-context) */
  context?: string;

  /** Namespace for sandbox pods */
  namespace?: string;

  /** Whether to auto-create the namespace if it doesn't exist */
  createNamespace?: boolean;

  /** Default timeout for pod startup (seconds) */
  podStartupTimeoutSeconds?: number;

  /** Default timeout for exec operations (milliseconds) */
  execTimeoutMs?: number;

  /** Whether to enable network policies (default: true) */
  networkPolicyEnabled?: boolean;

  /** List of allowed egress hosts (IPs or CIDRs) */
  allowedEgressHosts?: string[];

  /** Whether to setup RBAC resources (default: true) */
  setupRbac?: boolean;

  /** Whether to enable security audit logging (default: true) */
  enableAuditLogging?: boolean;

  /** Whether to enable warm pool for faster sandbox startup */
  enableWarmPool?: boolean;

  /** Minimum number of warm pods to maintain (default: 2) */
  warmPoolMinSize?: number;

  /** Maximum number of warm pods allowed (default: 10) */
  warmPoolMaxSize?: number;

  /** Whether to enable auto-scaling of the warm pool (default: true) */
  warmPoolAutoScaling?: boolean;
}

/**
 * Default K8s provider configuration
 */
export const K8S_PROVIDER_DEFAULTS = {
  namespace: 'agentpane-sandboxes',
  createNamespace: true,
  podStartupTimeoutSeconds: 120,
  execTimeoutMs: 60000,
  networkPolicyEnabled: true,
  setupRbac: true,
  enableAuditLogging: true,
  enableWarmPool: false,
  warmPoolMinSize: 2,
  warmPoolMaxSize: 10,
  warmPoolAutoScaling: true,
} as const;

/**
 * Pod labels used for identification and filtering
 */
export const K8S_POD_LABELS = {
  /** Label indicating this is an AgentPane sandbox */
  sandbox: 'agentpane.io/sandbox',
  /** Label for the sandbox ID */
  sandboxId: 'agentpane.io/sandbox-id',
  /** Label for the project ID */
  projectId: 'agentpane.io/project-id',
} as const;

/**
 * Discover and load kubeconfig using a tiered approach:
 * 1. K8S_KUBECONFIG env var (explicit path)
 * 2. KUBECONFIG env var (standard kubectl var)
 * 3. ~/.kube/config (default path)
 * 4. In-cluster config (when running inside K8s)
 *
 * @param explicitPath - Optional explicit path to kubeconfig
 * @returns Loaded KubeConfig instance
 * @throws K8sError if no valid kubeconfig found
 */
export function loadKubeConfig(explicitPath?: string): KubeConfig {
  const kc = new KubeConfig();

  // Tier 1: Explicit path provided
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw K8sErrors.KUBECONFIG_NOT_FOUND(explicitPath);
    }
    try {
      kc.loadFromFile(explicitPath);
      return kc;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw K8sErrors.KUBECONFIG_INVALID(message);
    }
  }

  // Tier 2: K8S_KUBECONFIG env var
  const k8sKubeconfigEnv = process.env.K8S_KUBECONFIG;
  if (k8sKubeconfigEnv) {
    if (!existsSync(k8sKubeconfigEnv)) {
      throw K8sErrors.KUBECONFIG_NOT_FOUND(k8sKubeconfigEnv);
    }
    try {
      kc.loadFromFile(k8sKubeconfigEnv);
      return kc;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw K8sErrors.KUBECONFIG_INVALID(message);
    }
  }

  // Tier 3: KUBECONFIG env var (standard)
  const kubeconfigEnv = process.env.KUBECONFIG;
  if (kubeconfigEnv) {
    // KUBECONFIG can contain multiple paths separated by :
    const paths = kubeconfigEnv.split(':').filter(Boolean);
    const existingPath = paths.find((p) => existsSync(p));
    if (existingPath) {
      try {
        kc.loadFromFile(existingPath);
        return kc;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw K8sErrors.KUBECONFIG_INVALID(message);
      }
    }
    // Fall through to default path if KUBECONFIG paths don't exist
  }

  // Tier 4: Default path ~/.kube/config
  const defaultPath = join(homedir(), '.kube', 'config');
  if (existsSync(defaultPath)) {
    try {
      kc.loadFromFile(defaultPath);
      return kc;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw K8sErrors.KUBECONFIG_INVALID(message);
    }
  }

  // Tier 5: In-cluster config (running inside Kubernetes)
  try {
    kc.loadFromCluster();
    return kc;
  } catch {
    // In-cluster config not available
  }

  // No config found
  throw K8sErrors.KUBECONFIG_NOT_FOUND();
}

/**
 * Resolve the K8s context to use
 *
 * @param kc - KubeConfig instance
 * @param requestedContext - Optional specific context to use
 * @returns The context name to use
 * @throws K8sError if context not found
 */
export function resolveContext(kc: KubeConfig, requestedContext?: string): string {
  if (requestedContext) {
    const contexts = kc.getContexts();
    const found = contexts.find((c) => c.name === requestedContext);
    if (!found) {
      throw K8sErrors.CONTEXT_NOT_FOUND(requestedContext);
    }
    kc.setCurrentContext(requestedContext);
    return requestedContext;
  }

  // Use current context
  const currentContext = kc.getCurrentContext();
  if (!currentContext) {
    throw K8sErrors.KUBECONFIG_INVALID('No current context set in kubeconfig');
  }

  return currentContext;
}

/**
 * Get cluster info from kubeconfig
 *
 * @param kc - KubeConfig instance
 * @returns Cluster information
 */
export function getClusterInfo(kc: KubeConfig): { name: string; server: string } | null {
  const currentContext = kc.getCurrentContext();
  if (!currentContext) {
    return null;
  }

  const context = kc.getContextObject(currentContext);
  if (!context?.cluster) {
    return null;
  }

  const cluster = kc.getCluster(context.cluster);
  if (!cluster) {
    return null;
  }

  return {
    name: context.cluster,
    server: cluster.server,
  };
}
