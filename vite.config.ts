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
    resolveId(source) {
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
