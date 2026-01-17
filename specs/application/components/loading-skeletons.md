# Loading Skeleton Patterns Specification

AgentPane loading skeleton components for perceived performance and layout stability during data fetching. This specification defines the skeleton system aligned with the GitHub dark theme design tokens and animation system.

**Related Specifications:**

- [Component Patterns](../implementation/component-patterns.md) - Base UI components
- [Animation System](../implementation/animation-system.md) - Timing and easing
- [Design Tokens](../wireframes/design-tokens.css) - Color system

---

## 1. Component Overview

### Purpose

Loading skeletons are placeholder UI elements that maintain the visual structure of content during asynchronous data loading. They provide users with an immediate preview of the interface layout, reducing perceived load time and preventing jarring layout shifts.

### Benefits Over Spinners

| Spinners | Skeletons |
|----------|-----------|
| Generic, disconnected from content | Contextual, matches expected content |
| Causes layout shift when content loads | Maintains layout stability |
| No preview of content structure | Shows expected content shape |
| Perceived as "waiting" | Perceived as "loading content" |
| Single element | Distributed across layout |

### When to Use Skeletons vs Spinners

| Use Skeletons | Use Spinners |
|---------------|--------------|
| Page or section initial load | Brief operations (< 300ms) |
| Content with known structure | Indeterminate progress |
| Lists, cards, tables | Background actions |
| Data fetching with network latency | Form submissions |
| Suspense boundaries | Button loading states |
| Server-side rendering hydration | Small inline indicators |

---

## 2. Base Skeleton Component

### Interface Definition

```typescript
// app/components/ui/skeleton.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const skeletonVariants = cva(
  'animate-skeleton bg-muted relative overflow-hidden',
  {
    variants: {
      variant: {
        text: 'rounded-[4px]',
        circular: 'rounded-full',
        rectangular: 'rounded-[6px]',
      },
      animation: {
        shimmer: 'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-[rgba(255,255,255,0.08)] before:to-transparent',
        pulse: 'animate-pulse',
        none: '',
      },
    },
    defaultVariants: {
      variant: 'text',
      animation: 'shimmer',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  /** Width in pixels or CSS value */
  width?: number | string;
  /** Height in pixels or CSS value */
  height?: number | string;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className,
      variant,
      animation,
      width,
      height,
      style,
      ...props
    },
    ref
  ) => {
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
```

### Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number \| string` | `'100%'` | Width in pixels or CSS value |
| `height` | `number \| string` | `'1em'` | Height in pixels or CSS value |
| `variant` | `'text' \| 'circular' \| 'rectangular'` | `'text'` | Shape variant |
| `animation` | `'shimmer' \| 'pulse' \| 'none'` | `'shimmer'` | Animation type |
| `className` | `string` | - | Additional CSS classes |

### Animation Timing

| Property | Value | Description |
|----------|-------|-------------|
| Duration | `1.5s` | Full shimmer cycle |
| Easing | `ease-in-out` | Smooth acceleration/deceleration |
| Iteration | `infinite` | Continuous animation |

---

## 3. Primitive Skeletons

### SkeletonText

Text placeholder with single or multi-line options.

```typescript
// app/components/ui/skeleton-text.tsx
export interface SkeletonTextProps {
  /** Number of lines to display */
  lines?: number;
  /** Width of the last line (percentage or 'random') */
  lastLineWidth?: number | 'random';
  /** Gap between lines in pixels */
  gap?: number;
  /** Height of each line */
  lineHeight?: number;
}

export function SkeletonText({
  lines = 1,
  lastLineWidth = 75,
  gap = 8,
  lineHeight = 16,
}: SkeletonTextProps) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1;
        const width = isLast
          ? lastLineWidth === 'random'
            ? `${50 + Math.random() * 40}%`
            : `${lastLineWidth}%`
          : '100%';

        return (
          <Skeleton
            key={i}
            variant="text"
            height={lineHeight}
            width={width}
          />
        );
      })}
    </div>
  );
}
```

**Usage:**

```tsx
// Single line
<SkeletonText />

// Multi-line paragraph
<SkeletonText lines={3} lastLineWidth={60} />

// With custom line height
<SkeletonText lines={2} lineHeight={14} gap={6} />
```

### SkeletonAvatar

Circular avatar placeholder in standard sizes.

```typescript
// app/components/ui/skeleton-avatar.tsx
export interface SkeletonAvatarProps {
  /** Size preset or custom pixels */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
}

const AVATAR_SIZES = {
  sm: 24,
  md: 32,
  lg: 40,
  xl: 48,
};

export function SkeletonAvatar({ size = 'md' }: SkeletonAvatarProps) {
  const pixels = typeof size === 'number' ? size : AVATAR_SIZES[size];

  return (
    <Skeleton
      variant="circular"
      width={pixels}
      height={pixels}
    />
  );
}
```

**Sizes:**

| Size | Pixels | Use Case |
|------|--------|----------|
| `sm` | 24px | Inline mentions, compact lists |
| `md` | 32px | List items, cards |
| `lg` | 40px | Presence indicators |
| `xl` | 48px | Profile headers |

### SkeletonButton

Button placeholder matching design system button sizes.

```typescript
// app/components/ui/skeleton-button.tsx
export interface SkeletonButtonProps {
  /** Button size variant */
  size?: 'sm' | 'default' | 'lg' | 'icon';
  /** Button width */
  width?: number | string;
}

const BUTTON_HEIGHTS = {
  sm: 32,
  default: 36,
  lg: 40,
  icon: 36,
};

const BUTTON_WIDTHS = {
  sm: 64,
  default: 80,
  lg: 96,
  icon: 36,
};

export function SkeletonButton({ size = 'default', width }: SkeletonButtonProps) {
  return (
    <Skeleton
      variant="rectangular"
      height={BUTTON_HEIGHTS[size]}
      width={width ?? BUTTON_WIDTHS[size]}
    />
  );
}
```

### SkeletonBadge

Pill-shaped badge placeholder.

```typescript
// app/components/ui/skeleton-badge.tsx
export interface SkeletonBadgeProps {
  /** Width of badge */
  width?: number;
}

export function SkeletonBadge({ width = 48 }: SkeletonBadgeProps) {
  return (
    <Skeleton
      variant="text"
      width={width}
      height={20}
      className="rounded-full"
    />
  );
}
```

### SkeletonImage

Image placeholder with aspect ratio preservation.

```typescript
// app/components/ui/skeleton-image.tsx
export interface SkeletonImageProps {
  /** Width in pixels */
  width?: number | string;
  /** Height in pixels (or use aspectRatio) */
  height?: number | string;
  /** Aspect ratio (e.g., '16/9', '4/3', '1/1') */
  aspectRatio?: string;
  /** Border radius */
  radius?: 'sm' | 'md' | 'lg' | 'full';
}

const RADIUS_MAP = {
  sm: '4px',
  md: '6px',
  lg: '12px',
  full: '9999px',
};

export function SkeletonImage({
  width = '100%',
  height,
  aspectRatio,
  radius = 'md',
}: SkeletonImageProps) {
  return (
    <Skeleton
      variant="rectangular"
      width={width}
      height={height}
      style={{
        aspectRatio: aspectRatio,
        borderRadius: RADIUS_MAP[radius],
      }}
    />
  );
}
```

---

## 4. Composite Skeletons

### SkeletonCard

Generic card layout skeleton with image, title, and description.

```typescript
// app/components/ui/skeleton-card.tsx
export interface SkeletonCardProps {
  /** Show image placeholder */
  showImage?: boolean;
  /** Image aspect ratio */
  imageAspectRatio?: string;
  /** Number of description lines */
  descriptionLines?: number;
  /** Show footer actions */
  showFooter?: boolean;
}

export function SkeletonCard({
  showImage = true,
  imageAspectRatio = '16/9',
  descriptionLines = 2,
  showFooter = true,
}: SkeletonCardProps) {
  return (
    <div className="rounded-[6px] border border-[#30363d] bg-[#161b22] overflow-hidden">
      {/* Image */}
      {showImage && (
        <SkeletonImage
          aspectRatio={imageAspectRatio}
          radius="sm"
          className="rounded-none"
        />
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton variant="text" height={20} width="70%" />

        {/* Description */}
        <SkeletonText lines={descriptionLines} lastLineWidth={85} lineHeight={14} />

        {/* Footer */}
        {showFooter && (
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <SkeletonAvatar size="sm" />
              <Skeleton variant="text" width={80} height={12} />
            </div>
            <SkeletonBadge width={56} />
          </div>
        )}
      </div>
    </div>
  );
}
```

### SkeletonListItem

List item with avatar, text, and metadata.

```typescript
// app/components/ui/skeleton-list-item.tsx
export interface SkeletonListItemProps {
  /** Show leading avatar */
  showAvatar?: boolean;
  /** Avatar size */
  avatarSize?: 'sm' | 'md' | 'lg';
  /** Show secondary text line */
  showSecondary?: boolean;
  /** Show trailing metadata */
  showMeta?: boolean;
}

export function SkeletonListItem({
  showAvatar = true,
  avatarSize = 'md',
  showSecondary = true,
  showMeta = true,
}: SkeletonListItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-[6px] border border-[#30363d] bg-[#161b22]">
      {/* Avatar */}
      {showAvatar && <SkeletonAvatar size={avatarSize} />}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton variant="text" height={16} width="60%" />
        {showSecondary && (
          <Skeleton variant="text" height={12} width="40%" />
        )}
      </div>

      {/* Meta */}
      {showMeta && (
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton variant="text" width={60} height={12} />
        </div>
      )}
    </div>
  );
}
```

### SkeletonTable

Table skeleton with configurable rows and columns.

```typescript
// app/components/ui/skeleton-table.tsx
export interface SkeletonTableProps {
  /** Number of columns */
  columns?: number;
  /** Number of rows */
  rows?: number;
  /** Show header row */
  showHeader?: boolean;
  /** Column widths (percentages) */
  columnWidths?: number[];
}

export function SkeletonTable({
  columns = 4,
  rows = 5,
  showHeader = true,
  columnWidths,
}: SkeletonTableProps) {
  const widths = columnWidths ?? Array(columns).fill(100 / columns);

  return (
    <div className="rounded-[6px] border border-[#30363d] overflow-hidden">
      {/* Header */}
      {showHeader && (
        <div className="flex gap-4 p-3 bg-[#1c2128] border-b border-[#30363d]">
          {widths.map((width, i) => (
            <Skeleton
              key={i}
              variant="text"
              height={14}
              width={`${width}%`}
              className="shrink-0"
            />
          ))}
        </div>
      )}

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={cn(
            'flex gap-4 p-3',
            rowIndex < rows - 1 && 'border-b border-[#21262d]'
          )}
        >
          {widths.map((width, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              height={14}
              width={`${width * (0.6 + Math.random() * 0.4)}%`}
              className="shrink-0"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### SkeletonKanbanCard

Matches the KanbanCard layout from the Kanban board specification.

```typescript
// app/components/views/kanban-board/skeletons/skeleton-kanban-card.tsx
export function SkeletonKanbanCard() {
  return (
    <div className="rounded-[6px] border border-[#30363d] bg-[#1c2128] p-3 space-y-2">
      {/* Labels */}
      <div className="flex flex-wrap gap-1.5">
        <SkeletonBadge width={52} />
        <SkeletonBadge width={64} />
      </div>

      {/* Title with priority dot */}
      <div className="flex items-start gap-2">
        <Skeleton variant="circular" width={8} height={8} className="mt-1.5 shrink-0" />
        <div className="flex-1">
          <SkeletonText lines={2} lineHeight={14} gap={4} lastLineWidth={50} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2.5 pt-1">
        <Skeleton variant="text" width={56} height={12} className="font-mono" />
        <SkeletonAvatar size="sm" />
      </div>
    </div>
  );
}
```

### SkeletonTaskDetail

Matches the TaskDetailDialog layout.

```typescript
// app/components/views/kanban-board/dialogs/skeletons/skeleton-task-detail.tsx
export function SkeletonTaskDetail() {
  return (
    <div className="w-full max-w-[560px] bg-[#161b22] rounded-[12px] border border-[#30363d]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
        <div className="flex items-center gap-3">
          <SkeletonBadge width={80} />
          <Skeleton variant="text" width={72} height={14} className="font-mono" />
        </div>
        <Skeleton variant="rectangular" width={32} height={32} />
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Title */}
        <Skeleton variant="text" width="80%" height={24} />

        {/* Description */}
        <div className="space-y-2">
          <Skeleton variant="text" width={80} height={12} />
          <SkeletonText lines={3} lineHeight={14} lastLineWidth={70} />
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton variant="text" width={60} height={12} />
              <Skeleton variant="text" width={100} height={14} />
            </div>
          ))}
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <Skeleton variant="text" width={60} height={12} />
          <div className="flex gap-2">
            <Skeleton variant="rectangular" width={72} height={32} />
            <Skeleton variant="rectangular" width={72} height={32} />
            <Skeleton variant="rectangular" width={72} height={32} />
          </div>
        </div>

        {/* Labels */}
        <div className="space-y-2">
          <Skeleton variant="text" width={48} height={12} />
          <div className="flex flex-wrap gap-1.5">
            <SkeletonBadge width={64} />
            <SkeletonBadge width={80} />
            <SkeletonBadge width={56} />
          </div>
        </div>

        {/* Activity */}
        <div className="space-y-3">
          <Skeleton variant="text" width={60} height={12} />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonListItem key={i} showMeta={false} avatarSize="sm" />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#30363d] bg-[#1c2128]">
        <SkeletonButton size="default" width={100} />
        <SkeletonButton size="default" width={100} />
      </div>
    </div>
  );
}
```

### SkeletonProjectCard

Matches the project card layout.

```typescript
// app/components/views/dashboard/skeletons/skeleton-project-card.tsx
export function SkeletonProjectCard() {
  return (
    <div className="rounded-[6px] border border-[#30363d] bg-[#161b22] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="rectangular" width={40} height={40} />
          <div className="space-y-2">
            <Skeleton variant="text" width={120} height={16} />
            <Skeleton variant="text" width={180} height={12} />
          </div>
        </div>
        <SkeletonBadge width={64} />
      </div>

      {/* Description */}
      <SkeletonText lines={2} lineHeight={14} lastLineWidth={80} />

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width={24} height={14} />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width={24} height={14} />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width={40} height={14} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#21262d]">
        <div className="flex -space-x-2">
          <SkeletonAvatar size="sm" />
          <SkeletonAvatar size="sm" />
          <SkeletonAvatar size="sm" />
        </div>
        <Skeleton variant="text" width={80} height={12} />
      </div>
    </div>
  );
}
```

---

## 5. Page-Level Skeletons

### DashboardSkeleton

Full dashboard layout with navigation and content areas.

```typescript
// app/components/views/dashboard/skeletons/dashboard-skeleton.tsx
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
        <div className="flex items-center gap-4">
          <Skeleton variant="rectangular" width={32} height={32} />
          <Skeleton variant="text" width={120} height={20} />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonButton size="icon" />
          <SkeletonAvatar size="md" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-60 border-r border-[#30363d] p-4 space-y-4">
          <Skeleton variant="text" width={80} height={12} className="mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton variant="rectangular" width={20} height={20} />
              <Skeleton variant="text" width={100} height={14} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* Page title */}
          <div className="space-y-2">
            <Skeleton variant="text" width={200} height={28} />
            <Skeleton variant="text" width={320} height={14} />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-[6px] border border-[#30363d] bg-[#161b22] p-4 space-y-2">
                <Skeleton variant="text" width={80} height={12} />
                <Skeleton variant="text" width={60} height={28} />
              </div>
            ))}
          </div>

          {/* Project cards */}
          <div className="grid grid-cols-2 gap-4">
            <SkeletonProjectCard />
            <SkeletonProjectCard />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### KanbanBoardSkeleton

Four-column Kanban board with card placeholders.

```typescript
// app/components/views/kanban-board/skeletons/kanban-board-skeleton.tsx
const COLUMN_TITLES = ['Backlog', 'In Progress', 'Waiting Approval', 'Verified'];
const CARDS_PER_COLUMN = [4, 3, 2, 1];

export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-4 p-5 overflow-x-auto min-h-[calc(100vh-180px)]">
      {COLUMN_TITLES.map((title, colIndex) => (
        <div
          key={title}
          className="flex flex-col w-[300px] min-w-[300px] rounded-[6px] border border-[#30363d] bg-[#161b22] max-h-[calc(100vh-180px)]"
        >
          {/* Column header */}
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#30363d] shrink-0">
            <div className="flex items-center gap-2.5">
              <Skeleton variant="rectangular" width={26} height={26} />
              <Skeleton
                variant="rectangular"
                width={3}
                height={14}
                className="rounded-sm"
              />
              <Skeleton variant="text" width={80} height={14} />
              <Skeleton variant="text" width={24} height={20} className="rounded-full" />
            </div>
            <Skeleton variant="rectangular" width={26} height={26} />
          </div>

          {/* Cards */}
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2.5">
            {Array.from({ length: CARDS_PER_COLUMN[colIndex] }).map((_, cardIndex) => (
              <SkeletonKanbanCard key={cardIndex} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### AgentSessionSkeleton

Agent session view with stream panel and sidebar.

```typescript
// app/components/views/agent-session/skeletons/agent-session-skeleton.tsx
export function AgentSessionSkeleton() {
  return (
    <div className="grid grid-rows-[auto_auto_1fr_auto] grid-cols-[1fr_320px] min-h-screen bg-[#0d1117]">
      {/* Header bar */}
      <div className="col-span-2 flex items-center justify-between px-5 py-3 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex items-center gap-3">
          <Skeleton variant="text" width={160} height={18} />
          <SkeletonBadge width={72} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width={16} height={16} />
          <Skeleton variant="text" width={72} height={14} />
        </div>
      </div>

      {/* Presence bar */}
      <div className="col-span-2 flex items-center justify-between px-5 py-3 border-b border-[#30363d] bg-[#1c2128]">
        {/* Avatar stack */}
        <div className="flex -space-x-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonAvatar key={i} size="md" />
          ))}
        </div>

        {/* Share URL */}
        <div className="flex items-center gap-3">
          <Skeleton variant="text" width={40} height={12} />
          <Skeleton variant="rectangular" width={240} height={32} />
          <Skeleton variant="rectangular" width={32} height={32} />
        </div>
      </div>

      {/* Stream panel */}
      <div className="p-4 pr-2">
        <div className="h-full rounded-[6px] border border-[#30363d] bg-[#161b22] overflow-hidden">
          {/* Stream header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
            <div className="flex items-center gap-2">
              <Skeleton variant="rectangular" width={16} height={16} />
              <Skeleton variant="text" width={100} height={14} />
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="circular" width={8} height={8} />
              ))}
            </div>
          </div>

          {/* Stream content */}
          <div className="p-4 space-y-3 bg-[#0d1117]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2">
                <Skeleton variant="text" width={`${40 + Math.random() * 50}%`} height={14} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity sidebar */}
      <div className="row-span-2 border-l border-[#30363d] bg-[#161b22] p-4 space-y-4">
        <Skeleton variant="text" width={64} height={14} />

        {/* Activity items */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton variant="circular" width={32} height={32} />
              <div className="flex-1 space-y-1">
                <Skeleton variant="text" width="80%" height={14} />
                <Skeleton variant="text" width={60} height={12} />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-auto pt-4 space-y-2">
          <SkeletonButton size="default" width="100%" />
          <SkeletonButton size="default" width="100%" />
        </div>
      </div>

      {/* Input area */}
      <div className="p-4 pr-2 bg-[#0d1117]">
        <div className="flex items-center gap-3 p-3 rounded-[6px] border border-[#30363d] bg-[#161b22]">
          <Skeleton variant="text" className="flex-1" height={20} />
          <Skeleton variant="rectangular" width={48} height={20} className="rounded" />
          <SkeletonButton size="default" width={80} />
        </div>
      </div>
    </div>
  );
}
```

### ProjectListSkeleton

List of project cards for the projects page.

```typescript
// app/components/views/projects/skeletons/project-list-skeleton.tsx
export interface ProjectListSkeletonProps {
  /** Number of project cards to show */
  count?: number;
  /** Grid columns (1, 2, or 3) */
  columns?: 1 | 2 | 3;
}

export function ProjectListSkeleton({ count = 6, columns = 2 }: ProjectListSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton variant="text" width={160} height={24} />
          <Skeleton variant="text" width={240} height={14} />
        </div>
        <SkeletonButton size="default" width={120} />
      </div>

      {/* Grid */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonProjectCard key={i} />
        ))}
      </div>
    </div>
  );
}
```

---

## 6. Animation

### Shimmer Effect

The primary skeleton animation uses a CSS gradient sweep for a subtle loading indication.

```css
/* app/styles/skeleton.css */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Skeleton base with shimmer overlay */
.animate-skeleton {
  background-color: var(--bg-muted); /* #21262d */
}

.animate-skeleton::before {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### Pulse Effect Alternative

For simpler loading states or reduced motion preference.

```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s ease-in-out infinite;
}
```

### Staggered Appearance

For lists and grids, stagger skeleton appearance to indicate loading direction.

```typescript
// app/components/ui/skeleton-stagger.tsx
export interface SkeletonStaggerProps {
  children: React.ReactNode;
  /** Delay between each child in ms */
  staggerDelay?: number;
  /** Base delay before first child */
  baseDelay?: number;
}

export function SkeletonStagger({
  children,
  staggerDelay = 50,
  baseDelay = 0,
}: SkeletonStaggerProps) {
  return (
    <>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;

        return React.cloneElement(child, {
          style: {
            ...child.props.style,
            animationDelay: `${baseDelay + index * staggerDelay}ms`,
          },
        });
      })}
    </>
  );
}

// Usage
<SkeletonStagger staggerDelay={50}>
  <SkeletonListItem />
  <SkeletonListItem />
  <SkeletonListItem />
</SkeletonStagger>
```

### Reduced Motion Support

Disable animations for users who prefer reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  .animate-skeleton::before {
    animation: none;
    transform: none;
    background: transparent;
  }

  .animate-pulse {
    animation: none;
  }

  .animate-shimmer {
    animation: none;
  }
}
```

```typescript
// React hook for reduced motion
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}
```

---

## 7. Styling

### Color Tokens

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `--bg-muted` | `#21262d` | Skeleton background |
| `--bg-subtle` | `#1c2128` | Skeleton surface on light bg |
| `--border-default` | `#30363d` | Skeleton container borders |
| Shimmer gradient | `rgba(255, 255, 255, 0.08)` | Shimmer highlight |

### Border Radius

Match skeleton radius to actual component radius:

| Component | Skeleton Radius | CSS Value |
|-----------|-----------------|-----------|
| Text | 4px | `rounded-[4px]` |
| Buttons, Cards | 6px | `rounded-[6px]` |
| Modals | 12px | `rounded-[12px]` |
| Avatars, Badges | full | `rounded-full` |

### Spacing

Use the same spacing system as real components:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-2` | 8px | Gap between skeleton elements |
| `--space-3` | 12px | Section spacing |
| `--space-4` | 16px | Card padding |
| `--space-5` | 20px | Page-level spacing |

---

## 8. Best Practices

### Match Real Content Dimensions

```tsx
// Good: Matches actual content dimensions
<Skeleton width={120} height={16} /> // For a 120px wide title

// Bad: Generic dimensions that cause layout shift
<Skeleton width="50%" height={20} />
```

### Avoid Layout Shift

1. **Fixed dimensions**: Use explicit widths for text skeletons
2. **Aspect ratios**: Preserve image/video aspect ratios
3. **Container sizing**: Match skeleton containers to final content containers
4. **Consistent heights**: Use design system heights for buttons, inputs

### Use Realistic Content Shapes

```tsx
// Good: Mimics real content structure
<div className="flex items-center gap-3">
  <SkeletonAvatar size="md" />
  <div className="flex-1">
    <Skeleton width="60%" height={16} />
    <Skeleton width="40%" height={12} className="mt-1" />
  </div>
</div>

// Bad: Generic block that doesn't represent content
<Skeleton width="100%" height={50} />
```

### Progressive Loading Patterns

Load content progressively, replacing skeletons as data becomes available:

```tsx
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading: userLoading } = useUser(userId);
  const { data: posts, isLoading: postsLoading } = usePosts(userId);

  return (
    <div>
      {/* User info - loads first */}
      {userLoading ? (
        <SkeletonListItem showSecondary />
      ) : (
        <UserInfo user={user} />
      )}

      {/* Posts - may still be loading */}
      {postsLoading ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <PostList posts={posts} />
      )}
    </div>
  );
}
```

---

## 9. Implementation

### Complete Base Component

```typescript
// app/components/ui/skeleton/index.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// ==========================================
// Base Skeleton Component
// ==========================================

export const skeletonVariants = cva(
  'relative overflow-hidden bg-[#21262d]',
  {
    variants: {
      variant: {
        text: 'rounded-[4px]',
        circular: 'rounded-full',
        rectangular: 'rounded-[6px]',
      },
      animation: {
        shimmer: [
          'before:absolute before:inset-0 before:-translate-x-full',
          'before:animate-[shimmer_1.5s_ease-in-out_infinite]',
          'before:bg-gradient-to-r before:from-transparent',
          'before:via-[rgba(255,255,255,0.08)] before:to-transparent',
        ].join(' '),
        pulse: 'animate-[pulse_2s_ease-in-out_infinite]',
        none: '',
      },
    },
    defaultVariants: {
      variant: 'text',
      animation: 'shimmer',
    },
  }
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: number | string;
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
// Primitive Skeletons
// ==========================================

export interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: number | 'random';
  gap?: number;
  lineHeight?: number;
  className?: string;
}

export function SkeletonText({
  lines = 1,
  lastLineWidth = 75,
  gap = 8,
  lineHeight = 16,
  className,
}: SkeletonTextProps) {
  return (
    <div className={cn('flex flex-col', className)} style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1;
        const width = isLast
          ? lastLineWidth === 'random'
            ? `${50 + Math.random() * 40}%`
            : `${lastLineWidth}%`
          : '100%';

        return <Skeleton key={i} variant="text" height={lineHeight} width={width} />;
      })}
    </div>
  );
}

export interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
}

const AVATAR_SIZES = { sm: 24, md: 32, lg: 40, xl: 48 };

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  const pixels = typeof size === 'number' ? size : AVATAR_SIZES[size];
  return <Skeleton variant="circular" width={pixels} height={pixels} className={className} />;
}

export interface SkeletonButtonProps {
  size?: 'sm' | 'default' | 'lg' | 'icon';
  width?: number | string;
  className?: string;
}

const BUTTON_HEIGHTS = { sm: 32, default: 36, lg: 40, icon: 36 };
const BUTTON_WIDTHS = { sm: 64, default: 80, lg: 96, icon: 36 };

export function SkeletonButton({ size = 'default', width, className }: SkeletonButtonProps) {
  return (
    <Skeleton
      variant="rectangular"
      height={BUTTON_HEIGHTS[size]}
      width={width ?? BUTTON_WIDTHS[size]}
      className={className}
    />
  );
}

export interface SkeletonBadgeProps {
  width?: number;
  className?: string;
}

export function SkeletonBadge({ width = 48, className }: SkeletonBadgeProps) {
  return <Skeleton variant="text" width={width} height={20} className={cn('rounded-full', className)} />;
}

export interface SkeletonImageProps {
  width?: number | string;
  height?: number | string;
  aspectRatio?: string;
  radius?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

const RADIUS_MAP = { sm: '4px', md: '6px', lg: '12px', full: '9999px' };

export function SkeletonImage({
  width = '100%',
  height,
  aspectRatio,
  radius = 'md',
  className,
}: SkeletonImageProps) {
  return (
    <Skeleton
      variant="rectangular"
      width={width}
      height={height}
      className={className}
      style={{ aspectRatio, borderRadius: RADIUS_MAP[radius] }}
    />
  );
}
```

### useSkeleton Hook

Conditional rendering utility for skeleton/content transitions.

```typescript
// app/lib/hooks/use-skeleton.ts
import { type ReactNode } from 'react';

export interface UseSkeletonOptions<T> {
  /** Data being loaded */
  data: T | undefined | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Skeleton to show while loading */
  skeleton: ReactNode;
  /** Content to show when loaded */
  children: (data: T) => ReactNode;
  /** Optional error state */
  error?: Error | null;
  /** Error fallback */
  errorFallback?: (error: Error) => ReactNode;
}

export function useSkeleton<T>({
  data,
  isLoading,
  skeleton,
  children,
  error,
  errorFallback,
}: UseSkeletonOptions<T>): ReactNode {
  if (error && errorFallback) {
    return errorFallback(error);
  }

  if (isLoading || data === undefined || data === null) {
    return skeleton;
  }

  return children(data);
}

// Alternative render-props component
export interface SkeletonLoaderProps<T> extends UseSkeletonOptions<T> {}

export function SkeletonLoader<T>(props: SkeletonLoaderProps<T>): ReactNode {
  return useSkeleton(props);
}
```

### Tailwind Configuration

Add animation keyframes to Tailwind config.

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        pulse: 'pulse 2s ease-in-out infinite',
      },
    },
  },
} satisfies Config;
```

---

## 10. Usage Examples

### Basic Primitives

```tsx
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonBadge,
  SkeletonImage,
} from '@/components/ui/skeleton';

// Single skeleton
<Skeleton width={200} height={16} />

// Text with multiple lines
<SkeletonText lines={3} lastLineWidth={60} />

// Avatar in a list
<SkeletonAvatar size="md" />

// Button placeholder
<SkeletonButton size="default" width={100} />

// Badge
<SkeletonBadge width={64} />

// Image with aspect ratio
<SkeletonImage aspectRatio="16/9" />
```

### Page-Level with Suspense

```tsx
import { Suspense } from 'react';
import { KanbanBoardSkeleton } from '@/components/views/kanban-board/skeletons';
import { KanbanBoard } from '@/components/views/kanban-board';

function ProjectPage({ projectId }: { projectId: string }) {
  return (
    <Suspense fallback={<KanbanBoardSkeleton />}>
      <KanbanBoard projectId={projectId} />
    </Suspense>
  );
}
```

### Conditional Skeleton/Content

```tsx
import { SkeletonLoader, SkeletonProjectCard } from '@/components/ui/skeleton';
import { ProjectCard } from '@/components/views/projects';
import { useProject } from '@/lib/hooks/use-project';

function ProjectSection({ projectId }: { projectId: string }) {
  const { data: project, isLoading, error } = useProject(projectId);

  return (
    <SkeletonLoader
      data={project}
      isLoading={isLoading}
      error={error}
      skeleton={<SkeletonProjectCard />}
      errorFallback={(err) => <ErrorMessage error={err} />}
    >
      {(project) => <ProjectCard project={project} />}
    </SkeletonLoader>
  );
}
```

### List with Staggered Loading

```tsx
import { SkeletonStagger, SkeletonListItem } from '@/components/ui/skeleton';

function TaskListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      <SkeletonStagger staggerDelay={50}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonListItem key={i} />
        ))}
      </SkeletonStagger>
    </div>
  );
}
```

### Progressive Data Loading

```tsx
function DashboardContent() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: activity, isLoading: activityLoading } = useActivity();

  return (
    <div className="space-y-6">
      {/* Stats load quickly */}
      {statsLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={80} />
          ))}
        </div>
      ) : (
        <StatsGrid stats={stats} />
      )}

      {/* Projects may take longer */}
      {projectsLoading ? (
        <ProjectListSkeleton count={4} columns={2} />
      ) : (
        <ProjectGrid projects={projects} />
      )}

      {/* Activity loads last */}
      {activityLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonListItem key={i} />
          ))}
        </div>
      ) : (
        <ActivityFeed items={activity} />
      )}
    </div>
  );
}
```

---

## Accessibility

### ARIA Attributes

All skeleton elements include `aria-hidden="true"` to prevent screen reader announcement of placeholder content.

```tsx
<div
  aria-hidden="true"
  className={skeletonVariants({ variant, animation })}
  {...props}
/>
```

### Loading Announcements

Pair skeletons with proper loading announcements:

```tsx
function LoadingSection({ isLoading, children }) {
  return (
    <>
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite" aria-busy={isLoading}>
        {isLoading ? 'Loading content...' : 'Content loaded'}
      </div>

      {/* Visual skeleton */}
      {isLoading ? <SectionSkeleton /> : children}
    </>
  );
}
```

### Focus Management

When content loads, ensure focus is managed appropriately:

```tsx
function FocusOnLoad({ isLoading, children }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && contentRef.current) {
      // Focus first focusable element after load
      const focusable = contentRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable as HTMLElement)?.focus();
    }
  }, [isLoading]);

  if (isLoading) return <ContentSkeleton />;

  return <div ref={contentRef}>{children}</div>;
}
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Component Patterns](../implementation/component-patterns.md) | Base UI components that skeletons match |
| [Animation System](../implementation/animation-system.md) | Timing tokens and animation guidelines |
| [Design Tokens](../wireframes/design-tokens.css) | Color system and spacing |
| [Kanban Board](./kanban-board.md) | KanbanBoardSkeleton matches this layout |
| [Task Detail Dialog](./task-detail-dialog.md) | SkeletonTaskDetail matches this layout |
| [Agent Session View](./agent-session-view.md) | AgentSessionSkeleton matches this layout |
