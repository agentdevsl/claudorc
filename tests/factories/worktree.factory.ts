import { createId } from '@paralleldrive/cuid2';
import type { NewWorktree, Worktree, WorktreeStatus } from '../../src/db/schema/worktrees';
import { worktrees } from '../../src/db/schema/worktrees';
import { getTestDb } from '../helpers/database';

export type WorktreeFactoryOptions = Partial<Omit<NewWorktree, 'projectId'>> & {
  projectId?: string;
  status?: WorktreeStatus;
  branch?: string;
  baseBranch?: string;
  taskId?: string | null;
};

export function buildWorktree(
  projectId: string,
  options: WorktreeFactoryOptions = {}
): NewWorktree {
  const id = options.id ?? createId();
  const branchId = createId();
  const branch = options.branch ?? `agent/${branchId}/task`;

  return {
    id,
    projectId,
    taskId: options.taskId ?? null,
    branch,
    path: options.path ?? `/tmp/worktrees/${id}`,
    baseBranch: options.baseBranch ?? 'main',
    status: options.status ?? 'active',
    mergedAt: options.mergedAt ?? null,
    removedAt: options.removedAt ?? null,
  };
}

export async function createTestWorktree(
  projectId: string,
  options: WorktreeFactoryOptions = {}
): Promise<Worktree> {
  const db = getTestDb();
  const data = buildWorktree(projectId, options);

  const [worktree] = await db.insert(worktrees).values(data).returning();

  if (!worktree) {
    throw new Error('Failed to create test worktree');
  }

  return worktree;
}

export async function createTestWorktrees(
  projectId: string,
  count: number,
  options: WorktreeFactoryOptions = {}
): Promise<Worktree[]> {
  const createdWorktrees: Worktree[] = [];

  for (let i = 0; i < count; i++) {
    const worktree = await createTestWorktree(projectId, {
      ...options,
    });
    createdWorktrees.push(worktree);
  }

  return createdWorktrees;
}

export async function createActiveWorktree(
  projectId: string,
  taskId: string,
  options: WorktreeFactoryOptions = {}
): Promise<Worktree> {
  return createTestWorktree(projectId, {
    ...options,
    taskId,
    status: 'active',
  });
}

export async function createMergedWorktree(
  projectId: string,
  options: WorktreeFactoryOptions = {}
): Promise<Worktree> {
  return createTestWorktree(projectId, {
    ...options,
    status: 'active',
    mergedAt: options.mergedAt ?? new Date(),
  });
}

export async function createRemovedWorktree(
  projectId: string,
  options: WorktreeFactoryOptions = {}
): Promise<Worktree> {
  return createTestWorktree(projectId, {
    ...options,
    status: 'removed',
    removedAt: options.removedAt ?? new Date(),
  });
}
