import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils/cn';

// ==========================================
// Base Skeleton Component with CVA Variants
// ==========================================

export const skeletonVariants = cva('relative overflow-hidden bg-[var(--bg-muted)]', {
  variants: {
    variant: {
      text: 'rounded-[var(--radius-sm)]',
      circular: 'rounded-full',
      rectangular: 'rounded-[var(--radius)]',
    },
    animation: {
      shimmer: 'animate-shimmer',
      pulse: 'animate-pulse',
      none: '',
    },
  },
  defaultVariants: {
    variant: 'text',
    animation: 'shimmer',
  },
});

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /** Width in pixels or CSS value */
  width?: number | string;
  /** Height in pixels or CSS value */
  height?: number | string;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant, animation, width, height, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant, animation }), className)}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          ...style,
        }}
        aria-hidden="true"
        {...props}
      />
    );
  }
);
Skeleton.displayName = 'Skeleton';

// ==========================================
// SkeletonText - Multi-line text patterns
// ==========================================

export interface SkeletonTextProps extends VariantProps<typeof skeletonVariants> {
  /** Number of lines to display */
  lines?: number;
  /** Width of the last line (percentage or 'random') */
  lastLineWidth?: number | 'random';
  /** Gap between lines in pixels */
  gap?: number;
  /** Height of each line in pixels */
  lineHeight?: number;
  /** Additional class names */
  className?: string;
}

export function SkeletonText({
  lines = 1,
  lastLineWidth = 75,
  gap = 8,
  lineHeight = 16,
  animation,
  className,
}: SkeletonTextProps): React.JSX.Element {
  // Generate stable widths for random mode (avoid hydration mismatch)
  const widths = React.useMemo(() => {
    return Array.from({ length: lines }).map((_, i) => {
      const isLast = i === lines - 1;
      if (!isLast) return '100%';
      if (lastLineWidth === 'random') {
        // Use a deterministic pattern based on index for SSR compatibility
        const baseWidths = [60, 75, 50, 80, 65];
        return `${baseWidths[i % baseWidths.length]}%`;
      }
      return `${lastLineWidth}%`;
    });
  }, [lines, lastLineWidth]);

  return (
    <div className={cn('flex flex-col', className)} style={{ gap }}>
      {widths.map((width, i) => (
        <Skeleton key={i} variant="text" animation={animation} height={lineHeight} width={width} />
      ))}
    </div>
  );
}
SkeletonText.displayName = 'SkeletonText';

// ==========================================
// SkeletonAvatar - Circular avatar skeleton
// ==========================================

export interface SkeletonAvatarProps extends VariantProps<typeof skeletonVariants> {
  /** Size preset or custom pixels */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Additional class names */
  className?: string;
}

const AVATAR_SIZES = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
} as const;

export function SkeletonAvatar({
  size = 'md',
  animation,
  className,
}: SkeletonAvatarProps): React.JSX.Element {
  const pixels = typeof size === 'number' ? size : AVATAR_SIZES[size];

  return (
    <Skeleton
      variant="circular"
      animation={animation}
      width={pixels}
      height={pixels}
      className={className}
    />
  );
}
SkeletonAvatar.displayName = 'SkeletonAvatar';

// ==========================================
// SkeletonCard - Card with header, body, footer
// ==========================================

export interface SkeletonCardProps extends VariantProps<typeof skeletonVariants> {
  /** Show image placeholder at top */
  showImage?: boolean;
  /** Image aspect ratio */
  imageAspectRatio?: string;
  /** Number of description lines */
  descriptionLines?: number;
  /** Show footer with avatar and meta */
  showFooter?: boolean;
  /** Additional class names */
  className?: string;
}

export function SkeletonCard({
  showImage = true,
  imageAspectRatio = '16/9',
  descriptionLines = 2,
  showFooter = true,
  animation,
  className,
}: SkeletonCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-default)] overflow-hidden',
        className
      )}
    >
      {/* Image placeholder */}
      {showImage && (
        <Skeleton
          variant="rectangular"
          animation={animation}
          className="w-full rounded-none"
          style={{ aspectRatio: imageAspectRatio }}
        />
      )}

      {/* Content area */}
      <div className="p-[var(--space-4)] space-y-[var(--space-3)]">
        {/* Title */}
        <Skeleton variant="text" animation={animation} height={20} width="70%" />

        {/* Description lines */}
        <SkeletonText
          lines={descriptionLines}
          lastLineWidth={85}
          lineHeight={14}
          animation={animation}
        />

        {/* Footer */}
        {showFooter && (
          <div className="flex items-center justify-between pt-[var(--space-2)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <SkeletonAvatar size="sm" animation={animation} />
              <Skeleton variant="text" animation={animation} width={80} height={12} />
            </div>
            <SkeletonBadge width={56} animation={animation} />
          </div>
        )}
      </div>
    </div>
  );
}
SkeletonCard.displayName = 'SkeletonCard';

// ==========================================
// SkeletonTable - Table rows with columns
// ==========================================

export interface SkeletonTableProps extends VariantProps<typeof skeletonVariants> {
  /** Number of columns */
  columns?: number;
  /** Number of data rows */
  rows?: number;
  /** Show header row */
  showHeader?: boolean;
  /** Column widths as percentages (should sum to ~100) */
  columnWidths?: number[];
  /** Additional class names */
  className?: string;
}

export function SkeletonTable({
  columns = 4,
  rows = 5,
  showHeader = true,
  columnWidths,
  animation,
  className,
}: SkeletonTableProps): React.JSX.Element {
  const widths = columnWidths ?? Array(columns).fill(100 / columns);

  // Pre-generate row cell widths for consistent rendering
  const rowCellWidths = React.useMemo(() => {
    const patterns = [0.8, 0.6, 0.9, 0.7, 0.85] as const;
    return Array.from({ length: rows }).map((_, rowIdx) =>
      widths.map((width, colIdx) => {
        const patternIndex = (rowIdx + colIdx) % patterns.length;
        const factor = patterns[patternIndex] ?? 0.8;
        return width * factor;
      })
    );
  }, [rows, widths]);

  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--border-default)] overflow-hidden',
        className
      )}
    >
      {/* Header row */}
      {showHeader && (
        <div className="flex gap-[var(--space-4)] p-[var(--space-3)] bg-[var(--bg-subtle)] border-b border-[var(--border-default)]">
          {widths.map((width, i) => (
            <Skeleton
              key={i}
              variant="text"
              animation={animation}
              height={14}
              width={`${width}%`}
              className="shrink-0"
            />
          ))}
        </div>
      )}

      {/* Data rows */}
      {rowCellWidths.map((cellWidths, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'flex gap-[var(--space-4)] p-[var(--space-3)]',
            rowIndex < rows - 1 && 'border-b border-[var(--border-muted)]'
          )}
        >
          {cellWidths.map((width, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              animation={animation}
              height={14}
              width={`${width}%`}
              className="shrink-0"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
SkeletonTable.displayName = 'SkeletonTable';

// ==========================================
// SkeletonBadge - Pill-shaped badge placeholder
// ==========================================

export interface SkeletonBadgeProps extends VariantProps<typeof skeletonVariants> {
  /** Width of badge in pixels */
  width?: number;
  /** Additional class names */
  className?: string;
}

export function SkeletonBadge({
  width = 48,
  animation,
  className,
}: SkeletonBadgeProps): React.JSX.Element {
  return (
    <Skeleton
      variant="text"
      animation={animation}
      width={width}
      height={20}
      className={cn('rounded-full', className)}
    />
  );
}
SkeletonBadge.displayName = 'SkeletonBadge';

// ==========================================
// SkeletonButton - Button placeholder
// ==========================================

export interface SkeletonButtonProps extends VariantProps<typeof skeletonVariants> {
  /** Button size variant */
  size?: 'sm' | 'default' | 'lg' | 'icon';
  /** Button width (overrides default) */
  width?: number | string;
  /** Additional class names */
  className?: string;
}

const BUTTON_HEIGHTS = {
  sm: 32,
  default: 36,
  lg: 40,
  icon: 36,
} as const;

const BUTTON_WIDTHS = {
  sm: 64,
  default: 80,
  lg: 96,
  icon: 36,
} as const;

export function SkeletonButton({
  size = 'default',
  width,
  animation,
  className,
}: SkeletonButtonProps): React.JSX.Element {
  return (
    <Skeleton
      variant="rectangular"
      animation={animation}
      height={BUTTON_HEIGHTS[size]}
      width={width ?? BUTTON_WIDTHS[size]}
      className={className}
    />
  );
}
SkeletonButton.displayName = 'SkeletonButton';

// ==========================================
// SkeletonImage - Image placeholder with aspect ratio
// ==========================================

export interface SkeletonImageProps extends VariantProps<typeof skeletonVariants> {
  /** Width in pixels or CSS value */
  width?: number | string;
  /** Height in pixels or CSS value (or use aspectRatio) */
  height?: number | string;
  /** Aspect ratio (e.g., '16/9', '4/3', '1/1') */
  aspectRatio?: string;
  /** Border radius preset */
  radius?: 'sm' | 'md' | 'lg' | 'full';
  /** Additional class names */
  className?: string;
}

const RADIUS_MAP = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius)',
  lg: 'var(--radius-lg)',
  full: 'var(--radius-full)',
} as const;

export function SkeletonImage({
  width = '100%',
  height,
  aspectRatio,
  radius = 'md',
  animation,
  className,
}: SkeletonImageProps): React.JSX.Element {
  return (
    <Skeleton
      variant="rectangular"
      animation={animation}
      width={width}
      height={height}
      className={className}
      style={{
        aspectRatio,
        borderRadius: RADIUS_MAP[radius],
      }}
    />
  );
}
SkeletonImage.displayName = 'SkeletonImage';

// ==========================================
// SkeletonListItem - List item with avatar and text
// ==========================================

export interface SkeletonListItemProps extends VariantProps<typeof skeletonVariants> {
  /** Show leading avatar */
  showAvatar?: boolean;
  /** Avatar size */
  avatarSize?: 'sm' | 'md' | 'lg';
  /** Show secondary text line */
  showSecondary?: boolean;
  /** Show trailing metadata */
  showMeta?: boolean;
  /** Additional class names */
  className?: string;
}

export function SkeletonListItem({
  showAvatar = true,
  avatarSize = 'md',
  showSecondary = true,
  showMeta = true,
  animation,
  className,
}: SkeletonListItemProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-[var(--space-3)] p-[var(--space-3)] rounded-[var(--radius)] border border-[var(--border-default)] bg-[var(--bg-default)]',
        className
      )}
    >
      {/* Avatar */}
      {showAvatar && <SkeletonAvatar size={avatarSize} animation={animation} />}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-[var(--space-2)]">
        <Skeleton variant="text" animation={animation} height={16} width="60%" />
        {showSecondary && <Skeleton variant="text" animation={animation} height={12} width="40%" />}
      </div>

      {/* Meta */}
      {showMeta && (
        <div className="flex items-center gap-[var(--space-2)] shrink-0">
          <Skeleton variant="text" animation={animation} width={60} height={12} />
        </div>
      )}
    </div>
  );
}
SkeletonListItem.displayName = 'SkeletonListItem';
