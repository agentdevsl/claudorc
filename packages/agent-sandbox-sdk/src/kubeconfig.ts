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
  let loaded = false;

  // Tier 1: Explicit path provided
  if (options?.kubeconfigPath) {
    if (!existsSync(options.kubeconfigPath)) {
      throw new KubeConfigError(`Kubeconfig file not found: ${options.kubeconfigPath}`);
    }
    try {
      kc.loadFromFile(options.kubeconfigPath);
      loaded = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new KubeConfigError(`Invalid kubeconfig: ${message}`);
    }
  }

  // Tier 2: K8S_KUBECONFIG env var
  if (!loaded) {
    const k8sKubeconfigEnv = process.env.K8S_KUBECONFIG;
    if (k8sKubeconfigEnv) {
      if (!existsSync(k8sKubeconfigEnv)) {
        throw new KubeConfigError(`Kubeconfig file not found: ${k8sKubeconfigEnv}`);
      }
      try {
        kc.loadFromFile(k8sKubeconfigEnv);
        loaded = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new KubeConfigError(`Invalid kubeconfig: ${message}`);
      }
    }
  }

  // Tier 3: KUBECONFIG env var (standard, colon-separated)
  if (!loaded) {
    const kubeconfigEnv = process.env.KUBECONFIG;
    if (kubeconfigEnv) {
      const paths = kubeconfigEnv.split(':').filter(Boolean);
      const existingPath = paths.find((p) => existsSync(p));
      if (existingPath) {
        try {
          kc.loadFromFile(existingPath);
          loaded = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          throw new KubeConfigError(`Invalid kubeconfig: ${message}`);
        }
      }
    }
  }

  // Tier 4: Default path ~/.kube/config
  if (!loaded) {
    const defaultPath = join(homedir(), '.kube', 'config');
    if (existsSync(defaultPath)) {
      try {
        kc.loadFromFile(defaultPath);
        loaded = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new KubeConfigError(`Invalid kubeconfig: ${message}`);
      }
    }
  }

  // Tier 5: In-cluster config
  if (!loaded) {
    try {
      kc.loadFromCluster();
      loaded = true;
    } catch {
      // In-cluster config not available
    }
  }

  if (!loaded) {
    throw new KubeConfigError(
      'No kubeconfig found. Tried: explicit path, K8S_KUBECONFIG, KUBECONFIG, ~/.kube/config, in-cluster'
    );
  }

  // Apply context if specified
  if (options?.context) {
    resolveContext(kc, options.context);
  }

  // Apply skipTLSVerify if requested
  if (options?.skipTLSVerify) {
    const cluster = kc.getCurrentCluster();
    if (cluster) {
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
