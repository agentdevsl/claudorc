import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/db/schema/tasks';
import { cn } from '@/lib/utils/cn';
import { LABEL_TYPES, type Priority } from './constants';
import { agentStatusVariants, cardVariants, labelVariants, priorityVariants } from './styles';

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

/**
 * Get the label type for styling
 */
function getLabelType(label: string): 'bug' | 'feature' | 'enhancement' | 'docs' | 'default' {
  const normalized = label.toLowerCase();
  const mapping = LABEL_TYPES as Record<string, string>;
  const mapped = mapping[normalized];
  if (mapped === 'bug') return 'bug';
  if (mapped === 'feature') return 'feature';
  if (mapped === 'enhancement') return 'enhancement';
  if (mapped === 'docs') return 'docs';
  return 'default';
}

/**
 * Extract priority from task
 */
function getPriority(task: Task): Priority {
  return (task.priority as Priority) ?? 'medium';
}

/**
 * Format task ID for display
 */
function formatTaskId(id: string): string {
  return `#TSK-${id.slice(-3).toUpperCase()}`;
}

export function KanbanCard({
  task,
  isSelected,
  isDragging,
  onSelect,
  onOpen,
}: KanbanCardProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Render ghost placeholder when this card is being dragged
  if (sortableIsDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative rounded-md border-2 border-dashed border-primary/20 bg-primary/5 min-h-[100px] w-full"
      />
    );
  }

  const cardState =
    isDragging || sortableIsDragging ? 'dragging' : isSelected ? 'selected' : 'default';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(e.metaKey || e.ctrlKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onOpen();
    } else if (e.key === ' ') {
      e.preventDefault();
      onSelect(e.metaKey || e.ctrlKey);
    }
  };

  const priority = getPriority(task);
  const labels = task.labels ?? [];
  const isAgentRunning = Boolean(task.agentId) && task.column === 'in_progress';

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cardVariants({ state: cardState })}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      aria-grabbed={isDragging || sortableIsDragging}
      {...attributes}
      {...listeners}
    >
      {/* Labels */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {labels.map((label) => (
            <span key={label} className={labelVariants({ type: getLabelType(label) })}>
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Header with priority and title */}
      <div className="flex items-start gap-2">
        <div className={cn(priorityVariants({ priority }), 'mt-1.5')} />
        <div className="flex-1 text-sm font-medium leading-snug text-fg">{task.title}</div>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="mt-1.5 text-xs text-fg-muted line-clamp-2">{task.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5">
        <span className="font-mono text-xs text-fg-muted">{formatTaskId(task.id)}</span>
      </div>

      {/* Agent Status Badge */}
      {isAgentRunning && (
        <div className={agentStatusVariants({ status: 'running' })}>
          <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
          <span>Agent running...</span>
        </div>
      )}
    </article>
  );
}
