# Git Worktrees Integration Specification

## Overview

Git worktrees enable parallel agent execution by providing isolated working directories for each task. This specification defines the complete worktree lifecycle, from creation through merge and cleanup.

**Wireframe Reference**: [worktree-management.html](../wireframes/worktree-management.html)

---

## Architecture

### Directory Structure

```text
project/
├── .git/                         # Shared git directory
├── main/                         # Primary worktree (main branch)
└── .worktrees/                   # Agent worktrees directory
    ├── feature-{task-id}-auth/   # Agent 1 isolated workspace
    ├── feature-{task-id}-api/    # Agent 2 isolated workspace
    └── fix-{task-id}-bug/        # Agent 3 isolated workspace
```

### Branch Naming Convention

All agent branches follow the pattern:

```
{type}/{task-id}-{slug}
```

| Component | Description | Example |
|-----------|-------------|---------|
| `type` | Branch category | `feature`, `fix`, `refactor`, `docs`, `test` |
| `task-id` | Task identifier (CUID2) | `cm1abc123def456` |
| `slug` | Kebab-case description | `add-user-auth`, `fix-stream-reconnect` |

**Full Example**: `feature/cm1abc123def456-add-user-auth`

---

## Worktree Service API

### Interface Definition

```typescript
// lib/worktrees/service.ts
import { $ } from 'bun';
import type { Result } from '@/lib/utils/result';
import type { Worktree, WorktreeStatus } from '@/db/schema';
import { WorktreeErrors } from '@/lib/errors/worktree-errors';

export interface WorktreeService {
  create(params: CreateWorktreeParams): Promise<Result<Worktree, WorktreeError>>;
  merge(id: string): Promise<Result<void, WorktreeError>>;
  remove(id: string, force?: boolean): Promise<Result<void, WorktreeError>>;
  getStatus(id: string): Promise<Result<WorktreeStatus, WorktreeError>>;
  list(projectId: string): Promise<Result<Worktree[], WorktreeError>>;
  prune(projectId: string): Promise<Result<PruneResult, WorktreeError>>;
  getDiskUsage(projectId: string): Promise<Result<DiskUsage, WorktreeError>>;
}

export interface CreateWorktreeParams {
  projectId: string;
  taskId: string;
  branchType: 'feature' | 'fix' | 'refactor' | 'docs' | 'test';
  slug: string;
  baseBranch?: string; // defaults to project.config.defaultBranch
}

export interface PruneResult {
  removedCount: number;
  freedBytes: number;
  removedPaths: string[];
}

export interface DiskUsage {
  totalBytes: number;
  worktrees: { path: string; bytes: number }[];
}
```

---

## Creation Workflow

### Step-by-Step Process

```typescript
// lib/worktrees/create.ts
import { $ } from 'bun';
import { db } from '@/db/client';
import { worktrees, projects } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ok, err, type Result } from '@/lib/utils/result';
import { WorktreeErrors } from '@/lib/errors/worktree-errors';
import { createId } from '@paralleldrive/cuid2';

export async function createWorktree(
  params: CreateWorktreeParams
): Promise<Result<Worktree, WorktreeError>> {
  const { projectId, taskId, branchType, slug, baseBranch } = params;

  // 1. Get project configuration
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  const base = baseBranch ?? project.config.defaultBranch;
  const branch = `${branchType}/${taskId}-${slug}`;
  const worktreePath = `${project.path}/${project.config.worktreeRoot}/${branchType}-${taskId}-${slug}`;

  // 2. Check if branch already exists
  const branchCheck = await $`git -C ${project.path} rev-parse --verify ${branch} 2>/dev/null`.quiet();
  if (branchCheck.exitCode === 0) {
    return err(WorktreeErrors.BRANCH_EXISTS(branch));
  }

  // 3. Create database record with 'creating' status
  const worktreeId = createId();
  const [worktreeRecord] = await db.insert(worktrees).values({
    id: worktreeId,
    projectId,
    taskId,
    branch,
    baseBranch: base,
    path: worktreePath,
    status: 'creating',
  }).returning();

  try {
    // 4. Create git worktree
    const createResult = await $`git -C ${project.path} worktree add ${worktreePath} -b ${branch} ${base}`.quiet();
    if (createResult.exitCode !== 0) {
      throw new Error(createResult.stderr.toString());
    }

    // 5. Copy environment file if configured
    if (project.config.envFile) {
      const envSource = `${project.path}/${project.config.envFile}`;
      const envDest = `${worktreePath}/.env`;
      try {
        await $`cp ${envSource} ${envDest}`.quiet();
        await db.update(worktrees)
          .set({ envCopied: true })
          .where(eq(worktrees.id, worktreeId));
      } catch (envError) {
        return err(WorktreeErrors.ENV_COPY_FAILED(String(envError)));
      }
    }

    // 6. Install dependencies
    const installResult = await $`cd ${worktreePath} && bun install`.quiet();
    if (installResult.exitCode !== 0) {
      throw new Error(`Dependency installation failed: ${installResult.stderr.toString()}`);
    }
    await db.update(worktrees)
      .set({ depsInstalled: true })
      .where(eq(worktrees.id, worktreeId));

    // 7. Run init script if configured
    if (project.config.initScript) {
      const initResult = await $`cd ${worktreePath} && ${project.config.initScript}`.quiet();
      if (initResult.exitCode !== 0) {
        return err(WorktreeErrors.INIT_SCRIPT_FAILED(
          project.config.initScript,
          initResult.stderr.toString()
        ));
      }
      await db.update(worktrees)
        .set({ initScriptRun: true })
        .where(eq(worktrees.id, worktreeId));
    }

    // 8. Update status to 'active'
    const [updatedWorktree] = await db.update(worktrees)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(worktrees.id, worktreeId))
      .returning();

    return ok(updatedWorktree);

  } catch (error) {
    // Cleanup on failure
    await $`git -C ${project.path} worktree remove ${worktreePath} --force`.quiet();
    await db.update(worktrees)
      .set({ status: 'error', lastError: String(error) })
      .where(eq(worktrees.id, worktreeId));

    return err(WorktreeErrors.CREATION_FAILED(branch, String(error)));
  }
}
```

### Creation Sequence Diagram

```
┌─────────┐     ┌───────────────┐     ┌─────────┐     ┌────────────┐
│ TaskSvc │     │ WorktreeSvc   │     │   Git   │     │     DB     │
└────┬────┘     └───────┬───────┘     └────┬────┘     └─────┬──────┘
     │                  │                  │                │
     │ create(params)   │                  │                │
     │─────────────────>│                  │                │
     │                  │                  │                │
     │                  │ INSERT (creating)│                │
     │                  │─────────────────────────────────->│
     │                  │                  │                │
     │                  │ worktree add     │                │
     │                  │─────────────────>│                │
     │                  │                  │                │
     │                  │ cp .env          │                │
     │                  │─────────────────>│                │
     │                  │                  │                │
     │                  │ bun install      │                │
     │                  │─────────────────>│                │
     │                  │                  │                │
     │                  │ initScript       │                │
     │                  │─────────────────>│                │
     │                  │                  │                │
     │                  │ UPDATE (active)  │                │
     │                  │─────────────────────────────────->│
     │                  │                  │                │
     │ Result<Worktree> │                  │                │
     │<─────────────────│                  │                │
```

---

## Merge Workflow

### On Task Approval

When a task is approved, the worktree branch is merged into the base branch.

```typescript
// lib/worktrees/merge.ts
import { $ } from 'bun';
import { db } from '@/db/client';
import { worktrees, projects, tasks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ok, err, type Result } from '@/lib/utils/result';
import { WorktreeErrors } from '@/lib/errors/worktree-errors';

export async function mergeWorktree(
  worktreeId: string
): Promise<Result<void, WorktreeError>> {
  // 1. Get worktree and project
  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, worktreeId),
    with: { project: true },
  });

  if (!worktree) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  const { project } = worktree;

  // 2. Update status to 'merging'
  await db.update(worktrees)
    .set({ status: 'merging' })
    .where(eq(worktrees.id, worktreeId));

  try {
    // 3. Check for uncommitted changes
    const statusResult = await $`git -C ${worktree.path} status --porcelain`.quiet();
    const uncommittedFiles = statusResult.stdout.toString().trim();
    if (uncommittedFiles) {
      const files = uncommittedFiles.split('\n').map(line => line.trim());
      return err(WorktreeErrors.DIRTY(files));
    }

    // 4. Commit any staged changes (agent should have committed)
    // This is a safety check - agents are expected to commit their work
    const diffResult = await $`git -C ${worktree.path} diff --cached --stat`.quiet();
    if (diffResult.stdout.toString().trim()) {
      await $`git -C ${worktree.path} commit -m "Agent task completion"`.quiet();
    }

    // 5. Switch to base branch in main worktree and merge
    const baseBranch = worktree.baseBranch;
    await $`git -C ${project.path} checkout ${baseBranch}`.quiet();

    const mergeResult = await $`git -C ${project.path} merge ${worktree.branch} --no-ff -m "Merge ${worktree.branch}"`.quiet();

    if (mergeResult.exitCode !== 0) {
      // Check for merge conflicts
      const conflictResult = await $`git -C ${project.path} diff --name-only --diff-filter=U`.quiet();
      const conflictingFiles = conflictResult.stdout.toString().trim().split('\n').filter(Boolean);

      if (conflictingFiles.length > 0) {
        // Abort merge and return error
        await $`git -C ${project.path} merge --abort`.quiet();
        return err(WorktreeErrors.MERGE_CONFLICT(conflictingFiles));
      }

      throw new Error(mergeResult.stderr.toString());
    }

    // 6. Update worktree status
    await db.update(worktrees)
      .set({
        status: 'removing',
        mergedAt: new Date(),
      })
      .where(eq(worktrees.id, worktreeId));

    // 7. Remove worktree
    await $`git -C ${project.path} worktree remove ${worktree.path}`.quiet();
    await $`git -C ${project.path} branch -d ${worktree.branch}`.quiet();

    // 8. Final status update
    await db.update(worktrees)
      .set({
        status: 'removed',
        removedAt: new Date(),
      })
      .where(eq(worktrees.id, worktreeId));

    return ok(undefined);

  } catch (error) {
    await db.update(worktrees)
      .set({ status: 'error', lastError: String(error) })
      .where(eq(worktrees.id, worktreeId));

    return err(WorktreeErrors.REMOVAL_FAILED(worktree.path, String(error)));
  }
}
```

---

## Cleanup and Pruning

### Stale Worktree Detection

A worktree is considered stale when:

1. **No recent activity**: No commits in the last 7 days (configurable)
2. **Branch deleted**: Remote branch no longer exists
3. **Task completed**: Associated task is in `verified` status
4. **Orphaned**: No associated task record

```typescript
// lib/worktrees/cleanup.ts
import { $ } from 'bun';
import { db } from '@/db/client';
import { worktrees, projects, tasks } from '@/db/schema';
import { eq, and, lt, isNull, inArray } from 'drizzle-orm';
import { ok, err, type Result } from '@/lib/utils/result';

export interface StaleWorktree {
  id: string;
  branch: string;
  path: string;
  reason: 'no_activity' | 'branch_deleted' | 'task_completed' | 'orphaned';
  lastActivity: Date | null;
  diskUsage: number;
}

export async function findStaleWorktrees(
  projectId: string,
  inactivityDays = 7
): Promise<Result<StaleWorktree[], WorktreeError>> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  const activeWorktrees = await db.query.worktrees.findMany({
    where: and(
      eq(worktrees.projectId, projectId),
      eq(worktrees.status, 'active')
    ),
    with: { task: true },
  });

  const staleWorktrees: StaleWorktree[] = [];
  const inactivityThreshold = new Date();
  inactivityThreshold.setDate(inactivityThreshold.getDate() - inactivityDays);

  for (const worktree of activeWorktrees) {
    // Check disk usage
    const duResult = await $`du -sb ${worktree.path}`.quiet();
    const diskUsage = parseInt(duResult.stdout.toString().split('\t')[0], 10) || 0;

    // Check if branch exists on remote
    const branchExists = await $`git -C ${project.path} ls-remote --heads origin ${worktree.branch}`.quiet();
    const branchDeleted = branchExists.stdout.toString().trim() === '';

    // Check last commit date
    const lastCommitResult = await $`git -C ${worktree.path} log -1 --format=%ci`.quiet();
    const lastActivity = lastCommitResult.exitCode === 0
      ? new Date(lastCommitResult.stdout.toString().trim())
      : null;

    // Determine if stale
    let reason: StaleWorktree['reason'] | null = null;

    if (!worktree.task) {
      reason = 'orphaned';
    } else if (worktree.task.column === 'verified') {
      reason = 'task_completed';
    } else if (branchDeleted) {
      reason = 'branch_deleted';
    } else if (lastActivity && lastActivity < inactivityThreshold) {
      reason = 'no_activity';
    }

    if (reason) {
      staleWorktrees.push({
        id: worktree.id,
        branch: worktree.branch,
        path: worktree.path,
        reason,
        lastActivity,
        diskUsage,
      });
    }
  }

  return ok(staleWorktrees);
}

export async function pruneWorktrees(
  projectId: string,
  worktreeIds: string[]
): Promise<Result<PruneResult, WorktreeError>> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return err(WorktreeErrors.NOT_FOUND);
  }

  const worktreesToPrune = await db.query.worktrees.findMany({
    where: and(
      eq(worktrees.projectId, projectId),
      inArray(worktrees.id, worktreeIds)
    ),
  });

  let freedBytes = 0;
  const removedPaths: string[] = [];

  for (const worktree of worktreesToPrune) {
    try {
      // Get disk usage before removal
      const duResult = await $`du -sb ${worktree.path}`.quiet();
      const bytes = parseInt(duResult.stdout.toString().split('\t')[0], 10) || 0;

      // Remove worktree
      await $`git -C ${project.path} worktree remove ${worktree.path} --force`.quiet();

      // Delete branch if it still exists locally
      await $`git -C ${project.path} branch -D ${worktree.branch}`.quiet();

      // Update database
      await db.update(worktrees)
        .set({ status: 'removed', removedAt: new Date() })
        .where(eq(worktrees.id, worktree.id));

      freedBytes += bytes;
      removedPaths.push(worktree.path);
    } catch (error) {
      // Log error but continue with other worktrees
      console.error(`Failed to prune worktree ${worktree.path}:`, error);
    }
  }

  // Run git worktree prune to clean up stale references
  await $`git -C ${project.path} worktree prune`.quiet();

  return ok({
    removedCount: removedPaths.length,
    freedBytes,
    removedPaths,
  });
}
```

### Auto-Cleanup Configuration

```typescript
// lib/worktrees/auto-cleanup.ts
import { CronJob } from 'cron';

export interface AutoCleanupConfig {
  enabled: boolean;
  inactivityDays: number;      // Default: 7
  maxDiskUsageBytes: number;   // Default: 5GB
  runSchedule: string;         // Cron expression, default: '0 0 * * *' (midnight daily)
}

export function startAutoCleanup(projectId: string, config: AutoCleanupConfig) {
  if (!config.enabled) return;

  const job = new CronJob(config.runSchedule, async () => {
    const staleResult = await findStaleWorktrees(projectId, config.inactivityDays);

    if (!staleResult.ok) {
      console.error('Failed to find stale worktrees:', staleResult.error);
      return;
    }

    // Only auto-prune worktrees with deleted branches
    const safeToPrune = staleResult.value
      .filter(w => w.reason === 'branch_deleted' || w.reason === 'task_completed')
      .map(w => w.id);

    if (safeToPrune.length > 0) {
      await pruneWorktrees(projectId, safeToPrune);
    }
  });

  job.start();
  return job;
}
```

---

## Error Handling

### Worktree-Specific Errors

All worktree errors are defined in the error catalog. Key error codes:

| Code | HTTP Status | Trigger |
|------|-------------|---------|
| `WORKTREE_CREATION_FAILED` | 500 | `git worktree add` fails |
| `WORKTREE_NOT_FOUND` | 404 | Worktree ID doesn't exist |
| `WORKTREE_BRANCH_EXISTS` | 409 | Branch already exists |
| `WORKTREE_MERGE_CONFLICT` | 409 | Merge has conflicts |
| `WORKTREE_DIRTY` | 400 | Uncommitted changes present |
| `WORKTREE_REMOVAL_FAILED` | 500 | `git worktree remove` fails |
| `WORKTREE_ENV_COPY_FAILED` | 500 | `.env` copy fails |
| `WORKTREE_INIT_SCRIPT_FAILED` | 500 | Post-setup script fails |

### Error Recovery Strategies

```typescript
// lib/worktrees/recovery.ts

// Recover from stuck 'creating' state
export async function recoverStuckWorktree(worktreeId: string): Promise<void> {
  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, worktreeId),
    with: { project: true },
  });

  if (!worktree || worktree.status !== 'creating') return;

  // Check if worktree actually exists
  const existsResult = await $`git -C ${worktree.project.path} worktree list --porcelain`.quiet();
  const exists = existsResult.stdout.toString().includes(worktree.path);

  if (exists) {
    // Worktree exists but DB stuck - update status
    await db.update(worktrees)
      .set({ status: 'active' })
      .where(eq(worktrees.id, worktreeId));
  } else {
    // Worktree doesn't exist - mark as error
    await db.update(worktrees)
      .set({ status: 'error', lastError: 'Worktree not found during recovery' })
      .where(eq(worktrees.id, worktreeId));
  }
}

// Force remove a stuck worktree
export async function forceRemoveWorktree(worktreeId: string): Promise<void> {
  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, worktreeId),
    with: { project: true },
  });

  if (!worktree) return;

  // Force remove regardless of state
  await $`git -C ${worktree.project.path} worktree remove ${worktree.path} --force`.quiet();
  await $`rm -rf ${worktree.path}`.quiet(); // Ensure directory is gone
  await $`git -C ${worktree.project.path} worktree prune`.quiet();

  await db.update(worktrees)
    .set({ status: 'removed', removedAt: new Date() })
    .where(eq(worktrees.id, worktreeId));
}
```

---

## Bun Shell Command Reference

### Common Operations

```typescript
import { $ } from 'bun';

// Create worktree with new branch
await $`git -C ${projectPath} worktree add ${worktreePath} -b ${branch} ${baseBranch}`;

// List all worktrees
const list = await $`git -C ${projectPath} worktree list --porcelain`;

// Remove worktree
await $`git -C ${projectPath} worktree remove ${worktreePath}`;

// Force remove worktree
await $`git -C ${projectPath} worktree remove ${worktreePath} --force`;

// Prune stale worktree references
await $`git -C ${projectPath} worktree prune`;

// Check if branch exists
const exists = await $`git -C ${projectPath} rev-parse --verify ${branch}`.quiet();

// Get disk usage
const du = await $`du -sb ${worktreePath}`;

// Copy environment file
await $`cp ${envSource} ${envDest}`;

// Install dependencies
await $`cd ${worktreePath} && bun install`;

// Check for uncommitted changes
const status = await $`git -C ${worktreePath} status --porcelain`;

// Get last commit date
const lastCommit = await $`git -C ${worktreePath} log -1 --format=%ci`;

// Merge branch
await $`git -C ${projectPath} merge ${branch} --no-ff -m "Merge ${branch}"`;

// Delete branch
await $`git -C ${projectPath} branch -d ${branch}`;

// Force delete branch
await $`git -C ${projectPath} branch -D ${branch}`;
```

---

## Database Integration

### Worktree Table Schema

Defined in `/specs/database/schema.md`:

```typescript
export const worktrees = pgTable('worktrees', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  branch: text('branch').notNull(),
  baseBranch: text('base_branch').notNull().default('main'),
  path: text('path').notNull(),
  status: worktreeStatusEnum('status').notNull().default('creating'),
  envCopied: boolean('env_copied').default(false),
  depsInstalled: boolean('deps_installed').default(false),
  initScriptRun: boolean('init_script_run').default(false),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  mergedAt: timestamp('merged_at'),
  removedAt: timestamp('removed_at'),
});
```

### Status Enum

```typescript
export const worktreeStatusEnum = pgEnum('worktree_status', [
  'creating',   // Worktree being set up
  'active',     // Ready for agent use
  'merging',    // Being merged to base
  'removing',   // Being cleaned up
  'removed',    // Successfully removed
  'error',      // Failed state
]);
```

---

## Workflow Events

Published via Durable Streams when worktree state changes:

```typescript
type WorktreeEvent =
  | { type: 'worktree:creating'; worktreeId: string; branch: string; taskId: string }
  | { type: 'worktree:created'; worktreeId: string; branch: string; path: string }
  | { type: 'worktree:merging'; worktreeId: string; branch: string }
  | { type: 'worktree:merged'; worktreeId: string; branch: string }
  | { type: 'worktree:removing'; worktreeId: string; branch: string }
  | { type: 'worktree:removed'; worktreeId: string; branch: string }
  | { type: 'worktree:error'; worktreeId: string; branch: string; error: string };
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](../database/schema.md) | Worktrees table definition |
| [Error Catalog](../errors/error-catalog.md) | Worktree error codes |
| [User Stories](../user-stories.md) | Isolation requirements |
| [Test Cases](../testing/test-cases.md) | Worktree lifecycle tests |
| [GitHub App](./github-app.md) | Branch/PR operations |
