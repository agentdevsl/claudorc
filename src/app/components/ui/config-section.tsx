import type { Icon } from '@phosphor-icons/react';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ConfigSectionProps {
  icon: Icon;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: 'accent' | 'success' | 'claude';
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}

/**
 * Collapsible section component with smooth animation
 * Used across settings pages for consistent UI
 */
export function ConfigSection({
  icon: IconComponent,
  title,
  description,
  badge,
  badgeColor = 'accent',
  children,
  defaultOpen = true,
  testId,
}: ConfigSectionProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const badgeColors = {
    accent: 'bg-accent-muted text-accent',
    success: 'bg-success-muted text-success',
    claude: 'bg-claude-muted text-claude',
  };

  return (
    <div
      data-testid={testId}
      className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-surface to-surface/50 transition-all duration-300 hover:border-fg-subtle/30"
    >
      {/* Subtle gradient accent line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-subtle/50"
      >
        {/* Icon container with gradient background */}
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-surface-emphasis to-surface-muted ring-1 ring-border/50">
          <IconComponent className="h-5 w-5 text-fg-muted" weight="duotone" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
            {badge && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                  badgeColors[badgeColor]
                )}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-fg-muted">{description}</p>
        </div>

        {/* Expand/collapse indicator */}
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200',
            isOpen ? 'rotate-180 bg-accent-muted' : 'bg-surface-emphasis'
          )}
        >
          <svg
            aria-hidden="true"
            className={cn('h-4 w-4 transition-colors', isOpen ? 'text-accent' : 'text-fg-muted')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible content */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/50 px-6 pb-6 pt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
