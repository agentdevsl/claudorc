import {
  ChatCircleText,
  FolderSimple,
  ListChecks,
  MagnifyingGlass,
  Robot,
  RocketLaunch,
  Warning,
  WifiSlash,
} from '@phosphor-icons/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

const emptyStateVariants = cva('flex flex-col items-center justify-center text-center', {
  variants: {
    size: {
      sm: 'gap-3 py-6',
      md: 'gap-4 py-8',
      lg: 'gap-6 py-12',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type EmptyStatePreset =
  | 'first-run'
  | 'no-projects'
  | 'no-tasks'
  | 'no-agents'
  | 'empty-session'
  | 'no-results'
  | 'error'
  | 'offline';

interface EmptyStateProps extends VariantProps<typeof emptyStateVariants> {
  preset?: EmptyStatePreset;
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const PRESETS: Record<
  EmptyStatePreset,
  {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle: string;
  }
> = {
  'first-run': {
    icon: RocketLaunch,
    title: 'Welcome to AgentPane',
    subtitle: 'Get started by creating your first project',
  },
  'no-projects': {
    icon: FolderSimple,
    title: 'No projects yet',
    subtitle: 'Create a project to start managing tasks',
  },
  'no-tasks': {
    icon: ListChecks,
    title: 'No tasks in this column',
    subtitle: 'Create a task or drag one here',
  },
  'no-agents': {
    icon: Robot,
    title: 'No agents configured',
    subtitle: 'Add an agent to start automating tasks',
  },
  'empty-session': {
    icon: ChatCircleText,
    title: 'No session activity',
    subtitle: 'Agent output will appear here',
  },
  'no-results': {
    icon: MagnifyingGlass,
    title: 'No results found',
    subtitle: 'Try adjusting your search or filters',
  },
  error: {
    icon: Warning,
    title: 'Something went wrong',
    subtitle: 'Please try again or contact support',
  },
  offline: {
    icon: WifiSlash,
    title: "You're offline",
    subtitle: 'Check your connection and try again',
  },
};

export function EmptyState({
  preset,
  icon,
  title,
  subtitle,
  action,
  size,
  className,
}: EmptyStateProps): React.JSX.Element {
  const presetConfig = preset ? PRESETS[preset] : undefined;
  const Icon = icon ?? presetConfig?.icon ?? FolderSimple;
  const displayTitle = title ?? presetConfig?.title ?? 'Nothing here';
  const displaySubtitle = subtitle ?? presetConfig?.subtitle ?? '';

  return (
    <div className={cn(emptyStateVariants({ size }), className)}>
      <div className="rounded-full border border-border bg-surface-muted p-4">
        <Icon className="h-8 w-8 text-fg-muted" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-fg">{displayTitle}</h3>
        <p className="text-sm text-fg-muted max-w-sm">{displaySubtitle}</p>
      </div>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
