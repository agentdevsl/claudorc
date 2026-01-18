import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Task, TaskColumn } from '@/db/schema/tasks';
import type { Worktree } from '@/db/schema/worktrees';
import { cn } from '@/lib/utils/cn';
import { TaskActions } from './task-actions';
import { TaskActivity } from './task-activity';
import { TaskDescription } from './task-description';
import { TaskHeader } from './task-header';
import { TaskLabels } from './task-labels';
import { TaskMetadata } from './task-metadata';
import { TaskWorktree } from './task-worktree';

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
  priority?: 'high' | 'medium' | 'low';
}

export interface ActivityEntry {
  id: string;
  type: 'tool_call' | 'status_change' | 'comment' | 'rejection' | 'approval';
  timestamp: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface TaskDetailDialogProps {
  task: Task | null;
  worktree?: Worktree | null;
  activityLog?: ActivityEntry[];
  availableLabels?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: UpdateTaskInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMoveColumn?: (taskId: string, column: TaskColumn) => Promise<void>;
  onViewSession?: (sessionId: string) => void;
  onOpenApproval?: (taskId: string) => void;
  viewers?: TaskViewer[];
}

type EditSection = 'title' | 'description' | 'labels' | 'priority';
type ActivityTab = 'timeline' | 'comments' | 'history';

interface DialogState {
  isEditing: boolean;
  editingSection: EditSection | null;
  isSaving: boolean;
  activityTab: ActivityTab;
}

type DialogAction =
  | { type: 'START_EDIT'; section: EditSection }
  | { type: 'CANCEL_EDIT' }
  | { type: 'START_SAVE' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR' }
  | { type: 'SET_ACTIVITY_TAB'; tab: ActivityTab };

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'START_EDIT':
      return { ...state, isEditing: true, editingSection: action.section };
    case 'CANCEL_EDIT':
      return { ...state, isEditing: false, editingSection: null };
    case 'START_SAVE':
      return { ...state, isSaving: true };
    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, isEditing: false, editingSection: null };
    case 'SAVE_ERROR':
      return { ...state, isSaving: false };
    case 'SET_ACTIVITY_TAB':
      return { ...state, activityTab: action.tab };
    default:
      return state;
  }
}

const initialState: DialogState = {
  isEditing: false,
  editingSection: null,
  isSaving: false,
  activityTab: 'timeline',
};

export function TaskDetailDialog({
  task,
  worktree,
  activityLog = [],
  availableLabels = ['bug', 'feature', 'enhancement', 'docs'],
  open,
  onOpenChange,
  onSave,
  onDelete,
  onMoveColumn,
  onViewSession,
  onOpenApproval,
  viewers = [],
}: TaskDetailDialogProps): React.JSX.Element {
  const [state, dispatch] = useReducer(dialogReducer, initialState);
  const [pendingChanges, setPendingChanges] = useState<Partial<UpdateTaskInput>>({});

  // Reset state when task changes or dialog closes
  useEffect(() => {
    if (!open || !task) {
      setPendingChanges({});
      dispatch({ type: 'CANCEL_EDIT' });
    }
  }, [open, task?.id]);

  // Merge pending changes with task for display
  const displayTask = useMemo(() => {
    if (!task) return null;
    return { ...task, ...pendingChanges };
  }, [task, pendingChanges]);

  const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

  // Field change handler
  const handleFieldChange = useCallback(
    <K extends keyof UpdateTaskInput>(field: K, value: UpdateTaskInput[K]) => {
      setPendingChanges((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Save handler
  const handleSave = useCallback(async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    dispatch({ type: 'START_SAVE' });

    try {
      await onSave(pendingChanges);
      dispatch({ type: 'SAVE_SUCCESS' });
      setPendingChanges({});
    } catch {
      dispatch({ type: 'SAVE_ERROR' });
    }
  }, [pendingChanges, onSave]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!task) return;
    await onDelete(task.id);
    onOpenChange(false);
  }, [task, onDelete, onOpenChange]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      if (isInputFocused) {
        if (e.key === 'Escape') {
          dispatch({ type: 'CANCEL_EDIT' });
          e.preventDefault();
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
            dispatch({ type: 'START_EDIT', section: 'description' });
            e.preventDefault();
          }
          break;
        case 'Escape':
          if (state.isEditing) {
            dispatch({ type: 'CANCEL_EDIT' });
          } else {
            onOpenChange(false);
          }
          e.preventDefault();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, state.isEditing, handleSave, onOpenChange]);

  if (!task || !displayTask) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6">
            <p className="text-fg-muted">No task selected</p>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[90vh]',
            '-translate-x-1/2 -translate-y-1/2',
            'rounded-xl border border-border bg-surface shadow-xl',
            'flex flex-col overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200 ease-out'
          )}
        >
          {/* Header */}
          <TaskHeader
            task={displayTask}
            viewers={viewers}
            onPriorityChange={(priority) => handleFieldChange('priority', priority)}
          />

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-5 p-5">
              {/* Description */}
              <TaskDescription
                description={displayTask.description ?? ''}
                isEditing={state.editingSection === 'description'}
                onEdit={() => dispatch({ type: 'START_EDIT', section: 'description' })}
                onChange={(description) => handleFieldChange('description', description)}
                onSave={handleSave}
                onCancel={() => dispatch({ type: 'CANCEL_EDIT' })}
              />

              {/* Metadata grid */}
              <TaskMetadata task={task} />

              {/* Labels */}
              <TaskLabels
                labels={(displayTask.labels as string[]) ?? []}
                availableLabels={availableLabels}
                onChange={(labels) => handleFieldChange('labels', labels)}
              />

              {/* Worktree info (if exists) */}
              {worktree && <TaskWorktree worktree={worktree} />}

              {/* Activity timeline */}
              <TaskActivity
                activities={activityLog}
                activeTab={state.activityTab}
                onTabChange={(tab) => dispatch({ type: 'SET_ACTIVITY_TAB', tab })}
              />
            </div>
          </div>

          {/* Footer with actions */}
          <div className="flex items-center justify-between border-t border-border bg-surface-muted px-5 py-4">
            {/* Unsaved changes indicator */}
            {hasUnsavedChanges ? (
              <span className="text-xs text-attention">Unsaved changes</span>
            ) : (
              <span />
            )}

            {/* Action buttons */}
            <TaskActions
              column={task.column}
              isSaving={state.isSaving}
              hasChanges={hasUnsavedChanges}
              onSave={handleSave}
              onCancel={() => {
                setPendingChanges({});
                dispatch({ type: 'CANCEL_EDIT' });
              }}
              onDelete={handleDelete}
              onViewSession={
                onViewSession && task.sessionId
                  ? () => {
                      const sessionId = task.sessionId;
                      if (sessionId) onViewSession(sessionId);
                    }
                  : undefined
              }
              onOpenApproval={onOpenApproval ? () => onOpenApproval(task.id) : undefined}
              onMoveColumn={onMoveColumn ? (col) => onMoveColumn(task.id, col) : undefined}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
