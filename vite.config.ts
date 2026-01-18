import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

const stubPath = resolve(__dirname, 'src/lib/agents/tools/browser-stubs.ts');

/**
 * Plugin to replace server-only agent tools with browser stubs.
 * This prevents Node.js modules from being bundled for the browser.
 */
function serverOnlyStubs(): Plugin {
  return {
    name: 'server-only-stubs',
    enforce: 'pre',
    resolveId(source, _importer) {
      // Match imports of server-only tools by their file path patterns
      const serverModules = ['bash-tool', 'file-tools', 'search-tools'];
      const normalized = source.replace(/\.(js|ts)$/, '');

      for (const mod of serverModules) {
        if (normalized.endsWith(mod) || normalized.endsWith(`/${mod}`)) {
          return stubPath;
        }
      }

      // Stub better-sqlite3 for browser builds
      if (source === 'better-sqlite3') {
        return '\0better-sqlite3-stub';
      }

      // Stub node:fs for browser builds
      if (source === 'node:fs' || source === 'fs') {
        return '\0node-fs-stub';
      }

      // Stub db/client for browser builds (it uses better-sqlite3 and node:fs)
      if (source.includes('db/client') || source === '@/db/client') {
        return '\0db-client-stub';
      }

      // Stub API runtime for browser builds
      if (source.includes('api/runtime') || source === '@/app/routes/api/runtime') {
        return '\0api-runtime-stub';
      }

      return null;
    },
    load(id) {
      // Provide a stub for better-sqlite3 in the browser
      if (id === '\0better-sqlite3-stub') {
        return `
          export default class Database {
            constructor() {
              throw new Error('better-sqlite3 is only available on the server');
            }
          }
        `;
      }

      // Provide a stub for node:fs in the browser
      if (id === '\0node-fs-stub') {
        return `
          export const existsSync = () => false;
          export const mkdirSync = () => {};
          export const readFileSync = () => '';
          export const writeFileSync = () => {};
          export default { existsSync, mkdirSync, readFileSync, writeFileSync };
        `;
      }

      // Provide a stub for db/client in the browser
      if (id === '\0db-client-stub') {
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

      // Provide a stub for api/runtime in the browser
      if (id === '\0api-runtime-stub') {
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
    },
  };
}

export default defineConfig({
  define: {
    'process.env': JSON.stringify({}),
    // Note: do not include secrets here.
    'import.meta.env.VITE_E2E_SEED': JSON.stringify(process.env.VITE_E2E_SEED),
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    TanStackRouterVite({
      routesDirectory: './src/app/routes',
      generatedRouteTree: './src/app/routeTree.gen.ts',
      routeFileIgnorePattern: '.*\\/api\\/.*',
    }),
    react(),
    serverOnlyStubs(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: ['@anthropic-ai/claude-agent-sdk', 'better-sqlite3'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: ['better-sqlite3'],
    },
  },
  worker: {
    format: 'es',
  },
  ssr: {
    external: ['better-sqlite3'],
  },
});
