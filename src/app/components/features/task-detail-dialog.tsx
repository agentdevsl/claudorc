import {
  CalendarBlank,
  Check,
  Circle,
  Clock,
  Code,
  File,
  GitBranch,
  Keyboard,
  Note,
  Robot,
  Spinner,
  Trash,
  X,
} from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { TextInput } from '@/app/components/ui/text-input';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import type { Agent } from '@/db/schema/agents';
import type { Task, TaskColumn } from '@/db/schema/tasks';
import type { Worktree } from '@/db/schema/worktrees';
import { cn } from '@/lib/utils/cn';
import {
  COLUMNS,
  formatTaskId,
  getLabelColors,
  PRIORITY_CONFIG,
  type Priority,
} from './kanban-board/constants';

// ============================================================================
// TYPES
// ============================================================================

interface ActivityEntry {
  id: string;
  type: 'comment' | 'status_change' | 'agent_action' | 'file_change';
  content: string;
  user?: string;
  timestamp: Date;
  metadata?: {
    oldStatus?: TaskColumn;
    newStatus?: TaskColumn;
    filesChanged?: number;
    agentName?: string;
  };
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    title?: string;
    description?: string;
    labels?: string[];
    agentId?: string | null;
    priority?: Priority;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  agents?: Agent[];
  worktree?: Worktree | null;
  activity?: ActivityEntry[];
  onOpenInIde?: (worktree: Worktree) => void;
}

// ============================================================================
// VARIANTS
// ============================================================================

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      status: {
        backlog: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
        queued: 'bg-[var(--secondary-muted)] text-[var(--secondary-fg)]',
        in_progress: 'bg-[var(--attention-muted)] text-[var(--attention-fg)]',
        waiting_approval: 'bg-[var(--accent-muted)] text-[var(--accent-fg)]',
        verified: 'bg-[var(--success-muted)] text-[var(--success-fg)]',
      },
    },
    defaultVariants: {
      status: 'backlog',
    },
  }
);

const priorityOptionVariants = cva(
  'relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-all duration-fast ease-out',
  {
    variants: {
      priority: {
        high: 'hover:border-[var(--danger-fg)]',
        medium: 'hover:border-[var(--attention-fg)]',
        low: 'hover:border-[var(--success-fg)]',
      },
      isSelected: {
        true: '',
        false: 'border-[var(--border-default)] bg-[var(--bg-canvas)]',
      },
    },
    compoundVariants: [
      {
        priority: 'high',
        isSelected: true,
        className: 'border-[var(--danger-fg)] bg-[var(--danger-muted)]',
      },
      {
        priority: 'medium',
        isSelected: true,
        className: 'border-[var(--attention-fg)] bg-[var(--attention-muted)]',
      },
      {
        priority: 'low',
        isSelected: true,
        className: 'border-[var(--success-fg)] bg-[var(--success-muted)]',
      },
    ],
    defaultVariants: {
      isSelected: false,
    },
  }
);

const labelPillVariants = cva(
  'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-fast ease-out',
  {
    variants: {
      isSelected: {
        true: 'ring-1 ring-current',
        false: 'opacity-70 hover:opacity-100',
      },
    },
    defaultVariants: {
      isSelected: false,
    },
  }
);

const agentStatusVariants = cva('h-2 w-2 rounded-full', {
  variants: {
    status: {
      idle: 'bg-[var(--fg-muted)]',
      starting: 'bg-[var(--attention-fg)] animate-pulse',
      running: 'bg-[var(--success-fg)] animate-pulse',
      paused: 'bg-[var(--attention-fg)]',
      error: 'bg-[var(--danger-fg)]',
      completed: 'bg-[var(--done-fg)]',
    },
  },
  defaultVariants: {
    status: 'idle',
  },
});

// ============================================================================
// CONSTANTS
// ============================================================================

const AVAILABLE_LABELS = ['bug', 'feature', 'enhancement', 'docs', 'refactor', 'test'];

const KEYBOARD_SHORTCUTS = [
  { key: 'E', description: 'Edit title' },
  { key: 'Esc', description: 'Close dialog' },
  { key: '\u2318S', description: 'Save changes' },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: TaskColumn }) {
  const column = COLUMNS.find((c) => c.id === status);
  const label = column?.label ?? 'Unknown';

  return (
    <span className={statusBadgeVariants({ status })} data-testid="status-badge">
      <Circle weight="fill" className="h-2 w-2" />
      {label}
    </span>
  );
}

function PrioritySelector({
  value,
  onChange,
}: {
  value: Priority | undefined;
  onChange: (priority: Priority) => void;
}) {
  return (
    <div className="flex gap-3" data-testid="priority-selector">
      {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((priority) => {
        const config = PRIORITY_CONFIG[priority];
        const isSelected = value === priority;

        return (
          <label
            key={priority}
            className={priorityOptionVariants({ priority, isSelected })}
            data-testid={`priority-option-${priority}`}
          >
            <input
              type="radio"
              name="priority"
              value={priority}
              checked={isSelected}
              onChange={() => onChange(priority)}
              className="sr-only"
            />
            <span className={cn('h-2.5 w-2.5 rounded-full', config.color)} />
            {config.label}
          </label>
        );
      })}
    </div>
  );
}

function LabelsSection({
  selectedLabels,
  onToggleLabel,
}: {
  selectedLabels: string[];
  onToggleLabel: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="task-labels-section">
      {AVAILABLE_LABELS.map((label) => {
        const colors = getLabelColors(label);
        const isSelected = selectedLabels.includes(label);

        return (
          <label
            key={label}
            className={cn(labelPillVariants({ isSelected }), colors.bg, colors.text)}
            data-testid={`label-pill-${label}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleLabel(label)}
              className="sr-only"
            />
            <span
              className={cn('h-2 w-2 rounded-full', {
                'bg-[var(--danger-fg)]': label === 'bug',
                'bg-[var(--done-fg)]': label === 'feature',
                'bg-[var(--accent-fg)]': label === 'enhancement',
                'bg-[var(--attention-fg)]': label === 'docs',
                'bg-[var(--secondary-fg)]': label === 'refactor',
                'bg-[var(--success-fg)]': label === 'test',
              })}
            />
            {label}
            {isSelected && <X className="h-3 w-3" weight="bold" />}
          </label>
        );
      })}
    </div>
  );
}

function AgentSelector({
  agents,
  selectedAgentId,
  onSelect,
}: {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelect: (agentId: string | null) => void;
}) {
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const getAgentInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getStatusLabel = (status: Agent['status']) => {
    switch (status) {
      case 'idle':
        return 'Available';
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  return (
    <Select
      value={selectedAgentId ?? 'unassigned'}
      onValueChange={(v) => onSelect(v === 'unassigned' ? null : v)}
    >
      <SelectTrigger data-testid="agent-selector">
        <SelectValue>
          {selectedAgent ? (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--success-fg)] to-[var(--success-emphasis)] text-xs font-semibold text-white">
                {getAgentInitials(selectedAgent.name)}
              </div>
              <span className="font-medium">{selectedAgent.name}</span>
              <span className={agentStatusVariants({ status: selectedAgent.status })} />
              <span className="text-[var(--fg-muted)]">
                - {getStatusLabel(selectedAgent.status)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-emphasis)] text-xs font-semibold text-[var(--fg-muted)]">
                --
              </div>
              <span className="text-[var(--fg-muted)]">Unassigned</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-emphasis)] text-xs font-semibold text-[var(--fg-muted)]">
              --
            </div>
            <span>Unassigned</span>
          </div>
        </SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--success-fg)] to-[var(--success-emphasis)] text-xs font-semibold text-white">
                {getAgentInitials(agent.name)}
              </div>
              <span className="font-medium">{agent.name}</span>
              <span className={agentStatusVariants({ status: agent.status })} />
              <span className="text-[var(--fg-muted)]">- {getStatusLabel(agent.status)}</span>
            </div>
          </SelectItem>
        ))}
        <SelectItem value="auto-assign">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent-fg)] to-[var(--accent-emphasis)] text-xs font-semibold text-white">
              <Robot className="h-3.5 w-3.5" />
            </div>
            <span className="font-medium">Auto-assign</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function MetadataGrid({
  task,
  filesChanged,
  turns,
}: {
  task: Task;
  filesChanged?: number;
  turns?: number;
}) {
  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  return (
    <div
      className="grid grid-cols-3 gap-4 rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] p-4"
      data-testid="metadata-grid"
    >
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
          <CalendarBlank className="h-3.5 w-3.5" />
          Created
        </span>
        <span className="text-sm font-medium text-[var(--fg-default)]">
          {formatDate(task.createdAt)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
          <Clock className="h-3.5 w-3.5" />
          Turns
        </span>
        <span className="text-sm font-medium text-[var(--fg-default)]">{turns ?? 0}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
          <File className="h-3.5 w-3.5" />
          Files Changed
        </span>
        <span className="text-sm font-medium text-[var(--fg-default)]">{filesChanged ?? 0}</span>
      </div>
    </div>
  );
}

function ActivityTimeline({ activity }: { activity: ActivityEntry[] }) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'comments' | 'history'>('timeline');

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getActivityIcon = (type: ActivityEntry['type']) => {
    switch (type) {
      case 'comment':
        return <Note className="h-4 w-4" />;
      case 'status_change':
        return <Circle className="h-4 w-4" weight="fill" />;
      case 'agent_action':
        return <Robot className="h-4 w-4" />;
      case 'file_change':
        return <Code className="h-4 w-4" />;
    }
  };

  const filteredActivity = useMemo(() => {
    if (activeTab === 'comments') {
      return activity.filter((a) => a.type === 'comment');
    }
    if (activeTab === 'history') {
      return activity.filter((a) => a.type === 'status_change');
    }
    return activity;
  }, [activity, activeTab]);

  return (
    <div data-testid="activity-timeline">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="max-h-48 overflow-y-auto">
          {filteredActivity.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--fg-muted)]">No activity yet</p>
          ) : (
            <div className="space-y-3 py-2">
              {filteredActivity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                    {getActivityIcon(entry.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--fg-default)]">{entry.content}</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                      {entry.user && <span>{entry.user}</span>}
                      <span>{formatTimestamp(entry.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WorktreeInfoPanel({
  worktree,
  onOpenInIde,
}: {
  worktree: Worktree;
  onOpenInIde?: (worktree: Worktree) => void;
}) {
  return (
    <div
      className="rounded-md border border-[var(--border-default)] bg-[var(--bg-canvas)] p-4"
      data-testid="worktree-info-panel"
    >
      <h4 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
        <GitBranch className="h-4 w-4" />
        Worktree
      </h4>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--fg-muted)]">Branch</span>
          <span className="font-mono text-sm text-[var(--accent-fg)]">{worktree.branch}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--fg-muted)]">Path</span>
          <span
            className="max-w-[200px] truncate font-mono text-xs text-[var(--fg-default)]"
            title={worktree.path}
          >
            {worktree.path}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--fg-muted)]">Status</span>
          <span
            className={cn('rounded-full px-2 py-0.5 text-xs font-medium', {
              'bg-[var(--success-muted)] text-[var(--success-fg)]': worktree.status === 'active',
              'bg-[var(--attention-muted)] text-[var(--attention-fg)]':
                worktree.status === 'creating' || worktree.status === 'merging',
              'bg-[var(--danger-muted)] text-[var(--danger-fg)]': worktree.status === 'error',
              'bg-[var(--bg-muted)] text-[var(--fg-muted)]':
                worktree.status === 'removed' || worktree.status === 'removing',
            })}
          >
            {worktree.status}
          </span>
        </div>
        {onOpenInIde && worktree.status === 'active' && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onOpenInIde(worktree)}
            data-testid="open-in-ide-button"
          >
            <Code className="h-4 w-4" />
            Open in IDE
          </Button>
        )}
      </div>
    </div>
  );
}

function KeyboardShortcutsHint() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--fg-subtle)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg-default)]"
            data-testid="keyboard-shortcuts-hint"
          >
            <Keyboard className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          <div className="space-y-1">
            {KEYBOARD_SHORTCUTS.map(({ key, description }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-[var(--fg-muted)]">{description}</span>
                <kbd className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onSave,
  onDelete,
  agents = [],
  worktree,
  activity = [],
  onOpenInIde,
}: TaskDetailDialogProps): React.JSX.Element {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [selectedLabels, setSelectedLabels] = useState<string[]>(task?.labels ?? []);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(task?.agentId ?? null);
  const [priority, setPriority] = useState<Priority | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset state when task changes
  useEffect(() => {
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setSelectedLabels(task?.labels ?? []);
    setSelectedAgentId(task?.agentId ?? null);
    setIsEditing(false);
  }, [task]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        title,
        description,
        labels: selectedLabels,
        agentId: selectedAgentId,
        priority,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    onSave,
    title,
    description,
    selectedLabels,
    selectedAgentId,
    priority,
    onOpenChange,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // E = Edit title
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !isEditing) {
        e.preventDefault();
        setIsEditing(true);
        setTimeout(() => titleInputRef.current?.focus(), 0);
      }

      // Esc = Close dialog explicitly for reliable behavior
      if (e.key === 'Escape') {
        onOpenChange(false);
      }

      // Cmd/Ctrl + S = Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, isEditing, handleSave, onOpenChange]);

  const handleDelete = async () => {
    if (!task) return;
    await onDelete(task.id);
    onOpenChange(false);
  };

  const handleToggleLabel = useCallback((label: string) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }, []);

  // Calculate metadata from diff summary
  const filesChanged = task?.diffSummary?.filesChanged ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="task-detail-dialog">
        {/* Header with status badge and keyboard hint */}
        <DialogHeader className="pr-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="flex items-center gap-2">
                {task ? (
                  <>
                    Edit Task
                    <span className="font-mono text-sm font-normal text-[var(--fg-muted)]">
                      {formatTaskId(task.id)}
                    </span>
                  </>
                ) : (
                  'New Task'
                )}
              </DialogTitle>
              {task && <StatusBadge status={task.column} />}
            </div>
            <KeyboardShortcutsHint />
          </div>
          <DialogDescription>
            {task ? 'Update task details and save changes.' : 'Add details for the new task.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto py-2">
          {/* Title */}
          <div className="space-y-2">
            <label
              htmlFor="task-title"
              className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
            >
              Title
              <span className="text-[var(--danger-fg)]">*</span>
            </label>
            <TextInput
              ref={titleInputRef}
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Task title..."
              data-testid="task-title-input"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label
              htmlFor="task-description"
              className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]"
            >
              Description
            </label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a detailed description..."
              rows={4}
              data-testid="task-description-input"
            />
            <p className="text-xs text-[var(--fg-muted)]">
              Supports{' '}
              <code className="rounded bg-[var(--bg-muted)] px-1 py-0.5 font-mono text-xs">
                Markdown
              </code>{' '}
              formatting
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
              Priority
            </span>
            <PrioritySelector value={priority} onChange={setPriority} />
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
              Labels
            </span>
            <LabelsSection selectedLabels={selectedLabels} onToggleLabel={handleToggleLabel} />
          </div>

          {/* Agent Assignment */}
          {agents.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
                Assign to Agent
              </span>
              <AgentSelector
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelect={setSelectedAgentId}
              />
            </div>
          )}

          {/* Metadata Grid */}
          {task && (
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
                Metadata
              </span>
              <MetadataGrid task={task} filesChanged={filesChanged} turns={0} />
            </div>
          )}

          {/* Worktree Info */}
          {worktree && <WorktreeInfoPanel worktree={worktree} onOpenInIde={onOpenInIde} />}

          {/* Activity Timeline */}
          {task && activity.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">
                Activity
              </span>
              <ActivityTimeline activity={activity} />
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 border-t border-[var(--border-default)] pt-4">
          {task && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              data-testid="delete-task-button"
              className="mr-auto"
            >
              <Trash className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="cancel-button">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} data-testid="save-task-button">
            {isSaving ? (
              <>
                <Spinner className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
