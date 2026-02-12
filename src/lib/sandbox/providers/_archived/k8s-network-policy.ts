import type * as k8s from '@kubernetes/client-node';
import { K8sErrors } from '../../errors/k8s-errors.js';
import { K8S_POD_LABELS } from './k8s-config.js';

/**
 * Configuration for network policy creation
 */
export interface NetworkPolicyConfig {
  /** Namespace where the policy will be created */
  namespace: string;

  /** Whether network policies are enabled */
  enabled: boolean;

  /** List of allowed egress hosts (FQDNs, IPs, or CIDR ranges) */
  allowedEgressHosts?: string[];

  /** Whether to allow DNS egress (default: true) */
  allowDns?: boolean;

  /** Whether to allow HTTPS egress to public internet (default: true) */
  allowHttps?: boolean;

  /** Whether to allow HTTP egress (default: false) */
  allowHttp?: boolean;

  /** Whether to allow SSH egress for Git (default: true) */
  allowSsh?: boolean;
}

/**
 * Default network policy configuration
 */
export const NETWORK_POLICY_DEFAULTS: Omit<NetworkPolicyConfig, 'namespace'> = {
  enabled: true,
  allowDns: true,
  allowHttps: true,
  allowHttp: false,
  allowSsh: true,
  allowedEgressHosts: [],
};

/**
 * Private IP ranges to exclude from egress (RFC 1918 + special ranges)
 */
export const PRIVATE_IP_RANGES = [
  '10.0.0.0/8', // Class A private
  '172.16.0.0/12', // Class B private
  '192.168.0.0/16', // Class C private
  '169.254.0.0/16', // Link-local (APIPA)
  '127.0.0.0/8', // Loopback
];

/**
 * NetworkPolicy name constants
 */
export const NETWORK_POLICY_NAMES = {
  defaultDeny: 'sandbox-default-policy',
  perSandbox: (sandboxId: string) => `sandbox-${sandboxId}-policy`,
};

/**
 * Manages Kubernetes NetworkPolicies for sandbox pods
 */
export class K8sNetworkPolicyManager {
  constructor(
    private networkingApi: k8s.NetworkingV1Api,
    private namespace: string
  ) {}

  /**
   * Create or update the default network policy for all sandbox pods
   */
  async ensureDefaultPolicy(config: Omit<NetworkPolicyConfig, 'namespace'>): Promise<void> {
    if (!config.enabled) {
      // If disabled, try to delete existing policy
      await this.deletePolicy(NETWORK_POLICY_NAMES.defaultDeny);
      return;
    }

    const policy = this.buildDefaultPolicy(config);

    try {
      // Try to create first
      await this.networkingApi.createNamespacedNetworkPolicy({
        namespace: this.namespace,
        body: policy,
      });
    } catch (error) {
      // If already exists, update it
      if (this.isAlreadyExistsError(error)) {
        try {
          await this.networkingApi.replaceNamespacedNetworkPolicy({
            name: NETWORK_POLICY_NAMES.defaultDeny,
            namespace: this.namespace,
            body: policy,
          });
        } catch (updateError) {
          const message = updateError instanceof Error ? updateError.message : String(updateError);
          throw K8sErrors.NETWORK_POLICY_UPDATE_FAILED(NETWORK_POLICY_NAMES.defaultDeny, message);
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw K8sErrors.NETWORK_POLICY_CREATION_FAILED(NETWORK_POLICY_NAMES.defaultDeny, message);
      }
    }
  }

  /**
   * Create a per-sandbox network policy with custom egress rules
   */
  async createSandboxPolicy(
    sandboxId: string,
    projectId: string,
    config: Omit<NetworkPolicyConfig, 'namespace'>
  ): Promise<void> {
    if (!config.enabled) {
      return;
    }

    const policyName = NETWORK_POLICY_NAMES.perSandbox(sandboxId);
    const policy = this.buildSandboxPolicy(policyName, sandboxId, projectId, config);

    try {
      await this.networkingApi.createNamespacedNetworkPolicy({
        namespace: this.namespace,
        body: policy,
      });
    } catch (error) {
      if (this.isAlreadyExistsError(error)) {
        // Policy already exists, update it
        try {
          await this.networkingApi.replaceNamespacedNetworkPolicy({
            name: policyName,
            namespace: this.namespace,
            body: policy,
          });
        } catch (updateError) {
          const message = updateError instanceof Error ? updateError.message : String(updateError);
          throw K8sErrors.NETWORK_POLICY_UPDATE_FAILED(policyName, message);
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw K8sErrors.NETWORK_POLICY_CREATION_FAILED(policyName, message);
      }
    }
  }

  /**
   * Delete a sandbox-specific network policy
   */
  async deleteSandboxPolicy(sandboxId: string): Promise<void> {
    const policyName = NETWORK_POLICY_NAMES.perSandbox(sandboxId);
    await this.deletePolicy(policyName);
  }

  /**
   * Delete a network policy by name
   */
  async deletePolicy(policyName: string): Promise<void> {
    try {
      await this.networkingApi.deleteNamespacedNetworkPolicy({
        name: policyName,
        namespace: this.namespace,
      });
    } catch (error) {
      // Ignore not found errors
      if (this.isNotFoundError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw K8sErrors.NETWORK_POLICY_DELETION_FAILED(policyName, message);
    }
  }

  /**
   * List all network policies in the namespace
   */
  async listPolicies(): Promise<k8s.V1NetworkPolicy[]> {
    const response = await this.networkingApi.listNamespacedNetworkPolicy({
      namespace: this.namespace,
      labelSelector: 'agentpane.io/managed=true',
    });
    return response.items;
  }

  /**
   * Check if a network policy exists
   */
  async policyExists(policyName: string): Promise<boolean> {
    try {
      await this.networkingApi.readNamespacedNetworkPolicy({
        name: policyName,
        namespace: this.namespace,
      });
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Build the default network policy for all sandbox pods
   */
  private buildDefaultPolicy(config: Omit<NetworkPolicyConfig, 'namespace'>): k8s.V1NetworkPolicy {
    const egress = this.buildEgressRules(config);

    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: NETWORK_POLICY_NAMES.defaultDeny,
        namespace: this.namespace,
        labels: {
          'agentpane.io/managed': 'true',
          'agentpane.io/policy-type': 'default',
        },
      },
      spec: {
        podSelector: {
          matchLabels: {
            [K8S_POD_LABELS.sandbox]: 'true',
          },
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [], // Deny all ingress
        egress,
      },
    };
  }

  /**
   * Build a per-sandbox network policy
   */
  private buildSandboxPolicy(
    policyName: string,
    sandboxId: string,
    projectId: string,
    config: Omit<NetworkPolicyConfig, 'namespace'>
  ): k8s.V1NetworkPolicy {
    const egress = this.buildEgressRules(config);

    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: policyName,
        namespace: this.namespace,
        labels: {
          'agentpane.io/managed': 'true',
          'agentpane.io/policy-type': 'sandbox',
          [K8S_POD_LABELS.sandboxId]: sandboxId,
          [K8S_POD_LABELS.projectId]: projectId,
        },
      },
      spec: {
        podSelector: {
          matchLabels: {
            [K8S_POD_LABELS.sandboxId]: sandboxId,
          },
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [], // Deny all ingress
        egress,
      },
    };
  }

  /**
   * Build egress rules based on configuration
   */
  private buildEgressRules(
    config: Omit<NetworkPolicyConfig, 'namespace'>
  ): k8s.V1NetworkPolicyEgressRule[] {
    const egress: k8s.V1NetworkPolicyEgressRule[] = [];

    // DNS egress (required for name resolution)
    if (config.allowDns !== false) {
      egress.push({
        to: [
          {
            namespaceSelector: {},
            podSelector: {
              matchLabels: {
                'k8s-app': 'kube-dns',
              },
            },
          },
        ],
        ports: [
          { protocol: 'UDP', port: 53 },
          { protocol: 'TCP', port: 53 },
        ],
      });
    }

    // HTTPS egress (external only)
    if (config.allowHttps !== false) {
      egress.push({
        to: [
          {
            ipBlock: {
              cidr: '0.0.0.0/0',
              except: PRIVATE_IP_RANGES,
            },
          },
        ],
        ports: [{ protocol: 'TCP', port: 443 }],
      });
    }

    // HTTP egress (external only, optional)
    if (config.allowHttp === true) {
      egress.push({
        to: [
          {
            ipBlock: {
              cidr: '0.0.0.0/0',
              except: PRIVATE_IP_RANGES,
            },
          },
        ],
        ports: [{ protocol: 'TCP', port: 80 }],
      });
    }

    // SSH egress (external only, for Git)
    if (config.allowSsh !== false) {
      egress.push({
        to: [
          {
            ipBlock: {
              cidr: '0.0.0.0/0',
              except: PRIVATE_IP_RANGES,
            },
          },
        ],
        ports: [{ protocol: 'TCP', port: 22 }],
      });
    }

    // Custom allowed hosts (TODO: requires external DNS resolver or IP lookup)
    // NetworkPolicies don't support FQDNs directly, only CIDR ranges
    // For now, we document this limitation - users must specify IPs/CIDRs
    if (config.allowedEgressHosts && config.allowedEgressHosts.length > 0) {
      const ipBlocks = config.allowedEgressHosts
        .filter((host) => this.isIpOrCidr(host))
        .map((ip) => ({
          ipBlock: {
            cidr: ip.includes('/') ? ip : `${ip}/32`,
          },
        }));

      if (ipBlocks.length > 0) {
        egress.push({
          to: ipBlocks,
          ports: [
            { protocol: 'TCP', port: 443 },
            { protocol: 'TCP', port: 80 },
          ],
        });
      }
    }

    return egress;
  }

  /**
   * Check if a string is an IP address or CIDR range
   */
  private isIpOrCidr(value: string): boolean {
    // Simple check for IP address or CIDR
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Pattern = /^([0-9a-fA-F:]+)(\/\d{1,3})?$/;
    return ipv4Pattern.test(value) || ipv6Pattern.test(value);
  }

  /**
   * Check if error is an AlreadyExists error
   */
  private isAlreadyExistsError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'body' in error) {
      const k8sError = error as { body?: { reason?: string } };
      return k8sError.body?.reason === 'AlreadyExists';
    }
    return false;
  }

  /**
   * Check if error is a NotFound error
   */
  private isNotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      if ('response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        return httpError.response?.statusCode === 404;
      }
      if ('body' in error) {
        const k8sError = error as { body?: { reason?: string } };
        return k8sError.body?.reason === 'NotFound';
      }
    }
    return false;
  }
}

/**
 * Create a NetworkPolicy manager
 */
export function createNetworkPolicyManager(
  networkingApi: k8s.NetworkingV1Api,
  namespace: string
): K8sNetworkPolicyManager {
  return new K8sNetworkPolicyManager(networkingApi, namespace);
}
