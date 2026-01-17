# Breadcrumbs Component Specification

## Overview

The Breadcrumbs component provides navigation hierarchy visualization and location awareness within the AgentPane application. It integrates with TanStack Router to automatically generate breadcrumb trails from the route tree while supporting manual overrides and dynamic content resolution.

**Related Specifications:**

- [Routing Specification](../routing/routes.md) - Route definitions and `useBreadcrumbs()` hook
- [Component Patterns](../implementation/component-patterns.md) - Base component styling

---

## Interface Definition

```typescript
// app/components/ui/breadcrumbs/types.ts
import type { ReactNode } from 'react';
import type { LinkProps } from '@tanstack/react-router';

/**
 * Individual breadcrumb item configuration
 */
export interface BreadcrumbItem {
  /** Display label for the breadcrumb */
  label: string;
  /** Navigation href - omit for current page (non-linked) */
  href?: string;
  /** Optional icon component to display before label */
  icon?: ReactNode;
  /** Whether this is the current page (renders without link, muted style) */
  isCurrent?: boolean;
  /** TanStack Router params for dynamic routes */
  params?: Record<string, string>;
}

/**
 * Separator options for between breadcrumb items
 */
export type BreadcrumbSeparator =
  | 'slash'      // Forward slash: /
  | 'chevron'    // Chevron right icon: >
  | 'arrow'      // Right arrow: →
  | ReactNode;   // Custom separator component

/**
 * Props for the Breadcrumbs component
 */
export interface BreadcrumbsProps {
  /**
   * Breadcrumb items to display. If omitted, auto-generates from route hierarchy.
   * Manual items override auto-generated breadcrumbs.
   */
  items?: BreadcrumbItem[];

  /**
   * Separator between items
   * @default 'slash'
   */
  separator?: BreadcrumbSeparator;

  /**
   * Maximum items to display before truncation.
   * When exceeded, shows first item, ellipsis, then last N-1 items.
   * @default undefined (no truncation)
   */
  maxItems?: number;

  /**
   * Show home icon as first item
   * @default true
   */
  showHomeIcon?: boolean;

  /** Custom home href @default '/' */
  homeHref?: string;

  /** Custom home label @default 'Home' */
  homeLabel?: string;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Route meta configuration for breadcrumb labels
 */
export interface RouteBreadcrumbMeta {
  /** Static breadcrumb label */
  breadcrumb?: string;
  /**
   * Dynamic breadcrumb resolver - receives loader data and params.
   * Use for resolving entity names from IDs.
   */
  breadcrumbResolver?: (context: {
    loaderData: unknown;
    params: Record<string, string>;
  }) => string | Promise<string>;
}

/**
 * Breadcrumb context for async data resolution
 */
export interface BreadcrumbContext {
  /** Route params (e.g., projectId, taskId) */
  params: Record<string, string>;
  /** Loader data from current route */
  loaderData: unknown;
  /** Resolved entity names cache */
  resolvedNames: Map<string, string>;
}
```

---

## Component Specifications

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `items` | `BreadcrumbItem[]` | No | auto-generated | Manual breadcrumb items (overrides auto-generation) |
| `separator` | `BreadcrumbSeparator` | No | `'slash'` | Visual separator between items |
| `maxItems` | `number` | No | `undefined` | Max items before truncation |
| `showHomeIcon` | `boolean` | No | `true` | Display home icon as first item |
| `homeHref` | `string` | No | `'/'` | Home link destination |
| `homeLabel` | `string` | No | `'Home'` | Home item accessible label |
| `className` | `string` | No | - | Additional CSS classes |

### State

| State | Type | Initial Value | Description |
|-------|------|---------------|-------------|
| `resolvedLabels` | `Map<string, string>` | empty | Cache for async-resolved labels |
| `isResolving` | `boolean` | `false` | Whether labels are being resolved |

### Events

| Event | Trigger | Description |
|-------|---------|-------------|
| Navigation | Item click | TanStack Router navigation to href |

---

## Visual Specifications

### Layout

```
+------------------------------------------------------------------+
| [Home Icon] / Projects / AgentPane / Tasks / Implement Login      |
|                                                                   |
| With truncation (maxItems=4):                                     |
| [Home Icon] / Projects / ... / Tasks / Implement Login            |
+------------------------------------------------------------------+
```

### Dimensions

| Element | Dimension | Value |
|---------|-----------|-------|
| Container | height | `auto` (content-based) |
| Container | padding | `0` (inherits from parent) |
| Item | padding | `0 4px` |
| Item | gap (from separator) | `8px` |
| Separator | margin | `0 4px` |
| Home icon | size | `16px x 16px` |
| Item icon | size | `14px x 14px` |
| Ellipsis button | size | `24px x 24px` |
| Font size | - | `14px` (--font-base) |
| Line height | - | `1.5` (--leading-normal) |

### Colors

| Element | Property | Token |
|---------|----------|-------|
| Link item | color | `--fg-muted` (#8b949e) |
| Link item hover | color | `--fg-default` (#e6edf3) |
| Link item hover | text-decoration | `underline` |
| Current item | color | `--fg-default` (#e6edf3) |
| Current item | font-weight | `500` (--font-medium) |
| Separator | color | `--fg-subtle` (#6e7681) |
| Home icon | color | `--fg-muted` (#8b949e) |
| Home icon hover | color | `--fg-default` (#e6edf3) |
| Ellipsis | color | `--fg-muted` (#8b949e) |
| Ellipsis hover | background | `--bg-subtle` (#1c2128) |
| Dropdown background | background | `--bg-default` (#161b22) |
| Dropdown border | border-color | `--border-default` (#30363d) |

### Separator Styles

```
Slash:    Projects / AgentPane / Tasks
Chevron:  Projects > AgentPane > Tasks
Arrow:    Projects → AgentPane → Tasks
```

### Animations

| Animation | Property | Value |
|-----------|----------|-------|
| Link hover | transition | `color 150ms ease` |
| Ellipsis dropdown | animation | `fade-in 200ms, slide-in-from-top-2 200ms` |

---

## Route Integration

### useBreadcrumbs Hook

The `useBreadcrumbs()` hook reads the current route tree and generates breadcrumb items automatically.

```typescript
// lib/hooks/use-breadcrumbs.ts
import { useMatches, useLoaderData } from '@tanstack/react-router';
import { useMemo, useState, useEffect } from 'react';
import type { BreadcrumbItem, RouteBreadcrumbMeta } from '@/components/ui/breadcrumbs/types';

/**
 * Hook to generate breadcrumbs from route hierarchy
 */
export function useBreadcrumbs(): {
  items: BreadcrumbItem[];
  isLoading: boolean;
} {
  const matches = useMatches();
  const [resolvedLabels, setResolvedLabels] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Build breadcrumbs from route matches
  const items = useMemo(() => {
    return matches
      .filter((match) => {
        // Filter out root and index routes without breadcrumb meta
        const meta = match.staticData as RouteBreadcrumbMeta | undefined;
        return meta?.breadcrumb || meta?.breadcrumbResolver;
      })
      .map((match, index, arr): BreadcrumbItem => {
        const meta = match.staticData as RouteBreadcrumbMeta;
        const isLast = index === arr.length - 1;

        // Try resolved label first, then static breadcrumb
        const resolvedLabel = resolvedLabels.get(match.pathname);
        const label = resolvedLabel || meta.breadcrumb || 'Untitled';

        return {
          label,
          href: isLast ? undefined : match.pathname,
          isCurrent: isLast,
          params: match.params,
        };
      });
  }, [matches, resolvedLabels]);

  // Resolve dynamic labels (e.g., project names from IDs)
  useEffect(() => {
    async function resolveLabels() {
      const needsResolution = matches.filter((match) => {
        const meta = match.staticData as RouteBreadcrumbMeta | undefined;
        return meta?.breadcrumbResolver && !resolvedLabels.has(match.pathname);
      });

      if (needsResolution.length === 0) return;

      setIsLoading(true);
      const newLabels = new Map(resolvedLabels);

      await Promise.all(
        needsResolution.map(async (match) => {
          const meta = match.staticData as RouteBreadcrumbMeta;
          if (!meta.breadcrumbResolver) return;

          try {
            const label = await meta.breadcrumbResolver({
              loaderData: match.loaderData,
              params: match.params,
            });
            newLabels.set(match.pathname, label);
          } catch {
            // Fallback to static breadcrumb or param
            newLabels.set(
              match.pathname,
              meta.breadcrumb || Object.values(match.params)[0] || 'Unknown'
            );
          }
        })
      );

      setResolvedLabels(newLabels);
      setIsLoading(false);
    }

    resolveLabels();
  }, [matches]);

  return { items, isLoading };
}
```

### Route Meta Configuration

```typescript
// app/routes/projects/$projectId.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/projects/$projectId')({
  staticData: {
    breadcrumb: 'Project', // Static fallback
    breadcrumbResolver: ({ loaderData }) => {
      // Dynamic resolution from loader data
      return loaderData?.project?.name ?? 'Project';
    },
  },
  loader: async ({ params }) => {
    const project = await projectService.getById(params.projectId);
    return { project: project.ok ? project.value : null };
  },
  component: ProjectDetail,
});
```

### Route Configuration Examples

```typescript
// Dashboard - no breadcrumb (root)
export const Route = createFileRoute('/')({
  staticData: {
    breadcrumb: 'Dashboard',
  },
});

// Projects list
export const Route = createFileRoute('/projects/')({
  staticData: {
    breadcrumb: 'Projects',
  },
});

// Project detail - dynamic name
export const Route = createFileRoute('/projects/$projectId')({
  staticData: {
    breadcrumb: 'Project',
    breadcrumbResolver: ({ loaderData }) => loaderData?.project?.name,
  },
});

// Task detail - dynamic title
export const Route = createFileRoute('/projects/$projectId/tasks/$taskId')({
  staticData: {
    breadcrumb: 'Task',
    breadcrumbResolver: ({ loaderData }) => loaderData?.task?.title,
  },
});

// Agents list
export const Route = createFileRoute('/agents/')({
  staticData: {
    breadcrumb: 'Agents',
  },
});

// Agent detail - dynamic name
export const Route = createFileRoute('/agents/$agentId')({
  staticData: {
    breadcrumb: 'Agent',
    breadcrumbResolver: ({ loaderData }) => loaderData?.agent?.name,
  },
});

// Session view - dynamic title
export const Route = createFileRoute('/sessions/$sessionId')({
  staticData: {
    breadcrumb: 'Session',
    breadcrumbResolver: ({ loaderData }) =>
      loaderData?.session?.title ?? `Session ${loaderData?.session?.id?.slice(-6)}`,
  },
});
```

---

## Behavior

### Auto-Generation from Route Hierarchy

1. Hook reads current `useMatches()` from TanStack Router
2. Filters matches to those with `breadcrumb` or `breadcrumbResolver` in `staticData`
3. For each match, resolves label (async if needed)
4. Marks last item as `isCurrent: true`
5. Returns array of `BreadcrumbItem` for rendering

### Manual Override Capability

When `items` prop is provided, it completely overrides auto-generation:

```tsx
<Breadcrumbs
  items={[
    { label: 'Custom Home', href: '/', icon: <HomeIcon /> },
    { label: 'Custom Section', href: '/section' },
    { label: 'Current Page', isCurrent: true },
  ]}
/>
```

### Truncation for Deep Hierarchies

When `maxItems` is set and items exceed the limit:

1. Always show first item (home/root)
2. Show ellipsis button that expands to dropdown
3. Show last `maxItems - 2` items

```
Before truncation (6 items, maxItems=4):
Home / Projects / AgentPane / Tasks / Backlog / Implement Login

After truncation:
Home / ... / Backlog / Implement Login
      ↓ (dropdown on ellipsis click)
      Projects
      AgentPane
      Tasks
```

### Home Icon Behavior

- When `showHomeIcon: true` (default), first item shows home icon only
- Accessible label provided via `aria-label`
- Clicking navigates to `homeHref` (default: '/')

---

## Responsive Behavior

### Desktop (>= 1024px)

- Full breadcrumb trail displayed
- All items visible (with truncation if configured)

### Tablet (768px - 1023px)

- Full trail with potential truncation at `maxItems: 4`
- Slightly reduced padding

### Mobile (< 768px)

- Collapse to show only: Current + Parent
- Dropdown to access full hierarchy
- Touch-friendly 44px tap targets

```typescript
// Responsive behavior implementation
export function useMobileBreadcrumbs(items: BreadcrumbItem[]): BreadcrumbItem[] {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (!isMobile || items.length <= 2) {
    return items;
  }

  // On mobile: show parent and current only
  return [
    items[items.length - 2], // Parent
    items[items.length - 1], // Current
  ];
}
```

### Mobile Layout

```
+----------------------------------+
| [Back] AgentPane > Implement...  |  <- Back button + truncated current
+----------------------------------+

Expanded (via dropdown):
+----------------------------------+
| Dashboard                        |
| Projects                         |
| AgentPane                        |
| Tasks                            |
| Implement Login (current)        |
+----------------------------------+
```

---

## Accessibility

### ARIA Attributes

```html
<nav aria-label="Breadcrumb" class="breadcrumbs">
  <ol role="list">
    <li>
      <a href="/" aria-label="Home">
        <HomeIcon aria-hidden="true" />
      </a>
    </li>
    <li aria-hidden="true" class="separator">/</li>
    <li>
      <a href="/projects">Projects</a>
    </li>
    <li aria-hidden="true" class="separator">/</li>
    <li>
      <a href="/projects/abc123">AgentPane</a>
    </li>
    <li aria-hidden="true" class="separator">/</li>
    <li aria-current="page">
      <span>Implement Login</span>
    </li>
  </ol>
</nav>
```

### Accessibility Requirements

| Requirement | Implementation |
|-------------|----------------|
| Navigation landmark | `<nav aria-label="Breadcrumb">` |
| Current page indicator | `aria-current="page"` on last item |
| Separator hidden from SR | `aria-hidden="true"` on separators |
| Home icon label | `aria-label="Home"` or visually hidden text |
| Keyboard navigation | Standard link tabbing |
| Focus visible | Focus ring on interactive elements |
| Screen reader text | Separators announced as "," by ordered list |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus between breadcrumb links |
| `Enter` | Activate focused link |
| `Space` | Activate focused link |
| `Escape` | Close ellipsis dropdown (if open) |

---

## Implementation

### Main Component

```typescript
// app/components/ui/breadcrumbs/breadcrumbs.tsx
import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useBreadcrumbs } from '@/lib/hooks/use-breadcrumbs';
import { BreadcrumbSeparator } from './breadcrumb-separator';
import { BreadcrumbEllipsis } from './breadcrumb-ellipsis';
import { HomeIcon } from 'lucide-react';
import type { BreadcrumbsProps, BreadcrumbItem } from './types';

const breadcrumbItemVariants = cva(
  'inline-flex items-center gap-1.5 text-sm transition-colors duration-150',
  {
    variants: {
      state: {
        link: 'text-[#8b949e] hover:text-[#e6edf3] hover:underline',
        current: 'text-[#e6edf3] font-medium pointer-events-none',
      },
    },
    defaultVariants: {
      state: 'link',
    },
  }
);

export function Breadcrumbs({
  items: manualItems,
  separator = 'slash',
  maxItems,
  showHomeIcon = true,
  homeHref = '/',
  homeLabel = 'Home',
  className,
}: BreadcrumbsProps) {
  // Use manual items or auto-generate from routes
  const { items: autoItems, isLoading } = useBreadcrumbs();
  const items = manualItems ?? autoItems;

  // Calculate truncation
  const { visibleItems, hiddenItems, showEllipsis } = React.useMemo(() => {
    if (!maxItems || items.length <= maxItems) {
      return { visibleItems: items, hiddenItems: [], showEllipsis: false };
    }

    // First item + ellipsis + last (maxItems - 2) items
    const firstItem = items[0];
    const lastItems = items.slice(-(maxItems - 2));
    const hidden = items.slice(1, -(maxItems - 2));

    return {
      visibleItems: [firstItem, ...lastItems],
      hiddenItems: hidden,
      showEllipsis: true,
    };
  }, [items, maxItems]);

  // Render home icon as first item if enabled
  const renderHomeItem = () => {
    if (!showHomeIcon) return null;

    return (
      <>
        <li className="flex items-center">
          <Link
            to={homeHref}
            aria-label={homeLabel}
            className={cn(
              breadcrumbItemVariants({ state: 'link' }),
              'p-1 -m-1 rounded hover:bg-[#1c2128]'
            )}
          >
            <HomeIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </li>
        <BreadcrumbSeparator separator={separator} />
      </>
    );
  };

  // Render individual breadcrumb item
  const renderItem = (item: BreadcrumbItem, index: number, isAfterEllipsis = false) => {
    const isFirst = index === 0 && !showHomeIcon;
    const isLast = item.isCurrent;
    const showSeparator = !isLast;

    return (
      <React.Fragment key={item.href || item.label}>
        <li className="flex items-center">
          {item.isCurrent ? (
            <span
              aria-current="page"
              className={breadcrumbItemVariants({ state: 'current' })}
            >
              {item.icon && (
                <span className="flex-shrink-0" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="truncate max-w-[200px]">{item.label}</span>
            </span>
          ) : (
            <Link
              to={item.href!}
              params={item.params}
              className={breadcrumbItemVariants({ state: 'link' })}
            >
              {item.icon && (
                <span className="flex-shrink-0" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="truncate max-w-[200px]">{item.label}</span>
            </Link>
          )}
        </li>
        {showSeparator && <BreadcrumbSeparator separator={separator} />}
      </React.Fragment>
    );
  };

  // Handle empty state
  if (items.length === 0 && !showHomeIcon) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center', className)}>
      <ol
        role="list"
        className="flex items-center gap-1 flex-wrap"
      >
        {renderHomeItem()}

        {showEllipsis ? (
          <>
            {/* First item (after home) */}
            {renderItem(visibleItems[0], 0)}

            {/* Ellipsis with dropdown */}
            <BreadcrumbEllipsis
              items={hiddenItems}
              separator={separator}
            />
            <BreadcrumbSeparator separator={separator} />

            {/* Remaining visible items */}
            {visibleItems.slice(1).map((item, idx) =>
              renderItem(item, idx + 1, true)
            )}
          </>
        ) : (
          visibleItems.map((item, index) => renderItem(item, index))
        )}
      </ol>
    </nav>
  );
}
```

### Separator Component

```typescript
// app/components/ui/breadcrumbs/breadcrumb-separator.tsx
import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BreadcrumbSeparator as SeparatorType } from './types';

interface BreadcrumbSeparatorProps {
  separator: SeparatorType;
  className?: string;
}

export function BreadcrumbSeparator({
  separator,
  className,
}: BreadcrumbSeparatorProps) {
  const baseClasses = 'text-[#6e7681] mx-1 flex-shrink-0';

  // Custom separator component
  if (React.isValidElement(separator)) {
    return (
      <li aria-hidden="true" className={cn(baseClasses, className)}>
        {separator}
      </li>
    );
  }

  // Built-in separator types
  const separatorContent = {
    slash: <span className="text-sm">/</span>,
    chevron: <ChevronRight className="h-3.5 w-3.5" />,
    arrow: <span className="text-sm">&rarr;</span>,
  };

  return (
    <li aria-hidden="true" className={cn(baseClasses, className)}>
      {separatorContent[separator]}
    </li>
  );
}
```

### Ellipsis Dropdown Component

```typescript
// app/components/ui/breadcrumbs/breadcrumb-ellipsis.tsx
import * as React from 'react';
import { Link } from '@tanstack/react-router';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem, BreadcrumbSeparator as SeparatorType } from './types';

interface BreadcrumbEllipsisProps {
  items: BreadcrumbItem[];
  separator: SeparatorType;
}

export function BreadcrumbEllipsis({ items, separator }: BreadcrumbEllipsisProps) {
  return (
    <li className="flex items-center">
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Show more breadcrumbs"
            className={cn(
              'inline-flex items-center justify-center',
              'w-6 h-6 rounded',
              'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128]',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]'
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="start"
            sideOffset={4}
            className={cn(
              'z-50 min-w-[160px] overflow-hidden',
              'rounded-[6px] border border-[#30363d] bg-[#161b22]',
              'shadow-lg',
              'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
              'duration-200'
            )}
          >
            {items.map((item, index) => (
              <DropdownMenuPrimitive.Item key={item.href || index} asChild>
                <Link
                  to={item.href!}
                  params={item.params}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2',
                    'text-sm text-[#8b949e]',
                    'outline-none cursor-pointer',
                    'hover:bg-[#1c2128] hover:text-[#e6edf3]',
                    'focus:bg-[#1c2128] focus:text-[#e6edf3]'
                  )}
                >
                  {item.icon && (
                    <span className="flex-shrink-0" aria-hidden="true">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </Link>
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </li>
  );
}
```

### Mobile Breadcrumbs Component

```typescript
// app/components/ui/breadcrumbs/mobile-breadcrumbs.tsx
import * as React from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from './types';

interface MobileBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function MobileBreadcrumbs({ items, className }: MobileBreadcrumbsProps) {
  const router = useRouter();

  if (items.length === 0) return null;

  const current = items[items.length - 1];
  const parent = items.length > 1 ? items[items.length - 2] : null;

  const handleBack = () => {
    if (parent?.href) {
      router.navigate({ to: parent.href, params: parent.params });
    } else {
      router.history.back();
    }
  };

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-2', className)}>
      {/* Back button */}
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className={cn(
          'inline-flex items-center justify-center',
          'w-11 h-11 rounded-[6px]', // 44px touch target
          'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2128]',
          'transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]'
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Current page with dropdown to full hierarchy */}
      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 px-3 h-11', // 44px touch target
              'text-sm font-medium text-[#e6edf3]',
              'rounded-[6px] hover:bg-[#1c2128]',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]'
            )}
          >
            <span className="truncate max-w-[200px]">{current.label}</span>
            <ChevronDown className="h-4 w-4 text-[#8b949e]" />
          </button>
        </DropdownMenuPrimitive.Trigger>

        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="start"
            sideOffset={4}
            className={cn(
              'z-50 min-w-[200px] max-w-[90vw] overflow-hidden',
              'rounded-[6px] border border-[#30363d] bg-[#161b22]',
              'shadow-lg',
              'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
              'duration-200'
            )}
          >
            {items.map((item, index) => (
              <DropdownMenuPrimitive.Item key={item.href || index} asChild>
                {item.isCurrent ? (
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-3', // Larger touch target
                      'text-sm font-medium text-[#e6edf3]',
                      'bg-[#1c2128]'
                    )}
                  >
                    {item.icon && (
                      <span className="flex-shrink-0" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                    <span className="ml-auto text-xs text-[#6e7681]">Current</span>
                  </div>
                ) : (
                  <Link
                    to={item.href!}
                    params={item.params}
                    className={cn(
                      'flex items-center gap-2 px-3 py-3', // Larger touch target
                      'text-sm text-[#8b949e]',
                      'outline-none cursor-pointer',
                      'hover:bg-[#1c2128] hover:text-[#e6edf3]',
                      'focus:bg-[#1c2128] focus:text-[#e6edf3]'
                    )}
                  >
                    {item.icon && (
                      <span className="flex-shrink-0" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                  </Link>
                )}
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </nav>
  );
}
```

### Responsive Wrapper

```typescript
// app/components/ui/breadcrumbs/responsive-breadcrumbs.tsx
import * as React from 'react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { Breadcrumbs } from './breadcrumbs';
import { MobileBreadcrumbs } from './mobile-breadcrumbs';
import { useBreadcrumbs } from '@/lib/hooks/use-breadcrumbs';
import type { BreadcrumbsProps } from './types';

export function ResponsiveBreadcrumbs(props: BreadcrumbsProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { items: autoItems } = useBreadcrumbs();
  const items = props.items ?? autoItems;

  if (isMobile) {
    return <MobileBreadcrumbs items={items} className={props.className} />;
  }

  return <Breadcrumbs {...props} />;
}
```

---

## Usage Examples

### Basic Usage (Auto-Generated)

```tsx
// Breadcrumbs automatically generated from route hierarchy
import { Breadcrumbs } from '@/components/ui/breadcrumbs';

function PageHeader() {
  return (
    <header className="border-b border-[#30363d] px-6 py-4">
      <Breadcrumbs />
      <h1 className="mt-2 text-xl font-semibold">Project Details</h1>
    </header>
  );
}
```

### With Custom Separator

```tsx
<Breadcrumbs separator="chevron" />
// Result: Home > Projects > AgentPane > Tasks

<Breadcrumbs separator="arrow" />
// Result: Home → Projects → AgentPane → Tasks

// Custom separator component
<Breadcrumbs
  separator={<span className="text-[#58a6ff]">/</span>}
/>
```

### With Icons

```tsx
import { FolderIcon, FileIcon } from 'lucide-react';

<Breadcrumbs
  items={[
    { label: 'Home', href: '/' },
    { label: 'Projects', href: '/projects', icon: <FolderIcon className="h-3.5 w-3.5" /> },
    { label: 'AgentPane', href: '/projects/abc123', icon: <FolderIcon className="h-3.5 w-3.5" /> },
    { label: 'Implement Login', isCurrent: true, icon: <FileIcon className="h-3.5 w-3.5" /> },
  ]}
/>
```

### With Truncation

```tsx
// Deep hierarchy truncated to 4 items
<Breadcrumbs maxItems={4} />

// Given path: Home / Projects / AgentPane / Tasks / Backlog / Implement Login
// Displays:   Home / ... / Backlog / Implement Login
//                   ↓ (dropdown shows: Projects, AgentPane, Tasks)
```

### With Custom Labels (Manual Override)

```tsx
<Breadcrumbs
  items={[
    { label: 'Dashboard', href: '/' },
    { label: 'My Projects', href: '/projects' },
    { label: 'Web App Dashboard', href: '/projects/proj_123' },
    { label: 'Task #42: Fix Auth Bug', isCurrent: true },
  ]}
/>
```

### Without Home Icon

```tsx
<Breadcrumbs showHomeIcon={false} />
// Starts directly with first route segment
```

### Mobile Responsive

```tsx
import { ResponsiveBreadcrumbs } from '@/components/ui/breadcrumbs';

function PageHeader() {
  return (
    <header className="border-b border-[#30363d] px-4 py-3 md:px-6 md:py-4">
      <ResponsiveBreadcrumbs />
    </header>
  );
}
// On mobile: Shows back button + current page with dropdown
// On desktop: Full breadcrumb trail
```

### Integration with Page Layout

```tsx
// app/components/layouts/page-layout.tsx
import { ResponsiveBreadcrumbs } from '@/components/ui/breadcrumbs';

interface PageLayoutProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageLayout({ title, children, actions }: PageLayoutProps) {
  return (
    <div className="flex flex-col h-full">
      <header className="shrink-0 border-b border-[#30363d] bg-[#161b22]">
        <div className="px-6 py-4">
          <ResponsiveBreadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-[#e6edf3]">{title}</h1>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

---

## Design Tokens Reference

```typescript
// Design tokens used by this component
const designTokens = {
  // Colors
  fgDefault: '#e6edf3',      // Current item, hover state
  fgMuted: '#8b949e',        // Link items, icons
  fgSubtle: '#6e7681',       // Separators
  bgSubtle: '#1c2128',       // Hover background
  bgDefault: '#161b22',      // Dropdown background
  borderDefault: '#30363d',  // Dropdown border
  accentFg: '#58a6ff',       // Focus ring

  // Typography
  fontSize: '14px',          // Base text size
  fontMedium: '500',         // Current item weight

  // Spacing
  gap: '4px',                // Between items
  separatorMargin: '4px',    // Separator horizontal margin

  // Sizing
  iconSize: '16px',          // Home icon
  itemIconSize: '14px',      // Item icons
  ellipsisButtonSize: '24px',// Ellipsis button
  touchTarget: '44px',       // Mobile touch target

  // Animation
  transitionDuration: '150ms',// Color transitions
  dropdownDuration: '200ms', // Dropdown animation
};
```

---

## Testing Considerations

### Unit Tests

```typescript
describe('Breadcrumbs', () => {
  it('should render provided items');
  it('should auto-generate from route hierarchy when items not provided');
  it('should render home icon when showHomeIcon is true');
  it('should not render home icon when showHomeIcon is false');
  it('should apply correct separator based on prop');
  it('should truncate when items exceed maxItems');
  it('should show ellipsis dropdown with hidden items');
  it('should mark last item as current with aria-current="page"');
  it('should hide separators from screen readers');
  it('should resolve dynamic labels from loader data');
});

describe('useBreadcrumbs', () => {
  it('should return items from route matches');
  it('should filter routes without breadcrumb meta');
  it('should resolve async breadcrumb labels');
  it('should use fallback when resolver fails');
  it('should cache resolved labels');
});

describe('MobileBreadcrumbs', () => {
  it('should show back button');
  it('should show current item with dropdown');
  it('should navigate on back button click');
  it('should show full hierarchy in dropdown');
  it('should have 44px touch targets');
});
```

### Integration Tests

```typescript
describe('Breadcrumbs Integration', () => {
  it('should update when route changes');
  it('should resolve project name from loader data');
  it('should navigate when breadcrumb is clicked');
  it('should expand truncated items in dropdown');
  it('should close dropdown on escape key');
  it('should switch between mobile and desktop layouts');
});
```

### Accessibility Tests

```typescript
describe('Breadcrumbs Accessibility', () => {
  it('should have nav element with aria-label');
  it('should have ordered list structure');
  it('should mark current page with aria-current');
  it('should hide separators from screen readers');
  it('should have visible focus indicators');
  it('should support keyboard navigation');
  it('should have accessible labels for icons');
});
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Routing Specification](../routing/routes.md) | Route meta, useBreadcrumbs hook base |
| [Component Patterns](../implementation/component-patterns.md) | Base styling, CVA patterns |
| [Animation System](../implementation/animation-system.md) | Dropdown animation timing |
| [Design Tokens](../wireframes/design-tokens.css) | Color and spacing values |
