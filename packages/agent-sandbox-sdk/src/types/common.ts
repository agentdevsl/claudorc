import type { V1Condition, V1ObjectMeta } from '@kubernetes/client-node';

/**
 * Base interface for all CRD resources
 */
export interface CRDResource<TSpec = unknown, TStatus = unknown> {
  apiVersion: string;
  kind: string;
  metadata: V1ObjectMeta;
  spec: TSpec;
  status?: TStatus;
}

/**
 * List wrapper for CRD resources
 */
export interface CRDResourceList<T extends CRDResource> {
  apiVersion: string;
  kind: string;
  metadata: { resourceVersion?: string; continue?: string };
  items: T[];
}

/**
 * Watch event types
 */
export type WatchEventType = 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR' | 'BOOKMARK';

/**
 * Watch event
 */
export interface WatchEvent<T extends CRDResource> {
  type: WatchEventType;
  object: T;
}

/**
 * Standard condition from K8s status
 */
export type Condition = V1Condition;
