# WorktreeService Specification

## Overview

The WorktreeService manages git worktree lifecycle for isolated agent execution environments. Each agent task runs in its own worktree, preventing conflicts between concurrent agents and enabling clean branch-based workflows with approval gates.

## Related Wireframes

- [Worktree Management](../wireframes/worktree-management.html) - Worktree status and cleanup UI
- [Error State Expanded](../wireframes/error-state-expanded.html) - Worktree error handling

---

## Interface Definition

```typescript
// lib/services/worktree-service.ts
import type { Result } from '@/lib/utils/result';
import type { Worktree, NewWorktree, WorktreeStatus } from '@/db/schema';
import type { WorktreeError, ValidationError } from '@/lib/errors';

export interface WorktreeCreateInput {
  projectId: string;
  taskId: string;
  branch: string;
  baseBranch?: string;  // Default: 'main'
}

export interface WorktreeSetupOptions {
  copyEnv?: boolean;       // Copy .env file (default: true)
  installDeps?: boolean;   // Run bun install (default: true)
  runInitScript?: boolean; // Run project init script (default: true)
}

export interface GitDiff {
  summary: string;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  patches: DiffPatch[];
}

export interface DiffPatch {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: string[];
}

export interface WorktreeStatusInfo {
  worktreeId: string;
  branch: string;
  path: string;
  status: WorktreeStatus;
  isClean: boolean;
  aheadCount: number;
  behindCount: number;
  uncommittedFiles: string[];
  lastActivity: Date;
}

export interface IWorktreeService {
  // Lifecycle Management
  create(input: WorktreeCreateInput, options?: WorktreeSetupOptions): Promise<Result<Worktree, WorktreeError>>;
  remove(worktreeId: string, force?: boolean): Promise<Result<void, WorktreeError>>;
  prune(projectId: string): Promise<Result<number, WorktreeError>>;

  // Setup Operations
  copyEnv(worktreeId: string): Promise<Result<void, WorktreeError>>;
  installDeps(worktreeId: string): Promise<Result<void, WorktreeError>>;
  runInitScript(worktreeId: string): Promise<Result<void, WorktreeError>>;

  // Git Operations
  commit(worktreeId: string, message: string): Promise<Result<string, WorktreeError>>;
  merge(worktreeId: string, targetBranch?: string): Promise<Result<void, WorktreeError>>;
  getDiff(worktreeId: string): Promise<Result<GitDiff, WorktreeError>>;

  // Status Operations
  getStatus(worktreeId: string): Promise<Result<WorktreeStatusInfo, WorktreeError>>;
  list(projectId: string): Promise<Result<WorktreeStatusInfo[], never>>;
  getByBranch(projectId: string, branch: string): Promise<Result<Worktree | null, never>>;
}
```

---

## Lifecycle Management

### create

Creates a new git worktree for an agent task.

```typescript
async create(
  input: WorktreeCreateInput,
  options: WorktreeSetupOptions = {}
): Promise<Result<Worktree, WorktreeError>> {
  const {
    copyEnv = true,
    installDeps = true,
    runInitScript = true,
  } = options;

  // 1. Get project
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });
  if (!project) {
    return err(WorktreeErrors.CREATION_FAILED(input.branch, 'Project not found'));
  }

  // 2. Sanitize branch name for filesystem
  const safeBranch = this.sanitizeBranchName(input.branch);
  const baseBranch = input.baseBranch ?? project.config.defaultBranch;

  // 3. Build worktree path
  const worktreeRoot = project.config.worktreeRoot ?? '.worktrees';
  const worktreePath = path.join(project.path, worktreeRoot, safeBranch);

  // 4. Check if branch already exists
  const existing = await this.getByBranch(input.projectId, input.branch);
  if (existing.value) {
    return err(WorktreeErrors.BRANCH_EXISTS(input.branch));
  }

  // 5. Create worktree record
  const [worktree] = await db.insert(worktrees).values({
    projectId: input.projectId,
    taskId: input.taskId,
    branch: input.branch,
    baseBranch,
    path: worktreePath,
    status: 'creating',
  }).returning();

  try {
    // 6. Create git worktree
    const createResult = await this.executeGitWorktreeAdd(
      project.path,
      worktreePath,
      input.branch,
      baseBranch
    );
    if (!createResult.ok) {
      await this.updateStatus(worktree.id, 'error', createResult.error);
      return err(WorktreeErrors.CREATION_FAILED(input.branch, createResult.error));
    }

    // 7. Copy environment file
    if (copyEnv) {
      const envResult = await this.copyEnv(worktree.id);
      if (!envResult.ok) {
        // Non-fatal, continue setup
        console.warn('Failed to copy .env:', envResult.error);
      }
    }

    // 8. Install dependencies
    if (installDeps) {
      const depsResult = await this.installDeps(worktree.id);
      if (!depsResult.ok) {
        await this.updateStatus(worktree.id, 'error', depsResult.error.message);
        return err(depsResult.error);
      }
    }

    // 9. Run init script
    if (runInitScript && project.config.initScript) {
      const initResult = await this.runInitScript(worktree.id);
      if (!initResult.ok) {
        await this.updateStatus(worktree.id, 'error', initResult.error.message);
        return err(initResult.error);
      }
    }

    // 10. Update status to active
    await this.updateStatus(worktree.id, 'active');

    // 11. Publish event
    publishWorktreeEvent(worktree.id, {
      type: 'worktree:created',
      payload: { worktreeId: worktree.id, branch: input.branch, path: worktreePath },
      timestamp: Date.now(),
    });

    return ok(await this.getWorktree(worktree.id));

  } catch (error) {
    await this.updateStatus(worktree.id, 'error', String(error));
    return err(WorktreeErrors.CREATION_FAILED(input.branch, String(error)));
  }
}
```

### executeGitWorktreeAdd (private)

Executes the git worktree add command using Bun shell.

```typescript
private async executeGitWorktreeAdd(
  projectPath: string,
  worktreePath: string,
  branch: string,
  baseBranch: string
): Promise<Result<void, string>> {
  try {
    // Check if branch exists
    const branchExists = await $`cd ${projectPath} && git show-ref --verify --quiet refs/heads/${branch}`.quiet();

    if (branchExists.exitCode === 0) {
      // Branch exists, create worktree from existing branch
      await $`cd ${projectPath} && git worktree add ${worktreePath} ${branch}`;
    } else {
      // Create new branch from base
      await $`cd ${projectPath} && git worktree add ${worktreePath} -b ${branch} ${baseBranch}`;
    }

    return ok(undefined);

  } catch (error) {
    const stderr = error.stderr?.toString() ?? String(error);

    // Handle common errors
    if (stderr.includes('already checked out')) {
      return err(`Branch '${branch}' is already checked out in another worktree`);
    }
    if (stderr.includes('already exists')) {
      return err(`Worktree path already exists: ${worktreePath}`);
    }

    return err(stderr);
  }
}
```

### remove

Removes a worktree and cleans up the branch.

```typescript
async remove(
  worktreeId: string,
  force: boolean = false
): Promise<Result<void, WorktreeError>> {
  // 1. Get worktree
  const worktree = await this.getWorktree(worktreeId);
  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  // 2. Check if worktree is in use (has agent assigned)
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.worktreeId, worktreeId),
  });
  if (task?.agentId && !force) {
    return err(WorktreeErrors.REMOVAL_FAILED(
      worktree.path,
      'Worktree is in use by an agent. Use force=true to remove.'
    ));
  }

  // 3. Check for uncommitted changes
  if (!force) {
    const status = await this.getStatus(worktreeId);
    if (status.ok && !status.value.isClean) {
      return err(WorktreeErrors.DIRTY(status.value.uncommittedFiles));
    }
  }

  // 4. Update status
  await this.updateStatus(worktreeId, 'removing');

  try {
    // 5. Get project path
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, worktree.projectId),
    });

    // 6. Remove git worktree
    const forceFlag = force ? '--force' : '';
    await $`cd ${project.path} && git worktree remove ${worktree.path} ${forceFlag}`;

    // 7. Delete branch if not merged
    try {
      await $`cd ${project.path} && git branch -d ${worktree.branch}`.quiet();
    } catch {
      // Branch might not exist or might be current, ignore
    }

    // 8. Update database
    await db.update(worktrees).set({
      status: 'removed',
      removedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(worktrees.id, worktreeId));

    // 9. Publish event
    publishWorktreeEvent(worktreeId, {
      type: 'worktree:removed',
      payload: { worktreeId, branch: worktree.branch },
      timestamp: Date.now(),
    });

    return ok(undefined);

  } catch (error) {
    await this.updateStatus(worktreeId, 'error', String(error));
    return err(WorktreeErrors.REMOVAL_FAILED(worktree.path, String(error)));
  }
}
```

### prune

Removes stale worktrees (no recent activity, branch deleted, etc.).

```typescript
async prune(projectId: string): Promise<Result<number, WorktreeError>> {
  // 1. Get project
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) {
    return ok(0);
  }

  // 2. Run git worktree prune first
  try {
    await $`cd ${project.path} && git worktree prune`;
  } catch (error) {
    console.warn('git worktree prune failed:', error);
  }

  // 3. Find stale worktrees in database
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - 7); // 7 days default

  const staleWorktrees = await db.query.worktrees.findMany({
    where: and(
      eq(worktrees.projectId, projectId),
      eq(worktrees.status, 'active'),
      lt(worktrees.updatedAt, staleThreshold),
      isNull(worktrees.removedAt)
    ),
  });

  // 4. Check each worktree
  let prunedCount = 0;
  for (const worktree of staleWorktrees) {
    // Check if task is still active
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.worktreeId, worktree.id),
    });

    // Skip if task is in progress
    if (task?.column === 'in_progress') {
      continue;
    }

    // Check if branch still exists
    const branchExists = await this.checkBranchExists(project.path, worktree.branch);

    // Remove if branch deleted or task completed
    if (!branchExists || task?.column === 'verified') {
      const result = await this.remove(worktree.id, true);
      if (result.ok) {
        prunedCount++;
      }
    }
  }

  // 5. Publish event
  publishWorktreeEvent('system', {
    type: 'worktrees:pruned',
    payload: { projectId, count: prunedCount },
    timestamp: Date.now(),
  });

  return ok(prunedCount);
}
```

---

## Setup Operations

### copyEnv

Copies the project's environment file to the worktree.

```typescript
async copyEnv(worktreeId: string): Promise<Result<void, WorktreeError>> {
  const worktree = await this.getWorktree(worktreeId);
  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, worktree.projectId),
  });

  const envFile = project?.config.envFile ?? '.env';
  const sourcePath = path.join(project.path, envFile);
  const destPath = path.join(worktree.path, envFile);

  try {
    // Check if source exists
    const sourceExists = await Bun.file(sourcePath).exists();
    if (!sourceExists) {
      // No env file to copy, not an error
      return ok(undefined);
    }

    // Copy file
    await $`cp ${sourcePath} ${destPath}`;

    // Update database
    await db.update(worktrees).set({
      envCopied: true,
      updatedAt: new Date(),
    }).where(eq(worktrees.id, worktreeId));

    return ok(undefined);

  } catch (error) {
    return err(WorktreeErrors.ENV_COPY_FAILED(String(error)));
  }
}
```

### installDeps

Installs dependencies in the worktree using Bun.

```typescript
async installDeps(worktreeId: string): Promise<Result<void, WorktreeError>> {
  const worktree = await this.getWorktree(worktreeId);
  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  try {
    // Run bun install
    await $`cd ${worktree.path} && bun install`.timeout(300_000); // 5 min timeout

    // Update database
    await db.update(worktrees).set({
      depsInstalled: true,
      updatedAt: new Date(),
    }).where(eq(worktrees.id, worktreeId));

    return ok(undefined);

  } catch (error) {
    const stderr = error.stderr?.toString() ?? String(error);
    return err(WorktreeErrors.INIT_SCRIPT_FAILED('bun install', stderr));
  }
}
```

### runInitScript

Runs the project's initialization script.

```typescript
async runInitScript(worktreeId: string): Promise<Result<void, WorktreeError>> {
  const worktree = await this.getWorktree(worktreeId);
  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, worktree.projectId),
  });

  const initScript = project?.config.initScript;
  if (!initScript) {
    return ok(undefined); // No script to run
  }

  try {
    // Run init script
    await $`cd ${worktree.path} && ${initScript}`.timeout(600_000); // 10 min timeout

    // Update database
    await db.update(worktrees).set({
      initScriptRun: true,
      updatedAt: new Date(),
    }).where(eq(worktrees.id, worktreeId));

    return ok(undefined);

  } catch (error) {
    const stderr = error.stderr?.toString() ?? String(error);
    return err(WorktreeErrors.INIT_SCRIPT_FAILED(initScript, stderr));
  }
}
```

---

## Git Operations

### commit

Creates a commit in the worktree with all changes.

```typescript
async commit(
  worktreeId: string,
  message: string
): Promise<Result<string, WorktreeError>> {
  const worktree = await this.getWorktree(worktreeId);
  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  try {
    // Stage all changes
    await $`cd ${worktree.path} && git add -A`;

    // Check if there are changes to commit
    const status = await $`cd ${worktree.path} && git status --porcelain`.text();
    if (!status.trim()) {
      return ok(''); // No changes to commit
    }

    // Create commit
    const result = await $`cd ${worktree.path} && git commit -m ${message}`.text();

    // Get commit SHA
    const sha = await $`cd ${worktree.path} && git rev-parse HEAD`.text();

    // Update worktree timestamp
    await db.update(worktrees).set({
      updatedAt: new Date(),
    }).where(eq(worktrees.id, worktreeId));

    return ok(sha.trim());

  } catch (error) {
    const stderr = error.stderr?.toString() ?? String(error);

    if (stderr.includes('nothing to commit')) {
      return ok(''); // No changes
    }

    return err(WorktreeErrors.CREATION_FAILED(worktree.branch, stderr));
  }
}
```

### merge

Merges the worktree branch into the target branch.

```typescript
async merge(
  worktreeId: string,
  targetBranch?: string
): Promise<Result<void, WorktreeError>> {
  const worktree = await this.getWorktree(worktreeId);
  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, worktree.projectId),
  });

  const target = targetBranch ?? worktree.baseBranch ?? project?.config.defaultBranch ?? 'main';

  try {
    // Update status
    await this.updateStatus(worktreeId, 'merging');

    // Commit any uncommitted changes first
    const commitResult = await this.commit(worktreeId, `Auto-commit before merge to ${target}`);
    if (!commitResult.ok) {
      return commitResult;
    }

    // Switch to target branch in main worktree
    await $`cd ${project.path} && git checkout ${target}`;

    // Pull latest
    await $`cd ${project.path} && git pull --rebase`.nothrow();

    // Merge the feature branch
    const mergeResult = await $`cd ${project.path} && git merge ${worktree.branch} --no-ff -m "Merge branch '${worktree.branch}'"`.nothrow();

    if (mergeResult.exitCode !== 0) {
      // Check for merge conflicts
      const conflictFiles = await $`cd ${project.path} && git diff --name-only --diff-filter=U`.text();

      if (conflictFiles.trim()) {
        // Abort merge
        await $`cd ${project.path} && git merge --abort`.nothrow();

        return err(WorktreeErrors.MERGE_CONFLICT(conflictFiles.trim().split('\n')));
      }

      return err(WorktreeErrors.CREATION_FAILED(worktree.branch, mergeResult.stderr?.toString()));
    }

    // Update database
    await db.update(worktrees).set({
      status: 'merging',
      mergedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(worktrees.id, worktreeId));

    // Publish event
    publishWorktreeEvent(worktreeId, {
      type: 'worktree:merged',
      payload: { worktreeId, branch: worktree.branch, targetBranch: target },
      timestamp: Date.now(),
    });

    return ok(undefined);

  } catch (error) {
    await this.updateStatus(worktreeId, 'error', String(error));
    return err(WorktreeErrors.CREATION_FAILED(worktree.branch, String(error)));
  }
}
```

### getDiff

Gets the git diff for the worktree compared to base branch.

```typescript
async getDiff(worktreeId: string): Promise<Result<GitDiff, WorktreeError>> {
  const worktree = await this.getWorktree(worktreeId);
  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  try {
    // Get diff stats
    const statsOutput = await $`cd ${worktree.path} && git diff --stat ${worktree.baseBranch}...HEAD`.text();

    // Get numstat for counts
    const numstatOutput = await $`cd ${worktree.path} && git diff --numstat ${worktree.baseBranch}...HEAD`.text();

    // Get full diff for patches
    const fullDiff = await $`cd ${worktree.path} && git diff ${worktree.baseBranch}...HEAD`.text();

    // Parse stats
    const files = numstatOutput.trim().split('\n').filter(Boolean);
    let totalAdded = 0;
    let totalRemoved = 0;
    const patches: DiffPatch[] = [];

    for (const line of files) {
      const [added, removed, file] = line.split('\t');
      const additions = parseInt(added) || 0;
      const deletions = parseInt(removed) || 0;
      totalAdded += additions;
      totalRemoved += deletions;

      // Determine status
      let status: DiffPatch['status'] = 'modified';
      if (additions > 0 && deletions === 0 && file.includes(' => ')) {
        status = 'renamed';
      } else if (await this.isNewFile(worktree.path, worktree.baseBranch, file)) {
        status = 'added';
      } else if (await this.isDeletedFile(worktree.path, worktree.baseBranch, file)) {
        status = 'deleted';
      }

      patches.push({
        path: file,
        status,
        additions,
        deletions,
        hunks: this.extractHunks(fullDiff, file),
      });
    }

    // Build summary
    const summary = this.buildDiffSummary(patches);

    return ok({
      summary,
      filesChanged: patches.length,
      linesAdded: totalAdded,
      linesRemoved: totalRemoved,
      patches,
    });

  } catch (error) {
    return err(WorktreeErrors.CREATION_FAILED(worktree.branch, String(error)));
  }
}
```

---

## Status Operations

### getStatus

Gets detailed status information for a worktree.

```typescript
async getStatus(worktreeId: string): Promise<Result<WorktreeStatusInfo, WorktreeError>> {
  const worktree = await this.getWorktree(worktreeId);
  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  try {
    // Get git status
    const statusOutput = await $`cd ${worktree.path} && git status --porcelain`.text();
    const uncommittedFiles = statusOutput.trim().split('\n')
      .filter(Boolean)
      .map(line => line.slice(3)); // Remove status prefix

    // Get ahead/behind counts
    const revList = await $`cd ${worktree.path} && git rev-list --left-right --count ${worktree.baseBranch}...HEAD`.text();
    const [behind, ahead] = revList.trim().split('\t').map(Number);

    return ok({
      worktreeId,
      branch: worktree.branch,
      path: worktree.path,
      status: worktree.status,
      isClean: uncommittedFiles.length === 0,
      aheadCount: ahead || 0,
      behindCount: behind || 0,
      uncommittedFiles,
      lastActivity: worktree.updatedAt,
    });

  } catch (error) {
    // Worktree might not exist on disk
    return ok({
      worktreeId,
      branch: worktree.branch,
      path: worktree.path,
      status: 'error',
      isClean: true,
      aheadCount: 0,
      behindCount: 0,
      uncommittedFiles: [],
      lastActivity: worktree.updatedAt,
    });
  }
}
```

### list

Lists all worktrees for a project with their status.

```typescript
async list(projectId: string): Promise<Result<WorktreeStatusInfo[], never>> {
  const projectWorktrees = await db.query.worktrees.findMany({
    where: and(
      eq(worktrees.projectId, projectId),
      ne(worktrees.status, 'removed')
    ),
    orderBy: [desc(worktrees.updatedAt)],
  });

  const statuses: WorktreeStatusInfo[] = [];

  for (const worktree of projectWorktrees) {
    const status = await this.getStatus(worktree.id);
    if (status.ok) {
      statuses.push(status.value);
    }
  }

  return ok(statuses);
}
```

### getByBranch

Gets a worktree by its branch name.

```typescript
async getByBranch(
  projectId: string,
  branch: string
): Promise<Result<Worktree | null, never>> {
  const worktree = await db.query.worktrees.findFirst({
    where: and(
      eq(worktrees.projectId, projectId),
      eq(worktrees.branch, branch),
      ne(worktrees.status, 'removed')
    ),
  });

  return ok(worktree ?? null);
}
```

---

## Business Rules

### Branch Naming

- Branch names sanitized for filesystem safety
- Pattern: `agent/{agentId}/{taskId}` or `feature/{slug}`
- Characters allowed: `a-z`, `0-9`, `-`, `_`, `/`
- Max length: 100 characters

```typescript
private sanitizeBranchName(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9\-_\/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
```

### Cleanup Triggers

Worktrees are candidates for cleanup when:

1. **Branch deleted**: Remote branch no longer exists
2. **Inactivity**: No updates in 7 days (configurable)
3. **Task verified**: Associated task moved to verified column
4. **Manual**: User requests deletion

Protected worktrees:
- Main worktree (project root)
- Worktrees with active agents
- Worktrees with uncommitted changes (unless force)

### Path Resolution

```
project/
├── .git/                     # Shared git directory
├── main/                     # Primary worktree (project root)
└── .worktrees/               # Worktree root (configurable)
    ├── agent-abc-task-123/   # Agent worktree
    └── feature-api-v2/       # Feature worktree
```

---

## Side Effects

### File System Operations

| Operation | Actions |
|-----------|---------|
| `create` | Creates directory, runs git commands |
| `copyEnv` | Copies `.env` file |
| `installDeps` | Runs `bun install`, creates `node_modules` |
| `runInitScript` | Executes project init script |
| `remove` | Deletes directory, runs git cleanup |
| `merge` | Modifies main worktree git state |

### Database Operations

| Operation | Tables Affected |
|-----------|-----------------|
| `create` | `worktrees` |
| `remove` | `worktrees` |
| `prune` | `worktrees` |
| `commit` | `worktrees` (timestamp) |
| `merge` | `worktrees` |

### Event Publishing

Events published via Durable Streams:

| Event Type | When |
|------------|------|
| `worktree:created` | Worktree setup complete |
| `worktree:removed` | Worktree deleted |
| `worktree:merged` | Branch merged to target |
| `worktrees:pruned` | Stale worktrees cleaned |
| `worktree:error` | Operation failed |

---

## Error Conditions

| Error Code | HTTP | Condition |
|------------|------|-----------|
| `WORKTREE_CREATION_FAILED` | 500 | git worktree add fails |
| `WORKTREE_NOT_FOUND` | 404 | Worktree ID doesn't exist |
| `WORKTREE_BRANCH_EXISTS` | 409 | Branch already has worktree |
| `WORKTREE_MERGE_CONFLICT` | 409 | Merge conflicts detected |
| `WORKTREE_DIRTY` | 400 | Uncommitted changes present |
| `WORKTREE_REMOVAL_FAILED` | 500 | git worktree remove fails |
| `WORKTREE_ENV_COPY_FAILED` | 500 | .env copy failed |
| `WORKTREE_INIT_SCRIPT_FAILED` | 500 | Init script exited non-zero |

---

## Implementation Outline

```typescript
// lib/services/worktree-service.ts
import { $ } from 'bun';
import * as path from 'path';
import { db } from '@/db/client';
import { worktrees, projects, tasks } from '@/db/schema';
import { eq, and, ne, lt, isNull, desc } from 'drizzle-orm';
import { ok, err, type Result } from '@/lib/utils/result';
import { WorktreeErrors } from '@/lib/errors';
import { publishWorktreeEvent } from '@/lib/streams/server';

export class WorktreeService implements IWorktreeService {

  // Helper: Get worktree from database
  private async getWorktree(id: string) {
    return db.query.worktrees.findFirst({
      where: eq(worktrees.id, id),
    });
  }

  // Helper: Update worktree status
  private async updateStatus(
    id: string,
    status: WorktreeStatus,
    error?: string
  ) {
    await db.update(worktrees).set({
      status,
      lastError: error ?? null,
      updatedAt: new Date(),
    }).where(eq(worktrees.id, id));
  }

  // Helper: Check if branch exists
  private async checkBranchExists(
    projectPath: string,
    branch: string
  ): Promise<boolean> {
    try {
      await $`cd ${projectPath} && git show-ref --verify --quiet refs/heads/${branch}`;
      return true;
    } catch {
      return false;
    }
  }

  // Helper: Sanitize branch name
  private sanitizeBranchName(branch: string): string {
    return branch
      .toLowerCase()
      .replace(/[^a-z0-9\-_\/]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  }

  // Helper: Build diff summary
  private buildDiffSummary(patches: DiffPatch[]): string {
    const added = patches.filter(p => p.status === 'added').length;
    const modified = patches.filter(p => p.status === 'modified').length;
    const deleted = patches.filter(p => p.status === 'deleted').length;
    const parts: string[] = [];
    if (added) parts.push(`${added} added`);
    if (modified) parts.push(`${modified} modified`);
    if (deleted) parts.push(`${deleted} deleted`);
    return parts.join(', ') || 'No changes';
  }

  // ... implement all interface methods
}

export const worktreeService = new WorktreeService();
```

---

## State Machine Coordination

Worktree status transitions:

```
creating -> active -> merging -> removed
                 \-> removing -> removed
                 \-> error
```

Valid transitions:

| From | To | Trigger |
|------|----|---------|
| `creating` | `active` | Setup complete |
| `creating` | `error` | Setup failed |
| `active` | `merging` | Merge started |
| `active` | `removing` | Remove requested |
| `active` | `error` | Git operation failed |
| `merging` | `removed` | Merge and cleanup complete |
| `removing` | `removed` | Removal complete |
| `removing` | `error` | Removal failed |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](../database/schema.md) | `worktrees` table |
| [Error Catalog](../errors/error-catalog.md) | Worktree errors |
| [AgentService](./agent-service.md) | Creates/uses worktrees for agent execution |
| [User Stories](../user-stories.md) | Worktree lifecycle, cleanup policies |
