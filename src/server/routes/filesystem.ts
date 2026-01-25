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

    const repos: LocalRepo[] = [];

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
            // Log skipped entries for debugging
            console.debug(
              `[Discover] Skipping ${fullPath}:`,
              error instanceof Error ? error.message : 'access denied'
            );
          }
        }
      } catch (error) {
        // Log unreadable directories for debugging
        console.debug(
          `[Discover] Cannot read ${searchDir}:`,
          error instanceof Error ? error.message : 'access denied'
        );
      }
    }

    // Sort by last modified (most recent first)
    repos.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    // Limit to 20 most recent
    return json({ ok: true, data: { repos: repos.slice(0, 20) } });
  });

  return app;
}
