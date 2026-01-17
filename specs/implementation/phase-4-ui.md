# Phase 4: UI Layer

**Duration:** Weeks 6-8
**Components:** 10 primitive + 10 feature components
**Pages:** 7 routes
**Dependencies:** Phase 3 (API Layer)

---

## Overview

Phase 4 implements the UI layer using Radix UI primitives, Tailwind CSS, and TanStack Router. The UI follows a component-driven architecture with primitives, feature components, and page routes.

---

## 4.1 Design Tokens

### Tailwind Configuration (`tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Status colors
        status: {
          idle: 'hsl(var(--status-idle))',
          running: 'hsl(var(--status-running))',
          paused: 'hsl(var(--status-paused))',
          error: 'hsl(var(--status-error))',
          completed: 'hsl(var(--status-completed))',
        },
        // Column colors
        column: {
          backlog: 'hsl(var(--column-backlog))',
          'in-progress': 'hsl(var(--column-in-progress))',
          'waiting-approval': 'hsl(var(--column-waiting-approval))',
          verified: 'hsl(var(--column-verified))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2s infinite',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

### CSS Variables (`app/styles/globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;

    /* Status colors */
    --status-idle: 215 16% 47%;
    --status-running: 142 71% 45%;
    --status-paused: 38 92% 50%;
    --status-error: 0 84% 60%;
    --status-completed: 142 71% 45%;

    /* Column colors */
    --column-backlog: 215 16% 47%;
    --column-in-progress: 217 91% 60%;
    --column-waiting-approval: 38 92% 50%;
    --column-verified: 142 71% 45%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
```

---

## 4.2 Primitive Components

### Button (`components/ui/button.tsx`)

```typescript
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

### Dialog (`components/ui/dialog.tsx`)

```typescript
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
);

const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
```

### Tabs (`components/ui/tabs.tsx`)

```typescript
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

### Additional Primitives

```
components/ui/
├── button.tsx          # Button with variants
├── dialog.tsx          # Modal dialog
├── tabs.tsx            # Tab navigation
├── dropdown-menu.tsx   # Context menus
├── tooltip.tsx         # Hover tooltips
├── checkbox.tsx        # Checkbox input
├── select.tsx          # Select dropdown
├── text-input.tsx      # Text input field
├── textarea.tsx        # Multiline input
├── skeleton.tsx        # Loading placeholder
└── toast.tsx           # Toast notifications
```

---

## 4.3 Skeleton Component (`components/ui/skeleton.tsx`)

```typescript
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
```

---

## 4.4 Feature Components

### KanbanBoard (`components/features/kanban-board.tsx`)

```typescript
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState } from 'react';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import type { Task, TaskColumn } from '@/db/schema';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: string, column: TaskColumn, position: number) => void;
  onTaskClick: (task: Task) => void;
  isLoading?: boolean;
}

const COLUMNS: { id: TaskColumn; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'waiting_approval', title: 'Waiting Approval' },
  { id: 'verified', title: 'Verified' },
];

export function KanbanBoard({ tasks, onTaskMove, onTaskClick, isLoading }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Determine target column
    let targetColumn: TaskColumn;
    let position = 0;

    if (COLUMNS.some((c) => c.id === overId)) {
      // Dropped on column
      targetColumn = overId as TaskColumn;
      position = tasks.filter((t) => t.column === targetColumn).length;
    } else {
      // Dropped on another task
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetColumn = overTask.column;
      position = overTask.position;
    }

    onTaskMove(taskId, targetColumn, position);
  };

  const getTasksByColumn = (column: TaskColumn) =>
    tasks.filter((t) => t.column === column).sort((a, b) => a.position - b.position);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={getTasksByColumn(column.id)}
            onTaskClick={onTaskClick}
            isLoading={isLoading}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <KanbanCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### KanbanColumn (`components/features/kanban-column.tsx`)

```typescript
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { KanbanCard } from './kanban-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Task, TaskColumn } from '@/db/schema';

interface KanbanColumnProps {
  id: TaskColumn;
  title: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  isLoading?: boolean;
}

export function KanbanColumn({ id, title, tasks, onTaskClick, isLoading }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const columnColorClass = {
    backlog: 'border-t-column-backlog',
    in_progress: 'border-t-column-in-progress',
    waiting_approval: 'border-t-column-waiting-approval',
    verified: 'border-t-column-verified',
  }[id];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-80 flex-shrink-0 flex-col rounded-lg border border-t-4 bg-muted/50',
        columnColorClass,
        isOver && 'ring-2 ring-ring'
      )}
    >
      <div className="flex items-center justify-between border-b p-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {tasks.map((task) => (
                <KanbanCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}
```

### KanbanCard (`components/features/kanban-card.tsx`)

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cva } from 'class-variance-authority';
import { GripVertical, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task } from '@/db/schema';

const cardVariants = cva(
  'group relative rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
  {
    variants: {
      isDragging: {
        true: 'opacity-50 shadow-lg',
        false: '',
      },
      hasAgent: {
        true: 'border-l-4 border-l-status-running',
        false: '',
      },
    },
    defaultVariants: {
      isDragging: false,
      hasAgent: false,
    },
  }
);

interface KanbanCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
}

export function KanbanCard({ task, onClick, isDragging: isDraggingProp }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(cardVariants({ isDragging: isDraggingProp ?? isDragging, hasAgent: !!task.agentId }))}
      onClick={onClick}
      {...attributes}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-1 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex-1 space-y-2">
          <p className="font-medium leading-tight">{task.title}</p>

          {task.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {task.labels?.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>

            {task.agentId && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Agent</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### ApprovalDialog (`components/features/approval-dialog.tsx`)

```typescript
import { useState } from 'react';
import { Check, X, GitBranch, FileText, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { Task, DiffSummary } from '@/db/schema';

interface ApprovalDialogProps {
  task: Task;
  diff: DiffSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (commitMessage?: string) => void;
  onReject: (reason: string) => void;
}

export function ApprovalDialog({
  task,
  diff,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: ApprovalDialogProps) {
  const [tab, setTab] = useState<'summary' | 'files' | 'diff'>('summary');
  const [rejectReason, setRejectReason] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = () => {
    onApprove(commitMessage || undefined);
    onOpenChange(false);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    onReject(rejectReason);
    onOpenChange(false);
    setRejectReason('');
    setShowRejectForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Review Changes: {task.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="files">Files ({diff?.filesChanged ?? 0})</TabsTrigger>
            <TabsTrigger value="diff">Diff</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-2">Change Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-500">+{diff?.insertions ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Insertions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">-{diff?.deletions ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Deletions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{diff?.filesChanged ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Files</p>
                </div>
              </div>
            </div>

            {task.rejectionCount > 0 && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">
                    Previously rejected {task.rejectionCount} time(s)
                  </span>
                </div>
                {task.rejectionReason && (
                  <p className="mt-2 text-sm text-muted-foreground">{task.rejectionReason}</p>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Commit Message (optional)</label>
              <Textarea
                placeholder="Custom commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="mt-1"
              />
            </div>
          </TabsContent>

          <TabsContent value="files" className="overflow-auto max-h-96">
            <div className="space-y-1">
              {diff?.files?.map((file) => (
                <div key={file.path} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 font-mono text-sm">{file.path}</span>
                  <span className="text-green-500 text-sm">+{file.insertions}</span>
                  <span className="text-red-500 text-sm">-{file.deletions}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="diff" className="overflow-auto max-h-96">
            <pre className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap">
              {diff?.patch ?? 'No diff available'}
            </pre>
          </TabsContent>
        </Tabs>

        {showRejectForm ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Rejection Reason</label>
            <Textarea
              placeholder="Explain why this needs more work..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
        ) : null}

        <DialogFooter>
          {showRejectForm ? (
            <>
              <Button variant="outline" onClick={() => setShowRejectForm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
                <X className="h-4 w-4 mr-2" />
                Confirm Reject
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowRejectForm(true)}>
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button onClick={handleApprove}>
                <Check className="h-4 w-4 mr-2" />
                Approve & Merge
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### AgentSessionView (`components/features/agent-session-view.tsx`)

```typescript
import { useEffect, useRef, useState } from 'react';
import { Terminal, Code, User, Pause, Play, Square } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useAgentStream } from '@/hooks/use-agent-stream';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AgentStatus } from '@/db/schema';

interface AgentSessionViewProps {
  sessionId: string;
  agentId: string;
  userId: string;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function AgentSessionView({
  sessionId,
  agentId,
  userId,
  onPause,
  onResume,
  onStop,
}: AgentSessionViewProps) {
  const { chunks, toolCalls, terminal, agentState, presence } = useSession(sessionId, userId);
  const streamRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [chunks, autoScroll]);

  const statusBadgeClass = {
    idle: 'bg-status-idle',
    starting: 'bg-status-running animate-pulse',
    running: 'bg-status-running',
    paused: 'bg-status-paused',
    error: 'bg-status-error',
    completed: 'bg-status-completed',
  }[agentState?.status ?? 'idle'];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <div className={cn('h-3 w-3 rounded-full', statusBadgeClass)} />
          <span className="font-medium capitalize">{agentState?.status ?? 'Idle'}</span>
          {agentState?.turn && (
            <span className="text-sm text-muted-foreground">Turn {agentState.turn}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Presence indicators */}
          <div className="flex -space-x-2">
            {presence.map((user) => (
              <div
                key={user.userId}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted"
                title={user.name}
              >
                <User className="h-4 w-4" />
              </div>
            ))}
          </div>

          {/* Controls */}
          {agentState?.status === 'running' && (
            <Button size="sm" variant="outline" onClick={onPause}>
              <Pause className="h-4 w-4" />
            </Button>
          )}
          {agentState?.status === 'paused' && (
            <Button size="sm" variant="outline" onClick={onResume}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          {['running', 'paused'].includes(agentState?.status ?? '') && (
            <Button size="sm" variant="destructive" onClick={onStop}>
              <Square className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="stream" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="stream">Stream</TabsTrigger>
          <TabsTrigger value="tools">Tools ({toolCalls.length})</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
        </TabsList>

        <TabsContent value="stream" className="flex-1 overflow-hidden px-4 pb-4">
          <div
            ref={streamRef}
            className="h-full overflow-y-auto rounded-lg border bg-muted/50 p-4 font-mono text-sm"
            onScroll={(e) => {
              const el = e.currentTarget;
              setAutoScroll(el.scrollHeight - el.scrollTop <= el.clientHeight + 50);
            }}
          >
            {chunks.map((chunk, i) => (
              <span key={i}>{chunk.text}</span>
            ))}
            {agentState?.status === 'running' && (
              <span className="inline-block h-4 w-2 animate-pulse bg-foreground" />
            )}
          </div>
        </TabsContent>

        <TabsContent value="tools" className="flex-1 overflow-auto px-4 pb-4">
          <div className="space-y-2">
            {toolCalls.map((call) => (
              <div key={call.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  <span className="font-medium">{call.tool}</span>
                  <span
                    className={cn(
                      'ml-auto rounded-full px-2 py-0.5 text-xs',
                      call.status === 'complete' && 'bg-green-500/20 text-green-600',
                      call.status === 'running' && 'bg-blue-500/20 text-blue-600',
                      call.status === 'error' && 'bg-red-500/20 text-red-600'
                    )}
                  >
                    {call.status}
                  </span>
                </div>
                {call.output && (
                  <pre className="mt-2 rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                    {JSON.stringify(call.output, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="terminal" className="flex-1 overflow-hidden px-4 pb-4">
          <div className="h-full overflow-y-auto rounded-lg bg-black p-4 font-mono text-sm text-green-400">
            {terminal.map((line, i) => (
              <div key={i} className={line.type === 'stderr' ? 'text-red-400' : ''}>
                {line.data}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### TaskDetailDialog (`components/features/task-detail-dialog.tsx`)

```typescript
import { useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { Textarea } from '@/components/ui/textarea';
import type { Task } from '@/db/schema';

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (task: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: TaskDetailDialogProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [labels, setLabels] = useState(task?.labels?.join(', ') ?? '');

  const handleSave = () => {
    onSave({
      title,
      description,
      labels: labels
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (task && confirm('Are you sure you want to delete this task?')) {
      onDelete(task.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description..."
              className="mt-1"
              rows={4}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Labels</label>
            <TextInput
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="bug, feature, urgent"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated labels</p>
          </div>
        </div>

        <DialogFooter>
          {task && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### NewProjectDialog (`components/features/new-project-dialog.tsx`)

```typescript
import { useState } from 'react';
import { FolderOpen, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/text-input';
import { Textarea } from '@/components/ui/textarea';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; path: string; description?: string }) => void;
}

export function NewProjectDialog({ open, onOpenChange, onSubmit }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  const [pathStatus, setPathStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [pathError, setPathError] = useState('');

  const validatePath = async (p: string) => {
    if (!p) {
      setPathStatus('idle');
      return;
    }

    try {
      const res = await fetch(`/api/projects/validate-path?path=${encodeURIComponent(p)}`);
      const data = await res.json();

      if (data.ok && data.data.valid) {
        setPathStatus('valid');
        setPathError('');
        if (!name && data.data.suggestedName) {
          setName(data.data.suggestedName);
        }
      } else {
        setPathStatus('invalid');
        setPathError(data.data?.reason ?? 'Invalid path');
      }
    } catch {
      setPathStatus('invalid');
      setPathError('Failed to validate path');
    }
  };

  const handleSubmit = () => {
    onSubmit({ name, path, description: description || undefined });
    onOpenChange(false);
    setName('');
    setPath('');
    setDescription('');
    setPathStatus('idle');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Project Path</label>
            <div className="relative mt-1">
              <TextInput
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  setPathStatus('idle');
                }}
                onBlur={() => validatePath(path)}
                placeholder="/path/to/project"
                className="pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {pathStatus === 'valid' && <Check className="h-4 w-4 text-green-500" />}
                {pathStatus === 'invalid' && <AlertCircle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
            {pathStatus === 'invalid' && (
              <p className="text-xs text-red-500 mt-1">{pathError}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Project Name</label>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project description..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || pathStatus !== 'valid'}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### ProjectPicker (`components/features/project-picker.tsx`)

```typescript
import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Project } from '@/db/schema';

interface ProjectPickerProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelect: (project: Project) => void;
  onNewProject: () => void;
}

export function ProjectPicker({
  projects,
  selectedProject,
  onSelect,
  onNewProject,
}: ProjectPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-64 justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4" />
            <span className="truncate">{selectedProject?.name ?? 'Select project'}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64">
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => {
              onSelect(project);
              setOpen(false);
            }}
          >
            <Check
              className={cn(
                'mr-2 h-4 w-4',
                selectedProject?.id === project.id ? 'opacity-100' : 'opacity-0'
              )}
            />
            <span className="truncate">{project.name}</span>
          </DropdownMenuItem>
        ))}

        {projects.length > 0 && <DropdownMenuSeparator />}

        <DropdownMenuItem onClick={onNewProject}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 4.5 Real-Time Hooks

### useSession (`hooks/use-session.ts`)

```typescript
import { useEffect, useState, useCallback } from 'react';
import { getSessionService } from '@/services/session.service';
import type { SessionEvent } from '@/services/session.service';

interface SessionState {
  chunks: { text: string; timestamp: number }[];
  toolCalls: { id: string; tool: string; input: unknown; output?: unknown; status: string }[];
  terminal: { type: 'stdout' | 'stderr'; data: string; timestamp: number }[];
  presence: { userId: string; name: string; lastSeen: number }[];
  agentState: { status: string; turn: number; progress: number } | null;
}

export function useSession(sessionId: string, userId: string) {
  const [state, setState] = useState<SessionState>({
    chunks: [],
    toolCalls: [],
    terminal: [],
    presence: [],
    agentState: null,
  });

  useEffect(() => {
    const sessionService = getSessionService();

    // Join session
    sessionService.join(sessionId, userId);

    // Subscribe to events
    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const data: SessionEvent = JSON.parse(event.data);

      setState((prev) => {
        switch (data.type) {
          case 'chunk':
            return { ...prev, chunks: [...prev.chunks, data.payload] };
          case 'tool_start':
            return {
              ...prev,
              toolCalls: [...prev.toolCalls, { ...data.payload, status: 'running' }],
            };
          case 'tool_complete':
            return {
              ...prev,
              toolCalls: prev.toolCalls.map((tc) =>
                tc.id === data.payload.id
                  ? { ...tc, output: data.payload.output, status: 'complete' }
                  : tc
              ),
            };
          case 'tool_error':
            return {
              ...prev,
              toolCalls: prev.toolCalls.map((tc) =>
                tc.id === data.payload.id ? { ...tc, status: 'error' } : tc
              ),
            };
          case 'terminal':
            return { ...prev, terminal: [...prev.terminal, data.payload] };
          case 'presence':
            return { ...prev, presence: data.payload };
          case 'agent_state':
            return { ...prev, agentState: data.payload };
          default:
            return prev;
        }
      });
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
      sessionService.leave(sessionId, userId);
    };
  }, [sessionId, userId]);

  return state;
}
```

### useAgentStream (`hooks/use-agent-stream.ts`)

```typescript
import { useEffect, useRef, useState } from 'react';

interface StreamChunk {
  text: string;
  timestamp: number;
}

export function useAgentStream(sessionId: string) {
  const [chunks, setChunks] = useState<StreamChunk[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    setIsStreaming(true);

    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

    eventSource.addEventListener('chunk', (event) => {
      const data = JSON.parse(event.data);
      setChunks((prev) => [...prev, { text: data.text, timestamp: Date.now() }]);
    });

    eventSource.addEventListener('complete', () => {
      setIsStreaming(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setIsStreaming(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
      abortRef.current?.abort();
    };
  }, [sessionId]);

  const fullText = chunks.map((c) => c.text).join('');

  return { chunks, fullText, isStreaming };
}
```

### usePresence (`hooks/use-presence.ts`)

```typescript
import { useEffect, useState, useCallback } from 'react';

interface PresenceUser {
  userId: string;
  name: string;
  cursor?: { line: number; column: number };
  lastSeen: number;
}

export function usePresence(sessionId: string, userId: string, userName: string) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  // Heartbeat to keep presence alive
  useEffect(() => {
    const heartbeat = async () => {
      await fetch(`/api/sessions/${sessionId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: userName }),
      });
    };

    heartbeat();
    const interval = setInterval(heartbeat, 30000);

    return () => clearInterval(interval);
  }, [sessionId, userId, userName]);

  // Subscribe to presence updates
  useEffect(() => {
    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

    eventSource.addEventListener('presence', (event) => {
      const data = JSON.parse(event.data);
      setUsers(data);
    });

    return () => eventSource.close();
  }, [sessionId]);

  const updateCursor = useCallback(
    async (cursor: { line: number; column: number }) => {
      await fetch(`/api/sessions/${sessionId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: userName, cursor }),
      });
    },
    [sessionId, userId, userName]
  );

  return { users, updateCursor };
}
```

---

## 4.6 Page Routes

### Route Structure

```
routes/
├── __root.tsx              # Root layout
├── index.tsx               # Dashboard
├── projects/
│   ├── index.tsx           # Projects list
│   └── $projectId/
│       ├── index.tsx       # Project kanban board
│       └── tasks/
│           └── $taskId.tsx # Task detail
├── agents/
│   ├── index.tsx           # Agents list
│   └── $agentId.tsx        # Agent detail
└── sessions/
    └── $sessionId.tsx      # Session view
```

### Root Layout (`routes/__root.tsx`)

```typescript
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { BootstrapProvider } from '@/providers/bootstrap-provider';
import { Toaster } from '@/components/ui/toast';

export const Route = createRootRoute({
  component: () => (
    <BootstrapProvider>
      <div className="min-h-screen bg-background">
        <Outlet />
        <Toaster />
      </div>
    </BootstrapProvider>
  ),
});
```

### Dashboard (`routes/index.tsx`)

```typescript
import { createFileRoute, Link } from '@tanstack/react-router';
import { FolderKanban, Bot, Clock } from 'lucide-react';
import { getProjectService } from '@/services/project.service';
import { getAgentService } from '@/services/agent.service';
import { Button } from '@/components/ui/button';
import { ProjectPicker } from '@/components/features/project-picker';

export const Route = createFileRoute('/')({
  loader: async () => {
    const projectService = getProjectService();
    const agentService = getAgentService();

    const [projects, runningAgents] = await Promise.all([
      projectService.list({ limit: 10 }),
      // Get running agents across all projects
    ]);

    return {
      projects: projects.ok ? projects.value.items : [],
      runningAgents: [],
    };
  },
  component: Dashboard,
});

function Dashboard() {
  const { projects, runningAgents } = Route.useLoaderData();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="rounded-lg border p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <FolderKanban className="h-5 w-5" />
            <span>Projects</span>
          </div>
          <p className="text-3xl font-bold">{projects.length}</p>
        </div>

        <div className="rounded-lg border p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Bot className="h-5 w-5" />
            <span>Running Agents</span>
          </div>
          <p className="text-3xl font-bold">{runningAgents.length}</p>
        </div>

        <div className="rounded-lg border p-6">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="h-5 w-5" />
            <span>Recent Activity</span>
          </div>
          <p className="text-sm text-muted-foreground">View recent tasks</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Projects</h2>
        <div className="grid grid-cols-2 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <h3 className="font-medium">{project.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{project.path}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Project Kanban (`routes/projects/$projectId/index.tsx`)

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { getProjectService } from '@/services/project.service';
import { getTaskService } from '@/services/task.service';
import { getAgentService } from '@/services/agent.service';
import { KanbanBoard } from '@/components/features/kanban-board';
import { TaskDetailDialog } from '@/components/features/task-detail-dialog';
import { ApprovalDialog } from '@/components/features/approval-dialog';
import { Button } from '@/components/ui/button';
import type { Task } from '@/db/schema';

export const Route = createFileRoute('/projects/$projectId/')({
  loader: async ({ params }) => {
    const projectService = getProjectService();
    const taskService = getTaskService();
    const agentService = getAgentService();

    const [project, tasks, agents] = await Promise.all([
      projectService.getById(params.projectId),
      taskService.list(params.projectId),
      agentService.list(params.projectId),
    ]);

    if (!project.ok) throw new Error('Project not found');

    return {
      project: project.value,
      tasks: tasks.ok ? tasks.value.items : [],
      agents: agents.value,
    };
  },
  component: ProjectKanban,
});

function ProjectKanban() {
  const { project, tasks, agents } = Route.useLoaderData();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [approvalTask, setApprovalTask] = useState<Task | null>(null);

  const handleTaskMove = async (taskId: string, column: TaskColumn, position: number) => {
    const taskService = getTaskService();
    await taskService.moveColumn(taskId, column, position);
  };

  const handleTaskClick = (task: Task) => {
    if (task.column === 'waiting_approval') {
      setApprovalTask(task);
    } else {
      setSelectedTask(task);
    }
  };

  const handleApprove = async (commitMessage?: string) => {
    if (!approvalTask) return;
    const taskService = getTaskService();
    await taskService.approve(approvalTask.id, { commitMessage });
  };

  const handleReject = async (reason: string) => {
    if (!approvalTask) return;
    const taskService = getTaskService();
    await taskService.reject(approvalTask.id, { reason });
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <Button onClick={() => setShowNewTask(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </header>

      <main className="flex-1 overflow-hidden">
        <KanbanBoard
          tasks={tasks}
          onTaskMove={handleTaskMove}
          onTaskClick={handleTaskClick}
        />
      </main>

      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask || showNewTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
            setShowNewTask(false);
          }
        }}
        onSave={async (data) => {
          const taskService = getTaskService();
          if (selectedTask) {
            await taskService.update(selectedTask.id, data);
          } else {
            await taskService.create({ projectId: project.id, ...data } as any);
          }
        }}
        onDelete={async (id) => {
          const taskService = getTaskService();
          await taskService.delete(id);
        }}
      />

      {approvalTask && (
        <ApprovalDialog
          task={approvalTask}
          diff={approvalTask.diffSummary}
          open={!!approvalTask}
          onOpenChange={(open) => !open && setApprovalTask(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
```

### Session View (`routes/sessions/$sessionId.tsx`)

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { getSessionService } from '@/services/session.service';
import { getAgentService } from '@/services/agent.service';
import { AgentSessionView } from '@/components/features/agent-session-view';

export const Route = createFileRoute('/sessions/$sessionId')({
  loader: async ({ params }) => {
    const sessionService = getSessionService();
    const session = await sessionService.getById(params.sessionId);

    if (!session.ok) throw new Error('Session not found');

    return { session: session.value };
  },
  component: SessionPage,
});

function SessionPage() {
  const { session } = Route.useLoaderData();
  const userId = 'current-user'; // From auth context

  const handlePause = async () => {
    if (!session.agentId) return;
    const agentService = getAgentService();
    await agentService.pause(session.agentId);
  };

  const handleResume = async () => {
    if (!session.agentId) return;
    const agentService = getAgentService();
    await agentService.resume(session.agentId);
  };

  const handleStop = async () => {
    if (!session.agentId) return;
    const agentService = getAgentService();
    await agentService.stop(session.agentId);
  };

  return (
    <div className="h-screen">
      <AgentSessionView
        sessionId={session.id}
        agentId={session.agentId ?? ''}
        userId={userId}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
      />
    </div>
  );
}
```

---

## 4.7 Feature Component Summary

| Component | File | Purpose |
|-----------|------|---------|
| KanbanBoard | `components/features/kanban-board.tsx` | Drag-drop task board |
| KanbanColumn | `components/features/kanban-column.tsx` | Task column container |
| KanbanCard | `components/features/kanban-card.tsx` | Draggable task card |
| ApprovalDialog | `components/features/approval-dialog.tsx` | Code review modal |
| AgentSessionView | `components/features/agent-session-view.tsx` | Real-time agent output |
| TaskDetailDialog | `components/features/task-detail-dialog.tsx` | Task editor modal |
| NewProjectDialog | `components/features/new-project-dialog.tsx` | Project creation wizard |
| ProjectPicker | `components/features/project-picker.tsx` | Project selector dropdown |
| ToastNotifications | `components/features/toast.tsx` | Toast system |
| Breadcrumbs | `components/features/breadcrumbs.tsx` | Navigation breadcrumbs |

---

## 4.8 Tests

### Component Test Categories

| Category | Test Count |
|----------|------------|
| Primitive components | 12 |
| KanbanBoard | 8 |
| ApprovalDialog | 6 |
| AgentSessionView | 5 |
| Hooks | 8 |
| Page routes | 10 |

### Example Test (`tests/components/kanban-board.test.tsx`)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KanbanBoard } from '@/components/features/kanban-board';
import { createTestTask } from '../factories';

describe('KanbanBoard', () => {
  const mockTasks = [
    createTestTask('project-1', { column: 'backlog', position: 0 }),
    createTestTask('project-1', { column: 'backlog', position: 1 }),
    createTestTask('project-1', { column: 'in_progress', position: 0 }),
  ];

  it('renders all columns', () => {
    render(
      <KanbanBoard
        tasks={mockTasks}
        onTaskMove={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );

    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Waiting Approval')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('displays task count per column', () => {
    render(
      <KanbanBoard
        tasks={mockTasks}
        onTaskMove={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // backlog
    expect(screen.getByText('1')).toBeInTheDocument(); // in_progress
  });

  it('calls onTaskClick when card clicked', async () => {
    const onTaskClick = vi.fn();
    render(
      <KanbanBoard
        tasks={mockTasks}
        onTaskMove={vi.fn()}
        onTaskClick={onTaskClick}
      />
    );

    fireEvent.click(screen.getByText(mockTasks[0].title));
    expect(onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });
});
```

---

## Spec References

- Component Patterns: `/specs/application/implementation/component-patterns.md`
- Animation System: `/specs/application/implementation/animation-system.md`
- Components: `/specs/application/components/*.md`
- Routes: `/specs/application/routing/routes.md`
- Wireframes: `/specs/application/wireframes/*.html`
