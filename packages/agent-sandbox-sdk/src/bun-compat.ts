/**
 * Bun runtime compatibility for @kubernetes/client-node.
 *
 * The k8s client uses `node-fetch` with an `agent` option carrying TLS client
 * certificates. Bun replaces node-fetch with a wrapper around its native fetch,
 * which ignores the `agent` option. This module patches the k8s client's
 * IsomorphicFetchHttpLibrary.send() to extract cert/key/ca from the agent
 * and pass them via bun's `tls` fetch option.
 */

const isBun = typeof (globalThis as Record<string, unknown>).Bun !== 'undefined';

let patched = false;

/**
 * Apply bun compatibility patches for @kubernetes/client-node.
 * Safe to call multiple times — patches are applied only once.
 * No-op when running under Node.js.
 */
export function applyBunCompat(): void {
  if (!isBun || patched) return;
  patched = true;
  patchIsomorphicFetch();
}

interface K8sRequest {
  getHttpMethod(): { toString(): string };
  getUrl(): string;
  getBody(): unknown;
  getHeaders(): Record<string, string>;
  getSignal(): AbortSignal | undefined;
  getAgent(): HttpsAgent | undefined;
}

interface HttpsAgent {
  options?: TlsOptions;
  // The agent itself may have these directly
  cert?: unknown;
  key?: unknown;
  ca?: unknown;
  rejectUnauthorized?: boolean;
}

interface TlsOptions {
  cert?: unknown;
  key?: unknown;
  ca?: unknown;
  rejectUnauthorized?: boolean;
}

function patchIsomorphicFetch(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const httpModule = require('@kubernetes/client-node/dist/gen/http/isomorphic-fetch.js');
    const HttpLibrary = httpModule.IsomorphicFetchHttpLibrary;
    if (!HttpLibrary) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ResponseContext } = require('@kubernetes/client-node/dist/gen/http/http.js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { from } = require('@kubernetes/client-node/dist/gen/rxjsStub.js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeFetch = require('node-fetch');

    HttpLibrary.prototype.send = (request: K8sRequest) => {
      const method = request.getHttpMethod().toString();
      const body = request.getBody();
      const agent = request.getAgent();

      // Build fetch options — translate agent TLS options to bun's tls option
      const fetchOpts: Record<string, unknown> = {
        method,
        body,
        headers: request.getHeaders(),
        signal: request.getSignal(),
      };

      if (agent) {
        const src = agent.options || agent;
        fetchOpts.tls = {
          cert: src.cert,
          key: src.key,
          ca: src.ca,
          rejectUnauthorized: src.rejectUnauthorized,
        };
        // Don't pass agent — bun ignores it
      }

      const resultPromise = nodeFetch(request.getUrl(), fetchOpts).then(
        (resp: {
          status: number;
          headers: { forEach: (fn: (v: string, k: string) => void) => void };
          text: () => Promise<string>;
          buffer: () => Promise<Buffer>;
        }) => {
          const headers: Record<string, string> = {};
          resp.headers.forEach((value: string, name: string) => {
            headers[name] = value;
          });
          const respBody = {
            text: () => resp.text(),
            binary: () => resp.buffer(),
          };
          return new ResponseContext(resp.status, headers, respBody);
        }
      );
      return from(resultPromise);
    };
  } catch {
    // If patching fails (e.g. different k8s-client version), fall back silently
  }
}
