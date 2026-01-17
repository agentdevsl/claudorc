# WorktreeManagement Component Specification

## Overview

The WorktreeManagement component displays and manages git worktrees for a project. It shows active worktrees, their status, associated tasks, and provides actions for merging, removing, and pruning worktrees.

**Related Wireframes:**
- [Worktree Management](../wireframes/worktree-management.html) - Worktree list with status and actions

---

## Interface Definition

```typescript
// app/components/views/worktree-management/types.ts
import type { Worktree, WorktreeStatus } from '@/lib/services/worktree-service.types';

// ===== Component Props =====
export interface WorktreeManagementProps {
  /** Project ID to show worktrees for */
  projectId: string;
  /** Callback when worktree is selected */
  onWorktreeSelect?: (worktree: Worktree) => void;
  /** Whether to show in panel mode (sidebar) */
  panelMode?: boolean;
}

// ===== Worktree List Item =====
export interface WorktreeListItem {
  id: string;
  branch: string;
  path: string;
  baseBranch: string;
  status: WorktreeStatus;
  taskId?: string;
  taskTitle?: string;
  agentId?: string;
  agentName?: string;
  createdAt: Date;
  lastActivity?: Date;
  hasUncommittedChanges: boolean;
  aheadBehind?: {
    ahead: number;
    behind: number;
  };
}

// ===== Worktree Status =====
export type WorktreeStatus =
  | 'creating'    // Being created
  | 'initializing'// Running setup scripts
  | 'active'      // Ready for use
  | 'dirty'       // Has uncommitted changes
  | 'committing'  // Commit in progress
  | 'merging'     // Merge in progress
  | 'conflict'    // Has merge conflicts
  | 'removing'    // Being removed
  | 'removed'     // Successfully removed
  | 'error';      // Error state
```

---

## Component Specifications

### WorktreeManagement (Container)

```typescript
// app/components/views/worktree-management/index.tsx
export interface WorktreeManagementProps {
  projectId: string;
  onWorktreeSelect?: (worktree: Worktree) => void;
  panelMode?: boolean;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `projectId` | `string` | Yes | - | Project to show worktrees for |
| `onWorktreeSelect` | `(worktree) => void` | No | - | Called when worktree clicked |
| `panelMode` | `boolean` | No | `false` | Use compact panel layout |

---

### Layout (Full Page)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Worktrees                                                  [+ Create]  │
│  Manage isolated workspaces for concurrent agent tasks                  │
│                                                                         │
│  ┌─ Active Worktrees (3) ──────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 🌿 agent/abc123/implement-auth                                  │││
│  │  │    Task: Implement user authentication            [Active]       │││
│  │  │    Agent: TaskBot                                               │││
│  │  │    ↑2 ↓0 from main · Created 2h ago                             │││
│  │  │                                        [Open] [Merge] [Remove]  │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ 🌿 agent/def456/fix-navigation                                  │││
│  │  │    Task: Fix navigation bug                       [Dirty]        │││
│  │  │    Agent: BugFixer                                              │││
│  │  │    ↑5 ↓1 from main · Has uncommitted changes                    │││
│  │  │                                        [Open] [Commit] [Remove] │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────┐││
│  │  │ ⚠ agent/ghi789/add-darkmode                                     │││
│  │  │    Task: Add dark mode support                   [Conflict]      │││
│  │  │    Agent: FeatureBot                                            │││
│  │  │    Has merge conflicts with main                                │││
│  │  │                                      [Open] [Resolve] [Abort]   │││
│  │  └─────────────────────────────────────────────────────────────────┘││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─ Stale Worktrees ───────────────────────────────────────────────────┐│
│  │  2 worktrees inactive for >7 days                    [Prune All]    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Layout (Panel Mode)

```
┌─────────────────────────────────┐
│  Worktrees (3)          [+]    │
├─────────────────────────────────┤
│  🌿 implement-auth              │
│     TaskBot · ↑2 ↓0   [Active] │
├─────────────────────────────────┤
│  🌿 fix-navigation              │
│     BugFixer · ↑5 ↓1  [Dirty]  │
├─────────────────────────────────┤
│  ⚠ add-darkmode                 │
│     FeatureBot      [Conflict]  │
└─────────────────────────────────┘
```

---

### WorktreeListItem

```typescript
// app/components/views/worktree-management/components/worktree-list-item.tsx
export interface WorktreeListItemProps {
  worktree: WorktreeListItem;
  onOpen?: () => void;
  onMerge?: () => void;
  onCommit?: () => void;
  onRemove?: () => void;
  onResolve?: () => void;
  compact?: boolean;
}
```

#### Visual Elements

| Element | Description | Style |
|---------|-------------|-------|
| Branch icon | Tree/branch indicator | `🌿` or `⚠` for conflict |
| Branch name | Shortened branch name | Monospace, blue |
| Task title | Associated task | 14px, truncate |
| Agent name | Working agent | 13px, muted |
| Ahead/Behind | Commits vs base | `↑N ↓M` format |
| Status badge | Current status | Colored badge |
| Actions | Context actions | Button group |

---

### Status Indicators

| Status | Icon | Badge Color | Actions |
|--------|------|-------------|---------|
| `creating` | Spinner | Blue | Cancel |
| `initializing` | Spinner | Blue | Cancel |
| `active` | Green dot | Green | Open, Merge, Remove |
| `dirty` | Orange dot | Orange | Open, Commit, Remove |
| `committing` | Spinner | Blue | - |
| `merging` | Spinner | Purple | Cancel |
| `conflict` | Warning | Red | Open, Resolve, Abort |
| `removing` | Spinner | Gray | - |
| `error` | X | Red | Retry, Remove |

---

### Action Buttons

```typescript
// Action definitions based on status
const actions: Record<WorktreeStatus, ActionButton[]> = {
  creating: [{ label: 'Cancel', variant: 'ghost' }],
  initializing: [{ label: 'Cancel', variant: 'ghost' }],
  active: [
    { label: 'Open', variant: 'secondary' },
    { label: 'Merge', variant: 'primary' },
    { label: 'Remove', variant: 'ghost' },
  ],
  dirty: [
    { label: 'Open', variant: 'secondary' },
    { label: 'Commit', variant: 'primary' },
    { label: 'Remove', variant: 'ghost' },
  ],
  committing: [],
  merging: [{ label: 'Cancel', variant: 'ghost' }],
  conflict: [
    { label: 'Open', variant: 'secondary' },
    { label: 'Resolve', variant: 'warning' },
    { label: 'Abort', variant: 'danger' },
  ],
  removing: [],
  removed: [],
  error: [
    { label: 'Retry', variant: 'primary' },
    { label: 'Force Remove', variant: 'danger' },
  ],
};
```

---

### Merge Dialog

```typescript
// app/components/views/worktree-management/components/merge-dialog.tsx
export interface MergeDialogProps {
  worktree: Worktree;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerge: (options: MergeOptions) => void;
}

interface MergeOptions {
  targetBranch: string;
  deleteAfterMerge: boolean;
  squash: boolean;
  commitMessage?: string;
}
```

#### Dialog Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Merge Worktree                                       [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Branch: agent/abc123/implement-auth                        │
│                                                             │
│  Target Branch                                              │
│  [▼ main                                              ]     │
│                                                             │
│  Options                                                    │
│  [✓] Delete worktree after merge                            │
│  [ ] Squash commits                                         │
│                                                             │
│  Commit Message (for squash)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Implement user authentication                       │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Changes: 5 files changed, +127 -23                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                [Cancel]  [Merge to main]    │
└─────────────────────────────────────────────────────────────┘
```

---

### Conflict Resolution

```typescript
// app/components/views/worktree-management/components/conflict-view.tsx
export interface ConflictViewProps {
  worktree: Worktree;
  conflicts: ConflictFile[];
  onResolve: (file: string, resolution: 'ours' | 'theirs' | 'manual') => void;
  onAbort: () => void;
}

interface ConflictFile {
  path: string;
  status: 'conflicted' | 'resolved';
  resolution?: 'ours' | 'theirs' | 'manual';
}
```

---

## Business Rules

| Rule | Description |
|------|-------------|
| **One worktree per task** | Each task can have only one active worktree |
| **Agent ownership** | Only the assigned agent modifies worktree |
| **Base branch sync** | Warn if base branch has new commits |
| **Stale detection** | Worktrees inactive >7 days marked stale |
| **Force remove** | Requires confirmation, loses uncommitted work |
| **Merge protection** | Cannot merge with uncommitted changes |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `O` | Open selected worktree in editor |
| `M` | Merge selected worktree |
| `R` | Remove selected worktree |
| `↑/↓` | Navigate list |
| `Enter` | Select worktree |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| List role | `role="list"` on container |
| Item role | `role="listitem"` on each worktree |
| Status | `aria-label` includes status |
| Actions | `aria-label` for icon buttons |
| Focus | Visible focus indicator |

---

## Error Conditions

| Condition | Error Code | UI Behavior |
|-----------|------------|-------------|
| Create failed | `WORKTREE_CREATION_FAILED` | Show error toast |
| Merge conflict | `WORKTREE_MERGE_CONFLICT` | Show conflict view |
| Remove failed | `WORKTREE_REMOVAL_FAILED` | Show error, offer force |
| Branch exists | `WORKTREE_BRANCH_EXISTS` | Show error message |
| Dirty worktree | `WORKTREE_DIRTY` | Block merge, show warning |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Worktree Service](../services/worktree-service.md) | Worktree operations |
| [Worktree Lifecycle](../state-machines/worktree-lifecycle.md) | State transitions |
| [Git Worktrees](../integrations/git-worktrees.md) | Git integration |
| [Error Catalog](../errors/error-catalog.md) | `WORKTREE_*` error codes |
