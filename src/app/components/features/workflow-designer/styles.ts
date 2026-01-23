import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Node container styles for workflow canvas
 * Using design system tokens for consistent appearance
 */
export const nodeVariants = cva(
  'rounded-[var(--radius)] border bg-[var(--bg-default)] shadow-[var(--shadow-sm)] transition-all duration-[var(--duration-fast)]',
  {
    variants: {
      state: {
        default:
          'border-[var(--border-default)] hover:border-[var(--fg-subtle)] hover:shadow-[var(--shadow-md)]',
        selected:
          'border-[var(--accent-fg)] bg-[var(--accent-subtle)] shadow-[var(--shadow-md)] ring-2 ring-[var(--accent-muted)]',
        executing: 'border-[var(--attention-fg)] bg-[var(--attention-subtle)] animate-pulse',
        completed: 'border-[var(--success-fg)] bg-[var(--success-subtle)]',
        error: 'border-[var(--danger-fg)] bg-[var(--danger-subtle)]',
        disabled: 'border-[var(--border-muted)] bg-[var(--bg-muted)] opacity-60',
      },
      type: {
        trigger: 'border-l-[3px] border-l-[var(--secondary-fg)]',
        action: 'border-l-[3px] border-l-[var(--accent-fg)]',
        condition: 'border-l-[3px] border-l-[var(--attention-fg)]',
        loop: 'border-l-[3px] border-l-[var(--done-fg)]',
        output: 'border-l-[3px] border-l-[var(--success-fg)]',
      },
    },
    defaultVariants: {
      state: 'default',
      type: 'action',
    },
  }
);

export type NodeVariants = VariantProps<typeof nodeVariants>;

/**
 * Edge styles for workflow connections
 */
export const edgeVariants = cva('transition-all duration-[var(--duration-fast)]', {
  variants: {
    state: {
      default: 'stroke-[var(--border-default)]',
      selected: 'stroke-[var(--accent-fg)] stroke-2',
      animated: 'stroke-[var(--attention-fg)] animate-pulse',
      success: 'stroke-[var(--success-fg)]',
      error: 'stroke-[var(--danger-fg)]',
      disabled: 'stroke-[var(--border-muted)] opacity-40',
    },
    type: {
      default: '',
      conditional: 'stroke-dasharray-4',
      loop: 'stroke-dasharray-2',
    },
  },
  defaultVariants: {
    state: 'default',
    type: 'default',
  },
});

export type EdgeVariants = VariantProps<typeof edgeVariants>;

/**
 * Toolbar container styles - refined floating panel
 */
export const toolbarVariants = cva(
  [
    'flex items-center gap-[var(--space-2)]',
    'rounded-[var(--radius-lg)] border border-[var(--border-default)]',
    'bg-[var(--bg-default)]/95 backdrop-blur-md',
    'p-[var(--space-2)] shadow-[var(--shadow-lg)]',
  ].join(' '),
  {
    variants: {
      position: {
        top: 'absolute top-[var(--space-4)] left-1/2 -translate-x-1/2 z-10',
        bottom: 'absolute bottom-[var(--space-4)] left-1/2 -translate-x-1/2 z-10',
        floating: 'fixed z-50',
      },
      size: {
        default: 'h-12',
        compact: 'h-10',
      },
    },
    defaultVariants: {
      position: 'top',
      size: 'default',
    },
  }
);

export type ToolbarVariants = VariantProps<typeof toolbarVariants>;

/**
 * Canvas container styles - clean minimal background (no grid dots)
 */
export const canvasVariants = cva(
  [
    'relative w-full h-full',
    'bg-[var(--bg-canvas)]',
    // Custom edge styling with design system colors
    '[&_.react-flow__edge-path]:stroke-[var(--border-default)]',
    '[&_.react-flow__edge-path]:stroke-[2px]',
    '[&_.react-flow__edge.selected_.react-flow__edge-path]:stroke-[var(--accent-fg)]',
    '[&_.react-flow__edge.selected_.react-flow__edge-path]:stroke-[2.5px]',
    // Connection line styling
    '[&_.react-flow__connection-line]:stroke-[var(--accent-fg)]',
    '[&_.react-flow__connection-line]:stroke-2',
    '[&_.react-flow__connection-line]:stroke-dasharray-4',
    // Handle styling
    '[&_.react-flow__handle]:bg-[var(--bg-muted)]',
    '[&_.react-flow__handle]:border-[var(--border-default)]',
    '[&_.react-flow__handle]:border-2',
    '[&_.react-flow__handle:hover]:bg-[var(--accent-fg)]',
    '[&_.react-flow__handle:hover]:border-[var(--accent-fg)]',
    // Attribution removal (pro license)
    '[&_.react-flow__attribution]:hidden',
    // Pane background
    '[&_.react-flow__pane]:bg-[var(--bg-canvas)]',
  ].join(' '),
  {
    variants: {
      state: {
        default: '',
        loading: 'bg-[var(--bg-muted)]',
        dragging: 'cursor-grabbing',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

export type CanvasVariants = VariantProps<typeof canvasVariants>;

/**
 * Toolbar button group styles
 */
export const toolbarGroupVariants = cva('flex items-center', {
  variants: {
    separated: {
      true: 'border-l border-[var(--border-default)] pl-[var(--space-2)] ml-[var(--space-2)]',
      false: 'gap-[var(--space-1)]',
    },
  },
  defaultVariants: {
    separated: false,
  },
});

/**
 * Sidebar panel styles for template picker and node inspector
 */
export const sidebarPanelVariants = cva(
  [
    'flex flex-col h-full',
    'bg-[var(--bg-default)] border-[var(--border-default)]',
    'transition-all duration-[var(--duration-normal)]',
  ].join(' '),
  {
    variants: {
      side: {
        left: 'border-r',
        right: 'border-l',
      },
      collapsed: {
        true: 'w-0 overflow-hidden opacity-0',
        false: 'opacity-100',
      },
    },
    defaultVariants: {
      side: 'left',
      collapsed: false,
    },
  }
);

export type SidebarPanelVariants = VariantProps<typeof sidebarPanelVariants>;

/**
 * Panel header styles
 */
export const panelHeaderVariants = cva(
  [
    'flex items-center justify-between',
    'px-[var(--space-4)] py-[var(--space-3)]',
    'border-b border-[var(--border-default)]',
    'bg-[var(--bg-subtle)]',
  ].join(' ')
);

/**
 * Template card styles for the picker
 */
export const templateCardVariants = cva(
  [
    'group relative flex flex-col gap-[var(--space-2)]',
    'p-[var(--space-3)] rounded-[var(--radius)]',
    'border border-[var(--border-default)]',
    'bg-[var(--bg-default)]',
    'transition-all duration-[var(--duration-fast)]',
    'cursor-pointer',
  ].join(' '),
  {
    variants: {
      selected: {
        true: [
          'border-[var(--accent-fg)] bg-[var(--accent-subtle)]',
          'ring-1 ring-[var(--accent-muted)]',
        ].join(' '),
        false: [
          'hover:border-[var(--fg-subtle)]',
          'hover:bg-[var(--bg-subtle)]',
          'hover:shadow-[var(--shadow-sm)]',
        ].join(' '),
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export type TemplateCardVariants = VariantProps<typeof templateCardVariants>;

/**
 * Inspector field styles
 */
export const inspectorFieldVariants = cva(
  [
    'flex flex-col gap-[var(--space-1)]',
    'py-[var(--space-2)]',
    'border-b border-[var(--border-subtle)]',
    'last:border-b-0',
  ].join(' ')
);

/**
 * Inspector field label
 */
export const inspectorLabelVariants = cva(
  'text-[var(--text-xs)] font-medium text-[var(--fg-muted)] uppercase tracking-wide'
);

/**
 * Inspector field value
 */
export const inspectorValueVariants = cva('text-[var(--text-sm)] text-[var(--fg-default)]');

export type ToolbarGroupVariants = VariantProps<typeof toolbarGroupVariants>;
