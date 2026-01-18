import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Column container styles
 */
export const columnVariants = cva(
  'flex flex-col rounded-md border border-border bg-surface transition-all duration-150',
  {
    variants: {
      state: {
        default: '',
        dropTarget: 'border-accent bg-accent-muted',
        collapsed: 'w-12 min-w-12',
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
export const priorityVariants = cva('w-2 h-2 rounded-full shrink-0', {
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
