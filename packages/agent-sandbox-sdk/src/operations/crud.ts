import type { KubeConfig } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';
import { AgentSandboxError, AlreadyExistsError, NotFoundError } from '../errors.js';
import type { CRDResource, CRDResourceList } from '../types/common.js';

/**
 * Configuration for CustomResourceCrud
 */
export interface CrudConfig {
  /** API group (e.g., 'agents.x-k8s.io') */
  group: string;
  /** API version (e.g., 'v1alpha1') */
  version: string;
  /** Resource plural (e.g., 'sandboxes') */
  plural: string;
}

/**
 * Options for list operations
 */
export interface ListOptions {
  /** Namespace (omit for cluster-scoped) */
  namespace?: string;
  /** Label selector */
  labelSelector?: string;
  /** Field selector */
  fieldSelector?: string;
  /** Maximum items to return */
  limit?: number;
  /** Continue token for pagination */
  continueToken?: string;
}

/**
 * Generic CRUD for any custom resource
 */
export class CustomResourceCrud<T extends CRDResource> {
  private api: k8s.CustomObjectsApi;

  constructor(
    kc: KubeConfig,
    private config: CrudConfig
  ) {
    this.api = kc.makeApiClient(k8s.CustomObjectsApi);
  }

  /** Create a resource */
  async create(namespace: string, body: T): Promise<T> {
    try {
      const response = await this.api.createNamespacedCustomObject({
        group: this.config.group,
        version: this.config.version,
        namespace,
        plural: this.config.plural,
        body,
      });
      return response as T;
    } catch (error) {
      if (this.isHttpError(error) && error.statusCode === 409) {
        throw new AlreadyExistsError(body.kind, body.metadata.name ?? 'unknown');
      }
      throw this.wrapError('create', error);
    }
  }

  /** Get a resource by name */
  async get(namespace: string, name: string): Promise<T> {
    try {
      const response = await this.api.getNamespacedCustomObject({
        group: this.config.group,
        version: this.config.version,
        namespace,
        plural: this.config.plural,
        name,
      });
      return response as T;
    } catch (error) {
      if (this.isHttpError(error) && error.statusCode === 404) {
        throw new NotFoundError(this.config.plural, name, namespace);
      }
      throw this.wrapError('get', error);
    }
  }

  /** List resources */
  async list(options?: ListOptions): Promise<CRDResourceList<T>> {
    try {
      const shared = {
        group: this.config.group,
        version: this.config.version,
        plural: this.config.plural,
        labelSelector: options?.labelSelector,
        fieldSelector: options?.fieldSelector,
        limit: options?.limit,
        _continue: options?.continueToken,
      };

      const response = options?.namespace
        ? await this.api.listNamespacedCustomObject({ ...shared, namespace: options.namespace })
        : await this.api.listClusterCustomObject(shared);

      return response as CRDResourceList<T>;
    } catch (error) {
      throw this.wrapError('list', error);
    }
  }

  /** Update a resource (full replacement) */
  async update(namespace: string, name: string, body: T): Promise<T> {
    try {
      const response = await this.api.replaceNamespacedCustomObject({
        group: this.config.group,
        version: this.config.version,
        namespace,
        plural: this.config.plural,
        name,
        body,
      });
      return response as T;
    } catch (error) {
      if (this.isHttpError(error) && error.statusCode === 404) {
        throw new NotFoundError(this.config.plural, name, namespace);
      }
      throw this.wrapError('update', error);
    }
  }

  /** Patch a resource (strategic merge patch) */
  async patch(namespace: string, name: string, patch: Partial<T>): Promise<T> {
    try {
      const response = await this.api.patchNamespacedCustomObject({
        group: this.config.group,
        version: this.config.version,
        namespace,
        plural: this.config.plural,
        name,
        body: patch,
      });
      return response as T;
    } catch (error) {
      if (this.isHttpError(error) && error.statusCode === 404) {
        throw new NotFoundError(this.config.plural, name, namespace);
      }
      throw this.wrapError('patch', error);
    }
  }

  /** Delete a resource */
  async delete(namespace: string, name: string): Promise<void> {
    try {
      await this.api.deleteNamespacedCustomObject({
        group: this.config.group,
        version: this.config.version,
        namespace,
        plural: this.config.plural,
        name,
      });
    } catch (error) {
      if (this.isHttpError(error) && error.statusCode === 404) {
        throw new NotFoundError(this.config.plural, name, namespace);
      }
      throw this.wrapError('delete', error);
    }
  }

  /** Check if a resource exists */
  async exists(namespace: string, name: string): Promise<boolean> {
    try {
      await this.get(namespace, name);
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false;
      }
      throw error;
    }
  }

  private isHttpError(error: unknown): error is { statusCode: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof (error as { statusCode: unknown }).statusCode === 'number'
    );
  }

  private wrapError(operation: string, error: unknown): AgentSandboxError {
    if (error instanceof AgentSandboxError) {
      return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = this.isHttpError(error) ? error.statusCode : undefined;
    return new AgentSandboxError(
      `CRUD ${operation} failed: ${message}`,
      'K8S_API_ERROR',
      statusCode
    );
  }
}
