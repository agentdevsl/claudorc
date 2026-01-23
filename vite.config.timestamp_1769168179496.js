// vite.config.ts
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
var stubPath = resolve(__dirname, "src/lib/agents/tools/browser-stubs.ts");
function serverOnlyStubs() {
  return {
    name: "server-only-stubs",
    enforce: "pre",
    resolveId(source, _importer) {
      const serverModules = ["bash-tool", "file-tools", "search-tools"];
      const normalized = source.replace(/\.(js|ts)$/, "");
      for (const mod of serverModules) {
        if (normalized.endsWith(mod) || normalized.endsWith(`/${mod}`)) {
          return stubPath;
        }
      }
      if (source === "better-sqlite3") {
        return "\0better-sqlite3-stub";
      }
      if (source === "node:fs" || source === "fs") {
        return "\0node-fs-stub";
      }
      if (source === "node:os" || source === "os") {
        return "\0node-os-stub";
      }
      if (source === "node:path" || source === "path") {
        return "\0node-path-stub";
      }
      if (source === "node:url" || source === "url") {
        return "\0node-url-stub";
      }
      if (source === "node:events" || source === "events") {
        return "\0node-events-stub";
      }
      if (source === "node:crypto" || source === "crypto") {
        return "\0node-crypto-stub";
      }
      if (source === "node:buffer" || source === "buffer") {
        return "\0node-buffer-stub";
      }
      if (source === "node:stream" || source === "stream") {
        return "\0node-stream-stub";
      }
      if (source === "node:util" || source === "util") {
        return "\0node-util-stub";
      }
      if (source === "node:assert" || source === "assert") {
        return "\0node-assert-stub";
      }
      if (source === "@anthropic-ai/claude-agent-sdk") {
        return "\0claude-agent-sdk-stub";
      }
      if (source === "@anthropic-ai/sdk") {
        return "\0anthropic-sdk-stub";
      }
      if (source.includes("db/client") || source === "@/db/client") {
        return "\0db-client-stub";
      }
      if (source.includes("api/runtime") || source === "@/app/routes/api/runtime") {
        return "\0api-runtime-stub";
      }
      return null;
    },
    load(id) {
      if (id === "\0better-sqlite3-stub") {
        return `
          export default class Database {
            constructor() {
              throw new Error('better-sqlite3 is only available on the server');
            }
          }
        `;
      }
      if (id === "\0node-fs-stub") {
        return `
          export const existsSync = () => false;
          export const mkdirSync = () => {};
          export const readFileSync = () => '';
          export const writeFileSync = () => {};
          export const appendFileSync = () => {};
          export const readdirSync = () => [];
          export const statSync = () => ({ isDirectory: () => false, mtime: new Date() });
          export const realpathSync = (p) => p;
          export const unlinkSync = () => {};
          export const rmdirSync = () => {};
          export const copyFileSync = () => {};
          export const renameSync = () => {};
          export const chmodSync = () => {};
          export const createReadStream = () => ({ pipe: () => {}, on: () => {} });
          export const createWriteStream = () => ({ write: () => {}, end: () => {}, on: () => {} });
          export const promises = {
            readFile: async () => '',
            writeFile: async () => {},
            mkdir: async () => {},
            stat: async () => ({ isDirectory: () => false, mtime: new Date() }),
            readdir: async () => [],
            unlink: async () => {},
            rmdir: async () => {},
            copyFile: async () => {},
            rename: async () => {},
            chmod: async () => {},
            realpath: async (p) => p,
            access: async () => {},
          };
          export default { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync, realpathSync, unlinkSync, rmdirSync, copyFileSync, renameSync, chmodSync, createReadStream, createWriteStream, promises };
        `;
      }
      if (id === "\0node-os-stub") {
        return `
          export const homedir = () => '/home/user';
          export const tmpdir = () => '/tmp';
          export const platform = () => 'browser';
          export const arch = () => 'wasm';
          export const cpus = () => [];
          export const hostname = () => 'browser';
          export default { homedir, tmpdir, platform, arch, cpus, hostname };
        `;
      }
      if (id === "\0node-path-stub") {
        return `
          export const join = (...args) => args.filter(Boolean).join('/');
          export const resolve = (...args) => args.filter(Boolean).join('/');
          export const dirname = (p) => p.split('/').slice(0, -1).join('/') || '/';
          export const basename = (p, ext) => { const base = p.split('/').pop() || ''; return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base; };
          export const extname = (p) => { const m = p.match(/\\.[^.]+$/); return m ? m[0] : ''; };
          export const sep = '/';
          export const parse = (p) => ({ dir: dirname(p), base: basename(p), ext: extname(p), name: basename(p, extname(p)), root: p.startsWith('/') ? '/' : '' });
          export default { join, resolve, dirname, basename, extname, sep, parse };
        `;
      }
      if (id === "\0node-url-stub") {
        return `
          export const fileURLToPath = (url) => url.replace('file://', '');
          export const pathToFileURL = (path) => new URL('file://' + path);
          export const URL = globalThis.URL;
          export const URLSearchParams = globalThis.URLSearchParams;
          export const parse = (urlString) => new URL(urlString);
          export const format = (urlObj) => urlObj.toString();
          export default { fileURLToPath, pathToFileURL, URL, URLSearchParams, parse, format };
        `;
      }
      if (id === "\0node-events-stub") {
        return `
          export class EventEmitter {
            constructor() { this._events = {}; }
            on(event, listener) { (this._events[event] = this._events[event] || []).push(listener); return this; }
            once(event, listener) { const fn = (...args) => { this.off(event, fn); listener(...args); }; return this.on(event, fn); }
            off(event, listener) { const arr = this._events[event]; if (arr) { const i = arr.indexOf(listener); if (i > -1) arr.splice(i, 1); } return this; }
            emit(event, ...args) { const arr = this._events[event]; if (arr) arr.forEach(fn => fn(...args)); return !!arr; }
            removeAllListeners(event) { if (event) delete this._events[event]; else this._events = {}; return this; }
            listenerCount(event) { return (this._events[event] || []).length; }
          }
          export const setMaxListeners = () => {};
          export const getMaxListeners = () => 10;
          export default EventEmitter;
        `;
      }
      if (id === "\0node-crypto-stub") {
        return `
          export const randomBytes = (size) => new Uint8Array(size).map(() => Math.floor(Math.random() * 256));
          export const randomUUID = () => crypto.randomUUID();
          export const createHash = () => ({ update: () => ({ digest: () => '' }) });
          export const createHmac = () => ({ update: () => ({ digest: () => '' }) });
          export default { randomBytes, randomUUID, createHash, createHmac };
        `;
      }
      if (id === "\0node-buffer-stub") {
        return `
          export const Buffer = {
            from: (data, encoding) => new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data)),
            alloc: (size) => new Uint8Array(size),
            isBuffer: () => false,
            concat: (arrays) => { const total = arrays.reduce((acc, arr) => acc + arr.length, 0); const result = new Uint8Array(total); let offset = 0; for (const arr of arrays) { result.set(arr, offset); offset += arr.length; } return result; },
          };
          export default { Buffer };
        `;
      }
      if (id === "\0node-stream-stub") {
        return `
          export class Readable { pipe() { return this; } on() { return this; } }
          export class Writable { write() {} end() {} on() { return this; } }
          export class Transform { pipe() { return this; } on() { return this; } }
          export class Duplex { pipe() { return this; } on() { return this; } write() {} end() {} }
          export const pipeline = (...args) => { const cb = args.pop(); cb && cb(); };
          export default { Readable, Writable, Transform, Duplex, pipeline };
        `;
      }
      if (id === "\0node-util-stub") {
        return `
          export const promisify = (fn) => (...args) => new Promise((resolve, reject) => fn(...args, (err, result) => err ? reject(err) : resolve(result)));
          export const inspect = (obj) => JSON.stringify(obj, null, 2);
          export const format = (...args) => args.map(String).join(' ');
          export const deprecate = (fn) => fn;
          export const inherits = (ctor, superCtor) => { ctor.super_ = superCtor; Object.setPrototypeOf(ctor.prototype, superCtor.prototype); };
          export const types = { isPromise: (v) => v instanceof Promise };
          export default { promisify, inspect, format, deprecate, inherits, types };
        `;
      }
      if (id === "\0node-assert-stub") {
        return `
          export const ok = (value, message) => { if (!value) throw new Error(message || 'Assertion failed'); };
          export const strictEqual = (actual, expected, message) => { if (actual !== expected) throw new Error(message || 'Assertion failed'); };
          export const deepStrictEqual = (actual, expected, message) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message || 'Assertion failed'); };
          export const fail = (message) => { throw new Error(message || 'Assertion failed'); };
          export default { ok, strictEqual, deepStrictEqual, fail };
        `;
      }
      if (id === "\0claude-agent-sdk-stub") {
        return `
          export const unstable_v2_createSession = () => {
            throw new Error('Claude Agent SDK is only available on the server');
          };
          export const query = async () => {
            throw new Error('Claude Agent SDK is only available on the server');
          };
          export default { unstable_v2_createSession, query };
        `;
      }
      if (id === "\0anthropic-sdk-stub") {
        return `
          export default class Anthropic {
            constructor() {
              throw new Error('Anthropic SDK is only available on the server');
            }
          }
        `;
      }
      if (id === "\0db-client-stub") {
        return `
          export const sqlite = null;
          export const pglite = null;
          export const db = {
            select: () => ({ from: () => ({ where: () => [] }) }),
            insert: () => ({ values: () => ({ returning: () => [] }) }),
            update: () => ({ set: () => ({ where: () => ({ returning: () => [] }) }) }),
            delete: () => ({ where: () => ({ returning: () => [] }) }),
          };
          export const createServerDb = () => db;
        `;
      }
      if (id === "\0api-runtime-stub") {
        return `
          const noopService = new Proxy({}, {
            get: () => () => Promise.resolve({ ok: true, value: [] })
          });
          export const getApiRuntime = () => ({ ok: true, value: {} });
          export const getApiRuntimeOrThrow = () => ({});
          export const getApiServices = () => ({ ok: true, value: {
            projectService: noopService,
            taskService: noopService,
            agentService: noopService,
            sessionService: noopService,
            worktreeService: noopService,
          }});
          export const getApiServicesOrThrow = () => ({
            projectService: noopService,
            taskService: noopService,
            agentService: noopService,
            sessionService: noopService,
            worktreeService: noopService,
          });
          export const getApiStreamsOrThrow = () => ({
            createStream: async () => undefined,
            publish: async () => undefined,
            subscribe: async function* () { yield { type: 'chunk', data: {} }; },
          });
        `;
      }
      return null;
    }
  };
}
var vite_config_default = defineConfig({
  define: {
    "process.env": JSON.stringify({}),
    // Note: do not include secrets here.
    "import.meta.env.VITE_E2E_SEED": JSON.stringify(process.env.VITE_E2E_SEED)
  },
  server: {
    port: Number(process.env.PORT) || 3e3,
    host: process.env.HOST || "localhost",
    proxy: {
      // Proxy API requests to the backend server
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    TanStackRouterVite({
      routesDirectory: "./src/app/routes",
      generatedRouteTree: "./src/app/routeTree.gen.ts",
      routeFileIgnorePattern: ".*\\/api\\/.*"
    }),
    react(),
    serverOnlyStubs()
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  optimizeDeps: {
    exclude: ["@anthropic-ai/claude-agent-sdk", "better-sqlite3"]
  },
  build: {
    target: "esnext",
    rollupOptions: {
      external: ["better-sqlite3"]
    }
  },
  worker: {
    format: "es"
  },
  ssr: {
    external: ["better-sqlite3"]
  }
});
export {
  vite_config_default as default
};
