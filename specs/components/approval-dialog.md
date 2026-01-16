# Approval Dialog Component Specification

## Overview

The Approval Dialog is a modal component that presents agent work for human review before merging to the main branch. It displays the full git diff, task metadata, test status, and provides controls for approving or rejecting changes with feedback.

**Related Wireframes:**
- [Approval Dialog](../wireframes/approval-dialog.html) - Full modal with diff viewer

---

## Interface Definition

```typescript
// app/components/views/kanban-board/dialogs/approval-dialog.tsx
import type { Result } from '@/lib/utils/result';
import type { Task, DiffResult, DiffFile, DiffHunk, Agent } from '@/db/schema';

export interface ApprovalDialogProps {
  /** Task awaiting approval */
  task: Task;
  /** Diff result containing file changes */
  diff: DiffResult;
  /** Agent that completed the work */
  agent: Agent;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Callback when task is approved */
  onApprove: (input: ApproveInput) => Promise<Result<Task, ApprovalError>>;
  /** Callback when task is rejected */
  onReject: (input: RejectInput) => Promise<Result<Task, ApprovalError>>;
  /** Whether dialog is open */
  open: boolean;
}
```

---

## Type Definitions

```typescript
// lib/types/approval.ts
import { z } from 'zod';

/** Approval input payload */
export interface ApproveInput {
  /** Optional feedback for the approval */
  feedback?: string;
  /** Whether to create a merge commit (default: true) */
  createMergeCommit?: boolean;
  /** Approver identifier */
  approvedBy?: string;
}

/** Rejection input payload */
export interface RejectInput {
  /** Reason for rejection (required) */
  reason: string;
  /** Additional feedback for agent to address */
  feedback?: string;
}

/** Dialog internal state */
export interface ApprovalDialogState {
  /** Currently selected file tab index */
  activeFileIndex: number;
  /** Feedback textarea content */
  feedback: string;
  /** Merge commit checkbox state */
  createMergeCommit: boolean;
  /** Loading state during action */
  isSubmitting: boolean;
  /** Current action being performed */
  submittingAction: 'approve' | 'reject' | null;
}

/** Result type pattern */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Approval-specific error types */
export type ApprovalError =
  | { code: 'TASK_NOT_FOUND'; message: string }
  | { code: 'NOT_WAITING_APPROVAL'; message: string; currentColumn: string }
  | { code: 'NO_DIFF'; message: string }
  | { code: 'ALREADY_APPROVED'; message: string }
  | { code: 'MERGE_CONFLICT'; message: string; conflictingFiles: string[] }
  | { code: 'WORKTREE_DIRTY'; message: string; uncommittedFiles: string[] };

/** Validation schemas */
export const approveInputSchema = z.object({
  feedback: z.string().max(1000).optional(),
  createMergeCommit: z.boolean().default(true),
  approvedBy: z.string().optional(),
});

export const rejectInputSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(1000),
  feedback: z.string().max(5000).optional(),
});
```

---

## Component Specifications

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `task` | `Task` | Yes | - | Task record with metadata and diff summary |
| `diff` | `DiffResult` | Yes | - | Parsed diff with files and hunks |
| `agent` | `Agent` | Yes | - | Agent that performed the work |
| `open` | `boolean` | Yes | - | Controls dialog visibility |
| `onClose` | `() => void` | Yes | - | Called when dialog should close |
| `onApprove` | `(ApproveInput) => Promise<Result>` | Yes | - | Async approval handler |
| `onReject` | `(RejectInput) => Promise<Result>` | Yes | - | Async rejection handler |

### State

| State | Type | Initial | Description |
|-------|------|---------|-------------|
| `activeFileIndex` | `number` | `0` | Currently selected file tab |
| `feedback` | `string` | `''` | User feedback textarea content |
| `createMergeCommit` | `boolean` | `true` | Merge commit checkbox state |
| `isSubmitting` | `boolean` | `false` | Loading indicator during action |
| `submittingAction` | `'approve' \| 'reject' \| null` | `null` | Which action is in progress |

### Events

| Event | Trigger | Payload | Handler Action |
|-------|---------|---------|----------------|
| `approval:requested` | Dialog opens | `{ taskId, diff }` | Published via Durable Streams |
| `approval:approved` | Approve clicked | `{ taskId, approver, feedback? }` | Call `onApprove`, close dialog |
| `approval:rejected` | Reject clicked | `{ taskId, reason, feedback? }` | Call `onReject`, close dialog |
| `file:selected` | Tab clicked | `{ fileIndex }` | Update `activeFileIndex` |
| `dialog:closed` | X or Escape | - | Call `onClose` |

---

## UI Structure

### Layout Specifications

```
+------------------------------------------------------------------+
|                      Modal Overlay                                |
|  +------------------------------------------------------------+  |
|  |                    Modal Container                          |  |
|  |  max-width: 900px                                          |  |
|  |  max-height: calc(100vh - 48px)                            |  |
|  |  display: flex, flex-direction: column                      |  |
|  |                                                             |  |
|  |  +--------------------------------------------------------+|  |
|  |  |                 Header (bg-subtle)                     ||  |
|  |  |  Task ID badge | Title | Agent avatar | Time | Tests   ||  |
|  |  +--------------------------------------------------------+|  |
|  |  |              Changes Summary Bar                        ||  |
|  |  |  Files changed | +additions | -deletions | Badges      ||  |
|  |  +--------------------------------------------------------+|  |
|  |  |               Diff Container (flex: 1)                  ||  |
|  |  |  +----------------------------------------------------+||  |
|  |  |  |           File Tabs (scrollable-x)                 |||  |
|  |  |  +----------------------------------------------------+||  |
|  |  |  |              Diff Viewer (overflow: auto)          |||  |
|  |  |  |  - File header                                     |||  |
|  |  |  |  - Hunk headers                                    |||  |
|  |  |  |  - Line-by-line diff                               |||  |
|  |  |  +----------------------------------------------------+||  |
|  |  +--------------------------------------------------------+|  |
|  |  |              Feedback Section                           ||  |
|  |  |  Textarea (min-height: 80px)                           ||  |
|  |  +--------------------------------------------------------+|  |
|  |  |              Footer (bg-subtle)                         ||  |
|  |  |  Merge checkbox | Reject btn | Approve btn             ||  |
|  |  +--------------------------------------------------------+|  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### Modal Container

```typescript
// Modal dimensions and styling
const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(1, 4, 9, 0.8)',
    backdropFilter: 'blur(4px)',
    padding: '24px',
  },
  content: {
    width: '100%',
    maxWidth: '900px',
    maxHeight: 'calc(100vh - 48px)',
    background: 'var(--bg-default)',       // #161b22
    border: '1px solid var(--border-default)', // #30363d
    borderRadius: '12px',                   // var(--radius-lg)
    boxShadow: 'var(--shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
};
```

### Header Section

| Element | Styling | Content |
|---------|---------|---------|
| Container | `bg-subtle`, `padding: 16px 20px`, `border-bottom` | Header row |
| Task ID badge | `font-mono`, `accent-fg`, `accent-muted bg`, `padding: 2px 8px` | `#TSK-{id}` |
| Title | `font-size: 16px`, `font-weight: 600` | Task title |
| Agent avatar | `18px` circle, gradient background | Agent indicator |
| Execution time | Icon + `"Completed in Xm Xs"` | Duration |
| Test status | Checkmark icon + `"All tests passed"` | Test result |
| Close button | `32x32px`, ghost style, X icon | Close action |

### Changes Summary Section

| Element | Styling | Content |
|---------|---------|---------|
| Container | `padding: 12px 20px`, `border-bottom` | Summary bar |
| Files count | `fg-muted`, file icon | `"3 files changed"` |
| Additions | `success-fg`, plus icon | `"+145"` |
| Deletions | `danger-fg`, minus icon | `"-23"` |
| Added badge | `success-muted bg`, `success-fg`, pill shape | `"1 added"` |
| Modified badge | `attention-muted bg`, `attention-fg`, pill shape | `"2 modified"` |
| Deleted badge | `danger-muted bg`, `danger-fg`, pill shape | `"0 deleted"` |

### Diff Tabs

| Element | Styling | Behavior |
|---------|---------|----------|
| Container | `overflow-x: auto`, `bg-subtle`, `border-bottom` | Horizontal scroll |
| Tab button | `font-mono 13px`, `padding: 10px 16px`, `white-space: nowrap` | Click to select |
| Active tab | `fg-default`, `border-bottom: 2px accent-fg` | Selected state |
| Inactive tab | `fg-muted`, transparent border | Hover: `fg-default` |
| Tab icon | `14px`, color matches file status | Added/Modified/Deleted |

### Diff Viewer

| Element | Styling | Content |
|---------|---------|---------|
| Container | `flex: 1`, `overflow: auto`, `bg-canvas` | Scrollable diff |
| File header | `bg-muted`, `font-mono 12px`, `padding: 8px 20px` | File path + status |
| Hunk header | `accent-muted bg`, `accent-fg`, `padding: 8px 16px` | `@@ -X,Y +A,B @@` |
| Diff line | `min-height: 24px`, `display: flex` | Line numbers + content |
| Line numbers | `width: 50px each`, `fg-subtle`, `text-align: right` | Old/New line numbers |
| Content | `flex: 1`, `padding: 0 16px`, `white-space: pre` | Code content |
| Addition line | `success-muted bg`, `success-fg` content | Green background |
| Deletion line | `danger-muted bg`, `danger-fg` content | Red background |
| Context line | No background, `fg-muted` | Unchanged code |

### Syntax Highlighting Classes

| Class | Color | Purpose |
|-------|-------|---------|
| `.syntax-keyword` | `#ff7b72` | Keywords (import, const, function) |
| `.syntax-string` | `#a5d6ff` | String literals |
| `.syntax-function` | `#d2a8ff` | Function names |
| `.syntax-comment` | `var(--fg-subtle)` | Comments (italic) |
| `.syntax-type` | `#79c0ff` | Type annotations |
| `.syntax-number` | `#79c0ff` | Numeric literals |

### Feedback Section

| Element | Styling | Content |
|---------|---------|---------|
| Container | `padding: 16px 20px`, `border-top` | Feedback area |
| Label | `font-size: 13px`, `font-weight: 500`, `fg-muted` | "Feedback (optional)" |
| Textarea | `min-height: 80px`, `bg-canvas`, `border`, `border-radius: 6px` | User input |
| Placeholder | `fg-subtle` | "Add any comments..." |
| Focus state | `border-color: accent-fg`, `box-shadow: accent-muted` | Focus ring |

### Footer Section

| Element | Styling | Behavior |
|---------|---------|----------|
| Container | `bg-subtle`, `padding: 16px 20px`, `border-top`, flex between | Action row |
| Merge checkbox | `18px` checkbox, custom styled | Toggle merge commit |
| Checkbox label | `font-size: 14px`, `fg-default` | "Create merge commit" |
| Reject button | `btn-danger`, X icon | Danger style |
| Approve button | `btn-success`, checkmark icon | Success style |

---

## Animations

### Overlay Animation

```css
@keyframes overlay-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-overlay {
  animation: overlay-fade-in var(--duration-normal) var(--ease-out);
  /* 200ms cubic-bezier(0.25, 1, 0.5, 1) */
}
```

### Modal Animation

```css
@keyframes modal-scale-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal {
  animation: modal-scale-in var(--duration-normal) var(--ease-out);
  /* 200ms cubic-bezier(0.25, 1, 0.5, 1) */
}
```

### Radix Integration

```typescript
// Using Radix Dialog with Tailwind animations
<DialogPrimitive.Overlay
  className={cn(
    'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'duration-200'
  )}
/>

<DialogPrimitive.Content
  className={cn(
    'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
    'duration-200 ease-out'
  )}
/>
```

---

## Business Rules

### Pre-conditions

1. **Task column validation**: Task must be in `waiting_approval` column
2. **Diff availability**: Task must have a valid diff (changes to review)
3. **Agent paused**: Associated agent must be in `paused` state
4. **Worktree exists**: Task worktree must be in `active` status

### Approval Rules

1. **Merge commit option**: When checked, creates `--no-ff` merge commit
2. **Fast-forward when unchecked**: Attempts fast-forward merge if possible
3. **Conflict detection**: If merge conflicts detected, return error with conflicting files
4. **Worktree cleanup**: After successful merge, worktree is removed automatically
5. **Agent completion**: Agent status transitions to `completed`
6. **Column transition**: Task moves from `waiting_approval` to `verified`

### Rejection Rules

1. **Reason required**: Rejection must include a reason (1-1000 characters)
2. **Feedback passed to agent**: Reason is used to resume agent with context
3. **Rejection count**: Increments `task.rejectionCount` for tracking
4. **Column transition**: Task moves from `waiting_approval` to `in_progress`
5. **Agent resumption**: Agent is resumed with feedback prompt
6. **Diff cleared**: Previous diff summary is cleared (regenerated on next completion)

### Validation Constraints

| Field | Constraint | Error Message |
|-------|------------|---------------|
| `feedback` | Max 1000 characters | "Feedback too long" |
| `reason` | Required, min 1, max 1000 characters | "Reason is required" |
| `task.column` | Must be `waiting_approval` | "Task not awaiting approval" |

---

## Implementation Outline

```typescript
// app/components/views/kanban-board/dialogs/approval-dialog.tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { ApprovalDialogProps, ApprovalDialogState } from './types';
import { DiffViewer } from './diff-viewer';
import { TaskHeader } from './task-header';
import { ChangesSummary } from './changes-summary';
import { FeedbackTextarea } from './feedback-textarea';

export function ApprovalDialog({
  task,
  diff,
  agent,
  open,
  onClose,
  onApprove,
  onReject,
}: ApprovalDialogProps) {
  const [state, setState] = React.useState<ApprovalDialogState>({
    activeFileIndex: 0,
    feedback: '',
    createMergeCommit: true,
    isSubmitting: false,
    submittingAction: null,
  });

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setState({
        activeFileIndex: 0,
        feedback: '',
        createMergeCommit: true,
        isSubmitting: false,
        submittingAction: null,
      });
    }
  }, [open]);

  const handleApprove = async () => {
    setState((prev) => ({
      ...prev,
      isSubmitting: true,
      submittingAction: 'approve',
    }));

    const result = await onApprove({
      feedback: state.feedback || undefined,
      createMergeCommit: state.createMergeCommit,
    });

    setState((prev) => ({
      ...prev,
      isSubmitting: false,
      submittingAction: null,
    }));

    if (result.ok) {
      onClose();
    }
    // Error handling delegated to parent
  };

  const handleReject = async () => {
    if (!state.feedback.trim()) {
      // Focus textarea and show validation
      return;
    }

    setState((prev) => ({
      ...prev,
      isSubmitting: true,
      submittingAction: 'reject',
    }));

    const result = await onReject({
      reason: state.feedback.trim(),
    });

    setState((prev) => ({
      ...prev,
      isSubmitting: false,
      submittingAction: null,
    }));

    if (result.ok) {
      onClose();
    }
  };

  const activeFile = diff.files[state.activeFileIndex];

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

        {/* Modal Content */}
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50',
            'translate-x-[-50%] translate-y-[-50%]',
            'w-full max-w-[900px] max-h-[calc(100vh-48px)]',
            'bg-[#161b22] border border-[#30363d] rounded-[12px]',
            'shadow-[0_12px_48px_rgba(1,4,9,0.5)]',
            'flex flex-col overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-[0.96] data-[state=open]:zoom-in-[0.96]',
            'duration-200 ease-out'
          )}
        >
          {/* Header */}
          <TaskHeader
            task={task}
            agent={agent}
            onClose={onClose}
          />

          {/* Changes Summary */}
          <ChangesSummary
            summary={diff.summary}
            files={diff.files}
          />

          {/* Diff Container */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* File Tabs */}
            <div className="flex gap-0 px-5 border-b border-[#30363d] bg-[#1c2128] overflow-x-auto">
              {diff.files.map((file, index) => (
                <button
                  key={file.path}
                  onClick={() => setState((prev) => ({ ...prev, activeFileIndex: index }))}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-[13px] font-mono whitespace-nowrap',
                    'border-b-2 transition-all duration-150',
                    index === state.activeFileIndex
                      ? 'text-[#e6edf3] border-[#58a6ff]'
                      : 'text-[#8b949e] border-transparent hover:text-[#e6edf3] hover:bg-[#21262d]'
                  )}
                >
                  <FileStatusIcon status={file.status} />
                  {file.path}
                </button>
              ))}
            </div>

            {/* Diff Viewer */}
            <DiffViewer file={activeFile} />
          </div>

          {/* Feedback Section */}
          <div className="px-5 py-4 border-t border-[#30363d] bg-[#161b22]">
            <label className="block text-[13px] font-medium text-[#8b949e] mb-2">
              Feedback {state.submittingAction === 'reject' ? '(required for rejection)' : '(optional)'}
            </label>
            <textarea
              value={state.feedback}
              onChange={(e) => setState((prev) => ({ ...prev, feedback: e.target.value }))}
              placeholder="Add any comments or feedback about this change..."
              className={cn(
                'w-full min-h-[80px] px-3 py-3',
                'bg-[#0d1117] border border-[#30363d] rounded-[6px]',
                'text-[#e6edf3] text-sm font-sans',
                'placeholder:text-[#6e7681]',
                'focus:outline-none focus:border-[#58a6ff]',
                'focus:shadow-[0_0_0_3px_rgba(56,139,253,0.15)]',
                'resize-y transition-all duration-150'
              )}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#30363d] bg-[#1c2128]">
            {/* Merge Option */}
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="merge-commit"
                checked={state.createMergeCommit}
                onCheckedChange={(checked) =>
                  setState((prev) => ({ ...prev, createMergeCommit: Boolean(checked) }))
                }
              />
              <label
                htmlFor="merge-commit"
                className="text-sm text-[#e6edf3] cursor-pointer"
              >
                Create merge commit
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={state.isSubmitting}
                isLoading={state.submittingAction === 'reject'}
              >
                <XIcon className="w-4 h-4" />
                Reject with Feedback
              </Button>
              <Button
                variant="success"
                onClick={handleApprove}
                disabled={state.isSubmitting}
                isLoading={state.submittingAction === 'approve'}
              >
                <CheckIcon className="w-4 h-4" />
                Approve & Merge
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

### Sub-components

```typescript
// app/components/views/kanban-board/dialogs/diff-viewer.tsx
export function DiffViewer({ file }: { file: DiffFile }) {
  return (
    <div className="flex-1 overflow-auto bg-[#0d1117]">
      {/* File Header */}
      <div className="flex items-center gap-2 px-5 py-2 bg-[#21262d] border-b border-[#30363d]">
        <FileIcon className="w-3.5 h-3.5 text-[#8b949e]" />
        <span className="text-xs font-mono text-[#8b949e]">{file.path}</span>
        <span className={cn(
          'ml-auto text-xs',
          file.status === 'added' && 'text-[#3fb950]',
          file.status === 'modified' && 'text-[#d29922]',
          file.status === 'deleted' && 'text-[#f85149]'
        )}>
          {file.status === 'added' ? 'new file' : file.status}
        </span>
      </div>

      {/* Hunks */}
      {file.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {/* Hunk Header */}
          <div className="px-4 py-2 text-xs bg-[rgba(56,139,253,0.15)] text-[#58a6ff] border-y border-[#21262d]">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>

          {/* Diff Lines */}
          <div className="font-mono text-[13px] leading-6">
            {parseDiffLines(hunk.content).map((line, lineIndex) => (
              <DiffLine key={lineIndex} line={line} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffLine({ line }: { line: ParsedDiffLine }) {
  const bgClass = cn(
    line.type === 'addition' && 'bg-[rgba(46,160,67,0.15)]',
    line.type === 'deletion' && 'bg-[rgba(248,81,73,0.15)]'
  );

  const lineNumBg = cn(
    line.type === 'addition' && 'bg-[rgba(46,160,67,0.25)]',
    line.type === 'deletion' && 'bg-[rgba(248,81,73,0.25)]'
  );

  const contentColor = cn(
    line.type === 'addition' && 'text-[#3fb950]',
    line.type === 'deletion' && 'text-[#f85149]',
    line.type === 'context' && 'text-[#8b949e]'
  );

  return (
    <div className={cn('flex min-h-6 hover:bg-[#1c2128]', bgClass)}>
      <span className={cn(
        'w-[50px] px-2 text-right text-[#6e7681] select-none flex-shrink-0',
        lineNumBg,
        line.type === 'addition' && 'text-[#3fb950]',
        line.type === 'deletion' && 'text-[#f85149]'
      )}>
        {line.oldLineNumber || ''}
      </span>
      <span className={cn(
        'w-[50px] px-2 text-right text-[#6e7681] select-none flex-shrink-0 border-r border-[#21262d]',
        lineNumBg,
        line.type === 'addition' && 'text-[#3fb950]',
        line.type === 'deletion' && 'text-[#f85149]'
      )}>
        {line.newLineNumber || ''}
      </span>
      <span className={cn('flex-1 px-4 whitespace-pre overflow-x-auto', contentColor)}>
        <SyntaxHighlightedContent content={line.content} />
      </span>
    </div>
  );
}
```

### Hook Integration

```typescript
// app/components/views/kanban-board/dialogs/use-approval-dialog.ts
import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { taskService } from '@/lib/services/task-service';
import type { Task, ApproveInput, RejectInput } from '@/db/schema';

export function useApprovalDialog(task: Task | null) {
  const [isOpen, setIsOpen] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async (input: ApproveInput) => {
      if (!task) throw new Error('No task selected');
      return taskService.approve(task.id, input);
    },
    onSuccess: () => {
      setIsOpen(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (input: RejectInput) => {
      if (!task) throw new Error('No task selected');
      return taskService.reject(task.id, input);
    },
    onSuccess: () => {
      setIsOpen(false);
    },
  });

  const openDialog = useCallback(() => setIsOpen(true), []);
  const closeDialog = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    openDialog,
    closeDialog,
    approveMutation,
    rejectMutation,
  };
}
```

---

## Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Escape` | Close dialog |
| `Tab` | Navigate between focusable elements |
| `Enter` | Activate focused button |
| `Arrow Left/Right` | Navigate between file tabs (when tabs focused) |

### ARIA Attributes

```typescript
<DialogPrimitive.Content
  role="dialog"
  aria-modal="true"
  aria-labelledby="approval-dialog-title"
  aria-describedby="approval-dialog-description"
>
  <DialogPrimitive.Title id="approval-dialog-title">
    Review & Approve Changes
  </DialogPrimitive.Title>
  <DialogPrimitive.Description id="approval-dialog-description">
    Review the changes for task #{task.id} before approving or rejecting.
  </DialogPrimitive.Description>
</DialogPrimitive.Content>
```

### Focus Management

1. **Focus trap**: Dialog traps focus within modal content
2. **Initial focus**: Focus moves to first file tab on open
3. **Return focus**: Focus returns to trigger element on close

---

## Error Handling

### Error States

| Error Code | Display | Action |
|------------|---------|--------|
| `NOT_WAITING_APPROVAL` | Toast notification | Close dialog, refresh task |
| `MERGE_CONFLICT` | Error banner in dialog | Show conflicting files, offer manual resolution |
| `WORKTREE_DIRTY` | Error banner in dialog | Show uncommitted files list |
| `ALREADY_APPROVED` | Toast notification | Close dialog, refresh task |
| `NO_DIFF` | Empty state in diff viewer | Show "No changes to review" |

### Loading States

| State | UI Behavior |
|-------|-------------|
| Loading diff | Skeleton loader in diff container |
| Approving | Approve button shows spinner, both buttons disabled |
| Rejecting | Reject button shows spinner, both buttons disabled |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Task Service](../services/task-service.md) | `approve()` and `reject()` methods |
| [Task Workflow State Machine](../state-machines/task-workflow.md) | Transition rules and guards |
| [Git Worktrees](../integrations/git-worktrees.md) | Merge and cleanup operations |
| [Component Patterns](../implementation/component-patterns.md) | Dialog and Button implementations |
| [Animation System](../implementation/animation-system.md) | Modal animation specifications |
| [Error Catalog](../errors/error-catalog.md) | Error codes and messages |
| [User Stories](../user-stories.md) | Approval workflow requirements |
| [API Endpoints](../api/endpoints.md) | REST endpoints for approval |
