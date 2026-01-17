# TaskService Specification

## Overview

The TaskService manages CRUD operations for tasks, Kanban board operations (column transitions, reordering), and the approval workflow. It enforces the 4-column workflow state machine and handles task-to-agent assignment.

**Related Wireframes:**

- [Kanban Board](../wireframes/kanban-board-full.html) - Task board with drag-and-drop
- [Task Detail Dialog](../wireframes/task-detail-dialog.html) - Task creation and editing
- [Approval Dialog](../wireframes/approval-dialog.html) - Diff review and approval workflow

---

## Interface Definition

```typescript
// lib/services/task-service.ts
import type { Result } from '@/lib/utils/result';
import type { Task, NewTask, TaskColumn } from '@/db/schema';
import type { TaskError } from '@/lib/errors/task-errors';

export interface ITaskService {
  // CRUD Operations
  create(input: CreateTaskInput): Promise<Result<Task, TaskError>>;
  getById(id: string): Promise<Result<Task, TaskError>>;
  list(projectId: string, options?: ListTasksOptions): Promise<Result<Task[], TaskError>>;
  update(id: string, input: UpdateTaskInput): Promise<Result<Task, TaskError>>;
  delete(id: string): Promise<Result<void, TaskError>>;

  // Kanban Operations
  moveColumn(id: string, column: TaskColumn, position?: number): Promise<Result<Task, TaskError>>;
  reorder(id: string, position: number): Promise<Result<Task, TaskError>>;
  getByColumn(projectId: string, column: TaskColumn): Promise<Result<Task[], TaskError>>;

  // Approval Workflow
  approve(id: string, input: ApproveInput): Promise<Result<Task, TaskError>>;
  reject(id: string, input: RejectInput): Promise<Result<Task, TaskError>>;
  getDiff(id: string): Promise<Result<DiffResult, TaskError>>;
}
```

---

## Type Definitions

```typescript
// Column type (matches database enum)
export type TaskColumn = 'backlog' | 'in_progress' | 'waiting_approval' | 'verified';

// Input Types
export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  labels?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  labels?: string[];
  metadata?: Record<string, unknown>;
}

export interface ListTasksOptions {
  column?: TaskColumn;
  agentId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'position' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface ApproveInput {
  approvedBy?: string;
  createMergeCommit?: boolean;
}

export interface RejectInput {
  reason: string;
}

export interface DiffResult {
  taskId: string;
  branch: string;
  baseBranch: string;
  files: DiffFile[];
  summary: DiffSummary;
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface DiffSummary {
  filesChanged: number;
  additions: number;
  deletions: number;
}
```

---

## Column Transition State Machine

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        TASK COLUMN STATE MACHINE                             │
└──────────────────────────────────────────────────────────────────────────────┘

     ┌─────────────┐                      ┌─────────────────┐
     │             │  moveColumn()        │                 │
     │   BACKLOG   │ ───────────────────► │   IN_PROGRESS   │
     │             │  (manual/auto)       │                 │
     └─────────────┘                      └────────┬────────┘
           ▲                                       │
           │                                       │ Agent completes
           │ reject()                              │ (automatic)
           │ (with feedback)                       ▼
           │                              ┌─────────────────┐
           │                              │                 │
           └───────────────────────────── │ WAITING_APPROVAL│
                                          │                 │
                                          └────────┬────────┘
                                                   │
                                                   │ approve()
                                                   ▼
                                          ┌─────────────────┐
                                          │                 │
                                          │    VERIFIED     │
                                          │                 │
                                          └─────────────────┘

Valid Transitions:
─────────────────
  backlog          → in_progress
  in_progress      → waiting_approval (automatic on agent completion)
  in_progress      → backlog          (manual abort)
  waiting_approval → verified         (approve)
  waiting_approval → in_progress      (reject with feedback)

Invalid Transitions (blocked):
──────────────────────────────
  backlog          → waiting_approval
  backlog          → verified
  in_progress      → verified
  waiting_approval → backlog
  verified         → any
```

### Transition Validation Function

```typescript
// lib/services/task-transitions.ts
export const VALID_TRANSITIONS: Record<TaskColumn, TaskColumn[]> = {
  backlog: ['in_progress'],
  in_progress: ['waiting_approval', 'backlog'],
  waiting_approval: ['verified', 'in_progress'],
  verified: [], // Terminal state - no transitions allowed
};

export function canTransition(from: TaskColumn, to: TaskColumn): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function getValidTransitions(from: TaskColumn): TaskColumn[] {
  return VALID_TRANSITIONS[from];
}
```

---

## Method Specifications

### create

Creates a new task in the backlog column.

**Signature:**

```typescript
create(input: CreateTaskInput): Promise<Result<Task, TaskError>>
```

**Preconditions:**

- `projectId` must reference an existing project
- `title` must be 1-200 characters
- `description` must be <= 5000 characters
- `labels` must be <= 10 items

**Business Rules:**

1. New tasks always start in `backlog` column
2. Position is set to end of backlog (max position + 1)
3. Task ID is generated using CUID2
4. `createdAt` and `updatedAt` are set to current timestamp

**Side Effects:**

- **Database:** Inserts new row into `tasks` table
- **Events:** Emits `task:created` event to Durable Streams

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Project not found | `TaskErrors.NOT_FOUND` (via project lookup) |
| Validation failed | `ValidationErrors.VALIDATION_ERROR` |

**Example:**

```typescript
const result = await taskService.create({
  projectId: 'clp1234567890abcdef',
  title: 'Implement user authentication flow',
  description: 'Add OAuth2 support for GitHub and Google sign-in',
  labels: ['feature', 'auth'],
});

if (result.ok) {
  console.log('Task created:', result.value.id);
  // result.value.column === 'backlog'
}
```

---

### getById

Retrieves a task by its ID.

**Signature:**

```typescript
getById(id: string): Promise<Result<Task, TaskError>>
```

**Preconditions:**

- `id` must be a valid CUID2 format

**Business Rules:**

1. Returns the complete task record including all metadata

**Side Effects:**

- None

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Task ID not found | `TaskErrors.NOT_FOUND` |

---

### list

Lists tasks for a project with optional filtering.

**Signature:**

```typescript
list(projectId: string, options?: ListTasksOptions): Promise<Result<Task[], TaskError>>
```

**Preconditions:**

- `projectId` must reference an existing project
- `limit` must be 1-100 (default: 50)

**Business Rules:**

1. Default ordering is by `position` ascending within each column
2. Can filter by column, agent assignment
3. Returns empty array if no tasks match

**Side Effects:**

- None

**Example:**

```typescript
const result = await taskService.list('clp1234567890abcdef', {
  column: 'in_progress',
  orderBy: 'position',
  orderDirection: 'asc',
});
```

---

### update

Updates task metadata (not column or position).

**Signature:**

```typescript
update(id: string, input: UpdateTaskInput): Promise<Result<Task, TaskError>>
```

**Preconditions:**

- Task with `id` must exist
- `title` (if provided) must be 1-200 characters

**Business Rules:**

1. Only metadata fields can be updated (title, description, labels, metadata)
2. Use `moveColumn` to change column
3. Use `reorder` to change position
4. `updatedAt` is automatically set

**Side Effects:**

- **Database:** Updates row in `tasks` table
- **Events:** Emits `task:updated` event

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Task not found | `TaskErrors.NOT_FOUND` |

---

### delete

Deletes a task.

**Signature:**

```typescript
delete(id: string): Promise<Result<void, TaskError>>
```

**Preconditions:**

- Task with `id` must exist
- Task must not have an active agent assigned

**Business Rules:**

1. Cascades delete to associated audit logs
2. Does not delete associated worktree (handled separately)
3. Reorders remaining tasks in column to fill gap

**Side Effects:**

- **Database:** Deletes task record
- **Events:** Emits `task:deleted` event

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Task not found | `TaskErrors.NOT_FOUND` |
| Has assigned running agent | `TaskErrors.ALREADY_ASSIGNED(agentId)` |

---

### moveColumn

Moves a task to a different column.

**Signature:**

```typescript
moveColumn(id: string, column: TaskColumn, position?: number): Promise<Result<Task, TaskError>>
```

**Preconditions:**

- Task with `id` must exist
- Transition from current column to target column must be valid

**Business Rules:**

1. Validates transition using state machine
2. If `position` not provided, places at end of target column
3. Reorders source column to fill gap
4. Reorders target column to make room
5. When moving to `in_progress`:
   - Triggers worktree creation
   - Sets `startedAt` timestamp
   - Generates branch name from task ID
6. When moving to `waiting_approval`:
   - Generates diff summary
   - Sets agent to paused state
7. When moving to `verified`:
   - Triggers merge workflow
   - Sets `completedAt` timestamp
   - Cleans up worktree

**Side Effects:**

- **Database:** Updates task column and position
- **Events:** Emits `task:moved` event
- **Worktree:** May create/merge/remove worktree
- **Git:** May create branch, merge to main

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Task not found | `TaskErrors.NOT_FOUND` |
| Invalid transition | `TaskErrors.INVALID_TRANSITION(from, to)` |
| Position conflict | `TaskErrors.POSITION_CONFLICT` |

**Example:**

```typescript
// Move task from backlog to in_progress
const result = await taskService.moveColumn(
  'task123',
  'in_progress',
  0 // Top of the column
);

if (!result.ok && result.error.code === 'TASK_INVALID_TRANSITION') {
  console.error('Cannot move to', result.error.details.to);
  console.error('Allowed:', result.error.details.allowedTransitions);
}
```

---

### reorder

Reorders a task within its current column.

**Signature:**

```typescript
reorder(id: string, position: number): Promise<Result<Task, TaskError>>
```

**Preconditions:**

- Task with `id` must exist
- `position` must be >= 0 and <= max position in column

**Business Rules:**

1. Uses optimistic locking to handle concurrent reorders
2. Shifts other tasks up or down as needed
3. Position 0 is top of column

**Side Effects:**

- **Database:** Updates positions of affected tasks
- **Events:** Emits `task:reordered` event

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Task not found | `TaskErrors.NOT_FOUND` |
| Concurrent update | `TaskErrors.POSITION_CONFLICT` |

**Example:**

```typescript
// Move task to top of its column
const result = await taskService.reorder('task123', 0);
```

---

### getByColumn

Gets all tasks in a specific column, ordered by position.

**Signature:**

```typescript
getByColumn(projectId: string, column: TaskColumn): Promise<Result<Task[], TaskError>>
```

**Preconditions:**

- `projectId` must reference an existing project

**Business Rules:**

1. Returns tasks ordered by `position` ascending
2. Returns empty array if no tasks in column

**Side Effects:**

- None

**Example:**

```typescript
const result = await taskService.getByColumn(
  'clp1234567890abcdef',
  'waiting_approval'
);

if (result.ok) {
  result.value.forEach(task => {
    console.log(`${task.position}: ${task.title}`);
  });
}
```

---

### approve

Approves a task in the waiting_approval column.

**Signature:**

```typescript
approve(id: string, input: ApproveInput): Promise<Result<Task, TaskError>>
```

**Preconditions:**

- Task with `id` must exist
- Task must be in `waiting_approval` column
- Task must have a diff (changes to approve)

**Business Rules:**

1. Validates task is in correct column
2. Sets `approvedAt` to current timestamp
3. Sets `approvedBy` if provided
4. Moves task to `verified` column
5. If `createMergeCommit` is true (default):
   - Commits any uncommitted changes
   - Merges branch to default branch
   - Removes worktree
6. Resets rejection count

**Side Effects:**

- **Database:** Updates task status and approval metadata
- **Events:** Emits `task:approved` event, `workflow:approved` event
- **Git:** Commits, merges branch, removes worktree
- **Agent:** Stops associated agent

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Task not found | `TaskErrors.NOT_FOUND` |
| Not in waiting_approval | `TaskErrors.NOT_WAITING_APPROVAL(currentColumn)` |
| No changes to approve | `TaskErrors.NO_DIFF` |
| Already approved | `TaskErrors.ALREADY_APPROVED` |

**Example:**

```typescript
const result = await taskService.approve('task123', {
  approvedBy: 'user@example.com',
  createMergeCommit: true,
});

if (result.ok) {
  console.log('Task approved at:', result.value.approvedAt);
}
```

---

### reject

Rejects a task and returns it to in_progress with feedback.

**Signature:**

```typescript
reject(id: string, input: RejectInput): Promise<Result<Task, TaskError>>
```

**Preconditions:**

- Task with `id` must exist
- Task must be in `waiting_approval` column
- `reason` must be 1-1000 characters

**Business Rules:**

1. Validates task is in correct column
2. Stores rejection reason in `rejectionReason` field
3. Increments `rejectionCount`
4. Moves task back to `in_progress` column
5. Resumes associated agent with feedback context
6. Clears diff summary (will be regenerated on next completion)

**Side Effects:**

- **Database:** Updates task status and rejection metadata
- **Events:** Emits `task:rejected` event, `workflow:rejected` event
- **Agent:** Resumes agent with feedback prompt

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Task not found | `TaskErrors.NOT_FOUND` |
| Not in waiting_approval | `TaskErrors.NOT_WAITING_APPROVAL(currentColumn)` |

**Example:**

```typescript
const result = await taskService.reject('task123', {
  reason: 'Missing error handling for edge case. Please add try-catch around the API call.',
});

if (result.ok) {
  console.log('Rejection count:', result.value.rejectionCount);
}
```

---

### getDiff

Generates a diff for a task's changes.

**Signature:**

```typescript
getDiff(id: string): Promise<Result<DiffResult, TaskError>>
```

**Preconditions:**

- Task with `id` must exist
- Task must have a worktree/branch assigned

**Business Rules:**

1. Compares task branch against default branch
2. Returns structured diff with file changes and line counts
3. Caches diff summary in task record for quick access

**Side Effects:**

- **Git:** Runs `git diff` against worktree
- **Database:** May update cached diff summary

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Task not found | `TaskErrors.NOT_FOUND` |
| No worktree/branch | `TaskErrors.NO_DIFF` |

**Example:**

```typescript
const result = await taskService.getDiff('task123');

if (result.ok) {
  const { summary, files } = result.value;
  console.log(`${summary.filesChanged} files, +${summary.additions}, -${summary.deletions}`);

  files.forEach(file => {
    console.log(`${file.status}: ${file.path}`);
  });
}
```

---

## Implementation Outline

```typescript
// lib/services/task-service.ts
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { tasks, projects, agents } from '@/db/schema';
import { ok, err } from '@/lib/utils/result';
import { TaskErrors } from '@/lib/errors/task-errors';
import { createTaskSchema, moveTaskSchema } from '@/db/schema/validation';
import { createId } from '@paralleldrive/cuid2';
import { canTransition, VALID_TRANSITIONS } from './task-transitions';

export class TaskService implements ITaskService {
  async create(input: CreateTaskInput): Promise<Result<Task, TaskError>> {
    // 1. Validate input
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      return err(TaskErrors.NOT_FOUND); // Should be validation error
    }

    // 2. Get max position in backlog
    const maxPosition = await db
      .select({ max: sql<number>`COALESCE(MAX(position), -1)` })
      .from(tasks)
      .where(and(
        eq(tasks.projectId, input.projectId),
        eq(tasks.column, 'backlog')
      ));

    // 3. Insert task
    const [task] = await db.insert(tasks).values({
      id: createId(),
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      column: 'backlog',
      position: (maxPosition[0]?.max ?? -1) + 1,
      labels: input.labels ?? [],
      metadata: input.metadata ?? {},
    }).returning();

    // 4. Emit event
    await this.emitEvent('task:created', task);

    return ok(task);
  }

  async getById(id: string): Promise<Result<Task, TaskError>> {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return err(TaskErrors.NOT_FOUND);
    }

    return ok(task);
  }

  async list(
    projectId: string,
    options?: ListTasksOptions
  ): Promise<Result<Task[], TaskError>> {
    const {
      column,
      agentId,
      limit = 50,
      offset = 0,
      orderBy = 'position',
      orderDirection = 'asc',
    } = options ?? {};

    const conditions = [eq(tasks.projectId, projectId)];
    if (column) conditions.push(eq(tasks.column, column));
    if (agentId) conditions.push(eq(tasks.agentId, agentId));

    const orderFn = orderDirection === 'desc' ? desc : asc;

    const results = await db.query.tasks.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [orderFn(tasks[orderBy])],
    });

    return ok(results);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Result<Task, TaskError>> {
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    const [updated] = await db.update(tasks)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    await this.emitEvent('task:updated', updated);

    return ok(updated);
  }

  async delete(id: string): Promise<Result<void, TaskError>> {
    const existing = await this.getById(id);
    if (!existing.ok) {
      return err(existing.error);
    }

    // Check for running agent
    if (existing.value.agentId) {
      const agent = await db.query.agents.findFirst({
        where: eq(agents.id, existing.value.agentId),
      });

      if (agent?.status === 'running') {
        return err(TaskErrors.ALREADY_ASSIGNED(agent.id));
      }
    }

    // Delete and reorder
    await db.transaction(async (tx) => {
      const { column, position, projectId } = existing.value;

      await tx.delete(tasks).where(eq(tasks.id, id));

      // Shift positions down for tasks after deleted one
      await tx.update(tasks)
        .set({ position: sql`position - 1` })
        .where(and(
          eq(tasks.projectId, projectId),
          eq(tasks.column, column),
          sql`position > ${position}`
        ));
    });

    await this.emitEvent('task:deleted', { id });

    return ok(undefined);
  }

  async moveColumn(
    id: string,
    column: TaskColumn,
    position?: number
  ): Promise<Result<Task, TaskError>> {
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    const task = existing.value;
    const fromColumn = task.column;

    // Validate transition
    if (!canTransition(fromColumn, column)) {
      return err(TaskErrors.INVALID_TRANSITION(fromColumn, column));
    }

    // Calculate target position
    let targetPosition = position;
    if (targetPosition === undefined) {
      const maxPos = await db
        .select({ max: sql<number>`COALESCE(MAX(position), -1)` })
        .from(tasks)
        .where(and(
          eq(tasks.projectId, task.projectId),
          eq(tasks.column, column)
        ));
      targetPosition = (maxPos[0]?.max ?? -1) + 1;
    }

    // Perform move in transaction
    const [updated] = await db.transaction(async (tx) => {
      // 1. Remove from source column (shift positions down)
      await tx.update(tasks)
        .set({ position: sql`position - 1` })
        .where(and(
          eq(tasks.projectId, task.projectId),
          eq(tasks.column, fromColumn),
          sql`position > ${task.position}`
        ));

      // 2. Make room in target column (shift positions up)
      await tx.update(tasks)
        .set({ position: sql`position + 1` })
        .where(and(
          eq(tasks.projectId, task.projectId),
          eq(tasks.column, column),
          sql`position >= ${targetPosition}`
        ));

      // 3. Update task
      const updateData: Partial<Task> = {
        column,
        position: targetPosition,
        updatedAt: new Date(),
      };

      // Set timestamps based on column
      if (column === 'in_progress' && fromColumn === 'backlog') {
        updateData.startedAt = new Date();
      } else if (column === 'verified') {
        updateData.completedAt = new Date();
      }

      return tx.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, id))
        .returning();
    });

    // Trigger side effects based on column
    await this.handleColumnSideEffects(updated, fromColumn, column);

    await this.emitEvent('task:moved', {
      task: updated,
      from: fromColumn,
      to: column,
    });

    return ok(updated);
  }

  async reorder(id: string, position: number): Promise<Result<Task, TaskError>> {
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    const task = existing.value;
    const oldPosition = task.position;

    if (oldPosition === position) {
      return ok(task); // No change needed
    }

    const [updated] = await db.transaction(async (tx) => {
      if (position > oldPosition) {
        // Moving down: shift tasks up in the gap
        await tx.update(tasks)
          .set({ position: sql`position - 1` })
          .where(and(
            eq(tasks.projectId, task.projectId),
            eq(tasks.column, task.column),
            sql`position > ${oldPosition}`,
            sql`position <= ${position}`
          ));
      } else {
        // Moving up: shift tasks down to make room
        await tx.update(tasks)
          .set({ position: sql`position + 1` })
          .where(and(
            eq(tasks.projectId, task.projectId),
            eq(tasks.column, task.column),
            sql`position >= ${position}`,
            sql`position < ${oldPosition}`
          ));
      }

      return tx.update(tasks)
        .set({ position, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
    });

    await this.emitEvent('task:reordered', updated);

    return ok(updated);
  }

  async getByColumn(
    projectId: string,
    column: TaskColumn
  ): Promise<Result<Task[], TaskError>> {
    const results = await db.query.tasks.findMany({
      where: and(
        eq(tasks.projectId, projectId),
        eq(tasks.column, column)
      ),
      orderBy: [asc(tasks.position)],
    });

    return ok(results);
  }

  async approve(id: string, input: ApproveInput): Promise<Result<Task, TaskError>> {
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    const task = existing.value;

    // Validate column
    if (task.column !== 'waiting_approval') {
      return err(TaskErrors.NOT_WAITING_APPROVAL(task.column));
    }

    // Check for diff
    if (!task.diffSummary && !task.branch) {
      return err(TaskErrors.NO_DIFF);
    }

    // Check not already approved
    if (task.approvedAt) {
      return err(TaskErrors.ALREADY_APPROVED);
    }

    // Move to verified (handles merge workflow)
    const moveResult = await this.moveColumn(id, 'verified');
    if (!moveResult.ok) {
      return moveResult;
    }

    // Update approval metadata
    const [updated] = await db.update(tasks)
      .set({
        approvedAt: new Date(),
        approvedBy: input.approvedBy,
        rejectionCount: 0,
        rejectionReason: null,
      })
      .where(eq(tasks.id, id))
      .returning();

    await this.emitEvent('task:approved', updated);
    await this.emitEvent('workflow:approved', {
      taskId: id,
      approver: input.approvedBy,
    });

    return ok(updated);
  }

  async reject(id: string, input: RejectInput): Promise<Result<Task, TaskError>> {
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    const task = existing.value;

    // Validate column
    if (task.column !== 'waiting_approval') {
      return err(TaskErrors.NOT_WAITING_APPROVAL(task.column));
    }

    // Move back to in_progress
    const moveResult = await this.moveColumn(id, 'in_progress');
    if (!moveResult.ok) {
      return moveResult;
    }

    // Update rejection metadata
    const [updated] = await db.update(tasks)
      .set({
        rejectionReason: input.reason,
        rejectionCount: sql`rejection_count + 1`,
        diffSummary: null,
        filesChanged: null,
        linesAdded: null,
        linesRemoved: null,
      })
      .where(eq(tasks.id, id))
      .returning();

    await this.emitEvent('task:rejected', updated);
    await this.emitEvent('workflow:rejected', {
      taskId: id,
      reason: input.reason,
    });

    // Resume agent with feedback
    // This is handled by the agent service

    return ok(updated);
  }

  async getDiff(id: string): Promise<Result<DiffResult, TaskError>> {
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    const task = existing.value;

    if (!task.branch || !task.worktreeId) {
      return err(TaskErrors.NO_DIFF);
    }

    // Generate diff using git service
    // This delegates to the worktree/git service
    const diff = await this.generateDiff(task);

    // Cache summary in task
    await db.update(tasks)
      .set({
        diffSummary: diff.summary.filesChanged > 0
          ? `${diff.summary.filesChanged} files, +${diff.summary.additions}, -${diff.summary.deletions}`
          : null,
        filesChanged: diff.summary.filesChanged,
        linesAdded: diff.summary.additions,
        linesRemoved: diff.summary.deletions,
      })
      .where(eq(tasks.id, id));

    return ok(diff);
  }

  private async handleColumnSideEffects(
    task: Task,
    fromColumn: TaskColumn,
    toColumn: TaskColumn
  ): Promise<void> {
    // Delegate to worktree service based on transition
    if (fromColumn === 'backlog' && toColumn === 'in_progress') {
      // Create worktree, assign agent
      // worktreeService.create(...)
    } else if (toColumn === 'waiting_approval') {
      // Generate diff, pause agent
      // agentService.pause(...)
    } else if (toColumn === 'verified') {
      // Merge branch, cleanup worktree
      // worktreeService.merge(...)
      // worktreeService.remove(...)
    }
  }

  private async generateDiff(task: Task): Promise<DiffResult> {
    // Implementation delegates to git/worktree service
    throw new Error('Not implemented - delegates to worktree service');
  }

  private async emitEvent(type: string, payload: unknown): Promise<void> {
    // Emit to Durable Streams
    // Implementation depends on session service
  }
}

// Export singleton instance
export const taskService = new TaskService();
```

---

## Position Management

### Optimistic Concurrency

Position updates use optimistic locking to handle concurrent drag-and-drop operations:

```typescript
// Position update with optimistic locking
async reorderWithLocking(
  id: string,
  position: number,
  expectedVersion: number
): Promise<Result<Task, TaskError>> {
  const [updated] = await db.update(tasks)
    .set({
      position,
      version: sql`version + 1`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(tasks.id, id),
      eq(tasks.version, expectedVersion)
    ))
    .returning();

  if (!updated) {
    return err(TaskErrors.POSITION_CONFLICT);
  }

  return ok(updated);
}
```

### Gap-Based Positioning (Alternative)

For high-frequency reordering, consider gap-based positioning:

```typescript
// Use large gaps between positions
// Allows insertions without shifting other items
const POSITION_GAP = 1000;

async insertBetween(
  beforeTaskId: string | null,
  afterTaskId: string | null
): Promise<number> {
  let newPosition: number;

  if (!beforeTaskId && !afterTaskId) {
    newPosition = POSITION_GAP;
  } else if (!beforeTaskId) {
    const after = await this.getById(afterTaskId!);
    newPosition = after.value!.position - POSITION_GAP;
  } else if (!afterTaskId) {
    const before = await this.getById(beforeTaskId!);
    newPosition = before.value!.position + POSITION_GAP;
  } else {
    const before = await this.getById(beforeTaskId);
    const after = await this.getById(afterTaskId);
    newPosition = Math.floor(
      (before.value!.position + after.value!.position) / 2
    );
  }

  return newPosition;
}
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](../database/schema.md) | Task table definition |
| [Error Catalog](../errors/error-catalog.md) | TaskError types |
| [ProjectService](./project-service.md) | Tasks belong to projects |
| [AgentService](./agent-service.md) | Agents are assigned to tasks |
| [WorktreeService](./worktree-service.md) | Worktrees are created for tasks |
| [API Endpoints](../api/endpoints.md) | HTTP routes for task operations |
| [Git Worktrees](../integrations/git-worktrees.md) | Worktree lifecycle |
