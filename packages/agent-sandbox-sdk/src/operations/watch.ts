import type { KubeConfig } from '@kubernetes/client-node';
import * as k8s from '@kubernetes/client-node';
import type { CRDResource, WatchEvent } from '../types/common.js';
import type { CrudConfig } from './crud.js';

/**
 * Options for watch operations
 */
export interface WatchOptions {
  /** Namespace to watch */
  namespace: string;
  /** Label selector filter */
  labelSelector?: string;
  /** Resource version to start from */
  resourceVersion?: string;
  /** Timeout in seconds (server-side) */
  timeoutSeconds?: number;
}

/**
 * Watch callback
 */
export type WatchCallback<T extends CRDResource> = (event: WatchEvent<T>) => void;

/**
 * Watch handle returned by startWatch
 */
export interface WatchHandle {
  /** Stop watching */
  stop(): void;
  /** Promise that resolves when the watch is done */
  done: Promise<void>;
}

/**
 * Start watching custom resources
 */
export function startWatch<T extends CRDResource>(
  kc: KubeConfig,
  config: CrudConfig,
  options: WatchOptions,
  callback: WatchCallback<T>
): WatchHandle {
  const watch = new k8s.Watch(kc);
  const path = `/apis/${config.group}/${config.version}/namespaces/${options.namespace}/${config.plural}`;

  let abortRequest: (() => void) | undefined;

  const queryParams: Record<string, string> = {};
  if (options.labelSelector) queryParams.labelSelector = options.labelSelector;
  if (options.resourceVersion) queryParams.resourceVersion = options.resourceVersion;
  if (options.timeoutSeconds) queryParams.timeoutSeconds = String(options.timeoutSeconds);

  const done = new Promise<void>((resolve, reject) => {
    watch
      .watch(
        path,
        queryParams,
        (type: string, apiObj: T) => {
          callback({ type: type as WatchEvent<T>['type'], object: apiObj });
        },
        (err?: Error) => (err ? reject(err) : resolve())
      )
      .then((req) => {
        abortRequest = () => req.abort();
      })
      .catch(reject);
  });

  return {
    stop: () => abortRequest?.(),
    done,
  };
}
