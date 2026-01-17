# SessionHistory Component Specification

## Overview

The SessionHistory component displays a chronological list of past agent sessions for a project or task, allowing users to review completed work, view session details, and access session recordings.

**Related Wireframes:**

- [Session History](../wireframes/session-history.html) - Session list with filtering and detail view

---

## Interface Definition

```typescript
// app/components/views/session-history/types.ts
import type { Session } from '@/lib/services/session-service.types';

// ===== Filter Options =====
export interface SessionFilters {
  /** Filter by status */
  status?: Session['status'][];
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by task ID */
  taskId?: string;
  /** Date range start */
  dateFrom?: Date;
  /** Date range end */
  dateTo?: Date;
  /** Search query */
  search?: string;
}

// ===== Sort Options =====
export type SessionSortField = 'createdAt' | 'closedAt' | 'duration';
export type SortDirection = 'asc' | 'desc';

// ===== Component Props =====
export interface SessionHistoryProps {
  /** Project ID to show sessions for */
  projectId: string;
  /** Optional task ID to filter sessions */
  taskId?: string;
  /** Initial filters */
  initialFilters?: SessionFilters;
  /** Callback when session is selected */
  onSessionSelect?: (session: Session) => void;
  /** Whether to show in compact mode */
  compact?: boolean;
}

// ===== Session List Item =====
export interface SessionListItem {
  id: string;
  title: string;
  agentName: string;
  taskTitle?: string;
  status: Session['status'];
  createdAt: Date;
  closedAt?: Date;
  duration?: number;
  turnsUsed: number;
  tokensUsed: number;
}
```

---

## Component Specifications

### SessionHistory (Container)

```typescript
// app/components/views/session-history/index.tsx
export interface SessionHistoryProps {
  projectId: string;
  taskId?: string;
  initialFilters?: SessionFilters;
  onSessionSelect?: (session: Session) => void;
  compact?: boolean;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `projectId` | `string` | Yes | - | Project to show sessions for |
| `taskId` | `string` | No | - | Filter to specific task |
| `initialFilters` | `SessionFilters` | No | `{}` | Initial filter values |
| `onSessionSelect` | `(session) => void` | No | - | Called when session clicked |
| `compact` | `boolean` | No | `false` | Use compact layout |

---

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Session History                                              [Export ▼]│
│                                                                         │
│  ┌─ Filters ───────────────────────────────────────────────────────────┐│
│  │ [Status ▼]  [Agent ▼]  [Date Range]  [🔍 Search sessions...]        ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─ Sessions ──────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  ┌───────────────────────────────────────────────────────────────┐ ││
│  │  │ ● Session #1234                                    2h ago     │ ││
│  │  │   "Implement user authentication"                             │ ││
│  │  │   Agent: TaskBot · 23 turns · 45.2k tokens        [Completed] │ ││
│  │  └───────────────────────────────────────────────────────────────┘ ││
│  │                                                                     ││
│  │  ┌───────────────────────────────────────────────────────────────┐ ││
│  │  │ ○ Session #1233                                    5h ago     │ ││
│  │  │   "Fix navigation bug"                                        │ ││
│  │  │   Agent: BugFixer · 15 turns · 28.1k tokens         [Closed]  │ ││
│  │  └───────────────────────────────────────────────────────────────┘ ││
│  │                                                                     ││
│  │  ┌───────────────────────────────────────────────────────────────┐ ││
│  │  │ ⚠ Session #1232                                  Yesterday    │ ││
│  │  │   "Add dark mode support"                                     │ ││
│  │  │   Agent: FeatureBot · 47 turns · 89.3k tokens       [Error]   │ ││
│  │  └───────────────────────────────────────────────────────────────┘ ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Showing 1-10 of 47 sessions                          [← Previous] [→] │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### SessionListItem

```typescript
// app/components/views/session-history/components/session-list-item.tsx
export interface SessionListItemProps {
  session: SessionListItem;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}
```

#### Standard Layout

| Element | Position | Style |
|---------|----------|-------|
| Status indicator | Left | 12px circle, status color |
| Session ID | Top left | Monospace, muted |
| Timestamp | Top right | Relative time |
| Task title | Middle | 14px, primary color, truncate |
| Agent name | Bottom left | 13px, muted |
| Metrics | Bottom middle | turns · tokens |
| Status badge | Bottom right | Colored badge |

#### Compact Layout

| Element | Position | Style |
|---------|----------|-------|
| Status indicator | Left | 8px circle |
| Task title | Center | 13px, truncate |
| Metrics | Right | Condensed |

---

### Status Colors

| Status | Dot | Badge Background | Badge Text |
|--------|-----|------------------|------------|
| `idle` | `#8b949e` | `bg-slate-500/15` | `text-slate-400` |
| `initializing` | `#58a6ff` | `bg-blue-500/15` | `text-blue-400` |
| `active` | `#3fb950` (pulse) | `bg-green-500/15` | `text-green-400` |
| `paused` | `#d29922` | `bg-amber-500/15` | `text-amber-400` |
| `closing` | `#8b949e` | `bg-slate-500/15` | `text-slate-400` |
| `closed` | `#a371f7` | `bg-purple-500/15` | `text-purple-400` |
| `error` | `#f85149` | `bg-red-500/15` | `text-red-400` |

---

### FilterBar

```typescript
// app/components/views/session-history/components/filter-bar.tsx
export interface FilterBarProps {
  filters: SessionFilters;
  onFiltersChange: (filters: SessionFilters) => void;
  agents: { id: string; name: string }[];
}
```

#### Filter Controls

| Filter | Type | Options |
|--------|------|---------|
| Status | Multi-select | All statuses |
| Agent | Single-select | Project agents |
| Date Range | Date picker | From/To dates |
| Search | Text input | Searches title |

---

### SessionDetail (Expandable)

```typescript
// app/components/views/session-history/components/session-detail.tsx
export interface SessionDetailProps {
  session: Session;
  onReplay?: () => void;
  onViewLogs?: () => void;
}
```

#### Detail Sections

| Section | Content |
|---------|---------|
| Overview | Duration, timestamps, metrics |
| Agent | Agent name, model, configuration |
| Task | Task title, status, branch |
| Summary | AI-generated session summary |
| Actions | View logs, Replay, Export |

---

## Metrics Display

### Token Formatting

```typescript
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return tokens.toString();
}
```

### Duration Formatting

```typescript
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
```

---

## Pagination

| Property | Value |
|----------|-------|
| Page size | 10 items |
| Navigation | Previous/Next buttons |
| Info text | "Showing X-Y of Z sessions" |
| Loading | Skeleton rows while fetching |

---

## Business Rules

| Rule | Description |
|------|-------------|
| **Default sort** | Most recent first (createdAt desc) |
| **Active sessions** | Shown at top regardless of sort |
| **Retention** | Sessions retained for 30 days |
| **Export** | Export as JSON or CSV |
| **Replay** | Only available for completed sessions |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| List role | `role="list"` on container |
| Item role | `role="listitem"` on each session |
| Status | `aria-label` includes status |
| Keyboard | Arrow keys navigate list |
| Focus | Visible focus indicator |

---

## Error Conditions

| Condition | Error Code | UI Behavior |
|-----------|------------|-------------|
| Load failed | `SESSION_LOAD_ERROR` | Show error state with retry |
| No sessions | - | Show empty state |
| Session not found | `SESSION_NOT_FOUND` | Show not found message |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Session Service](../services/session-service.md) | Session data source |
| [Agent Session View](./agent-session-view.md) | Active session display |
| [Loading Skeletons](./loading-skeletons.md) | Loading states |
| [Empty States](./empty-states.md) | No sessions state |
