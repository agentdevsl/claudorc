# EmptyStates Component Specification

## Overview

Empty states provide visual feedback and actionable guidance when a view has no content. They use consistent visual hierarchy: icon, title, subtitle, and optional action buttons.

**Related Wireframes:**

- [Empty States](../wireframes/empty-states.html) - All empty state variants (first run, no tasks, no agents, empty session)

---

## Interface Definition

```typescript
// app/components/ui/empty-state/types.ts

// ===== Preset Types =====
export type EmptyStatePreset =
  | 'first-run'       // No projects created yet
  | 'no-projects'     // Project list is empty
  | 'no-tasks'        // Kanban board is empty
  | 'no-agents'       // Agent list is empty
  | 'empty-session'   // Session has no history
  | 'no-results'      // Search returned nothing
  | 'error'           // Something went wrong
  | 'offline';        // Network unavailable

// ===== Component Props =====
export interface EmptyStateProps {
  /** Use a preset configuration */
  preset?: EmptyStatePreset;
  /** Custom icon (overrides preset) */
  icon?: React.ReactNode;
  /** Title text (overrides preset) */
  title?: string;
  /** Subtitle/description text (overrides preset) */
  subtitle?: string;
  /** Primary action button */
  primaryAction?: EmptyStateAction;
  /** Secondary action (link style) */
  secondaryAction?: EmptyStateAction;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

// ===== Action Definition =====
export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
}
```

---

## Component Specifications

### EmptyState

```typescript
// app/components/ui/empty-state/index.tsx
export interface EmptyStateProps {
  preset?: EmptyStatePreset;
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `preset` | `EmptyStatePreset` | No | - | Use preset configuration |
| `icon` | `React.ReactNode` | No | From preset | Custom icon |
| `title` | `string` | No | From preset | Title text |
| `subtitle` | `string` | No | From preset | Description text |
| `primaryAction` | `EmptyStateAction` | No | - | Primary CTA button |
| `secondaryAction` | `EmptyStateAction` | No | - | Secondary link action |
| `size` | `'sm' \| 'md' \| 'lg'` | No | `'md'` | Size variant |
| `className` | `string` | No | - | Additional CSS classes |

---

### Visual Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                        ┌─────┐                          │
│                        │     │ ← Icon (64×64px)         │
│                        │ ○─○ │                          │
│                        └─────┘                          │
│                                                         │
│                   No Tasks Yet                          │
│                        ↑                                │
│                    Title (20px, semibold)               │
│                                                         │
│     Create your first task to start working             │
│             with your AI agents.                        │
│                        ↑                                │
│              Subtitle (14px, muted)                     │
│                                                         │
│              [+ Create Task]                            │
│                    ↑                                    │
│           Primary Action (button)                       │
│                                                         │
│              Import from GitHub                         │
│                    ↑                                    │
│           Secondary Action (link)                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Size Variants

| Size | Icon | Title | Subtitle | Max Width | Padding |
|------|------|-------|----------|-----------|---------|
| `sm` | 48px | 16px | 13px | 320px | 24px |
| `md` | 64px | 20px | 14px | 440px | 48px |
| `lg` | 80px | 24px | 16px | 560px | 64px |

---

### Preset Configurations

#### First Run (`first-run`)

| Property | Value |
|----------|-------|
| Icon | Sparkles / Welcome |
| Title | "Welcome to AgentPane" |
| Subtitle | "Get started by creating your first project or importing from GitHub" |
| Primary | "Create Project" |
| Secondary | "Import from GitHub" |

#### No Projects (`no-projects`)

| Property | Value |
|----------|-------|
| Icon | Folder |
| Title | "No Projects" |
| Subtitle | "Create a project to start organizing your tasks and agents" |
| Primary | "Create Project" |
| Secondary | None |

#### No Tasks (`no-tasks`)

| Property | Value |
|----------|-------|
| Icon | Clipboard/Checklist |
| Title | "No Tasks Yet" |
| Subtitle | "Create your first task to start working with your AI agents" |
| Primary | "Create Task" |
| Secondary | "Import from GitHub Issues" |

#### No Agents (`no-agents`)

| Property | Value |
|----------|-------|
| Icon | Robot/Bot |
| Title | "No Agents" |
| Subtitle | "Create an agent to automate your development tasks" |
| Primary | "Create Agent" |
| Secondary | "Learn about agents" |

#### Empty Session (`empty-session`)

| Property | Value |
|----------|-------|
| Icon | Terminal |
| Title | "No Session History" |
| Subtitle | "Agent activity will appear here once execution begins" |
| Primary | None |
| Secondary | None |

#### No Results (`no-results`)

| Property | Value |
|----------|-------|
| Icon | Search |
| Title | "No Results Found" |
| Subtitle | "Try adjusting your search or filter criteria" |
| Primary | "Clear Filters" |
| Secondary | None |

#### Error (`error`)

| Property | Value |
|----------|-------|
| Icon | AlertTriangle |
| Title | "Something Went Wrong" |
| Subtitle | "We encountered an error loading this content" |
| Primary | "Try Again" |
| Secondary | "Report Issue" |

#### Offline (`offline`)

| Property | Value |
|----------|-------|
| Icon | WifiOff |
| Title | "You're Offline" |
| Subtitle | "Check your internet connection and try again" |
| Primary | "Retry" |
| Secondary | None |

---

### Icon Styling

```css
.empty-state-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 24px;
  color: var(--fg-subtle);
  stroke-width: 1.5px; /* Thin strokes for elegance */
}

/* Icon container with subtle background */
.empty-state-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--bg-subtle);
  border: 2px dashed var(--border-muted);
}
```

---

### Colors

| Element | Light Theme | Dark Theme |
|---------|-------------|------------|
| Icon | `#6e7781` | `#8b949e` |
| Icon container | `#f6f8fa` | `#21262d` |
| Container border | `#d8dee4` (dashed) | `#30363d` (dashed) |
| Title | `#24292f` | `#e6edf3` |
| Subtitle | `#656d76` | `#8b949e` |
| Primary button | `--success-fg` | `--success-fg` |
| Secondary link | `--accent-fg` | `--accent-fg` |

---

## Business Rules

| Rule | Description |
|------|-------------|
| **Context awareness** | Presets adapt text based on current context |
| **Action visibility** | Actions hidden if user lacks permission |
| **Loading state** | Show skeleton instead of empty state while loading |
| **Error recovery** | Error state includes retry mechanism |
| **Responsive** | Stack layout vertically on mobile |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| Role | `role="status"` for dynamic content |
| ARIA | `aria-label` describing the empty state |
| Focus | Primary action receives focus on render |
| Color contrast | 4.5:1 minimum for all text |

---

## Implementation Example

```typescript
// app/components/ui/empty-state/index.tsx
import { cva } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { presets } from './presets';

const emptyStateVariants = cva(
  'flex flex-col items-center justify-center text-center',
  {
    variants: {
      size: {
        sm: 'p-6 max-w-xs gap-3',
        md: 'p-12 max-w-md gap-4',
        lg: 'p-16 max-w-lg gap-5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export function EmptyState({
  preset,
  icon,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  size = 'md',
  className,
}: EmptyStateProps) {
  const config = preset ? presets[preset] : {};

  const finalIcon = icon ?? config.icon;
  const finalTitle = title ?? config.title;
  const finalSubtitle = subtitle ?? config.subtitle;
  const finalPrimary = primaryAction ?? config.primaryAction;
  const finalSecondary = secondaryAction ?? config.secondaryAction;

  return (
    <article
      role="status"
      aria-label={finalTitle}
      className={emptyStateVariants({ size, className })}
    >
      {finalIcon && (
        <div className="empty-state-icon-container">
          <div className="empty-state-icon">{finalIcon}</div>
        </div>
      )}

      {finalTitle && (
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {finalTitle}
        </h2>
      )}

      {finalSubtitle && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {finalSubtitle}
        </p>
      )}

      {(finalPrimary || finalSecondary) && (
        <div className="flex flex-col items-center gap-3 mt-4">
          {finalPrimary && (
            <Button
              variant="primary"
              onClick={finalPrimary.onClick}
              asChild={!!finalPrimary.href}
            >
              {finalPrimary.icon}
              {finalPrimary.label}
            </Button>
          )}

          {finalSecondary && (
            <a
              href={finalSecondary.href}
              onClick={finalSecondary.onClick}
              className="text-sm text-blue-500 hover:underline"
            >
              {finalSecondary.label}
            </a>
          )}
        </div>
      )}
    </article>
  );
}
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Loading Skeletons](./loading-skeletons.md) | Show instead of empty state while loading |
| [Kanban Board](./kanban-board.md) | Uses `no-tasks` empty state |
| [Component Patterns](../implementation/component-patterns.md) | CVA variants |
| [Design Tokens](../wireframes/design-tokens.css) | Color variables |
