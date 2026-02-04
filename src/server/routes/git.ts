/**
 * Git view routes
 */

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { projects } from '../../db/schema';
import type { CommandRunner } from '../../services/worktree.service.js';
import type { Database } from '../../types/database.js';
import { isValidBranchName, isValidId, json } from '../shared.js';

interface GitDeps {
  db: Database;
  commandRunner: CommandRunner;
}

export function createGitRoutes({ db, commandRunner }: GitDeps) {
  const app = new Hono();

  // GET /api/git/status
  app.get('/status', async (c) => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return json(
        { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
        400
      );
    }

    if (!isValidId(projectId)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid projectId format' } },
        400
      );
    }

    try {
      // Get project to find the path
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
      }

      // Get current branch
      const { stdout: branchOutput } = await commandRunner.exec(
        'git rev-parse --abbrev-ref HEAD',
        project.path
      );
      const currentBranch = branchOutput.trim();

      // Get repo name from path
      const repoName = project.path.split('/').pop() || project.name;

      // Get git status (porcelain format for easy parsing)
      const { stdout: statusOutput } = await commandRunner.exec(
        'git status --porcelain',
        project.path
      );

      const statusLines = statusOutput
        .trim()
        .split('\n')
        .filter((line) => line.trim());
      const staged = statusLines.filter((line) => /^[MADRC]/.test(line)).length;
      const unstaged = statusLines.filter((line) => /^.[MADRC]/.test(line)).length;
      const untracked = statusLines.filter((line) => line.startsWith('??')).length;
      const hasChanges = statusLines.length > 0;

      // Get ahead/behind info
      let ahead = 0;
      let behind = 0;
      try {
        const { stdout: aheadBehind } = await commandRunner.exec(
          `git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0	0"`,
          project.path
        );
        const [aheadStr, behindStr] = aheadBehind.trim().split(/\s+/);
        ahead = parseInt(aheadStr || '0', 10) || 0;
        behind = parseInt(behindStr || '0', 10) || 0;
      } catch (error) {
        // No upstream tracking branch - this is expected for local-only branches
        console.debug(
          '[Git] No upstream for branch:',
          error instanceof Error ? error.message : 'unknown'
        );
      }

      return json({
        ok: true,
        data: {
          repoName,
          currentBranch,
          status: hasChanges ? 'dirty' : 'clean',
          staged,
          unstaged,
          untracked,
          ahead,
          behind,
        },
      });
    } catch (error) {
      console.error('[Git] Get status error:', error);
      return json(
        { ok: false, error: { code: 'GIT_ERROR', message: 'Failed to get git status' } },
        500
      );
    }
  });

  // GET /api/git/branches
  app.get('/branches', async (c) => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return json(
        { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
        400
      );
    }

    if (!isValidId(projectId)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid projectId format' } },
        400
      );
    }

    try {
      // Get project to find the path
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
      }

      // Get current HEAD branch
      const { stdout: headOutput } = await commandRunner.exec(
        'git rev-parse --abbrev-ref HEAD',
        project.path
      );
      const currentBranch = headOutput.trim();

      // Get all local branches with their commit info
      const { stdout: branchOutput } = await commandRunner.exec(
        'git for-each-ref --format="%(refname:short)|%(objectname)|%(objectname:short)|%(upstream:track)" refs/heads/',
        project.path
      );

      const branches = await Promise.all(
        branchOutput
          .trim()
          .split('\n')
          .filter((line) => line.trim())
          .map(async (line) => {
            const [name, commitHash, shortHash, trackInfo] = line.split('|');
            if (!name || !commitHash) return null;

            // Get commit count (commits ahead of main/master)
            let commitCount = 0;
            try {
              // Validate branch name before interpolating into shell command (prevent command injection)
              if (!isValidBranchName(name)) {
                console.warn('[Git] Skipping commit count for invalid branch name:', name);
              } else {
                const { stdout: countOutput } = await commandRunner.exec(
                  `git rev-list --count main..${name} 2>/dev/null || git rev-list --count master..${name} 2>/dev/null || echo "0"`,
                  project.path
                );
                commitCount = parseInt(countOutput.trim(), 10) || 0;
              }
            } catch (error) {
              // Commit count is optional - branch may not have a main/master base
              console.debug(
                '[Git] Could not get commit count for branch:',
                error instanceof Error ? error.message : 'unknown'
              );
            }

            // Parse tracking status
            let status: 'ahead' | 'behind' | 'diverged' | 'up-to-date' | 'no-upstream' =
              'no-upstream';
            if (trackInfo) {
              if (trackInfo.includes('ahead') && trackInfo.includes('behind')) {
                status = 'diverged';
              } else if (trackInfo.includes('ahead')) {
                status = 'ahead';
              } else if (trackInfo.includes('behind')) {
                status = 'behind';
              } else if (trackInfo === '') {
                status = 'up-to-date';
              }
            }

            return {
              name: name || '',
              commitHash: commitHash || '',
              shortHash: shortHash || '',
              commitCount,
              isHead: name === currentBranch,
              status,
            };
          })
      );

      // Filter out nulls and sort by isHead first, then by name
      const validBranches = branches
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .sort((a, b) => {
          if (a.isHead && !b.isHead) return -1;
          if (!a.isHead && b.isHead) return 1;
          return a.name.localeCompare(b.name);
        });

      return json({ ok: true, data: { items: validBranches } });
    } catch (error) {
      console.error('[Git] List branches error:', error);
      return json(
        { ok: false, error: { code: 'GIT_ERROR', message: 'Failed to list branches' } },
        500
      );
    }
  });

  // GET /api/git/commits
  app.get('/commits', async (c) => {
    const projectId = c.req.query('projectId');
    const branch = c.req.query('branch');
    const limit = parseInt(c.req.query('limit') ?? '50', 10);

    if (!projectId) {
      return json(
        { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
        400
      );
    }

    if (!isValidId(projectId)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid projectId format' } },
        400
      );
    }

    try {
      // Get project to find the path
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
      }

      // Validate branch name if provided (prevents command injection)
      if (branch && !isValidBranchName(branch)) {
        return json(
          { ok: false, error: { code: 'INVALID_BRANCH', message: 'Invalid branch name' } },
          400
        );
      }

      // Default to current branch if not specified
      const targetBranch = branch || 'HEAD';

      // Get commit log with format: hash|short|subject|author|date
      const { stdout: logOutput } = await commandRunner.exec(
        `git log ${targetBranch} --format="%H|%h|%s|%an|%aI" -n ${limit}`,
        project.path
      );

      const commits = await Promise.all(
        logOutput
          .trim()
          .split('\n')
          .filter((line) => line.trim())
          .map(async (line) => {
            const parts = line.split('|');
            const hash = parts[0] || '';
            const shortHash = parts[1] || '';
            const message = parts[2] || '';
            const author = parts[3] || '';
            const date = parts[4] || '';

            // Get file stats for each commit
            let additions: number | undefined;
            let deletions: number | undefined;
            let filesChanged: number | undefined;

            try {
              const { stdout: statsOutput } = await commandRunner.exec(
                `git show ${hash} --stat --format="" | tail -1`,
                project.path
              );
              const statsLine = statsOutput.trim();
              const filesMatch = statsLine.match(/(\d+) files? changed/);
              const insertionsMatch = statsLine.match(/(\d+) insertions?\(\+\)/);
              const deletionsMatch = statsLine.match(/(\d+) deletions?\(-\)/);

              if (filesMatch) filesChanged = parseInt(filesMatch[1] || '0', 10);
              if (insertionsMatch) additions = parseInt(insertionsMatch[1] || '0', 10);
              if (deletionsMatch) deletions = parseInt(deletionsMatch[1] || '0', 10);
            } catch (error) {
              // Stats are optional - some commits may not have stat info
              console.debug(
                '[Git] Could not get stats for commit:',
                error instanceof Error ? error.message : 'unknown'
              );
            }

            return {
              hash,
              shortHash,
              message,
              author,
              date,
              ...(additions !== undefined && { additions }),
              ...(deletions !== undefined && { deletions }),
              ...(filesChanged !== undefined && { filesChanged }),
            };
          })
      );

      return json({ ok: true, data: { items: commits } });
    } catch (error) {
      console.error('[Git] List commits error:', error);
      return json(
        { ok: false, error: { code: 'GIT_ERROR', message: 'Failed to list commits' } },
        500
      );
    }
  });

  // GET /api/git/remote-branches
  app.get('/remote-branches', async (c) => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return json(
        { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
        400
      );
    }

    if (!isValidId(projectId)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid projectId format' } },
        400
      );
    }

    try {
      // Get project to find the path
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
      }

      // Fetch latest from remote (don't fail if offline)
      try {
        await commandRunner.exec('git fetch --prune 2>/dev/null || true', project.path);
      } catch (error) {
        // Fetch is best-effort - user might be offline or have network issues
        console.debug(
          '[Git] Fetch failed (may be offline):',
          error instanceof Error ? error.message : 'unknown'
        );
      }

      // Get all remote branches with their commit info
      const { stdout: branchOutput } = await commandRunner.exec(
        'git for-each-ref --format="%(refname:short)|%(objectname)|%(objectname:short)" refs/remotes/',
        project.path
      );

      const branches = await Promise.all(
        branchOutput
          .trim()
          .split('\n')
          .filter((line) => line.trim())
          .map(async (line) => {
            const [fullName, commitHash, shortHash] = line.split('|');
            if (!fullName || !commitHash) return null;

            // Skip HEAD pointer
            if (fullName.endsWith('/HEAD')) return null;

            // Skip entries without a slash
            if (!fullName.includes('/')) return null;

            // Remove remote prefix
            const name = fullName.replace(/^[^/]+\//, '');

            // Get commit count from main/master
            let commitCount = 0;
            try {
              // Validate branch name before interpolating into shell command (prevent command injection)
              if (!isValidBranchName(fullName)) {
                console.warn(
                  '[Git] Skipping commit count for invalid remote branch name:',
                  fullName
                );
              } else {
                const { stdout: countOutput } = await commandRunner.exec(
                  `git rev-list --count main..${fullName} 2>/dev/null || git rev-list --count master..${fullName} 2>/dev/null || echo "0"`,
                  project.path
                );
                commitCount = parseInt(countOutput.trim(), 10) || 0;
              }
            } catch (error) {
              // Commit count is optional - branch may not have a main/master base
              console.debug(
                '[Git] Could not get commit count for remote branch:',
                error instanceof Error ? error.message : 'unknown'
              );
            }

            return {
              name,
              fullName: fullName || '',
              commitHash: commitHash || '',
              shortHash: shortHash || '',
              commitCount,
            };
          })
      );

      // Filter out nulls and sort by name
      const validBranches = branches
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      return json({ ok: true, data: { items: validBranches } });
    } catch (error) {
      console.error('[Git] List remote branches error:', error);
      return json(
        { ok: false, error: { code: 'GIT_ERROR', message: 'Failed to list remote branches' } },
        500
      );
    }
  });

  return app;
}
