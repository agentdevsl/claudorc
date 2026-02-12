import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { KubeConfig } from '@kubernetes/client-node';
import { KubeConfigError } from './errors.js';

/**
 * Options for loading KubeConfig
 */
export interface KubeConfigOptions {
  /** Explicit path to kubeconfig file */
  kubeconfigPath?: string;
  /** Context to use (defaults to current-context) */
  context?: string;
  /** Skip TLS verification */
  skipTLSVerify?: boolean;
}

/**
 * Load KubeConfig using 5-tier discovery:
 * 1. Explicit path parameter
 * 2. K8S_KUBECONFIG env var
 * 3. KUBECONFIG env var (colon-separated)
 * 4. ~/.kube/config
 * 5. In-cluster service account
 */
export function loadKubeConfig(options?: KubeConfigOptions): KubeConfig {
  const kc = new KubeConfig();

  const loaded =
    // Tier 1: Explicit path provided
    tryLoadFromFile(kc, options?.kubeconfigPath, true) ||
    // Tier 2: K8S_KUBECONFIG env var
    tryLoadFromFile(kc, process.env.K8S_KUBECONFIG, true) ||
    // Tier 3: KUBECONFIG env var (standard, colon-separated)
    tryLoadFromFile(
      kc,
      process.env.KUBECONFIG?.split(':').find((p) => p && existsSync(p))
    ) ||
    // Tier 4: Default path ~/.kube/config
    tryLoadFromFile(kc, join(homedir(), '.kube', 'config')) ||
    // Tier 5: In-cluster config
    tryLoadFromCluster(kc);

  if (!loaded) {
    throw new KubeConfigError(
      'No kubeconfig found. Tried: explicit path, K8S_KUBECONFIG, KUBECONFIG, ~/.kube/config, in-cluster'
    );
  }

  // Apply context if specified
  if (options?.context) {
    resolveContext(kc, options.context);
  }

  // Apply skipTLSVerify if requested.
  // Set on all clusters so the k8s client creates agents with rejectUnauthorized: false.
  // The bun-compat module handles translating this to bun's tls option.
  if (options?.skipTLSVerify) {
    for (const cluster of kc.clusters) {
      (cluster as { skipTLSVerify: boolean }).skipTLSVerify = true;
    }
  }

  return kc;
}

/**
 * Resolve and set the active context
 */
export function resolveContext(kc: KubeConfig, context?: string): string {
  if (context) {
    const contexts = kc.getContexts();
    const found = contexts.find((c) => c.name === context);
    if (!found) {
      throw new KubeConfigError(`Context "${context}" not found in kubeconfig`);
    }
    kc.setCurrentContext(context);
    return context;
  }

  const currentContext = kc.getCurrentContext();
  if (!currentContext) {
    throw new KubeConfigError('No current context set in kubeconfig');
  }

  return currentContext;
}

/**
 * Get cluster info from the active context
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

/**
 * Try to load a kubeconfig from a file path.
 * When `requireExists` is true, throws if the path is specified but the file is missing.
 * Returns true if the config was loaded successfully.
 */
function tryLoadFromFile(kc: KubeConfig, path?: string, requireExists = false): boolean {
  if (!path) return false;

  if (!existsSync(path)) {
    if (requireExists) {
      throw new KubeConfigError(`Kubeconfig file not found: ${path}`);
    }
    return false;
  }

  try {
    kc.loadFromFile(path);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new KubeConfigError(`Invalid kubeconfig: ${message}`);
  }
}

/**
 * Try to load in-cluster kubeconfig. Returns true if successful.
 */
function tryLoadFromCluster(kc: KubeConfig): boolean {
  try {
    kc.loadFromCluster();
    return true;
  } catch {
    return false;
  }
}
