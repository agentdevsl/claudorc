# QueueWaitingState Component Specification

## Overview

The QueueWaitingState component displays when a task is queued waiting for an available agent slot. It shows queue position, estimated wait time, and currently running agents.

**Related Wireframes:**
- [Queue Waiting State](../wireframes/queue-waiting-state.html) - Queue position display and running agent status

---

## Interface Definition

```typescript
// app/components/ui/queue-waiting-state/types.ts

// ===== Component Props =====
export interface QueueWaitingStateProps {
  /** Current position in queue */
  position: number;
  /** Total items in queue */
  queueLength: number;
  /** Task being queued */
  task: {
    id: string;
    title: string;
  };
  /** Currently running agents */
  runningAgents: RunningAgentInfo[];
  /** Maximum concurrent agents */
  maxConcurrent: number;
  /** Callback to cancel queued task */
  onCancel?: () => void;
  /** Optional estimated wait time in ms */
  estimatedWait?: number;
}

// ===== Running Agent Info =====
export interface RunningAgentInfo {
  id: string;
  name: string;
  taskId: string;
  taskTitle: string;
  progress: number;
  startedAt: Date;
  currentTurn: number;
  maxTurns: number;
}
```

---

## Component Specifications

### QueueWaitingState

```typescript
// app/components/ui/queue-waiting-state/index.tsx
export interface QueueWaitingStateProps {
  position: number;
  queueLength: number;
  task: { id: string; title: string };
  runningAgents: RunningAgentInfo[];
  maxConcurrent: number;
  onCancel?: () => void;
  estimatedWait?: number;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `position` | `number` | Yes | - | Position in queue (1-indexed) |
| `queueLength` | `number` | Yes | - | Total queued items |
| `task` | `object` | Yes | - | Queued task info |
| `runningAgents` | `RunningAgentInfo[]` | Yes | - | Currently running agents |
| `maxConcurrent` | `number` | Yes | - | Max concurrent limit |
| `onCancel` | `() => void` | No | - | Cancel callback |
| `estimatedWait` | `number` | No | - | Estimated wait in ms |

---

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                           ┌─────────────────┐                           │
│                           │       ⏳        │                           │
│                           │    Position     │                           │
│                           │                 │                           │
│                           │       #2        │                           │
│                           │    in queue     │                           │
│                           └─────────────────┘                           │
│                                                                         │
│                    Waiting for an available agent                       │
│                                                                         │
│          Your task "Implement user authentication" is queued            │
│                                                                         │
│  ┌─ Currently Running (3/3) ───────────────────────────────────────────┐│
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │ ● TaskBot                                                   │   ││
│  │  │   "Fix navigation bug"                                      │   ││
│  │  │   Turn 12/50 · 24% complete                                 │   ││
│  │  │   [████████░░░░░░░░░░░░░░░░░░░░░░░░░]                        │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │ ● BugFixer                                                  │   ││
│  │  │   "Add unit tests for auth"                                 │   ││
│  │  │   Turn 8/50 · 16% complete                                  │   ││
│  │  │   [█████░░░░░░░░░░░░░░░░░░░░░░░░░░░░]                        │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │ ● FeatureBot                                                │   ││
│  │  │   "Implement dark mode"                                     │   ││
│  │  │   Turn 45/50 · 90% complete · Finishing soon                │   ││
│  │  │   [████████████████████████████████████░░░░]                 │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│                            [Cancel Queue]                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Position Badge

```typescript
// app/components/ui/queue-waiting-state/components/position-badge.tsx
export interface PositionBadgeProps {
  position: number;
  total: number;
}
```

#### Visual Design

| Property | Value |
|----------|-------|
| Container | 120px × 120px |
| Background | `bg-slate-800` |
| Border | 2px dashed `border-slate-600` |
| Border radius | 16px |
| Icon | ⏳ or clock, 32px |
| Position | 36px, bold |
| Label | 14px, muted |

---

### RunningAgentCard

```typescript
// app/components/ui/queue-waiting-state/components/running-agent-card.tsx
export interface RunningAgentCardProps {
  agent: RunningAgentInfo;
}
```

#### Visual Design

| Element | Style |
|---------|-------|
| Container | `bg-slate-800`, rounded, padding 16px |
| Status dot | 8px green, pulsing |
| Agent name | 14px, semibold |
| Task title | 14px, muted, truncate |
| Progress info | 12px, muted |
| Progress bar | 4px height, green fill |

#### Progress Bar Colors

| Progress | Fill Color |
|----------|------------|
| 0-25% | `#58a6ff` (blue) |
| 25-75% | `#3fb950` (green) |
| 75-90% | `#d29922` (amber) |
| 90-100% | `#a371f7` (purple) - "Finishing soon" |

---

### Progress Calculation

```typescript
function calculateProgress(turn: number, maxTurns: number): number {
  return Math.min(100, Math.round((turn / maxTurns) * 100));
}

function getProgressLabel(progress: number, turn: number, maxTurns: number): string {
  if (progress >= 90) {
    return `Turn ${turn}/${maxTurns} · ${progress}% complete · Finishing soon`;
  }
  return `Turn ${turn}/${maxTurns} · ${progress}% complete`;
}
```

---

### Estimated Wait (Optional)

```typescript
function formatEstimatedWait(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return 'About 1 minute';
  if (minutes < 60) return `About ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  return `About ${hours} hour${hours > 1 ? 's' : ''}`;
}
```

---

## Animation

### Pulsing Status Dot

```css
.status-dot-running {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.9);
  }
}
```

### Position Badge Animation

```css
.position-badge {
  animation: gentle-bounce 3s ease-in-out infinite;
}

@keyframes gentle-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
```

---

## Business Rules

| Rule | Description |
|------|-------------|
| **Queue order** | First-in-first-out (FIFO) |
| **Position update** | Real-time via Durable Streams |
| **Auto-start** | Task starts automatically when slot available |
| **Cancel** | Removes from queue, returns task to backlog |
| **Estimate** | Based on average completion time of running tasks |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| Status | `aria-live="polite"` for position updates |
| Progress | `role="progressbar"` with aria values |
| Cancel | `aria-label="Cancel queue and return to backlog"` |
| Focus | Focus cancel button for keyboard users |

---

## Error Conditions

| Condition | Error Code | UI Behavior |
|-----------|------------|-------------|
| Queue full | `QUEUE_FULL` | Show error, prevent queue |
| Cancel failed | - | Show toast, retry |
| Position unavailable | - | Show "Calculating..." |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Agent Service](../services/agent-service.md) | Queue management |
| [Task Workflow](../state-machines/task-workflow.md) | Queue state |
| [Durable Sessions](../integrations/durable-sessions.md) | Real-time updates |
| [Error Catalog](../errors/error-catalog.md) | `QUEUE_*` error codes |
