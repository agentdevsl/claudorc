import type * as k8s from '@kubernetes/client-node';
import { K8sErrors } from '../../errors/k8s-errors.js';

/**
 * RBAC resource names
 */
export const RBAC_NAMES = {
  serviceAccount: 'agentpane-sandbox-controller',
  role: 'sandbox-manager',
  roleBinding: 'agentpane-sandbox-controller-binding',
  clusterRole: 'agentpane-cluster-reader',
  clusterRoleBinding: 'agentpane-cluster-reader-binding',
};

/**
 * RBAC configuration
 */
export interface RbacConfig {
  /** Namespace for the service account and role */
  namespace: string;

  /** Whether to create cluster-level read access */
  createClusterRole?: boolean;
}

/**
 * Manages Kubernetes RBAC resources for AgentPane sandbox operations
 */
export class K8sRbacManager {
  constructor(
    private coreApi: k8s.CoreV1Api,
    private rbacApi: k8s.RbacAuthorizationV1Api,
    private namespace: string
  ) {}

  /**
   * Ensure all RBAC resources exist
   */
  async ensureRbac(config?: { createClusterRole?: boolean }): Promise<void> {
    await this.ensureServiceAccount();
    await this.ensureRole();
    await this.ensureRoleBinding();

    if (config?.createClusterRole !== false) {
      await this.ensureClusterRole();
      await this.ensureClusterRoleBinding();
    }
  }

  /**
   * Create or verify the service account exists
   */
  async ensureServiceAccount(): Promise<void> {
    const serviceAccount: k8s.V1ServiceAccount = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: RBAC_NAMES.serviceAccount,
        namespace: this.namespace,
        labels: {
          'agentpane.io/managed': 'true',
          'agentpane.io/component': 'sandbox-controller',
        },
      },
    };

    try {
      await this.coreApi.createNamespacedServiceAccount({
        namespace: this.namespace,
        body: serviceAccount,
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        throw K8sErrors.SERVICE_ACCOUNT_CREATION_FAILED(RBAC_NAMES.serviceAccount, message);
      }
    }
  }

  /**
   * Create or verify the role exists
   */
  async ensureRole(): Promise<void> {
    const role: k8s.V1Role = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        name: RBAC_NAMES.role,
        namespace: this.namespace,
        labels: {
          'agentpane.io/managed': 'true',
          'agentpane.io/component': 'sandbox-controller',
        },
      },
      rules: [
        // Pod management
        {
          apiGroups: [''],
          resources: ['pods'],
          verbs: ['create', 'get', 'list', 'watch', 'delete', 'deletecollection'],
        },
        // Pod logs
        {
          apiGroups: [''],
          resources: ['pods/log'],
          verbs: ['get', 'list'],
        },
        // Pod exec
        {
          apiGroups: [''],
          resources: ['pods/exec'],
          verbs: ['create', 'get'],
        },
        // Pod attach
        {
          apiGroups: [''],
          resources: ['pods/attach'],
          verbs: ['create', 'get'],
        },
        // Pod status
        {
          apiGroups: [''],
          resources: ['pods/status'],
          verbs: ['get'],
        },
        // Events
        {
          apiGroups: [''],
          resources: ['events'],
          verbs: ['get', 'list', 'watch'],
        },
        // ConfigMaps
        {
          apiGroups: [''],
          resources: ['configmaps'],
          verbs: ['create', 'get', 'list', 'delete'],
        },
        // Secrets
        {
          apiGroups: [''],
          resources: ['secrets'],
          verbs: ['create', 'get', 'delete'],
        },
        // NetworkPolicies
        {
          apiGroups: ['networking.k8s.io'],
          resources: ['networkpolicies'],
          verbs: ['create', 'get', 'list', 'update', 'delete'],
        },
        // ResourceQuotas
        {
          apiGroups: [''],
          resources: ['resourcequotas'],
          verbs: ['get', 'list'],
        },
        // LimitRanges
        {
          apiGroups: [''],
          resources: ['limitranges'],
          verbs: ['get', 'list', 'create'],
        },
      ],
    };

    try {
      await this.rbacApi.createNamespacedRole({
        namespace: this.namespace,
        body: role,
      });
    } catch (error) {
      if (this.isAlreadyExistsError(error)) {
        // Update existing role
        try {
          await this.rbacApi.replaceNamespacedRole({
            name: RBAC_NAMES.role,
            namespace: this.namespace,
            body: role,
          });
        } catch (updateError) {
          const message = updateError instanceof Error ? updateError.message : String(updateError);
          throw K8sErrors.ROLE_CREATION_FAILED(RBAC_NAMES.role, message);
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw K8sErrors.ROLE_CREATION_FAILED(RBAC_NAMES.role, message);
      }
    }
  }

  /**
   * Create or verify the role binding exists
   */
  async ensureRoleBinding(): Promise<void> {
    const roleBinding: k8s.V1RoleBinding = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: RBAC_NAMES.roleBinding,
        namespace: this.namespace,
        labels: {
          'agentpane.io/managed': 'true',
          'agentpane.io/component': 'sandbox-controller',
        },
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: RBAC_NAMES.serviceAccount,
          namespace: this.namespace,
        },
      ],
      roleRef: {
        kind: 'Role',
        name: RBAC_NAMES.role,
        apiGroup: 'rbac.authorization.k8s.io',
      },
    };

    try {
      await this.rbacApi.createNamespacedRoleBinding({
        namespace: this.namespace,
        body: roleBinding,
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        throw K8sErrors.ROLE_BINDING_CREATION_FAILED(RBAC_NAMES.roleBinding, message);
      }
    }
  }

  /**
   * Create or verify the cluster role exists
   */
  async ensureClusterRole(): Promise<void> {
    const clusterRole: k8s.V1ClusterRole = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: {
        name: RBAC_NAMES.clusterRole,
        labels: {
          'agentpane.io/managed': 'true',
          'agentpane.io/component': 'sandbox-controller',
        },
      },
      rules: [
        // Namespace read
        {
          apiGroups: [''],
          resources: ['namespaces'],
          verbs: ['get', 'list'],
        },
        // Nodes (for cluster info)
        {
          apiGroups: [''],
          resources: ['nodes'],
          verbs: ['list'],
        },
      ],
    };

    try {
      await this.rbacApi.createClusterRole({
        body: clusterRole,
      });
    } catch (error) {
      if (this.isAlreadyExistsError(error)) {
        // Update existing cluster role
        try {
          await this.rbacApi.replaceClusterRole({
            name: RBAC_NAMES.clusterRole,
            body: clusterRole,
          });
        } catch (updateError) {
          const message = updateError instanceof Error ? updateError.message : String(updateError);
          throw K8sErrors.ROLE_CREATION_FAILED(RBAC_NAMES.clusterRole, message);
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw K8sErrors.ROLE_CREATION_FAILED(RBAC_NAMES.clusterRole, message);
      }
    }
  }

  /**
   * Create or verify the cluster role binding exists
   */
  async ensureClusterRoleBinding(): Promise<void> {
    const clusterRoleBinding: k8s.V1ClusterRoleBinding = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: {
        name: RBAC_NAMES.clusterRoleBinding,
        labels: {
          'agentpane.io/managed': 'true',
          'agentpane.io/component': 'sandbox-controller',
        },
      },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: RBAC_NAMES.serviceAccount,
          namespace: this.namespace,
        },
      ],
      roleRef: {
        kind: 'ClusterRole',
        name: RBAC_NAMES.clusterRole,
        apiGroup: 'rbac.authorization.k8s.io',
      },
    };

    try {
      await this.rbacApi.createClusterRoleBinding({
        body: clusterRoleBinding,
      });
    } catch (error) {
      if (!this.isAlreadyExistsError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        throw K8sErrors.ROLE_BINDING_CREATION_FAILED(RBAC_NAMES.clusterRoleBinding, message);
      }
    }
  }

  /**
   * Delete all RBAC resources
   */
  async deleteRbac(): Promise<void> {
    // Delete in reverse order of dependencies
    try {
      await this.rbacApi.deleteClusterRoleBinding({
        name: RBAC_NAMES.clusterRoleBinding,
      });
    } catch {
      // Ignore errors
    }

    try {
      await this.rbacApi.deleteClusterRole({
        name: RBAC_NAMES.clusterRole,
      });
    } catch {
      // Ignore errors
    }

    try {
      await this.rbacApi.deleteNamespacedRoleBinding({
        name: RBAC_NAMES.roleBinding,
        namespace: this.namespace,
      });
    } catch {
      // Ignore errors
    }

    try {
      await this.rbacApi.deleteNamespacedRole({
        name: RBAC_NAMES.role,
        namespace: this.namespace,
      });
    } catch {
      // Ignore errors
    }

    try {
      await this.coreApi.deleteNamespacedServiceAccount({
        name: RBAC_NAMES.serviceAccount,
        namespace: this.namespace,
      });
    } catch {
      // Ignore errors
    }
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
}

/**
 * Create an RBAC manager
 */
export function createRbacManager(
  coreApi: k8s.CoreV1Api,
  rbacApi: k8s.RbacAuthorizationV1Api,
  namespace: string
): K8sRbacManager {
  return new K8sRbacManager(coreApi, rbacApi, namespace);
}
