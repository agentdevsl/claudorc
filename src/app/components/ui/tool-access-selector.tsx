import { SlidersHorizontal } from '@phosphor-icons/react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { TOOL_GROUPS } from '@/lib/constants/tools';
import { cn } from '@/lib/utils/cn';

export interface ToolAccessSelectorProps {
  /** Currently selected tools */
  value: string[];
  /** Called when tool selection changes */
  onChange: (tools: string[]) => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact single-row display */
  compact?: boolean;
  /** Test ID */
  'data-testid'?: string;
}

/**
 * Tool access selector with grouped checkboxes.
 * Allows selecting which tools an agent can use.
 */
export function ToolAccessSelector({
  value,
  onChange,
  className,
  compact = false,
  'data-testid': testId = 'tool-access-selector',
}: ToolAccessSelectorProps): React.JSX.Element {
  const toggleTool = (tool: string): void => {
    const next = value.includes(tool) ? value.filter((t) => t !== tool) : [...value, tool];
    onChange(next);
  };

  const toggleGroup = (tools: readonly string[]): void => {
    const allSelected = tools.every((t) => value.includes(t));
    if (allSelected) {
      onChange(value.filter((t) => !tools.includes(t)));
    } else {
      const newTools = new Set([...value, ...tools]);
      onChange([...newTools]);
    }
  };

  const selectAll = (): void => {
    const allTools = Object.values(TOOL_GROUPS).flat();
    onChange([...allTools]);
  };

  const selectNone = (): void => {
    onChange([]);
  };

  if (compact) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)} data-testid={testId}>
        {Object.values(TOOL_GROUPS)
          .flat()
          .map((tool) => (
            <label
              key={tool}
              htmlFor={`compact-tool-${tool}`}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                value.includes(tool)
                  ? 'border-accent bg-accent-muted text-accent'
                  : 'border-border bg-surface-subtle text-fg-muted hover:border-fg-subtle'
              )}
            >
              <Checkbox
                id={`compact-tool-${tool}`}
                checked={value.includes(tool)}
                onCheckedChange={() => toggleTool(tool)}
                className="h-3 w-3"
              />
              {tool}
            </label>
          ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} data-testid={testId}>
      {/* Quick actions */}
      <div className="flex gap-2 text-xs">
        <button type="button" onClick={selectAll} className="text-accent hover:underline">
          Select all
        </button>
        <span className="text-fg-subtle">|</span>
        <button type="button" onClick={selectNone} className="text-accent hover:underline">
          Select none
        </button>
      </div>

      {/* Tool groups */}
      {Object.entries(TOOL_GROUPS).map(([group, tools]) => {
        const groupSelected = tools.filter((t) => value.includes(t)).length;
        const allSelected = groupSelected === tools.length;

        return (
          <div key={group} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {group}
              </div>
              <button
                type="button"
                onClick={() => toggleGroup(tools)}
                className="text-xs text-accent hover:underline"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {tools.map((tool) => (
                <label
                  key={tool}
                  htmlFor={`tool-${tool}`}
                  className="flex cursor-pointer items-center gap-2 text-sm text-fg"
                >
                  <Checkbox
                    id={`tool-${tool}`}
                    checked={value.includes(tool)}
                    onCheckedChange={() => toggleTool(tool)}
                  />
                  {tool}
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div className="text-xs text-fg-muted">
        {value.length} of {Object.values(TOOL_GROUPS).flat().length} tools selected
      </div>
    </div>
  );
}

/**
 * Compact inline tool badge display (read-only).
 */
export function ToolAccessBadges({
  tools,
  className,
}: {
  tools: string[];
  className?: string;
}): React.JSX.Element {
  if (tools.length === 0) {
    return <span className={cn('text-xs text-fg-muted', className)}>No tools</span>;
  }

  const allTools = Object.values(TOOL_GROUPS).flat();
  if (tools.length === allTools.length) {
    return <span className={cn('text-xs text-fg-muted', className)}>All tools</span>;
  }

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tools.slice(0, 4).map((tool) => (
        <span key={tool} className="rounded bg-surface-subtle px-1.5 py-0.5 text-xs text-fg-muted">
          {tool}
        </span>
      ))}
      {tools.length > 4 && (
        <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-xs text-fg-muted">
          +{tools.length - 4} more
        </span>
      )}
    </div>
  );
}
