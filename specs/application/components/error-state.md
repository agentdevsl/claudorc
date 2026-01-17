# ErrorState Component Specification

## Overview

The ErrorState component provides detailed error visualization for agent failures, including error details, stack traces, activity logs, and retry options. It helps users understand what went wrong and take corrective action.

**Related Wireframes:**

- [Error State Expanded](../wireframes/error-state-expanded.html) - Full error view with stack trace and retry options

---

## Interface Definition

```typescript
// app/components/views/error-state/types.ts
import type { AgentRun } from '@/lib/services/agent-service.types';
import type { Task } from '@/lib/services/task-service.types';

// ===== Component Props =====
export interface ErrorStateProps {
  /** The failed agent run */
  agentRun: AgentRun;
  /** Associated task */
  task: Task;
  /** Error details */
  error: AgentError;
  /** Activity log before failure */
  activityLog: ActivityLogEntry[];
  /** Callback for retry */
  onRetry?: (options: RetryOptions) => void;
  /** Callback for skip task */
  onSkip?: () => void;
  /** Callback for abort */
  onAbort?: () => void;
  /** Callback for viewing full logs */
  onViewLogs?: () => void;
}

// ===== Error Details =====
export interface AgentError {
  code: string;
  type: string;
  message: string;
  location?: {
    file: string;
    line: number;
    column?: number;
  };
  stackTrace?: string;
  timestamp: Date;
}

// ===== Activity Log Entry =====
export interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  type: 'read' | 'edit' | 'bash' | 'result' | 'stdout' | 'stderr' | 'error';
  message: string;
  details?: unknown;
}

// ===== Retry Options =====
export interface RetryOptions {
  feedback?: string;
  fromCheckpoint: boolean;
  increaseTurns: boolean;
  useStrongerModel: boolean;
}
```

---

## Component Specifications

### ErrorState (Container)

```typescript
// app/components/views/error-state/index.tsx
export interface ErrorStateProps {
  agentRun: AgentRun;
  task: Task;
  error: AgentError;
  activityLog: ActivityLogEntry[];
  onRetry?: (options: RetryOptions) => void;
  onSkip?: () => void;
  onAbort?: () => void;
  onViewLogs?: () => void;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `agentRun` | `AgentRun` | Yes | - | Failed agent run |
| `task` | `Task` | Yes | - | Associated task |
| `error` | `AgentError` | Yes | - | Error details |
| `activityLog` | `ActivityLogEntry[]` | Yes | - | Activity before failure |
| `onRetry` | `function` | No | - | Retry callback |
| `onSkip` | `function` | No | - | Skip task callback |
| `onAbort` | `function` | No | - | Abort callback |
| `onViewLogs` | `function` | No | - | View logs callback |

---

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════════════╗  │
│  ║  ✗  Agent Failed                                                  ║  │
│  ║                                                                   ║  │
│  ║  📋 #TSK-148 "Add real-time agent collaboration mode"             ║  │
│  ║  📊 Failed at: Turn 23 of 50 · ⏱ Duration: 4m 12s                ║  │
│  ╚═══════════════════════════════════════════════════════════════════╝  │
│                                                                         │
│  ┌─────────────────────────────────────────┐  ┌─────────────────────┐  │
│  │                                         │  │                     │  │
│  │  ┌─ Error Details ────────────────────┐ │  │  ┌─ Retry Options ─┐│  │
│  │  │                                    │ │  │  │                 ││  │
│  │  │  ⬡ ValidationError                 │ │  │  │  Feedback:      ││  │
│  │  │                                    │ │  │  │  ┌─────────────┐││  │
│  │  │  ┌─────────────────────────────┐   │ │  │  │  │             │││  │
│  │  │  │ Schema mismatch at field    │   │ │  │  │  │             │││  │
│  │  │  │ 'user_id': expected string, │   │ │  │  │  └─────────────┘││  │
│  │  │  │ received number             │   │ │  │  │                 ││  │
│  │  │  └─────────────────────────────┘   │ │  │  │  [✓] From       ││  │
│  │  │                                    │ │  │  │      checkpoint ││  │
│  │  │  📄 src/lib/collaboration/types.ts │ │  │  │  [ ] Increase   ││  │
│  │  │     :47                            │ │  │  │      turns      ││  │
│  │  │                                    │ │  │  │  [ ] Use opus   ││  │
│  │  └────────────────────────────────────┘ │  │  │                 ││  │
│  │                                         │  │  │  [Retry Task]   ││  │
│  │  ┌─ Stack Trace ──────────── [Copy] ──┐ │  │  │                 ││  │
│  │  │                                    │ │  │  └─────────────────┘│  │
│  │  │  ValidationError: Schema mismatch  │ │  │                     │  │
│  │  │    at validateSchema               │ │  │  ┌─ Actions ───────┐│  │
│  │  │       (src/lib/validation.ts:23)   │ │  │  │                 ││  │
│  │  │    at processMessage               │ │  │  │  [Skip Task]    ││  │
│  │  │       (src/lib/.../handler.ts:89)  │ │  │  │                 ││  │
│  │  │    at WebSocketServer.onMessage    │ │  │  │  [Abort & Return││  │
│  │  │       (src/lib/.../websocket.ts:47)│ │  │  │   to Queue]     ││  │
│  │  │    ...                             │ │  │  │                 ││  │
│  │  │                                    │ │  │  │  View Full Logs ││  │
│  │  └────────────────────────────────────┘ │  │  │                 ││  │
│  │                                         │  │  └─────────────────┘│  │
│  │  ┌─ Activity Log Before Failure ──────┐ │  │                     │  │
│  │  │                                    │ │  └─────────────────────┘  │
│  │  │  14:32:26  Read   src/lib/...      │ │                           │
│  │  │  14:32:28  Edit   Adding handler   │ │                           │
│  │  │  14:32:30  Bash   npm run typecheck│ │                           │
│  │  │  14:32:32  result ✓ No type errors │ │                           │
│  │  │  14:32:34  Read   src/lib/...      │ │                           │
│  │  │  14:32:36  Edit   Updating...      │ │                           │
│  │  │  14:32:38  Bash   npm run test     │ │                           │
│  │  │  14:32:40  stdout Running tests    │ │                           │
│  │  │  14:32:42  stderr FAIL: test/...   │ │                           │
│  │  │  14:32:44  ERROR  ValidationError  │ │                           │
│  │  │                                    │ │                           │
│  │  └────────────────────────────────────┘ │                           │
│  │                                         │                           │
│  └─────────────────────────────────────────┘                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### ErrorBanner

```typescript
// app/components/views/error-state/components/error-banner.tsx
export interface ErrorBannerProps {
  taskId: string;
  taskTitle: string;
  turn: number;
  maxTurns: number;
  duration: number;
}
```

#### Visual Design

| Property | Value |
|----------|-------|
| Background | Gradient: `#da3633` → `#8b1a1a` |
| Border bottom | 1px solid `#f85149` |
| Padding | 24px 32px |
| Icon | 48px circle, white X on dark bg |

---

### ErrorDetailsCard

```typescript
// app/components/views/error-state/components/error-details.tsx
export interface ErrorDetailsCardProps {
  error: AgentError;
}
```

#### Error Type Badge

| Property | Value |
|----------|-------|
| Background | `rgba(248, 81, 73, 0.15)` |
| Text color | `#f85149` |
| Font | Monospace, 12px, semibold |
| Icon | Hexagon |
| Border radius | 16px pill |

#### Error Message Box

| Property | Value |
|----------|-------|
| Background | `#1c2128` |
| Left border | 3px solid `#f85149` |
| Font | 16px, medium weight |
| Padding | 16px |

---

### StackTracePanel

```typescript
// app/components/views/error-state/components/stack-trace.tsx
export interface StackTracePanelProps {
  stackTrace: string;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  onCopy?: () => void;
}
```

#### Syntax Highlighting

| Element | Color |
|---------|-------|
| Error message | `#f85149` (red) |
| File path | `#58a6ff` (blue) |
| Line number | `#d29922` (amber) |
| Function name | `#e6edf3` (default) |

---

### ActivityLog

```typescript
// app/components/views/error-state/components/activity-log.tsx
export interface ActivityLogProps {
  entries: ActivityLogEntry[];
  maxEntries?: number;
}
```

#### Log Entry Types

| Type | Badge Color | Icon |
|------|-------------|------|
| `read` | Blue | 📖 |
| `edit` | Purple | ✏️ |
| `bash` | Green | ⌨️ |
| `result` | Green | ✓ |
| `stdout` | Gray | → |
| `stderr` | Amber | ⚠ |
| `error` | Red | ✗ |

#### Log Entry Layout

| Element | Width | Style |
|---------|-------|-------|
| Timestamp | 70px | Monospace, subtle |
| Type badge | 70px | Colored, centered |
| Message | Flex | Truncate with ellipsis |

---

### RetryOptionsPanel

```typescript
// app/components/views/error-state/components/retry-options.tsx
export interface RetryOptionsPanelProps {
  onRetry: (options: RetryOptions) => void;
  defaultFeedback?: string;
}
```

#### Checkbox Options

| Option | Default | Description |
|--------|---------|-------------|
| From checkpoint | ✓ | Start from last successful state |
| Increase turns | ○ | Add more turns to limit |
| Use opus | ○ | Switch to more capable model |

#### Feedback Textarea

| Property | Value |
|----------|-------|
| Min height | 100px |
| Placeholder | "Provide additional context for retry..." |
| Font | Sans-serif, 14px |

---

### ActionButtons

```typescript
// app/components/views/error-state/components/action-buttons.tsx
export interface ActionButtonsProps {
  onRetry: () => void;
  onSkip: () => void;
  onAbort: () => void;
  onViewLogs: () => void;
}
```

#### Button Variants

| Button | Variant | Icon |
|--------|---------|------|
| Retry Task | Primary (blue) | ↻ |
| Skip Task | Warning (amber outline) | ⏭ |
| Abort & Return | Danger (red) | ✗ |
| View Full Logs | Link | 📄 |

---

## Business Rules

| Rule | Description |
|------|-------------|
| **Checkpoint recovery** | Saves state after each successful action |
| **Feedback injection** | Feedback added to next prompt |
| **Model upgrade** | Opus used for complex error recovery |
| **Turn increase** | Adds 50% more turns |
| **Skip** | Moves task back to backlog |
| **Abort** | Cancels run, preserves worktree state |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| Error announcement | `role="alert"` on banner |
| Collapsible | `aria-expanded` on stack trace |
| Focus | Focus retry button on load |
| Color contrast | 7:1 for error text |

---

## Error Codes

| Code | Type | Description |
|------|------|-------------|
| `AGENT_EXECUTION_ERROR` | Runtime | General execution failure |
| `AGENT_TURN_LIMIT_EXCEEDED` | Limit | Max turns reached |
| `AGENT_TOOL_NOT_ALLOWED` | Permission | Blocked tool usage |
| `VALIDATION_ERROR` | Validation | Schema/data validation |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Agent Service](../services/agent-service.md) | Agent execution, retry |
| [Agent Lifecycle](../state-machines/agent-lifecycle.md) | Error state handling |
| [Error Catalog](../errors/error-catalog.md) | Error codes |
| [Toast Notifications](./toast-notifications.md) | Error toasts |
