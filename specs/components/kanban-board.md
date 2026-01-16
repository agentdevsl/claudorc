# KanbanBoard Component Specification

## Overview

The KanbanBoard component provides a 4-column drag-and-drop task management interface for the AgentPane workflow. It displays tasks organized by workflow state (backlog, in_progress, waiting_approval, verified), supports multi-select operations, and integrates with the task service for state transitions.

**Related Wireframes:**
- [Kanban Board Full](../wireframes/kanban-board-full.html) - Complete board with drag overlay
- [Task Detail Dialog](../wireframes/task-detail-dialog.html) - Task editing modal

---

## Interface Definition

```typescript
// app/components/views/kanban-board/types.ts
import type { Result } from '@/lib/utils/result';
import type { Task, TaskColumn } from '@/db/schema';

/**
 * Column configuration for the Kanban board
 */
export interface KanbanColumn {
  id: TaskColumn;
  title: string;
  indicatorColor: string;
  isCollapsed: boolean;
}

/**
 * Card data structure for display
 */
export interface KanbanCard {
  id: string;
  title: string;
  taskId: string;
  priority: 'high' | 'medium' | 'low';
  labels: string[];
  assignee?: {
    initials: string;
    name: string;
  };
  agentStatus?: {
    agentId: string;
    agentName: string;
    isRunning: boolean;
  };
}

/**
 * Drag operation context
 */
export interface DragContext {
  activeId: string | null;
  overId: string | null;
  activeColumn: TaskColumn | null;
  overColumn: TaskColumn | null;
}

/**
 * Board state for selection and operations
 */
export interface BoardState {
  selectedCardIds: Set<string>;
  collapsedColumns: Set<TaskColumn>;
  dragContext: DragContext;
  isLoading: boolean;
}

/**
 * Event handlers for board operations
 */
export interface BoardEventHandlers {
  onCardMove: (taskId: string, toColumn: TaskColumn, position: number) => Promise<Result<Task, Error>>;
  onCardReorder: (taskId: string, newPosition: number) => Promise<Result<Task, Error>>;
  onCardSelect: (taskId: string, multiSelect: boolean) => void;
  onCardOpen: (taskId: string) => void;
  onBulkMove: (taskIds: string[], toColumn: TaskColumn) => Promise<Result<Task[], Error>>;
  onBulkDelete: (taskIds: string[]) => Promise<Result<void, Error>>;
  onColumnCollapse: (column: TaskColumn, collapsed: boolean) => void;
  onNewTask: (column: TaskColumn) => void;
}
```

---

## Component Specifications

### KanbanBoard (Root Component)

**Props:**

```typescript
interface KanbanBoardProps {
  /** Project ID to load tasks for */
  projectId: string;
  /** Initial tasks data (for SSR hydration) */
  initialTasks?: Task[];
  /** Callback when task is opened for editing */
  onTaskOpen?: (taskId: string) => void;
  /** Callback when new task is requested */
  onNewTask?: (column: TaskColumn) => void;
  /** Custom class name */
  className?: string;
}
```

**State:**

```typescript
interface KanbanBoardState {
  /** Tasks grouped by column */
  tasksByColumn: Record<TaskColumn, Task[]>;
  /** Currently selected task IDs */
  selectedIds: Set<string>;
  /** Collapsed column IDs */
  collapsedColumns: Set<TaskColumn>;
  /** Active drag operation */
  activeDrag: {
    id: string;
    column: TaskColumn;
  } | null;
  /** Loading state for operations */
  isOperating: boolean;
}
```

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `task:moved` | `{ taskId, from, to, position }` | Task moved between columns |
| `task:reordered` | `{ taskId, position }` | Task reordered within column |
| `task:selected` | `{ taskId, selected, multi }` | Task selection changed |
| `column:collapsed` | `{ column, collapsed }` | Column collapsed/expanded |

---

### KanbanColumn

**Props:**

```typescript
interface KanbanColumnProps {
  /** Column identifier */
  id: TaskColumn;
  /** Display title */
  title: string;
  /** Tasks in this column */
  tasks: Task[];
  /** Indicator bar color */
  indicatorColor: string;
  /** Whether column is collapsed */
  isCollapsed: boolean;
  /** Whether column is a valid drop target */
  isDropTarget: boolean;
  /** Callback to toggle collapse */
  onCollapse: (collapsed: boolean) => void;
  /** Callback to add new task */
  onAddTask: () => void;
}
```

---

### KanbanCard

**Props:**

```typescript
interface KanbanCardProps {
  /** Task data */
  task: Task;
  /** Whether card is selected */
  isSelected: boolean;
  /** Whether card is being dragged */
  isDragging: boolean;
  /** Callback for selection */
  onSelect: (multiSelect: boolean) => void;
  /** Callback to open task detail */
  onOpen: () => void;
}
```

---

### DragOverlay

**Props:**

```typescript
interface DragOverlayProps {
  /** Active drag item */
  activeItem: Task | null;
  /** Number of selected items being dragged */
  selectedCount: number;
}
```

---

## Column Configuration

```typescript
// app/components/views/kanban-board/constants.ts

export const COLUMN_CONFIG: Record<TaskColumn, {
  title: string;
  indicatorColor: string;
  bgMuted: string;
}> = {
  backlog: {
    title: 'Backlog',
    indicatorColor: '#8b949e',      // --fg-muted (gray)
    bgMuted: 'bg-slate-600',
  },
  in_progress: {
    title: 'In Progress',
    indicatorColor: '#d29922',      // --attention-fg (yellow)
    bgMuted: 'bg-amber-600',
  },
  waiting_approval: {
    title: 'Waiting Approval',
    indicatorColor: '#58a6ff',      // --accent-fg (blue)
    bgMuted: 'bg-blue-600',
  },
  verified: {
    title: 'Verified',
    indicatorColor: '#3fb950',      // --success-fg (green)
    bgMuted: 'bg-green-600',
  },
};

export const COLUMN_ORDER: TaskColumn[] = [
  'backlog',
  'in_progress',
  'waiting_approval',
  'verified',
];

/** Fixed column width in pixels */
export const COLUMN_WIDTH = 300;

/** Drag overlay rotation in degrees */
export const DRAG_ROTATION = 3;

/** Priority dot size in pixels */
export const PRIORITY_DOT_SIZE = 8;

/** Assignee avatar size in pixels */
export const ASSIGNEE_AVATAR_SIZE = 24;

/** Column indicator bar height */
export const INDICATOR_HEIGHT = 14;

/** Column indicator bar width */
export const INDICATOR_WIDTH = 3;
```

---

## Styling with CVA Variants

```typescript
// app/components/views/kanban-board/styles.ts
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Column container styles
 */
export const columnVariants = cva(
  'flex flex-col rounded-md border border-default bg-default',
  {
    variants: {
      state: {
        default: '',
        dropTarget: 'border-accent-fg bg-accent-muted',
        collapsed: 'w-12 min-w-12',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

/**
 * Card container styles
 */
export const cardVariants = cva(
  'rounded-md border bg-subtle p-3 cursor-grab transition-all duration-150',
  {
    variants: {
      state: {
        default: 'border-default hover:border-fg-subtle',
        selected: 'border-accent-fg bg-accent-muted',
        dragging: 'opacity-40 cursor-grabbing',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

/**
 * Priority indicator styles
 */
export const priorityVariants = cva(
  'w-2 h-2 rounded-full shrink-0',
  {
    variants: {
      priority: {
        high: 'bg-danger-fg',      // #f85149
        medium: 'bg-attention-fg', // #d29922
        low: 'bg-success-fg',      // #3fb950
      },
    },
    defaultVariants: {
      priority: 'medium',
    },
  }
);

/**
 * Label pill styles
 */
export const labelVariants = cva(
  'text-xs font-medium px-2 py-0.5 rounded-full uppercase tracking-wider',
  {
    variants: {
      type: {
        bug: 'bg-danger-muted text-danger-fg',
        feature: 'bg-done-muted text-done-fg',
        enhancement: 'bg-accent-muted text-accent-fg',
        docs: 'bg-attention-muted text-attention-fg',
        default: 'bg-muted text-fg-muted',
      },
    },
    defaultVariants: {
      type: 'default',
    },
  }
);

/**
 * Column indicator bar styles
 */
export const indicatorVariants = cva(
  'w-[3px] h-[14px] rounded-sm',
  {
    variants: {
      column: {
        backlog: 'bg-fg-muted',
        in_progress: 'bg-attention-fg',
        waiting_approval: 'bg-accent-fg',
        verified: 'bg-success-fg',
      },
    },
    defaultVariants: {
      column: 'backlog',
    },
  }
);

/**
 * Agent status badge styles
 */
export const agentStatusVariants = cva(
  'flex items-center gap-1.5 px-2 py-1 rounded text-xs mt-2',
  {
    variants: {
      status: {
        running: 'bg-attention-muted text-attention-fg',
        paused: 'bg-accent-muted text-accent-fg',
        idle: 'bg-muted text-fg-muted',
      },
    },
    defaultVariants: {
      status: 'idle',
    },
  }
);
```

---

## Business Rules

### Column Transitions

Valid drag-and-drop transitions follow the task workflow state machine:

| From | Allowed To | Trigger |
|------|-----------|---------|
| `backlog` | `in_progress` | Manual drag or auto-assign |
| `in_progress` | `backlog` | Manual abort (cancel) |
| `in_progress` | `waiting_approval` | Agent completion (automatic only) |
| `waiting_approval` | `in_progress` | Rejection with feedback |
| `waiting_approval` | `verified` | Approval |
| `verified` | (none) | Terminal state |

**Note:** Users cannot manually drag tasks into `waiting_approval` - this transition only occurs when an agent completes its work.

### Selection Rules

1. **Single click**: Selects card, deselects others
2. **Ctrl/Cmd + click**: Toggles selection, preserves other selections
3. **Shift + click**: Range select within same column
4. **Click outside**: Clears all selections
5. **Drag selected**: Moves all selected cards together

### Bulk Operations

- **Move**: Only valid if target column is valid for ALL selected tasks
- **Delete**: Blocked if any task has a running agent assigned
- **Assign**: Opens agent picker for selected tasks

### Collapse Behavior

- Collapsed columns show vertical title text
- Cards hidden when collapsed
- Drag-to-collapsed column expands it temporarily
- Collapse state persists in local storage

---

## Implementation Outline

```typescript
// app/components/views/kanban-board/index.tsx
import { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { taskService } from '@/lib/services/task-service';
import { COLUMN_ORDER, COLUMN_CONFIG, COLUMN_WIDTH } from './constants';
import { KanbanColumn } from './components/column';
import { KanbanCard } from './components/card';
import { CardDragOverlay } from './components/drag-overlay';
import type { Task, TaskColumn } from '@/db/schema';

export function KanbanBoard({ projectId, onTaskOpen, onNewTask }: KanbanBoardProps) {
  // State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskColumn>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskColumn | null>(null);

  // Query tasks by column
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => taskService.list(projectId, { orderBy: 'position' }),
    select: (result) => result.ok ? result.value : [],
  });

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    return COLUMN_ORDER.reduce((acc, column) => {
      acc[column] = tasks.filter((t) => t.column === column);
      return acc;
    }, {} as Record<TaskColumn, Task[]>);
  }, [tasks]);

  // Mutations
  const moveTask = useMutation({
    mutationFn: ({ taskId, column, position }: { taskId: string; column: TaskColumn; position: number }) =>
      taskService.moveColumn(taskId, column, position),
    onSuccess: () => queryClient.invalidateQueries(['tasks', projectId]),
  });

  const reorderTask = useMutation({
    mutationFn: ({ taskId, position }: { taskId: string; position: number }) =>
      taskService.reorder(taskId, position),
    onSuccess: () => queryClient.invalidateQueries(['tasks', projectId]),
  });

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // DnD Handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // If dragged item is not selected, select only it
    if (!selectedIds.has(active.id as string)) {
      setSelectedIds(new Set([active.id as string]));
    }
  }, [selectedIds]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      // Determine target column from over.id
      const targetColumn = getColumnFromDroppableId(over.id as string);
      setOverColumn(targetColumn);
    } else {
      setOverColumn(null);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumn(null);

    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const targetColumn = getColumnFromDroppableId(over.id as string);
    const targetPosition = getPositionFromDroppableId(over.id as string, tasksByColumn);

    // Validate transition
    if (!canTransition(activeTask.column, targetColumn)) {
      // Show error toast
      return;
    }

    if (activeTask.column !== targetColumn) {
      // Move to different column
      await moveTask.mutateAsync({
        taskId: activeTask.id,
        column: targetColumn,
        position: targetPosition,
      });
    } else if (targetPosition !== activeTask.position) {
      // Reorder within same column
      await reorderTask.mutateAsync({
        taskId: activeTask.id,
        position: targetPosition,
      });
    }
  }, [tasks, tasksByColumn, moveTask, reorderTask]);

  // Selection handlers
  const handleCardSelect = useCallback((taskId: string, multiSelect: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (multiSelect) {
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
      } else {
        next.clear();
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleColumnCollapse = useCallback((column: TaskColumn, collapsed: boolean) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (collapsed) {
        next.add(column);
      } else {
        next.delete(column);
      }
      return next;
    });
  }, []);

  // Active task for drag overlay
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-5 overflow-x-auto" style={{ minHeight: 'calc(100vh - 180px)' }}>
        {COLUMN_ORDER.map((columnId) => (
          <KanbanColumn
            key={columnId}
            id={columnId}
            title={COLUMN_CONFIG[columnId].title}
            tasks={tasksByColumn[columnId]}
            indicatorColor={COLUMN_CONFIG[columnId].indicatorColor}
            isCollapsed={collapsedColumns.has(columnId)}
            isDropTarget={overColumn === columnId}
            onCollapse={(collapsed) => handleColumnCollapse(columnId, collapsed)}
            onAddTask={() => onNewTask?.(columnId)}
          >
            <SortableContext
              items={tasksByColumn[columnId].map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {tasksByColumn[columnId].map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isSelected={selectedIds.has(task.id)}
                  isDragging={activeId === task.id}
                  onSelect={(multi) => handleCardSelect(task.id, multi)}
                  onOpen={() => onTaskOpen?.(task.id)}
                />
              ))}
            </SortableContext>
          </KanbanColumn>
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <CardDragOverlay
            task={activeTask}
            selectedCount={selectedIds.size}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// Helper functions
function getColumnFromDroppableId(id: string): TaskColumn {
  // Parse column from droppable ID format: "column-{columnId}" or "card-{cardId}"
  if (id.startsWith('column-')) {
    return id.replace('column-', '') as TaskColumn;
  }
  // For card IDs, look up the task's column
  return 'backlog'; // Default fallback
}

function getPositionFromDroppableId(
  id: string,
  tasksByColumn: Record<TaskColumn, Task[]>
): number {
  // Calculate position based on drop target
  return 0; // Simplified - full implementation would calculate exact position
}

function canTransition(from: TaskColumn, to: TaskColumn): boolean {
  const VALID_TRANSITIONS: Record<TaskColumn, TaskColumn[]> = {
    backlog: ['in_progress'],
    in_progress: ['backlog'], // Note: waiting_approval is automatic only
    waiting_approval: ['verified', 'in_progress'],
    verified: [], // Terminal state
  };
  return VALID_TRANSITIONS[from].includes(to);
}
```

---

## Sub-Components

### KanbanColumn Component

```typescript
// app/components/views/kanban-board/components/column.tsx
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { columnVariants, indicatorVariants } from '../styles';
import { COLUMN_WIDTH } from '../constants';
import type { TaskColumn, Task } from '@/db/schema';

interface KanbanColumnProps {
  id: TaskColumn;
  title: string;
  tasks: Task[];
  indicatorColor: string;
  isCollapsed: boolean;
  isDropTarget: boolean;
  onCollapse: (collapsed: boolean) => void;
  onAddTask: () => void;
  children: React.ReactNode;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  indicatorColor,
  isCollapsed,
  isDropTarget,
  onCollapse,
  onAddTask,
  children,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
  });

  const columnState = isDropTarget || isOver
    ? 'dropTarget'
    : isCollapsed
    ? 'collapsed'
    : 'default';

  return (
    <div
      ref={setNodeRef}
      className={cn(
        columnVariants({ state: columnState }),
        'max-h-[calc(100vh-180px)]'
      )}
      style={{ width: isCollapsed ? undefined : COLUMN_WIDTH, minWidth: isCollapsed ? undefined : COLUMN_WIDTH }}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-3.5 py-3 border-b border-default shrink-0',
        isCollapsed && 'flex-col writing-vertical-rl text-orientation-mixed py-3 px-2 gap-3'
      )}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onCollapse(!isCollapsed)}
            className="w-6.5 h-6.5 rounded flex items-center justify-center text-fg-muted hover:bg-muted hover:text-fg-default transition-colors"
          >
            <ChevronDown className={cn('w-3.5 h-3.5', isCollapsed && 'rotate-180')} />
          </button>

          {!isCollapsed && (
            <>
              <div className={indicatorVariants({ column: id })} />
              <span className="text-sm font-semibold">{title}</span>
              <span className="bg-muted text-fg-muted text-xs font-medium px-1.5 py-0.5 rounded-full">
                {tasks.length}
              </span>
            </>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={onAddTask}
            className="w-6.5 h-6.5 rounded flex items-center justify-center text-fg-muted hover:bg-muted hover:text-fg-default transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5">
          {children}
        </div>
      )}
    </div>
  );
}
```

### KanbanCard Component

```typescript
// app/components/views/kanban-board/components/card.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { cardVariants, priorityVariants, labelVariants, agentStatusVariants } from '../styles';
import type { Task } from '@/db/schema';

interface KanbanCardProps {
  task: Task;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (multiSelect: boolean) => void;
  onOpen: () => void;
}

export function KanbanCard({
  task,
  isSelected,
  isDragging,
  onSelect,
  onOpen,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardState = isDragging
    ? 'dragging'
    : isSelected
    ? 'selected'
    : 'default';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(e.metaKey || e.ctrlKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cardVariants({ state: cardState })}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      {...attributes}
      {...listeners}
    >
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {task.labels.map((label) => (
            <span key={label} className={labelVariants({ type: getLabelType(label) })}>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Header with priority and title */}
      <div className="flex items-start gap-2">
        <div className={cn(priorityVariants({ priority: getPriority(task) }), 'mt-1.5')} />
        <div className="flex-1 text-sm font-medium leading-snug">{task.title}</div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="font-mono text-xs text-fg-muted">
          #TSK-{task.id.slice(-3).toUpperCase()}
        </span>
        {task.metadata?.assignee && (
          <div className="w-6 h-6 rounded-full bg-emphasis flex items-center justify-center text-xs font-medium text-fg-muted">
            {getInitials(task.metadata.assignee as string)}
          </div>
        )}
      </div>

      {/* Agent Status Badge */}
      {task.agentId && task.column === 'in_progress' && (
        <div className={agentStatusVariants({ status: 'running' })}>
          <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
          <span>Agent running...</span>
        </div>
      )}
    </div>
  );
}

// Helper functions
function getLabelType(label: string): 'bug' | 'feature' | 'enhancement' | 'docs' | 'default' {
  const labelMap: Record<string, 'bug' | 'feature' | 'enhancement' | 'docs'> = {
    bug: 'bug',
    feature: 'feature',
    enhancement: 'enhancement',
    docs: 'docs',
    documentation: 'docs',
  };
  return labelMap[label.toLowerCase()] || 'default';
}

function getPriority(task: Task): 'high' | 'medium' | 'low' {
  return (task.metadata?.priority as 'high' | 'medium' | 'low') || 'medium';
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}
```

### CardDragOverlay Component

```typescript
// app/components/views/kanban-board/components/drag-overlay.tsx
import { cn } from '@/lib/utils';
import { cardVariants, priorityVariants, labelVariants } from '../styles';
import { DRAG_ROTATION } from '../constants';
import type { Task } from '@/db/schema';

interface CardDragOverlayProps {
  task: Task;
  selectedCount: number;
}

export function CardDragOverlay({ task, selectedCount }: CardDragOverlayProps) {
  return (
    <div
      className={cn(
        cardVariants({ state: 'default' }),
        'shadow-xl cursor-grabbing border-accent-fg',
        'opacity-90'
      )}
      style={{
        transform: `rotate(${DRAG_ROTATION}deg)`,
        width: 280,
      }}
    >
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {task.labels.map((label) => (
            <span key={label} className={labelVariants({ type: getLabelType(label) })}>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-2">
        <div className={cn(priorityVariants({ priority: getPriority(task) }), 'mt-1.5')} />
        <div className="flex-1 text-sm font-medium leading-snug">{task.title}</div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="font-mono text-xs text-fg-muted">
          #TSK-{task.id.slice(-3).toUpperCase()}
        </span>
        {task.metadata?.assignee && (
          <div className="w-6 h-6 rounded-full bg-emphasis flex items-center justify-center text-xs font-medium text-fg-muted">
            {getInitials(task.metadata.assignee as string)}
          </div>
        )}
      </div>

      {/* Multi-select badge */}
      {selectedCount > 1 && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent-fg text-white text-xs font-bold flex items-center justify-center">
          {selectedCount}
        </div>
      )}
    </div>
  );
}

function getLabelType(label: string): 'bug' | 'feature' | 'enhancement' | 'docs' | 'default' {
  const labelMap: Record<string, 'bug' | 'feature' | 'enhancement' | 'docs'> = {
    bug: 'bug',
    feature: 'feature',
    enhancement: 'enhancement',
    docs: 'docs',
  };
  return labelMap[label.toLowerCase()] || 'default';
}

function getPriority(task: Task): 'high' | 'medium' | 'low' {
  return (task.metadata?.priority as 'high' | 'medium' | 'low') || 'medium';
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}
```

---

## Design Tokens Reference

```typescript
// Design tokens used by this component
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
  columnWidth: 300,
  priorityDotSize: 8,
  assigneeAvatarSize: 24,
  indicatorHeight: 14,
  indicatorWidth: 3,

  // Animation
  transitionFast: '100ms',
  transitionBase: '150ms',
  dragRotation: '3deg',
};
```

---

## Accessibility

- **Keyboard navigation**: Arrow keys to move between cards, Enter to select, Space to drag
- **Screen reader**: ARIA labels for columns, cards, and drag states
- **Focus indicators**: Visible focus rings on interactive elements
- **Color contrast**: All text meets WCAG 2.1 AA contrast requirements

```typescript
// ARIA attributes for accessibility
const ariaAttributes = {
  column: {
    role: 'region',
    'aria-label': (title: string, count: number) => `${title} column with ${count} tasks`,
  },
  card: {
    role: 'article',
    'aria-selected': (selected: boolean) => selected,
    'aria-grabbed': (dragging: boolean) => dragging,
  },
  dragOverlay: {
    role: 'dialog',
    'aria-label': 'Dragging task',
  },
};
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](../database/schema.md) | Task table definition with column, position fields |
| [Task Service](../services/task-service.md) | moveColumn, reorder operations |
| [Task Workflow State Machine](../state-machines/task-workflow.md) | Valid column transitions |
| [Component Patterns](../implementation/component-patterns.md) | Button, Dialog, Tooltip patterns |
| [Animation System](../implementation/animation-system.md) | Drag-drop animation timing |
| [User Stories](../user-stories.md) | Kanban workflow requirements |
| [Error Catalog](../errors/error-catalog.md) | TASK_INVALID_TRANSITION, POSITION_CONFLICT errors |
