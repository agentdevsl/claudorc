import path from 'node:path';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, lt } from 'drizzle-orm';
import type { Database } from '../types/database.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Worktree, WorktreeStatus } from '../db/schema/worktrees.js';
import { worktrees } from '../db/schema/worktrees.js';
import { projects } from '../db/schema/projects.js';
import type { WorktreeError } from '../lib/errors/worktree-errors.js';
import { WorktreeErrors } from '../lib/errors/worktree-errors.js';

export type WorktreeCreateInput = {
  projectId: string;
  taskId: string;
  baseBranch?: string;
};

export type WorktreeSetupOptions = {
  skipEnvCopy?: boolean;
  skipDepsInstall?: boolean;
  skipInitScript?: boolean;
};

export type DiffHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
};

export type DiffFile = {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
};

export type GitDiff = {
  files: DiffFile[];
  stats: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
};

export type WorktreeStatusInfo = {
  id: string;
  branch: string;
  status: WorktreeStatus;
  path: string;
  updatedAt: Date | null;
};

export type WorktreeServiceResult<T> = Promise<Result<T, WorktreeError>>;

/**
 * Escapes a string for safe use in shell commands within double quotes.
 * Escapes: backslash, double quote, backtick, dollar sign, and newlines.
 */
const escapeShellString = (str: string): string => {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n');
};

const extractHunks = (diff: string, filePath: string): string[] => {
  const hunks = diff.split(`diff --git a/${filePath} b/${filePath}`);
  if (hunks.length < 2) {
    return [];
  }

  const lines = hunks[1].split('\n');
  return lines.filter((line) => line.startsWith('@@'));
};

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type CommandRunner = {
  exec: (command: string, cwd: string) => Promise<CommandResult>;
};

export class WorktreeService {
  constructor(
    private db: Database,
    private runner: CommandRunner
  ) {}

  async create(
    input: WorktreeCreateInput,
    options?: WorktreeSetupOptions
  ): WorktreeServiceResult<Worktree> {
    const { projectId, taskId, baseBranch = 'main' } = input;

    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return err(WorktreeErrors.CREATION_FAILED('unknown', 'Project not found'));
    }

    const branchId = createId();
    const branch = `agent/${branchId}/${taskId}`;
    const root = project.config?.worktreeRoot ?? '.worktrees';
    const worktreePath = path.join(project.path, root, branch.replaceAll('/', '-'));

    const branchCheck = await this.runner.exec(`git branch --list ${branch}`, project.path);
    if (branchCheck.stdout.trim()) {
      return err(WorktreeErrors.BRANCH_EXISTS(branch));
    }

    try {
      const escapedPath = escapeShellString(worktreePath);
      const escapedBranch = escapeShellString(branch);
      const escapedBaseBranch = escapeShellString(baseBranch);

      await this.runner.exec(
        `git worktree add "${escapedPath}" -b "${escapedBranch}" "${escapedBaseBranch}"`,
        project.path
      );
    } catch (error) {
      return err(WorktreeErrors.CREATION_FAILED(branch, String(error)));
    }

    const [worktree] = await this.db
      .insert(worktrees)
      .values({
        projectId,
        taskId,
        branch,
        path: worktreePath,
        baseBranch,
        status: 'creating',
      })
      .returning();

    if (!options?.skipEnvCopy) {
      await this.copyEnv(worktree.id);
    }
    if (!options?.skipDepsInstall) {
      await this.installDeps(worktree.id);
    }
    if (!options?.skipInitScript && project.config?.initScript) {
      await this.runInitScript(worktree.id);
    }

    await this.db
      .update(worktrees)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(worktrees.id, worktree.id));

    return ok({ ...worktree, status: 'active' });
  }

  async remove(worktreeId: string, force = false): WorktreeServiceResult<void> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
      with: { project: true },
    });

    if (!worktree) {
      return err(WorktreeErrors.NOT_FOUND);
    }

    await this.db
      .update(worktrees)
      .set({ status: 'removing', updatedAt: new Date() })
      .where(eq(worktrees.id, worktreeId));

    try {
      const forceFlag = force ? '--force' : '';
      const escapedPath = escapeShellString(worktree.path);
      const escapedBranch = escapeShellString(worktree.branch);

      await this.runner.exec(
        `git worktree remove "${escapedPath}" ${forceFlag}`,
        worktree.project.path
      );
      await this.runner.exec(`git branch -D "${escapedBranch}"`, worktree.project.path);

      await this.db
        .update(worktrees)
        .set({ status: 'removed', removedAt: new Date(), updatedAt: new Date() })
        .where(eq(worktrees.id, worktreeId));

      return ok(undefined);
    } catch (error) {
      await this.db
        .update(worktrees)
        .set({ status: 'error', updatedAt: new Date() })
        .where(eq(worktrees.id, worktreeId));

      return err(WorktreeErrors.REMOVAL_FAILED(worktree.path, String(error)));
    }
  }

  async prune(projectId: string): WorktreeServiceResult<number> {
    const stale = await this.db.query.worktrees.findMany({
      where: and(
        eq(worktrees.projectId, projectId),
        eq(worktrees.status, 'active'),
        lt(worktrees.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ),
    });

    let pruned = 0;
    for (const worktree of stale) {
      const result = await this.remove(worktree.id, true);
      if (result.ok) {
        pruned += 1;
      }
    }

    return ok(pruned);
  }

  async copyEnv(worktreeId: string): WorktreeServiceResult<void> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
      with: { project: true },
    });

    if (!worktree) {
      return err(WorktreeErrors.NOT_FOUND);
    }

    const envFile = worktree.project.config?.envFile ?? '.env';
    const sourcePath = path.join(worktree.project.path, envFile);
    const targetPath = path.join(worktree.path, envFile);

    try {
      const escapedSource = escapeShellString(sourcePath);
      const escapedTarget = escapeShellString(targetPath);
      await this.runner.exec(`cp "${escapedSource}" "${escapedTarget}"`, worktree.project.path);
      return ok(undefined);
    } catch (error) {
      return err(WorktreeErrors.ENV_COPY_FAILED(String(error)));
    }
  }

  async installDeps(worktreeId: string): WorktreeServiceResult<void> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
    });

    if (!worktree) {
      return err(WorktreeErrors.NOT_FOUND);
    }

    try {
      await this.runner.exec('bun install', worktree.path);
      return ok(undefined);
    } catch (error) {
      return err(WorktreeErrors.INIT_SCRIPT_FAILED('bun install', String(error)));
    }
  }

  async runInitScript(worktreeId: string): WorktreeServiceResult<void> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
      with: { project: true },
    });

    if (!worktree) {
      return err(WorktreeErrors.NOT_FOUND);
    }

    const initScript = worktree.project.config?.initScript;
    if (!initScript) {
      return ok(undefined);
    }

    try {
      await this.runner.exec(initScript, worktree.path);
      return ok(undefined);
    } catch (error) {
      return err(WorktreeErrors.INIT_SCRIPT_FAILED(initScript, String(error)));
    }
  }

  async commit(worktreeId: string, message: string): WorktreeServiceResult<string> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
    });

    if (!worktree) {
      return err(WorktreeErrors.NOT_FOUND);
    }

    try {
      const escapedPath = escapeShellString(worktree.path);
      await this.runner.exec('git add -A', escapedPath);
      const status = await this.runner.exec('git status --porcelain', escapedPath);
      if (!status.stdout.trim()) {
        return ok('');
      }

      const escapedMessage = escapeShellString(message);
      await this.runner.exec(`git commit -m "${escapedMessage}"`, escapedPath);
      const sha = await this.runner.exec('git rev-parse HEAD', escapedPath);

      await this.db
        .update(worktrees)
        .set({ updatedAt: new Date() })
        .where(eq(worktrees.id, worktreeId));

      return ok(sha.stdout.trim());
    } catch (error) {
      return err(WorktreeErrors.CREATION_FAILED(worktree.branch, String(error)));
    }
  }

  async merge(worktreeId: string, targetBranch?: string): WorktreeServiceResult<void> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
      with: { project: true },
    });

    if (!worktree) {
      return err(WorktreeErrors.NOT_FOUND);
    }

    const target = targetBranch ?? worktree.baseBranch;

    await this.db
      .update(worktrees)
      .set({ status: 'merging', updatedAt: new Date() })
      .where(eq(worktrees.id, worktreeId));

    const commitResult = await this.commit(worktreeId, `Auto-commit before merge to ${target}`);
    if (!commitResult.ok) {
      return commitResult;
    }

    try {
      const escapedTarget = escapeShellString(target);
      const escapedBranch = escapeShellString(worktree.branch);
      const escapedProjectPath = escapeShellString(worktree.project.path);

      await this.runner.exec(`git checkout "${escapedTarget}"`, escapedProjectPath);
      await this.runner.exec('git pull --rebase', escapedProjectPath);
      const merge = await this.runner.exec(
        `git merge "${escapedBranch}" --no-ff -m "Merge branch '${escapedBranch}'"`,
        escapedProjectPath
      );

      if (merge.stderr.includes('CONFLICT')) {
        const conflicts = await this.runner.exec(
          'git diff --name-only --diff-filter=U',
          escapedProjectPath
        );
        return err(
          WorktreeErrors.MERGE_CONFLICT(conflicts.stdout.trim().split('\n').filter(Boolean))
        );
      }

      await this.db
        .update(worktrees)
        .set({ mergedAt: new Date(), updatedAt: new Date(), status: 'active' })
        .where(eq(worktrees.id, worktreeId));

      return ok(undefined);
    } catch (error) {
      return err(WorktreeErrors.CREATION_FAILED(worktree.branch, String(error)));
    }
  }

  async getDiff(worktreeId: string): WorktreeServiceResult<GitDiff> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
    });

    if (!worktree) {
      return err(WorktreeErrors.NOT_FOUND);
    }

    try {
      const escapedPath = escapeShellString(worktree.path);
      const escapedBaseBranch = escapeShellString(worktree.baseBranch);

      const stat = await this.runner.exec(
        `git diff --stat "${escapedBaseBranch}"...HEAD`,
        escapedPath
      );
      const numstat = await this.runner.exec(
        `git diff --numstat "${escapedBaseBranch}"...HEAD`,
        escapedPath
      );
      const fullDiff = await this.runner.exec(
        `git diff "${escapedBaseBranch}"...HEAD`,
        escapedPath
      );

      const files = numstat.stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [added, removed, filePath] = line.split('\t');
          return {
            path: filePath,
            status: 'modified' as const,
            additions: Number.parseInt(added ?? '0', 10),
            deletions: Number.parseInt(removed ?? '0', 10),
            hunks: extractHunks(fullDiff.stdout, filePath),
          };
        });

      const totals = files.reduce(
        (acc, file) => {
          acc.additions += file.additions;
          acc.deletions += file.deletions;
          return acc;
        },
        { additions: 0, deletions: 0 }
      );

      return ok({
        files,
        stats: {
          filesChanged: files.length,
          additions: totals.additions,
          deletions: totals.deletions,
        },
      });
    } catch (error) {
      return err(WorktreeErrors.CREATION_FAILED(worktree.branch, String(error)));
    }
  }

  async getStatus(worktreeId: string): WorktreeServiceResult<WorktreeStatusInfo> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktreeId),
    });

    if (!worktree) {
      return err(WorktreeErrors.NOT_FOUND);
    }

    return ok({
      id: worktree.id,
      branch: worktree.branch,
      status: worktree.status,
      path: worktree.path,
      updatedAt: worktree.updatedAt,
    });
  }

  async list(projectId: string): Promise<Result<WorktreeStatusInfo[], never>> {
    const list = await this.db.query.worktrees.findMany({
      where: eq(worktrees.projectId, projectId),
    });

    return ok(
      list.map((worktree) => ({
        id: worktree.id,
        branch: worktree.branch,
        status: worktree.status,
        path: worktree.path,
        updatedAt: worktree.updatedAt,
      }))
    );
  }

  async getByBranch(projectId: string, branch: string): Promise<Result<Worktree | null, never>> {
    const worktree = await this.db.query.worktrees.findFirst({
      where: and(eq(worktrees.projectId, projectId), eq(worktrees.branch, branch)),
    });

    return ok(worktree ?? null);
  }
}
