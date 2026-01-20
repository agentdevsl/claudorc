import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Column container styles
 */
export const columnVariants = cva(
  'flex flex-col rounded-md border-2 border-border bg-surface transition-all duration-200',
  {
    variants: {
      state: {
        default: 'border-transparent',
        dropTarget: 'bg-primary/5 border-primary/20 shadow-inner',
        collapsed: 'w-12 min-w-12 border-transparent',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

export type ColumnVariants = VariantProps<typeof columnVariants>;

/**
 * Card container styles
 */
export const cardVariants = cva(
  'rounded-md border bg-surface p-3 cursor-grab transition-all duration-150',
  {
    variants: {
      state: {
        default: 'border-border hover:border-fg-subtle',
        selected: 'border-accent bg-accent-muted',
        dragging: 'opacity-40 cursor-grabbing',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

export type CardVariants = VariantProps<typeof cardVariants>;

/**
 * Priority indicator styles
 */
export const priorityVariants = cva('w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10', {
  variants: {
    priority: {
      high: 'bg-danger',
      medium: 'bg-attention',
      low: 'bg-success',
    },
  },
  defaultVariants: {
    priority: 'medium',
  },
});

export type PriorityVariants = VariantProps<typeof priorityVariants>;

/**
 * Label pill styles
 */
export const labelVariants = cva(
  'text-xs font-medium px-2 py-0.5 rounded-full uppercase tracking-wider',
  {
    variants: {
      type: {
        bug: 'bg-danger-muted text-danger',
        feature: 'bg-done-muted text-done',
        enhancement: 'bg-accent-muted text-accent',
        docs: 'bg-attention-muted text-attention',
        default: 'bg-surface-muted text-fg-muted',
      },
    },
    defaultVariants: {
      type: 'default',
    },
  }
);

export type LabelVariants = VariantProps<typeof labelVariants>;

/**
 * Column indicator bar styles
 */
export const indicatorVariants = cva('w-[3px] h-[14px] rounded-sm', {
  variants: {
    column: {
      backlog: 'bg-fg-muted',
      queued: 'bg-secondary',
      in_progress: 'bg-attention',
      waiting_approval: 'bg-accent',
      verified: 'bg-success',
    },
  },
  defaultVariants: {
    column: 'backlog',
  },
});

export type IndicatorVariants = VariantProps<typeof indicatorVariants>;

/**
 * Agent status badge styles
 */
export const agentStatusVariants = cva('flex items-center gap-1.5 px-2 py-1 rounded text-xs mt-2', {
  variants: {
    status: {
      running: 'bg-attention-muted text-attention',
      paused: 'bg-accent-muted text-accent',
      idle: 'bg-surface-muted text-fg-muted',
    },
  },
  defaultVariants: {
    status: 'idle',
  },
});

export type AgentStatusVariants = VariantProps<typeof agentStatusVariants>;

/**
 * Task mode badge styles
 */
export const modeBadgeVariants = cva(
  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
  {
    variants: {
      mode: {
        plan: 'bg-secondary-muted text-secondary',
        implement: 'bg-accent-muted text-accent',
      },
    },
    defaultVariants: {
      mode: 'implement',
    },
  }
);

export type ModeBadgeVariants = VariantProps<typeof modeBadgeVariants>;
