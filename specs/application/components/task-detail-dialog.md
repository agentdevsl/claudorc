# TaskDetailDialog Component Specification

## Overview

The TaskDetailDialog is a modal component that displays comprehensive task information and provides inline editing capabilities. It serves as the primary interface for viewing task details, managing metadata, tracking activity history, and performing context-sensitive actions based on the task's current workflow state.

**Related Wireframes:**
- [Task Detail Dialog](../wireframes/task-detail-dialog.html) - Full modal with edit form
- [Kanban Board Full](../wireframes/kanban-board-full.html) - Task cards that open this dialog

---

## Display Modes

The TaskDetailDialog supports two display modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Modal** | Centered overlay with backdrop | Default - triggered from Kanban card click |
| **Panel** | Side panel slide-in from right | Split-view layout for multi-task workflows |

```typescript
type DialogDisplayMode = 'modal' | 'panel';
```

---

## Interface Definition

```typescript
// app/components/views/kanban-board/dialogs/task-detail-dialog.tsx
import type { Result } from '@/lib/utils/result';
import type { Task, Agent, Worktree, TaskColumn, AuditLog } from '@/db/schema';

export interface TaskDetailDialogProps {
  /** Task to display/edit */
  task: Task;
  /** Assigned agent (if any) */
  agent?: Agent;
  /** Associated worktree (if any) */
  worktree?: Worktree;
  /** Activity/audit log entries */
  activityLog?: AuditLog[];
  /** Available agents for assignment dropdown */
  availableAgents: Agent[];
  /** Available labels for the project */
  availableLabels: string[];
  /** Whether dialog is open */
  open: boolean;
  /** Display mode */
  displayMode?: DialogDisplayMode;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Callback when task is updated */
  onUpdate: (input: UpdateTaskInput) => Promise<Result<Task, TaskError>>;
  /** Callback when task is deleted */
  onDelete: (taskId: string) => Promise<Result<void, TaskError>>;
  /** Callback when agent is assigned */
  onAssignAgent: (taskId: string, agentId: string) => Promise<Result<Task, TaskError>>;
  /** Callback when task is moved to different column */
  onMoveColumn: (taskId: string, column: TaskColumn) => Promise<Result<Task, TaskError>>;
  /** Callback to view agent session */
  onViewSession?: (sessionId: string) => void;
  /** Callback to open approval dialog */
  onOpenApproval?: (taskId: string) => void;
  /** Users currently viewing this task */
  viewers?: TaskViewer[];
}

export interface TaskViewer {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  labels?: string[];
  metadata?: Record<string, unknown>;
}

export type TaskError =
  | { code: 'TASK_NOT_FOUND'; message: string }
  | { code: 'TASK_INVALID_TRANSITION'; message: string; from: TaskColumn; to: TaskColumn }
  | { code: 'TASK_ALREADY_ASSIGNED'; message: string; agentId: string }
  | { code: 'VALIDATION_ERROR'; message: string; field: string };
```

---

## Type Definitions

```typescript
// lib/types/task-detail.ts
import { z } from 'zod';

/** Dialog internal state */
export interface TaskDetailDialogState {
  /** Whether in edit mode */
  isEditing: boolean;
  /** Active section being edited */
  editingSection: EditSection | null;
  /** Pending changes not yet saved */
  pendingChanges: Partial<UpdateTaskInput>;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Which action is in progress */
  pendingAction: TaskAction | null;
  /** Expanded/collapsed sections */
  expandedSections: Set<DialogSection>;
  /** Active tab in activity section */
  activityTab: 'timeline' | 'comments' | 'history';
}

export type EditSection = 'title' | 'description' | 'labels' | 'priority' | 'agent';
export type DialogSection = 'metadata' | 'labels' | 'activity' | 'worktree';
export type TaskAction = 'save' | 'delete' | 'assign' | 'approve' | 'reject' | 'pause' | 'cancel';

/** Priority levels */
export type TaskPriority = 'high' | 'medium' | 'low';

/** Validation schemas */
export const updateTaskInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(5000, 'Description too long').optional(),
  labels: z.array(z.string()).max(10, 'Maximum 10 labels').optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const taskPrioritySchema = z.enum(['high', 'medium', 'low']);
```

---

## Component Specifications

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `task` | `Task` | Yes | - | Task record to display |
| `agent` | `Agent` | No | - | Assigned agent details |
| `worktree` | `Worktree` | No | - | Linked worktree info |
| `activityLog` | `AuditLog[]` | No | `[]` | Activity/history entries |
| `availableAgents` | `Agent[]` | Yes | - | Agents for dropdown |
| `availableLabels` | `string[]` | Yes | - | Project labels |
| `open` | `boolean` | Yes | - | Controls visibility |
| `displayMode` | `DialogDisplayMode` | No | `'modal'` | Modal or panel mode |
| `onClose` | `() => void` | Yes | - | Close handler |
| `onUpdate` | `(UpdateTaskInput) => Promise<Result>` | Yes | - | Update handler |
| `onDelete` | `(taskId) => Promise<Result>` | Yes | - | Delete handler |
| `onAssignAgent` | `(taskId, agentId) => Promise<Result>` | Yes | - | Assignment handler |
| `onMoveColumn` | `(taskId, column) => Promise<Result>` | Yes | - | Column move handler |
| `onViewSession` | `(sessionId) => void` | No | - | Open session viewer |
| `onOpenApproval` | `(taskId) => void` | No | - | Open approval dialog |
| `viewers` | `TaskViewer[]` | No | `[]` | Active viewers |

### State

| State | Type | Initial | Description |
|-------|------|---------|-------------|
| `isEditing` | `boolean` | `false` | Edit mode active |
| `editingSection` | `EditSection \| null` | `null` | Which field is being edited |
| `pendingChanges` | `Partial<UpdateTaskInput>` | `{}` | Unsaved changes |
| `isSaving` | `boolean` | `false` | Save in progress |
| `pendingAction` | `TaskAction \| null` | `null` | Current action |
| `expandedSections` | `Set<DialogSection>` | All expanded | Collapsed sections |
| `activityTab` | `'timeline' \| 'comments' \| 'history'` | `'timeline'` | Activity view |

### Events

| Event | Trigger | Payload | Handler Action |
|-------|---------|---------|----------------|
| `task:opened` | Dialog opens | `{ taskId }` | Track presence |
| `task:edited` | Edit saved | `{ taskId, changes }` | Call `onUpdate` |
| `task:deleted` | Delete confirmed | `{ taskId }` | Call `onDelete`, close dialog |
| `agent:assigned` | Agent selected | `{ taskId, agentId }` | Call `onAssignAgent` |
| `dialog:closed` | X or Escape | - | Call `onClose` |
| `edit:started` | E key or edit button | `{ section }` | Enter edit mode |
| `edit:cancelled` | Escape or cancel | - | Discard changes |
| `edit:saved` | Cmd+S or save button | `{ changes }` | Save pending changes |

---

## Display Sections

### 1. Header Section

The header displays the task identifier, title (editable), and status badge.

```
+------------------------------------------------------------------+
| [Status Badge]  #TSK-156                           [Viewers] [X] |
|------------------------------------------------------------------|
| [Title - editable inline]                                        |
+------------------------------------------------------------------+
```

| Element | Styling | Behavior |
|---------|---------|----------|
| Status Badge | Colored badge based on column | Click to view transitions |
| Task ID | `font-mono`, `text-fg-muted` | Copy on click |
| Title | `text-lg font-semibold`, editable | Click to edit inline |
| Viewers | Avatar stack with count | Hover for names |
| Close button | `32x32px` icon button | Close dialog |

### 2. Description Section

Rich text description with Markdown support.

| Element | Styling | Behavior |
|---------|---------|----------|
| Label | `text-sm font-medium text-fg-muted` | "Description" |
| Content | Rendered markdown, `prose prose-invert` | Click to edit |
| Placeholder | `text-fg-subtle italic` | "Add a description..." |
| Edit mode | Textarea with markdown toolbar | Min height 100px |

### 3. Metadata Section

Key task metadata in a compact grid layout.

```
+----------------------+------------------------+
| Created              | Updated                |
| Jan 15, 2026 2:30 PM | Jan 17, 2026 10:15 AM  |
+----------------------+------------------------+
| Started              | Completed              |
| Jan 16, 2026 9:00 AM | -                      |
+----------------------+------------------------+
| Turns                | Files Changed          |
| 23                   | 5 (+145 / -23)         |
+----------------------+------------------------+
```

| Field | Format | Source |
|-------|--------|--------|
| Created | Relative + absolute on hover | `task.createdAt` |
| Updated | Relative + absolute on hover | `task.updatedAt` |
| Started | Relative or "-" | `task.startedAt` |
| Completed | Relative or "-" | `task.completedAt` |
| Turns | Number | `task.turnCount` |
| Files Changed | Count with +/- | `task.filesChanged`, `linesAdded`, `linesRemoved` |

### 4. Labels Section

Tag-style labels with add/remove capability.

```
+------------------------------------------------------------------+
| Labels                                                    [Edit] |
|------------------------------------------------------------------|
| [x feature] [x enhancement] [+ Add label]                        |
+------------------------------------------------------------------+
```

| Element | Styling | Behavior |
|---------|---------|----------|
| Label pill | Colored background, rounded-full | X to remove |
| Add button | Ghost button with + icon | Opens label picker dropdown |
| Label picker | Dropdown with available labels | Multi-select checkboxes |

**Label Colors (CVA Variants):**

```typescript
const labelVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
  {
    variants: {
      type: {
        bug: 'bg-danger-muted text-danger-fg',
        feature: 'bg-accent-muted text-accent-fg',
        enhancement: 'bg-done-muted text-done-fg',
        documentation: 'bg-muted text-fg-muted',
        default: 'bg-subtle text-fg-default',
      },
    },
  }
);
```

### 5. Priority Selector

Visual radio-style priority selection.

```
+------------------------------------------------------------------+
| Priority                                                         |
|------------------------------------------------------------------|
| [o High]  [* Medium]  [o Low]                                    |
+------------------------------------------------------------------+
```

| Priority | Indicator Color | Background (selected) |
|----------|----------------|----------------------|
| High | `--danger-fg` (#f85149) | `--danger-muted` |
| Medium | `--attention-fg` (#d29922) | `--attention-muted` |
| Low | `--success-fg` (#3fb950) | `--success-muted` |

### 6. Agent Assignment Dropdown

Custom select for agent assignment with status indicators.

```
+------------------------------------------------------------------+
| Assign to Agent                                                  |
|------------------------------------------------------------------|
| [Avatar] Task Runner - Available                            [v]  |
|  +------------------------------------------------------+        |
|  | [--] Unassigned                                      |        |
|  | [TR] Task Runner - Available                    [*]  |        |
|  | [CR] Code Reviewer - Busy                            |        |
|  | [AI] Auto-assign                                     |        |
|  +------------------------------------------------------+        |
+------------------------------------------------------------------+
```

| Element | Styling | Content |
|---------|---------|---------|
| Avatar | `24px` circle, gradient background | Agent initials |
| Name | `font-medium` | Agent name |
| Status | `text-fg-muted text-xs` | "Available", "Busy", "Running" |
| Dropdown | `bg-subtle`, `border-default` | Agent list with selection |

### 7. Activity/History Timeline

Tabbed view of task activity.

**Tabs:**
- **Timeline**: All events in chronological order
- **Comments**: User comments and feedback
- **History**: State changes only

```
+------------------------------------------------------------------+
| Activity                      [Timeline] [Comments] [History]    |
|------------------------------------------------------------------|
| [o] Agent started execution                       2 hours ago    |
| [o] File modified: src/auth/login.ts              1 hour ago     |
| [o] Agent completed task                          30 min ago     |
| [!] Task rejected: Missing error handling         15 min ago     |
| [o] Agent resumed with feedback                   10 min ago     |
+------------------------------------------------------------------+
```

| Event Type | Icon | Color |
|------------|------|-------|
| Agent started | Play icon | `--accent-fg` |
| File modified | File icon | `--fg-muted` |
| Agent completed | Check icon | `--success-fg` |
| Task rejected | X icon | `--danger-fg` |
| Agent resumed | Refresh icon | `--attention-fg` |
| Comment added | Message icon | `--fg-default` |

### 8. Linked Worktree Info

Display worktree details when task is in progress.

```
+------------------------------------------------------------------+
| Worktree                                                         |
|------------------------------------------------------------------|
| Branch: task/clp1234567                                          |
| Path: .worktrees/task-clp1234567                                 |
| Status: Active                                    [Open in IDE]  |
+------------------------------------------------------------------+
```

| Field | Value | Action |
|-------|-------|--------|
| Branch | `worktree.branch` | Copy button |
| Path | `worktree.path` | Copy button |
| Status | Badge (Active/Merging/Error) | - |
| Open in IDE | Button | Opens VS Code/Cursor |

### 9. Action Buttons

Context-sensitive actions based on current column.

---

## Action Buttons by Column

Actions available depend on the task's current workflow state:

### Backlog Column

| Button | Variant | Icon | Action |
|--------|---------|------|--------|
| Assign Agent | Primary | User+ | Opens agent picker, moves to In Progress |
| Delete Task | Danger ghost | Trash | Confirms and deletes task |

### In Progress Column

| Button | Variant | Icon | Action |
|--------|---------|------|--------|
| View Session | Primary | Terminal | Opens agent session viewer |
| Pause Agent | Secondary | Pause | Pauses agent execution |
| Cancel Task | Danger ghost | X | Returns task to Backlog |

### Waiting Approval Column

| Button | Variant | Icon | Action |
|--------|---------|------|--------|
| View Diff | Primary | GitBranch | Opens diff in approval dialog |
| Approve | Success | Check | Approves and merges changes |
| Reject | Danger | X | Opens feedback dialog |

### Verified Column

| Button | Variant | Icon | Action |
|--------|---------|------|--------|
| View History | Primary | Clock | Shows full execution history |
| Archive | Secondary ghost | Archive | Moves to archived state |

---

## Edit Mode

### Inline Editing

Edit mode is triggered per-section for focused editing.

| Section | Trigger | Editor | Save |
|---------|---------|--------|------|
| Title | Click on title or E key | Input field | Blur or Enter |
| Description | Click or Edit button | Textarea with toolbar | Cmd+S or Save button |
| Labels | Edit button | Checkbox dropdown | Auto-save on change |
| Priority | Click option | Radio buttons | Auto-save on change |
| Agent | Dropdown change | Select | Auto-save on change |

### Rich Text for Description

The description editor supports Markdown with a toolbar:

```
+------------------------------------------------------------------+
| [B] [I] [~] [<>] [Link] [List] [Quote]              [Preview]    |
|------------------------------------------------------------------|
| Add OAuth2 support for GitHub and Google sign-in providers.      |
| Include token refresh logic and secure session management.       |
|                                                                  |
| ## Acceptance Criteria                                           |
| - [ ] GitHub OAuth flow                                          |
| - [ ] Google OAuth flow                                          |
| - [ ] Token refresh on expiry                                    |
+------------------------------------------------------------------+
```

### Label Management

Label editing uses a popover with checkboxes:

```typescript
interface LabelEditorProps {
  selected: string[];
  available: string[];
  onToggle: (label: string) => void;
  onCreate?: (label: string) => void;
}
```

---

## State Management

### View vs Edit Mode

```typescript
const [state, dispatch] = useReducer(taskDetailReducer, {
  isEditing: false,
  editingSection: null,
  pendingChanges: {},
  isSaving: false,
  pendingAction: null,
  expandedSections: new Set(['metadata', 'labels', 'activity', 'worktree']),
  activityTab: 'timeline',
});

type TaskDetailAction =
  | { type: 'START_EDIT'; section: EditSection }
  | { type: 'CANCEL_EDIT' }
  | { type: 'UPDATE_FIELD'; field: keyof UpdateTaskInput; value: unknown }
  | { type: 'START_SAVE' }
  | { type: 'SAVE_SUCCESS'; task: Task }
  | { type: 'SAVE_ERROR'; error: TaskError }
  | { type: 'START_ACTION'; action: TaskAction }
  | { type: 'ACTION_COMPLETE' }
  | { type: 'TOGGLE_SECTION'; section: DialogSection }
  | { type: 'SET_ACTIVITY_TAB'; tab: 'timeline' | 'comments' | 'history' };
```

### Pending Changes

Changes are buffered before save:

```typescript
// Track changes independently
const [pendingChanges, setPendingChanges] = useState<Partial<UpdateTaskInput>>({});

// Check for unsaved changes
const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

// Merge with current task for display
const displayTask = useMemo(() => ({
  ...task,
  ...pendingChanges,
}), [task, pendingChanges]);
```

### Optimistic Updates

Updates are applied optimistically with rollback on error:

```typescript
async function handleSave() {
  const previousTask = task;

  // Optimistic update
  dispatch({ type: 'START_SAVE' });

  const result = await onUpdate(pendingChanges);

  if (result.ok) {
    dispatch({ type: 'SAVE_SUCCESS', task: result.value });
    setPendingChanges({});
  } else {
    // Rollback
    dispatch({ type: 'SAVE_ERROR', error: result.error });
    // Toast notification
  }
}
```

---

## Real-time Updates

### Agent Status Changes

Subscribe to agent status updates via Durable Streams:

```typescript
useEffect(() => {
  if (!agent?.id) return;

  const unsubscribe = subscribeToAgentEvents(agent.id, (event) => {
    switch (event.type) {
      case 'agent:status_changed':
        // Update agent status badge
        setAgentStatus(event.status);
        break;
      case 'agent:turn_completed':
        // Increment turn count
        setTurnCount((prev) => prev + 1);
        break;
      case 'agent:tool_called':
        // Add to activity timeline
        addActivity(event);
        break;
    }
  });

  return () => unsubscribe();
}, [agent?.id]);
```

### Activity Feed Updates

New activity entries are prepended to the timeline:

```typescript
interface ActivityEntry {
  id: string;
  type: 'tool_call' | 'status_change' | 'comment' | 'rejection' | 'approval';
  timestamp: number;
  data: Record<string, unknown>;
}

function useActivityFeed(taskId: string) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToTaskEvents(taskId, (event) => {
      setActivities((prev) => [
        { id: event.id, type: event.type, timestamp: Date.now(), data: event },
        ...prev,
      ]);
    });

    return () => unsubscribe();
  }, [taskId]);

  return activities;
}
```

### Presence Indicators

Show who else is viewing this task:

```typescript
interface PresenceState {
  viewers: TaskViewer[];
  isSubscribed: boolean;
}

function useTaskPresence(taskId: string, userId: string) {
  const [presence, setPresence] = useState<PresenceState>({
    viewers: [],
    isSubscribed: false,
  });

  useEffect(() => {
    // Join presence channel
    const channel = presenceClient.channel(`task:${taskId}`);

    channel.subscribe((event) => {
      if (event.type === 'presence') {
        setPresence((prev) => ({
          ...prev,
          viewers: event.viewers.filter((v) => v.userId !== userId),
        }));
      }
    });

    // Announce presence
    channel.track({ userId, joinedAt: Date.now() });

    return () => {
      channel.untrack();
      channel.unsubscribe();
    };
  }, [taskId, userId]);

  return presence;
}
```

---

## Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `E` | Enter edit mode | Not editing |
| `Escape` | Close dialog or cancel edit | Any |
| `Cmd+S` / `Ctrl+S` | Save changes | Editing |
| `Cmd+Enter` | Save and close | Editing |
| `Delete` / `Backspace` | Delete task (with confirm) | Not editing, Backlog |
| `A` | Open agent assignment | Backlog |
| `V` | View session/diff | In Progress / Waiting Approval |
| `Tab` | Navigate between sections | Any |

### Keyboard Handler Implementation

```typescript
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    // Ignore when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      if (e.key === 'Escape') {
        dispatch({ type: 'CANCEL_EDIT' });
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      return;
    }

    switch (e.key) {
      case 'e':
      case 'E':
        if (!state.isEditing) {
          dispatch({ type: 'START_EDIT', section: 'title' });
        }
        break;
      case 'Escape':
        if (state.isEditing) {
          dispatch({ type: 'CANCEL_EDIT' });
        } else {
          onClose();
        }
        break;
      case 'a':
      case 'A':
        if (task.column === 'backlog') {
          // Focus agent dropdown
        }
        break;
      case 'v':
      case 'V':
        if (task.column === 'in_progress' && onViewSession) {
          onViewSession(task.sessionId!);
        } else if (task.column === 'waiting_approval' && onOpenApproval) {
          onOpenApproval(task.id);
        }
        break;
    }
  }

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [state.isEditing, task.column, onClose, onViewSession, onOpenApproval]);
```

---

## Accessibility Requirements

### ARIA Attributes

```typescript
<DialogPrimitive.Content
  role="dialog"
  aria-modal="true"
  aria-labelledby="task-detail-title"
  aria-describedby="task-detail-description"
>
  <DialogPrimitive.Title id="task-detail-title" className="sr-only">
    Task Details: {task.title}
  </DialogPrimitive.Title>
  <DialogPrimitive.Description id="task-detail-description" className="sr-only">
    View and edit details for task #{task.id}
  </DialogPrimitive.Description>
</DialogPrimitive.Content>
```

### Focus Management

1. **Initial focus**: Focus moves to close button on open
2. **Edit mode**: Focus moves to first editable field
3. **Save**: Focus returns to trigger element
4. **Tab order**: Logical flow through sections
5. **Focus trap**: Focus stays within dialog

### Screen Reader Support

| Element | Announcement |
|---------|--------------|
| Status badge | "Status: In Progress" |
| Priority | "Priority: High, selected" |
| Labels | "Labels: feature, enhancement. 2 labels selected" |
| Activity | "Activity timeline, 5 entries" |
| Actions | "Actions for task in Waiting Approval state" |

### Color Contrast

All text meets WCAG 2.1 AA requirements:
- Primary text: 7:1 contrast ratio
- Secondary text: 4.5:1 contrast ratio
- Interactive elements: Clear focus indicators

---

## Implementation Outline

```typescript
// app/components/views/kanban-board/dialogs/task-detail-dialog.tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarGroup } from '@/components/ui/avatar';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { TaskDetailDialogProps, TaskDetailDialogState } from './types';
import { TaskHeader } from './components/task-header';
import { TaskDescription } from './components/task-description';
import { TaskMetadata } from './components/task-metadata';
import { TaskLabels } from './components/task-labels';
import { TaskPriority } from './components/task-priority';
import { TaskAgentSelect } from './components/task-agent-select';
import { TaskActivityTimeline } from './components/task-activity-timeline';
import { TaskWorktreeInfo } from './components/task-worktree-info';
import { TaskActions } from './components/task-actions';

export function TaskDetailDialog({
  task,
  agent,
  worktree,
  activityLog = [],
  availableAgents,
  availableLabels,
  open,
  displayMode = 'modal',
  onClose,
  onUpdate,
  onDelete,
  onAssignAgent,
  onMoveColumn,
  onViewSession,
  onOpenApproval,
  viewers = [],
}: TaskDetailDialogProps) {
  // State management
  const [state, dispatch] = React.useReducer(taskDetailReducer, initialState);
  const [pendingChanges, setPendingChanges] = React.useState<Partial<UpdateTaskInput>>({});

  // Presence tracking
  const presence = useTaskPresence(task.id, getCurrentUserId());

  // Real-time activity feed
  const realtimeActivity = useActivityFeed(task.id);
  const allActivity = React.useMemo(
    () => [...realtimeActivity, ...activityLog],
    [realtimeActivity, activityLog]
  );

  // Keyboard shortcuts
  useTaskDetailKeyboard({
    task,
    state,
    dispatch,
    onClose,
    onSave: handleSave,
    onViewSession,
    onOpenApproval,
  });

  // Reset state when task changes
  React.useEffect(() => {
    setPendingChanges({});
    dispatch({ type: 'CANCEL_EDIT' });
  }, [task.id]);

  // Warn on unsaved changes
  useUnsavedChangesWarning(Object.keys(pendingChanges).length > 0);

  // Handlers
  const handleFieldChange = React.useCallback(
    (field: keyof UpdateTaskInput, value: unknown) => {
      setPendingChanges((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSave = React.useCallback(async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    dispatch({ type: 'START_SAVE' });

    const result = await onUpdate(pendingChanges);

    if (result.ok) {
      dispatch({ type: 'SAVE_SUCCESS', task: result.value });
      setPendingChanges({});
    } else {
      dispatch({ type: 'SAVE_ERROR', error: result.error });
    }
  }, [pendingChanges, onUpdate]);

  const handleAssignAgent = React.useCallback(
    async (agentId: string) => {
      dispatch({ type: 'START_ACTION', action: 'assign' });

      const result = await onAssignAgent(task.id, agentId);

      dispatch({ type: 'ACTION_COMPLETE' });

      if (!result.ok) {
        // Show error toast
      }
    },
    [task.id, onAssignAgent]
  );

  const handleDelete = React.useCallback(async () => {
    const confirmed = await showConfirmDialog({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${task.title}"?`,
      confirmText: 'Delete',
      variant: 'danger',
    });

    if (!confirmed) return;

    dispatch({ type: 'START_ACTION', action: 'delete' });

    const result = await onDelete(task.id);

    dispatch({ type: 'ACTION_COMPLETE' });

    if (result.ok) {
      onClose();
    }
  }, [task.id, task.title, onDelete, onClose]);

  // Merge pending changes with task for display
  const displayTask = React.useMemo(
    () => ({ ...task, ...pendingChanges }),
    [task, pendingChanges]
  );

  const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

  // Determine available actions based on column
  const actions = React.useMemo(
    () => getActionsForColumn(task.column, {
      hasAgent: !!agent,
      hasWorktree: !!worktree,
      hasDiff: !!task.diffSummary,
    }),
    [task.column, agent, worktree, task.diffSummary]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50',
            'bg-[rgba(1,4,9,0.8)] backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50',
            displayMode === 'modal' && [
              'left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]',
              'w-full max-w-[560px] max-h-[90vh]',
            ],
            displayMode === 'panel' && [
              'right-0 top-0 h-full',
              'w-full max-w-[480px]',
              'data-[state=open]:slide-in-from-right',
              'data-[state=closed]:slide-out-to-right',
            ],
            'bg-[#161b22] border border-[#30363d]',
            displayMode === 'modal' ? 'rounded-[12px]' : 'rounded-l-[12px]',
            'shadow-[0_12px_48px_rgba(1,4,9,0.5)]',
            'flex flex-col overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            displayMode === 'modal' && [
              'data-[state=closed]:zoom-out-[0.96] data-[state=open]:zoom-in-[0.96]',
            ],
            'duration-200 ease-out'
          )}
        >
          {/* Header */}
          <TaskHeader
            task={displayTask}
            viewers={[...viewers, ...presence.viewers]}
            isEditing={state.editingSection === 'title'}
            onEditTitle={() => dispatch({ type: 'START_EDIT', section: 'title' })}
            onTitleChange={(title) => handleFieldChange('title', title)}
            onSave={handleSave}
            onClose={onClose}
          />

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5">
              {/* Description */}
              <TaskDescription
                description={displayTask.description}
                isEditing={state.editingSection === 'description'}
                onEdit={() => dispatch({ type: 'START_EDIT', section: 'description' })}
                onChange={(description) => handleFieldChange('description', description)}
                onSave={handleSave}
                onCancel={() => dispatch({ type: 'CANCEL_EDIT' })}
              />

              {/* Metadata */}
              <TaskMetadata task={task} />

              {/* Priority */}
              <TaskPriority
                priority={(displayTask.metadata?.priority as TaskPriority) || 'medium'}
                onChange={(priority) =>
                  handleFieldChange('metadata', { ...displayTask.metadata, priority })
                }
              />

              {/* Labels */}
              <TaskLabels
                labels={displayTask.labels || []}
                availableLabels={availableLabels}
                isEditing={state.editingSection === 'labels'}
                onEdit={() => dispatch({ type: 'START_EDIT', section: 'labels' })}
                onChange={(labels) => handleFieldChange('labels', labels)}
              />

              {/* Agent Assignment */}
              {task.column === 'backlog' && (
                <TaskAgentSelect
                  selectedAgentId={task.agentId}
                  agents={availableAgents}
                  onSelect={handleAssignAgent}
                  isLoading={state.pendingAction === 'assign'}
                />
              )}

              {/* Agent Info (when assigned) */}
              {agent && task.column !== 'backlog' && (
                <TaskAgentInfo
                  agent={agent}
                  onViewSession={onViewSession}
                />
              )}

              {/* Worktree Info */}
              {worktree && (
                <TaskWorktreeInfo worktree={worktree} />
              )}

              {/* Activity Timeline */}
              <TaskActivityTimeline
                activities={allActivity}
                activeTab={state.activityTab}
                onTabChange={(tab) => dispatch({ type: 'SET_ACTIVITY_TAB', tab })}
              />
            </div>
          </div>

          {/* Footer with Actions */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#30363d] bg-[#1c2128]">
            {/* Unsaved changes indicator */}
            {hasUnsavedChanges && (
              <span className="text-xs text-[#d29922]">Unsaved changes</span>
            )}
            {!hasUnsavedChanges && <span />}

            {/* Action Buttons */}
            <TaskActions
              column={task.column}
              actions={actions}
              isLoading={state.pendingAction !== null}
              loadingAction={state.pendingAction}
              onAssign={() => {/* focus agent select */}}
              onDelete={handleDelete}
              onViewSession={() => onViewSession?.(task.sessionId!)}
              onPause={() => {/* pause agent */}}
              onCancel={() => onMoveColumn(task.id, 'backlog')}
              onViewDiff={() => onOpenApproval?.(task.id)}
              onApprove={() => onMoveColumn(task.id, 'verified')}
              onReject={() => {/* open reject dialog */}}
              onArchive={() => {/* archive task */}}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Action helper
function getActionsForColumn(
  column: TaskColumn,
  context: { hasAgent: boolean; hasWorktree: boolean; hasDiff: boolean }
): TaskAction[] {
  switch (column) {
    case 'backlog':
      return ['assign', 'delete'];
    case 'in_progress':
      return context.hasAgent ? ['viewSession', 'pause', 'cancel'] : ['assign', 'cancel'];
    case 'waiting_approval':
      return context.hasDiff ? ['viewDiff', 'approve', 'reject'] : ['cancel'];
    case 'verified':
      return ['viewHistory', 'archive'];
    default:
      return [];
  }
}
```

---

## Sub-Components

### TaskHeader

```typescript
interface TaskHeaderProps {
  task: Task;
  viewers: TaskViewer[];
  isEditing: boolean;
  onEditTitle: () => void;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onClose: () => void;
}
```

### TaskDescription

```typescript
interface TaskDescriptionProps {
  description?: string;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (description: string) => void;
  onSave: () => void;
  onCancel: () => void;
}
```

### TaskLabels

```typescript
interface TaskLabelsProps {
  labels: string[];
  availableLabels: string[];
  isEditing: boolean;
  onEdit: () => void;
  onChange: (labels: string[]) => void;
}
```

### TaskPriority

```typescript
interface TaskPriorityProps {
  priority: TaskPriority;
  onChange: (priority: TaskPriority) => void;
}
```

### TaskAgentSelect

```typescript
interface TaskAgentSelectProps {
  selectedAgentId?: string | null;
  agents: Agent[];
  onSelect: (agentId: string) => void;
  isLoading: boolean;
}
```

### TaskActivityTimeline

```typescript
interface TaskActivityTimelineProps {
  activities: ActivityEntry[];
  activeTab: 'timeline' | 'comments' | 'history';
  onTabChange: (tab: 'timeline' | 'comments' | 'history') => void;
}
```

### TaskWorktreeInfo

```typescript
interface TaskWorktreeInfoProps {
  worktree: Worktree;
}
```

### TaskActions

```typescript
interface TaskActionsProps {
  column: TaskColumn;
  actions: TaskAction[];
  isLoading: boolean;
  loadingAction: TaskAction | null;
  onAssign: () => void;
  onDelete: () => void;
  onViewSession: () => void;
  onPause: () => void;
  onCancel: () => void;
  onViewDiff: () => void;
  onApprove: () => void;
  onReject: () => void;
  onArchive: () => void;
}
```

---

## Service Integration

### Task Service

```typescript
// lib/services/task-service.ts
interface TaskServiceMethods {
  getById(id: string): Promise<Result<Task, TaskError>>;
  update(id: string, input: UpdateTaskInput): Promise<Result<Task, TaskError>>;
  delete(id: string): Promise<Result<void, TaskError>>;
  moveColumn(id: string, column: TaskColumn): Promise<Result<Task, TaskError>>;
  getDiff(id: string): Promise<Result<DiffResult, TaskError>>;
}
```

### Agent Service

```typescript
// lib/services/agent-service.ts
interface AgentServiceMethods {
  assignToTask(agentId: string, taskId: string): Promise<Result<Agent, AgentError>>;
  pause(agentId: string): Promise<Result<Agent, AgentError>>;
  resume(agentId: string, feedback?: string): Promise<Result<Agent, AgentError>>;
}
```

### Session Service

```typescript
// lib/services/session-service.ts
interface SessionServiceMethods {
  subscribeToTask(taskId: string, callback: (event: TaskEvent) => void): () => void;
  trackPresence(taskId: string, userId: string): () => void;
}
```

---

## Animations

### Modal Animation

```css
/* Open */
@keyframes modal-scale-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* Close */
@keyframes modal-scale-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.96);
  }
}
```

### Panel Animation

```css
/* Open */
@keyframes panel-slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Close */
@keyframes panel-slide-out {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
}
```

---

## Error Handling

| Error Code | Display | Action |
|------------|---------|--------|
| `TASK_NOT_FOUND` | Toast notification | Close dialog |
| `TASK_INVALID_TRANSITION` | Error banner | Show allowed transitions |
| `TASK_ALREADY_ASSIGNED` | Toast notification | Show assigned agent |
| `VALIDATION_ERROR` | Inline field error | Highlight field |

---

## Testing

### Unit Tests

```typescript
describe('TaskDetailDialog', () => {
  it('displays task information correctly', () => {
    render(<TaskDetailDialog task={mockTask} {...mockProps} />);

    expect(screen.getByText(mockTask.title)).toBeInTheDocument();
    expect(screen.getByText(`#TSK-${mockTask.id.slice(-3)}`)).toBeInTheDocument();
  });

  it('enters edit mode on E key', async () => {
    const user = userEvent.setup();
    render(<TaskDetailDialog task={mockTask} {...mockProps} />);

    await user.keyboard('e');

    expect(screen.getByRole('textbox', { name: /title/i })).toHaveFocus();
  });

  it('saves changes on Cmd+S', async () => {
    const onUpdate = vi.fn().mockResolvedValue({ ok: true, value: mockTask });
    const user = userEvent.setup();
    render(<TaskDetailDialog task={mockTask} {...mockProps} onUpdate={onUpdate} />);

    // Enter edit mode and make changes
    await user.keyboard('e');
    await user.type(screen.getByRole('textbox'), ' Updated');
    await user.keyboard('{Meta>}s{/Meta}');

    expect(onUpdate).toHaveBeenCalledWith({
      title: `${mockTask.title} Updated`,
    });
  });

  it('shows correct actions for backlog column', () => {
    render(<TaskDetailDialog task={{ ...mockTask, column: 'backlog' }} {...mockProps} />);

    expect(screen.getByText('Assign Agent')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('View Session')).not.toBeInTheDocument();
  });

  it('shows correct actions for waiting_approval column', () => {
    render(<TaskDetailDialog task={{ ...mockTask, column: 'waiting_approval' }} {...mockProps} />);

    expect(screen.getByText('View Diff')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });
});
```

---

## Design Tokens Reference

```typescript
const designTokens = {
  // Background colors
  bgCanvas: '#0d1117',
  bgDefault: '#161b22',
  bgSubtle: '#1c2128',
  bgMuted: '#21262d',
  bgEmphasis: '#30363d',

  // Border
  borderDefault: '#30363d',

  // Foreground (text)
  fgDefault: '#e6edf3',
  fgMuted: '#8b949e',
  fgSubtle: '#6e7681',

  // Semantic colors
  accentFg: '#58a6ff',
  accentMuted: 'rgba(56, 139, 253, 0.15)',
  successFg: '#3fb950',
  successMuted: 'rgba(46, 160, 67, 0.15)',
  dangerFg: '#f85149',
  dangerMuted: 'rgba(248, 81, 73, 0.15)',
  attentionFg: '#d29922',
  attentionMuted: 'rgba(187, 128, 9, 0.15)',
  doneFg: '#a371f7',
  doneMuted: 'rgba(163, 113, 247, 0.15)',

  // Sizing
  radius: '6px',
  radiusLg: '12px',
  modalWidth: 560,
  panelWidth: 480,

  // Animation
  durationFast: '150ms',
  durationNormal: '200ms',
  easeOut: 'cubic-bezier(0.25, 1, 0.5, 1)',
};
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](../database/schema.md) | Task table definition |
| [Task Service](../services/task-service.md) | CRUD operations |
| [Task Workflow State Machine](../state-machines/task-workflow.md) | Column transitions |
| [Approval Dialog](./approval-dialog.md) | Opened from View Diff action |
| [Kanban Board](./kanban-board.md) | Parent component, opens this dialog |
| [Component Patterns](../implementation/component-patterns.md) | Dialog, Button, Select patterns |
| [Animation System](../implementation/animation-system.md) | Modal animation specs |
| [Error Catalog](../errors/error-catalog.md) | TaskError types |
| [User Stories](../user-stories.md) | Task management requirements |
