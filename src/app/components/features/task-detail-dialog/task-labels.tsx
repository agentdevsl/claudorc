import { Plus, X } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';

const labelVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      type: {
        bug: 'bg-danger-muted text-danger',
        feature: 'bg-accent-muted text-accent',
        enhancement: 'bg-success-muted text-success',
        docs: 'bg-surface-muted text-fg-muted',
        default: 'bg-surface-muted text-fg',
      },
    },
    defaultVariants: {
      type: 'default',
    },
  }
);

function getLabelType(label: string): 'bug' | 'feature' | 'enhancement' | 'docs' | 'default' {
  const lower = label.toLowerCase();
  if (lower.includes('bug') || lower.includes('fix')) return 'bug';
  if (lower.includes('feature') || lower.includes('feat')) return 'feature';
  if (lower.includes('enhancement') || lower.includes('improve')) return 'enhancement';
  if (lower.includes('doc')) return 'docs';
  return 'default';
}

interface TaskLabelsProps {
  labels: string[];
  availableLabels: string[];
  onChange: (labels: string[]) => void;
}

export function TaskLabels({
  labels,
  availableLabels,
  onChange,
}: TaskLabelsProps): React.JSX.Element {
  const handleRemoveLabel = (labelToRemove: string) => {
    onChange(labels.filter((l) => l !== labelToRemove));
  };

  const handleAddLabel = (label: string) => {
    if (!labels.includes(label)) {
      onChange([...labels, label]);
    }
  };

  // Get labels not yet added
  const unselectedLabels = availableLabels.filter((l) => !labels.includes(l));

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Labels</h3>

      <div className="flex flex-wrap items-center gap-2">
        {/* Existing labels */}
        {labels.map((label) => (
          <span key={label} className={cn(labelVariants({ type: getLabelType(label) }), 'group')}>
            {label}
            <button
              type="button"
              onClick={() => handleRemoveLabel(label)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
              aria-label={`Remove ${label} label`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {/* Add label dropdown */}
        {unselectedLabels.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-fg-muted',
                  'hover:border-fg-subtle hover:text-fg transition-colors'
                )}
              >
                <Plus className="h-3 w-3" />
                Add label
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start">
              {unselectedLabels.map((label) => (
                <DropdownMenuItem
                  key={label}
                  onSelect={() => handleAddLabel(label)}
                  className="gap-2"
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      getLabelType(label) === 'bug' && 'bg-danger',
                      getLabelType(label) === 'feature' && 'bg-accent',
                      getLabelType(label) === 'enhancement' && 'bg-success',
                      getLabelType(label) === 'docs' && 'bg-fg-muted',
                      getLabelType(label) === 'default' && 'bg-fg-subtle'
                    )}
                  />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Show empty state if no labels */}
        {labels.length === 0 && unselectedLabels.length === 0 && (
          <span className="text-xs text-fg-subtle italic">No labels available</span>
        )}
      </div>
    </div>
  );
}
