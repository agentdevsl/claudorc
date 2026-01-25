import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Base node container styles - aligned with design system tokens
 */
export const baseNodeVariants = cva(
  [
    'flex items-center justify-center',
    'transition-all duration-[var(--duration-fast)]',
    'border',
  ].join(' '),
  {
    variants: {
      selected: {
        true: [
          'border-[var(--accent-fg)]',
          'ring-2 ring-[var(--accent-muted)]',
          'shadow-[var(--shadow-lg)]',
        ].join(' '),
        false: [
          'border-[var(--border-default)]',
          'shadow-[var(--shadow-sm)]',
          'hover:shadow-[var(--shadow-md)]',
          'hover:border-[var(--fg-subtle)]',
        ].join(' '),
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export type BaseNodeVariants = VariantProps<typeof baseNodeVariants>;

/**
 * Rectangle node styles (Skill, Context, Agent, Loop)
 * Sophisticated card-like appearance with subtle type indicators
 */
export const rectangleNodeVariants = cva(
  [
    'flex flex-col items-start gap-[var(--space-2)]',
    'px-[var(--space-4)] py-[var(--space-3)]',
    'min-w-[180px] max-w-[240px]',
    'rounded-[var(--radius-lg)]',
    'bg-[var(--bg-default)]',
    'transition-all duration-[var(--duration-fast)]',
    'border',
  ].join(' '),
  {
    variants: {
      selected: {
        true: [
          'border-[var(--accent-fg)]',
          'ring-2 ring-[var(--accent-muted)]',
          'shadow-[var(--shadow-lg)]',
          'bg-[var(--accent-subtle)]',
        ].join(' '),
        false: [
          'border-[var(--border-default)]',
          'shadow-[var(--shadow-sm)]',
          'hover:shadow-[var(--shadow-md)]',
          'hover:border-[var(--fg-subtle)]',
          'hover:bg-[var(--bg-subtle)]',
        ].join(' '),
      },
      nodeType: {
        skill: 'border-l-[3px] border-l-[var(--secondary-fg)]',
        context: 'border-l-[3px] border-l-[var(--attention-fg)]',
        agent: 'border-l-[3px] border-l-[var(--accent-fg)]',
        loop: 'border-l-[3px] border-l-[var(--done-fg)]',
      },
    },
    defaultVariants: {
      selected: false,
      nodeType: 'skill',
    },
  }
);

export type RectangleNodeVariants = VariantProps<typeof rectangleNodeVariants>;

/**
 * Diamond node styles (Conditional)
 */
export const diamondNodeVariants = cva(
  [
    'flex flex-col items-center justify-center gap-[var(--space-1)]',
    'w-[100px] h-[100px]',
    'rotate-45',
    'bg-[var(--bg-default)]',
    'transition-all duration-[var(--duration-fast)]',
    'border rounded-[var(--radius)]',
  ].join(' '),
  {
    variants: {
      selected: {
        true: [
          'border-[var(--accent-fg)]',
          'ring-2 ring-[var(--accent-muted)]',
          'shadow-[var(--shadow-lg)]',
        ].join(' '),
        false: [
          'border-[var(--border-default)]',
          'shadow-[var(--shadow-sm)]',
          'hover:shadow-[var(--shadow-md)]',
          'hover:border-[var(--fg-subtle)]',
        ].join(' '),
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export type DiamondNodeVariants = VariantProps<typeof diamondNodeVariants>;

/**
 * Pill node styles (Start, End)
 * Refined terminal node design with subtle gradients
 */
export const pillNodeVariants = cva(
  [
    'flex items-center justify-center gap-[var(--space-2)]',
    'px-[var(--space-6)] py-[var(--space-3)]',
    'min-w-[120px]',
    'rounded-[var(--radius-full)]',
    'transition-all duration-[var(--duration-fast)]',
    'border',
    'font-[var(--font-medium)] text-[var(--text-sm)]',
  ].join(' '),
  {
    variants: {
      selected: {
        true: 'ring-2 ring-offset-2 shadow-[var(--shadow-lg)]',
        false: 'shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]',
      },
      nodeType: {
        start: [
          'bg-[var(--success-emphasis)]',
          'text-[var(--fg-on-emphasis)]',
          'border-[var(--success-fg)]',
          'ring-[var(--success-muted)]',
        ].join(' '),
        end: [
          'bg-[var(--danger-emphasis)]',
          'text-[var(--fg-on-emphasis)]',
          'border-[var(--danger-fg)]',
          'ring-[var(--danger-muted)]',
        ].join(' '),
      },
    },
    compoundVariants: [
      {
        selected: false,
        nodeType: 'start',
        className: 'hover:bg-[var(--success-fg)]',
      },
      {
        selected: false,
        nodeType: 'end',
        className: 'hover:bg-[var(--danger-fg)]',
      },
    ],
    defaultVariants: {
      selected: false,
      nodeType: 'start',
    },
  }
);

export type PillNodeVariants = VariantProps<typeof pillNodeVariants>;

/**
 * Fork node styles (Parallel)
 */
export const forkNodeVariants = cva(
  [
    'flex flex-col items-center justify-center gap-[var(--space-2)]',
    'px-[var(--space-5)] py-[var(--space-3)]',
    'min-w-[140px]',
    'bg-[var(--bg-default)]',
    'transition-all duration-[var(--duration-fast)]',
    'border rounded-[var(--radius-lg)]',
    'border-l-[3px] border-l-[var(--done-fg)]',
  ].join(' '),
  {
    variants: {
      selected: {
        true: [
          'border-[var(--accent-fg)]',
          'ring-2 ring-[var(--accent-muted)]',
          'shadow-[var(--shadow-lg)]',
        ].join(' '),
        false: [
          'border-[var(--border-default)]',
          'shadow-[var(--shadow-sm)]',
          'hover:shadow-[var(--shadow-md)]',
          'hover:border-[var(--fg-subtle)]',
        ].join(' '),
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export type ForkNodeVariants = VariantProps<typeof forkNodeVariants>;

/**
 * Node icon styles - larger and more visually prominent
 */
export const nodeIconVariants = cva('text-[18px] select-none flex-shrink-0', {
  variants: {
    nodeType: {
      skill: 'text-[var(--secondary-fg)]',
      context: 'text-[var(--attention-fg)]',
      agent: 'text-[var(--accent-fg)]',
      loop: 'text-[var(--done-fg)]',
      conditional: 'text-[var(--fg-muted)]',
      parallel: 'text-[var(--done-fg)]',
      start: 'text-[var(--fg-on-emphasis)]',
      end: 'text-[var(--fg-on-emphasis)]',
    },
  },
  defaultVariants: {
    nodeType: 'skill',
  },
});

export type NodeIconVariants = VariantProps<typeof nodeIconVariants>;

/**
 * Node header row with icon and label
 */
export const nodeHeaderVariants = cva('flex items-center gap-[var(--space-2)] w-full');

/**
 * Node label styles - clear hierarchy
 */
export const nodeLabelVariants = cva(
  ['text-[var(--text-sm)] font-[var(--font-semibold)]', 'truncate max-w-[160px]'].join(' '),
  {
    variants: {
      nodeType: {
        skill: 'text-[var(--fg-default)]',
        context: 'text-[var(--fg-default)]',
        agent: 'text-[var(--fg-default)]',
        loop: 'text-[var(--fg-default)]',
        conditional: 'text-[var(--fg-default)]',
        parallel: 'text-[var(--fg-default)]',
        start: 'text-[var(--fg-on-emphasis)]',
        end: 'text-[var(--fg-on-emphasis)]',
      },
    },
    defaultVariants: {
      nodeType: 'skill',
    },
  }
);

export type NodeLabelVariants = VariantProps<typeof nodeLabelVariants>;

/**
 * Node AI summary/description styles
 */
export const nodeSummaryVariants = cva(
  ['text-[var(--text-xs)] text-[var(--fg-muted)]', 'line-clamp-2 leading-relaxed', 'w-full'].join(
    ' '
  )
);

/**
 * Node type badge styles
 */
export const nodeTypeBadgeVariants = cva(
  [
    'px-[var(--space-2)] py-[2px]',
    'rounded-[var(--radius-sm)]',
    'text-[10px] font-[var(--font-medium)] uppercase tracking-wider',
  ].join(' '),
  {
    variants: {
      nodeType: {
        skill: 'bg-[var(--secondary-subtle)] text-[var(--secondary-fg)]',
        context: 'bg-[var(--attention-subtle)] text-[var(--attention-fg)]',
        agent: 'bg-[var(--accent-subtle)] text-[var(--accent-fg)]',
        loop: 'bg-[var(--done-subtle)] text-[var(--done-fg)]',
        conditional: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
        parallel: 'bg-[var(--done-subtle)] text-[var(--done-fg)]',
      },
    },
    defaultVariants: {
      nodeType: 'skill',
    },
  }
);

export type NodeTypeBadgeVariants = VariantProps<typeof nodeTypeBadgeVariants>;

/**
 * Handle styles for connection points - refined appearance
 */
export const handleVariants = cva(
  [
    'w-[10px] h-[10px]',
    'rounded-full border-2',
    'bg-[var(--bg-default)]',
    'transition-all duration-[var(--duration-fast)]',
  ].join(' '),
  {
    variants: {
      type: {
        source: [
          'border-[var(--fg-subtle)]',
          'hover:border-[var(--accent-fg)]',
          'hover:bg-[var(--accent-muted)]',
          'hover:scale-125',
        ].join(' '),
        target: [
          'border-[var(--fg-subtle)]',
          'hover:border-[var(--accent-fg)]',
          'hover:bg-[var(--accent-muted)]',
          'hover:scale-125',
        ].join(' '),
      },
      connected: {
        true: 'bg-[var(--accent-fg)] border-[var(--accent-fg)]',
        false: 'bg-[var(--bg-default)]',
      },
    },
    defaultVariants: {
      type: 'source',
      connected: false,
    },
  }
);

export type HandleVariants = VariantProps<typeof handleVariants>;

/**
 * Agent handoff dot styles
 */
export const handoffDotVariants = cva(
  ['w-[6px] h-[6px]', 'rounded-full', 'bg-[var(--accent-fg)]', 'animate-pulse'].join(' '),
  {
    variants: {
      position: {
        left: 'absolute -left-[3px] top-1/2 -translate-y-1/2',
        right: 'absolute -right-[3px] top-1/2 -translate-y-1/2',
      },
    },
    defaultVariants: {
      position: 'left',
    },
  }
);

export type HandoffDotVariants = VariantProps<typeof handoffDotVariants>;
