/**
 * Filesystem routes
 */

import { Hono } from 'hono';
import { json } from '../shared.js';

export function createFilesystemRoutes() {
  const app = new Hono();

  // GET /api/filesystem/discover-repos
  app.get('/discover-repos', async (_c) => {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    // Common directories to search for git repos
    const searchDirs = [
      `${homeDir}/git`,
      `${homeDir}/projects`,
      `${homeDir}/code`,
      `${homeDir}/Developer`,
      `${homeDir}/repos`,
      `${homeDir}/workspace`,
      `${homeDir}/src`,
    ];

    const { existsSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');

    type LocalRepo = {
      name: string;
      path: string;
      lastModified: string;
    };

    type AccessWarning = {
      path: string;
      error: string;
    };

    const repos: LocalRepo[] = [];
    const warnings: AccessWarning[] = [];

    for (const searchDir of searchDirs) {
      if (!existsSync(searchDir)) continue;

      try {
        const entries = readdirSync(searchDir);

        for (const entry of entries) {
          const fullPath = join(searchDir, entry);

          try {
            const stat = statSync(fullPath);
            if (!stat.isDirectory()) continue;

            // Check if it's a git repo
            const gitDir = join(fullPath, '.git');
            if (existsSync(gitDir)) {
              repos.push({
                name: entry,
                path: fullPath,
                lastModified: stat.mtime.toISOString(),
              });
            }
          } catch (error) {
            // Track skipped entries so user knows why repos might be missing
            const errorMsg = error instanceof Error ? error.message : 'access denied';
            console.warn(`[Discover] Skipping ${fullPath}: ${errorMsg}`);
            warnings.push({ path: fullPath, error: errorMsg });
          }
        }
      } catch (error) {
        // Track unreadable directories so user knows why repos might be missing
        const errorMsg = error instanceof Error ? error.message : 'access denied';
        console.warn(`[Discover] Cannot read ${searchDir}: ${errorMsg}`);
        warnings.push({ path: searchDir, error: errorMsg });
      }
    }

    // Sort by last modified (most recent first)
    repos.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    // Limit to 20 most recent, include warnings if any directories were inaccessible
    return json({
      ok: true,
      data: {
        repos: repos.slice(0, 20),
        ...(warnings.length > 0 && { warnings }),
      },
    });
  });

  return app;
}
