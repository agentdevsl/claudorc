# AgentSessionView Component Specification

## Overview

The AgentSessionView is the primary interface for observing and interacting with a running agent session. It provides real-time streaming output, collaborative presence indicators, activity tracking, and bidirectional terminal input via Durable Streams.

**Related Wireframes:**

- [Agent Session Presence](../wireframes/agent-session-presence.html) - Real-time presence indicators, avatar stack, share URLs
- [GitHub Terminal Split](../wireframes/github-terminal-split.html) - Agent stream, file preview layout

---

## Interface Definition

```typescript
// app/components/views/agent-session/types.ts
import type { Result } from '@/lib/utils/result';
import type { Session, SessionWithPresence } from '@/lib/services/session-service.types';
import type { AgentStateEvent, ToolCallEvent, TerminalEvent, PresenceEvent, ChunkEvent } from '@/lib/sessions/schema';

// ===== Result Type Pattern =====
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// ===== Component Props =====
export interface AgentSessionViewProps {
  /** Session ID to display */
  sessionId: string;
  /** Current user ID for presence */
  userId: string;
  /** Optional callback when session ends */
  onSessionEnd?: () => void;
  /** Optional callback when session errors */
  onError?: (error: Error) => void;
}

// ===== Session State =====
export interface AgentSessionState {
  /** Session metadata with presence */
  session: SessionWithPresence | null;
  /** Agent execution status */
  agentStatus: AgentStateEvent['status'];
  /** Current turn number */
  turn: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Accumulated streaming text */
  streamingText: string;
  /** Stream output lines for terminal display */
  streamLines: StreamLine[];
  /** Active tool calls */
  toolCalls: ToolCallEvent[];
  /** Activity feed items */
  activityItems: ActivityItem[];
  /** Active participants */
  participants: PresenceEvent[];
  /** Viewer count */
  viewerCount: number;
  /** Connection status */
  isConnected: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

// ===== Stream Line Types =====
export type StreamLineType =
  | 'prompt'    // Agent prompt marker (green)
  | 'command'   // Agent command text (default)
  | 'output'    // Command output (muted)
  | 'thinking'  // Agent thinking text (yellow, italic)
  | 'action'    // Action indicator (blue)
  | 'success'   // Success message (green)
  | 'error';    // Error message (red)

export interface StreamLine {
  id: string;
  type: StreamLineType;
  content: string;
  timestamp: number;
  agentId?: string;
  toolName?: string;
}

// ===== Activity Feed =====
export type ActivityItemType =
  | 'join'      // User joined session
  | 'leave'     // User left session
  | 'watch'     // User watching
  | 'start'     // Session started
  | 'pause'     // Agent paused
  | 'resume'    // Agent resumed
  | 'complete'  // Agent completed
  | 'error';    // Error occurred

export interface ActivityItem {
  id: string;
  type: ActivityItemType;
  userId?: string;
  displayName?: string;
  message: string;
  timestamp: number;
}

// ===== Events =====
export interface AgentSessionEvents {
  onInputSubmit: (input: string) => void;
  onSessionLeave: () => void;
  onSessionEnd: () => void;
  onCopyShareUrl: () => void;
  onPresenceUpdate: (cursor: { x: number; y: number }) => void;
}
```

---

## Component Specifications

### AgentSessionView (Container)

```typescript
// app/components/views/agent-session/index.tsx
export interface AgentSessionViewProps {
  sessionId: string;
  userId: string;
  onSessionEnd?: () => void;
  onError?: (error: Error) => void;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `sessionId` | `string` | Yes | - | Session ID to display and subscribe to |
| `userId` | `string` | Yes | - | Current user's ID for presence tracking |
| `onSessionEnd` | `() => void` | No | - | Callback when session ends |
| `onError` | `(error: Error) => void` | No | - | Callback when session errors |

#### State

| State | Type | Initial | Description |
|-------|------|---------|-------------|
| `session` | `SessionWithPresence \| null` | `null` | Session metadata with active users |
| `agentStatus` | `AgentStateEvent['status']` | `'idle'` | Current agent execution status |
| `turn` | `number` | `0` | Current turn number |
| `progress` | `number` | `0` | Progress percentage (0-100) |
| `streamingText` | `string` | `''` | Accumulated streaming output |
| `streamLines` | `StreamLine[]` | `[]` | Parsed stream lines for display |
| `toolCalls` | `ToolCallEvent[]` | `[]` | Active and completed tool calls |
| `activityItems` | `ActivityItem[]` | `[]` | Activity feed events |
| `participants` | `PresenceEvent[]` | `[]` | Active session participants |
| `viewerCount` | `number` | `0` | Number of active viewers |
| `isConnected` | `boolean` | `false` | Durable Stream connection status |
| `isLoading` | `boolean` | `true` | Initial loading state |
| `error` | `Error \| null` | `null` | Error state |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `onInputSubmit` | `string` | User submits terminal input |
| `onSessionLeave` | - | User clicks Leave Session |
| `onSessionEnd` | - | User clicks End Session |
| `onCopyShareUrl` | - | User copies share URL |
| `onPresenceUpdate` | `{ x: number; y: number }` | User cursor position update |

---

### HeaderBar

```typescript
// app/components/views/agent-session/components/header-bar.tsx
export interface HeaderBarProps {
  title: string;
  status: AgentStateEvent['status'];
  viewerCount: number;
}
```

#### Layout

- Full width, spans both grid columns
- Height: 48px (auto)
- Background: `bg-slate-800` (#161b22)
- Border: `border-b border-slate-700` (#30363d)
- Padding: 12px 20px

#### Sub-components

| Component | Position | Content |
|-----------|----------|---------|
| SessionTitle | Left | Session name, 16px semibold |
| StatusBadge | Left (after title) | Pulsing dot + status text |
| ViewerCount | Right | Eye icon + "{n} watching" |

#### Status Badge Variants

| Status | Background | Text | Dot Animation |
|--------|------------|------|---------------|
| `idle` | `bg-slate-700/50` | `text-slate-400` | None |
| `starting` | `bg-blue-500/15` | `text-blue-400` | Pulse 2s |
| `running` | `bg-green-500/15` | `text-green-400` | Pulse 2s |
| `paused` | `bg-amber-500/15` | `text-amber-400` | None |
| `error` | `bg-red-500/15` | `text-red-400` | None |
| `completed` | `bg-purple-500/15` | `text-purple-400` | None |

---

### PresenceBar

```typescript
// app/components/views/agent-session/components/presence-bar.tsx
export interface PresenceBarProps {
  participants: PresenceEvent[];
  viewerCount: number;
  shareUrl: string;
  onCopyUrl: () => void;
}
```

#### Layout

- Full width, spans both grid columns
- Background: `bg-slate-850` (#1c2128)
- Border: `border-b border-slate-700`
- Padding: 12px 20px

#### Avatar Stack

| Property | Value |
|----------|-------|
| Avatar size | 32px diameter |
| Border | 2px solid background color |
| Overlap | -8px margin-left |
| Max visible | 5 avatars + overflow indicator |
| Online indicator | 10px green dot, bottom-right |
| Hover | translateY(-2px), z-index: 10 |

#### Share URL Panel

| Component | Description |
|-----------|-------------|
| Label | "SHARE" uppercase, 12px, muted |
| URL Input | Monospace, `text-blue-400`, readonly |
| Copy Button | Icon button, hover: blue background |

---

### AgentStreamPanel

```typescript
// app/components/views/agent-session/components/agent-stream-panel.tsx
export interface AgentStreamPanelProps {
  lines: StreamLine[];
  isStreaming: boolean;
  viewerIndicators: { color: string }[];
}
```

#### Layout

- Position: Main content area (left column)
- Flex: 1 (fills available space)
- Margin: 16px (8px right for gutter)
- Background: `bg-slate-800` with `bg-slate-900` content area
- Border: `border border-slate-700`, 6px radius

#### Stream Header

| Element | Style |
|---------|-------|
| Title | "Agent Stream" with terminal icon |
| Viewer dots | 8px circles, participant colors |

#### Stream Content

| Property | Value |
|----------|-------|
| Font | Fira Code, 13px |
| Line height | 1.6 |
| Padding | 16px |
| Overflow | `overflow-y-auto` |

#### Stream Line Colors

| Type | Color Variable | Tailwind Class |
|------|----------------|----------------|
| `prompt` | `--success-fg` (#3fb950) | `text-green-400` |
| `command` | `--fg-default` (#e6edf3) | `text-slate-200` |
| `output` | `--fg-muted` (#8b949e) | `text-slate-400` |
| `thinking` | `--attention-fg` (#d29922) | `text-amber-400 italic` |
| `action` | `--accent-fg` (#58a6ff) | `text-blue-400` |
| `success` | `--success-fg` (#3fb950) | `text-green-400` |
| `error` | `--danger-fg` (#f85149) | `text-red-400` |

#### Cursor Animation

```css
.stream-cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background-color: var(--fg-default);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

---

### ActivitySidebar

```typescript
// app/components/views/agent-session/components/activity-sidebar.tsx
export interface ActivitySidebarProps {
  items: ActivityItem[];
  onLeaveSession: () => void;
  onEndSession: () => void;
  canEndSession: boolean;
}
```

#### Layout

| Property | Value |
|----------|-------|
| Width | 320px (fixed) |
| Position | Right column |
| Background | `bg-slate-800` |
| Border | `border-l border-slate-700` |

#### Activity Item

| Component | Style |
|-----------|-------|
| Icon container | 32px circle, colored background |
| Text | 13px, primary color |
| Username | `font-weight: 500` |
| Timestamp | 12px, muted color |

#### Activity Icon Colors

| Type | Background | Icon Color |
|------|------------|------------|
| `join` | `bg-green-500/15` | `text-green-400` |
| `leave` | `bg-slate-500/15` | `text-slate-400` |
| `watch` | `bg-purple-500/15` | `text-purple-400` |
| `start` | `bg-blue-500/15` | `text-blue-400` |
| `error` | `bg-red-500/15` | `text-red-400` |

#### Session Actions

| Button | Variant | Action |
|--------|---------|--------|
| End Session | `danger` | Close session for all |
| Leave Session | `secondary` | Leave but keep session active |

---

### InputArea

```typescript
// app/components/views/agent-session/components/input-area.tsx
export interface InputAreaProps {
  onSubmit: (input: string) => void;
  disabled: boolean;
  placeholder?: string;
}
```

#### Layout

| Property | Value |
|----------|-------|
| Position | Bottom row, left column only |
| Padding | 16px (8px right) |
| Background | `bg-slate-900` |

#### Input Container

| Property | Value |
|----------|-------|
| Background | `bg-slate-800` |
| Border | `border border-slate-700` |
| Border radius | 6px |
| Padding | 12px |
| Gap | 12px |

#### Components

| Element | Description |
|---------|-------------|
| Input field | Flex: 1, monospace, 14px |
| Shortcut hint | "Enter" badge, muted |
| Send button | Primary, with send icon |

---

## Layout Grid

```typescript
// Grid template for AgentSessionView
const gridLayout = {
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
  gridTemplateColumns: '1fr 320px',
  minHeight: '100vh',
  gap: 0,
};

// Row assignments
// Row 1: HeaderBar (spans both columns)
// Row 2: PresenceBar (spans both columns)
// Row 3: AgentStreamPanel (col 1), ActivitySidebar (col 2)
// Row 4: InputArea (col 1 only)
```

### CSS Grid Definition

```css
.agent-session-view {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  grid-template-columns: 1fr 320px;
  min-height: 100vh;
  gap: 0;
}

.header-bar {
  grid-column: 1 / -1; /* Span all columns */
}

.presence-bar {
  grid-column: 1 / -1; /* Span all columns */
}

.agent-stream-panel {
  grid-column: 1 / 2;
  grid-row: 3 / 4;
}

.activity-sidebar {
  grid-column: 2 / 3;
  grid-row: 3 / 5; /* Extends into input row */
}

.input-area {
  grid-column: 1 / 2;
  grid-row: 4 / 5;
}
```

---

## Business Rules

### Session Lifecycle

| Rule | Description |
|------|-------------|
| **Auto-join** | Users automatically join presence on component mount |
| **Heartbeat** | Presence heartbeat every 10 seconds |
| **Stale timeout** | Users marked offline after 30 seconds without heartbeat |
| **Leave on unmount** | Component cleanup publishes leave event |
| **Reconnect** | Auto-reconnect on connection loss with exponential backoff |

### Stream Processing

| Rule | Description |
|------|-------------|
| **Token batching** | Streaming tokens batched for 16ms before render |
| **Line parsing** | Stream text parsed into lines on newline characters |
| **Type detection** | Line type detected from prefixes (`agent $`, `Thinking:`, etc.) |
| **Auto-scroll** | Scroll to bottom on new content unless user scrolled up |
| **Max lines** | Virtual scrolling for sessions with 10,000+ lines |

### Presence Management

| Rule | Description |
|------|-------------|
| **Max visible** | Show max 5 avatars, then "+N more" indicator |
| **Sort order** | Current user first, then by join time |
| **Cursor throttle** | Cursor updates throttled to 50ms |
| **Offline cleanup** | Remove users from list after 30s inactive |

### Input Handling

| Rule | Description |
|------|-------------|
| **Disabled states** | Input disabled when agent is idle or session is closed |
| **Optimistic UI** | Input appears immediately in stream, rollback on error |
| **History** | Up/Down arrows navigate input history (last 50 commands) |
| **Escape** | Clear current input |

---

## Implementation Outline

### Main Component

```typescript
// app/components/views/agent-session/index.tsx
import { useSession, useSessionPresence } from '@/lib/sessions/hooks';
import { HeaderBar } from './components/header-bar';
import { PresenceBar } from './components/presence-bar';
import { AgentStreamPanel } from './components/agent-stream-panel';
import { ActivitySidebar } from './components/activity-sidebar';
import { InputArea } from './components/input-area';

export function AgentSessionView({ sessionId, userId, onSessionEnd, onError }: AgentSessionViewProps) {
  // Subscribe to session events via Durable Streams
  const {
    session,
    messages,
    toolCalls,
    terminal,
    agentState,
    isConnected,
    isLoading,
    error,
    sendInput,
  } = useSession(sessionId, userId);

  // Presence management
  const { participants, viewerCount, updateCursor } = useSessionPresence(sessionId, userId);

  // Parse stream content into display lines
  const streamLines = useStreamLines(messages, toolCalls, terminal);

  // Activity feed from presence and state events
  const activityItems = useActivityFeed(participants, agentState);

  // Share URL
  const shareUrl = useMemo(
    () => `${window.location.origin}/sessions/${sessionId}`,
    [sessionId]
  );

  // Handle errors
  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  if (isLoading) {
    return <SessionLoadingSkeleton />;
  }

  if (error) {
    return <SessionErrorState error={error} />;
  }

  return (
    <div className="agent-session-view">
      <HeaderBar
        title={session?.title ?? 'Agent Session'}
        status={agentState?.status ?? 'idle'}
        viewerCount={viewerCount}
      />

      <PresenceBar
        participants={participants}
        viewerCount={viewerCount}
        shareUrl={shareUrl}
        onCopyUrl={() => navigator.clipboard.writeText(shareUrl)}
      />

      <AgentStreamPanel
        lines={streamLines}
        isStreaming={agentState?.status === 'running'}
        viewerIndicators={participants.slice(0, 3).map((p) => ({
          color: getAvatarColor(p.userId),
        }))}
      />

      <ActivitySidebar
        items={activityItems}
        onLeaveSession={() => leaveSession(sessionId, userId)}
        onEndSession={() => closeSession(sessionId)}
        canEndSession={session?.ownerId === userId}
      />

      <InputArea
        onSubmit={sendInput}
        disabled={agentState?.status !== 'running'}
        placeholder="Send a message or command to the agent..."
      />
    </div>
  );
}
```

### Custom Hooks

```typescript
// app/components/views/agent-session/hooks/use-stream-lines.ts
export function useStreamLines(
  messages: Message[],
  toolCalls: ToolCallEvent[],
  terminal: TerminalEvent[]
): StreamLine[] {
  return useMemo(() => {
    const lines: StreamLine[] = [];

    // Merge and sort all events by timestamp
    const allEvents = [
      ...messages.map((m) => ({ ...m, _source: 'message' as const })),
      ...toolCalls.map((t) => ({ ...t, _source: 'tool' as const })),
      ...terminal.map((t) => ({ ...t, _source: 'terminal' as const })),
    ].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of allEvents) {
      if (event._source === 'message') {
        // Parse message text into lines
        const textLines = event.text.split('\n');
        for (const line of textLines) {
          lines.push(parseStreamLine(line, event.timestamp, event.agentId));
        }
      } else if (event._source === 'tool') {
        // Tool call start/result
        if (event.status === 'running') {
          lines.push({
            id: `${event.id}-start`,
            type: 'action',
            content: `-> ${event.tool}`,
            timestamp: event.timestamp,
            agentId: event.agentId,
            toolName: event.tool,
          });
        } else if (event.status === 'complete') {
          lines.push({
            id: `${event.id}-result`,
            type: 'output',
            content: formatToolOutput(event.output),
            timestamp: event.timestamp,
            agentId: event.agentId,
            toolName: event.tool,
          });
        }
      } else if (event._source === 'terminal') {
        // Terminal I/O
        lines.push({
          id: event.id,
          type: event.type === 'input' ? 'command' : event.type === 'error' ? 'error' : 'output',
          content: event.data,
          timestamp: event.timestamp,
        });
      }
    }

    return lines;
  }, [messages, toolCalls, terminal]);
}

function parseStreamLine(text: string, timestamp: number, agentId?: string): StreamLine {
  // Detect line type from content
  if (text.startsWith('agent $')) {
    return { id: createId(), type: 'prompt', content: text, timestamp, agentId };
  }
  if (text.startsWith('Thinking:') || text.includes('thinking...')) {
    return { id: createId(), type: 'thinking', content: text, timestamp, agentId };
  }
  if (text.startsWith('->') || text.startsWith('Reading') || text.startsWith('Editing')) {
    return { id: createId(), type: 'action', content: text, timestamp, agentId };
  }
  if (text.startsWith('SUCCESS') || text.startsWith('OK') || text.startsWith('Done')) {
    return { id: createId(), type: 'success', content: text, timestamp, agentId };
  }
  if (text.startsWith('ERROR') || text.startsWith('FAIL')) {
    return { id: createId(), type: 'error', content: text, timestamp, agentId };
  }
  return { id: createId(), type: 'output', content: text, timestamp, agentId };
}
```

```typescript
// app/components/views/agent-session/hooks/use-activity-feed.ts
export function useActivityFeed(
  participants: PresenceEvent[],
  agentState: AgentStateEvent | null
): ActivityItem[] {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const prevParticipantsRef = useRef<PresenceEvent[]>([]);

  // Track participant changes
  useEffect(() => {
    const prev = new Set(prevParticipantsRef.current.map((p) => p.userId));
    const current = new Set(participants.map((p) => p.userId));

    // New joins
    for (const p of participants) {
      if (!prev.has(p.userId)) {
        setItems((items) => [
          {
            id: createId(),
            type: 'join',
            userId: p.userId,
            displayName: p.displayName,
            message: `${p.displayName ?? 'User'} joined the session`,
            timestamp: Date.now(),
          },
          ...items,
        ]);
      }
    }

    // Leaves
    for (const p of prevParticipantsRef.current) {
      if (!current.has(p.userId)) {
        setItems((items) => [
          {
            id: createId(),
            type: 'leave',
            userId: p.userId,
            displayName: p.displayName,
            message: `${p.displayName ?? 'User'} left the session`,
            timestamp: Date.now(),
          },
          ...items,
        ]);
      }
    }

    prevParticipantsRef.current = participants;
  }, [participants]);

  // Track agent state changes
  useEffect(() => {
    if (!agentState) return;

    const statusMessages: Record<AgentStateEvent['status'], string | null> = {
      idle: null,
      starting: 'Agent starting...',
      running: 'Agent is running',
      paused: 'Agent paused',
      error: `Agent error: ${agentState.error}`,
      completed: 'Agent completed',
    };

    const message = statusMessages[agentState.status];
    if (message) {
      setItems((items) => [
        {
          id: createId(),
          type: agentState.status === 'error' ? 'error' : agentState.status === 'completed' ? 'complete' : 'start',
          message,
          timestamp: agentState.timestamp,
        },
        ...items,
      ]);
    }
  }, [agentState?.status]);

  return items;
}
```

---

## Durable Streams Integration

### Session Schema Channels

The component subscribes to these Durable Streams channels:

| Channel | Schema | Purpose |
|---------|--------|---------|
| `chunks` | `ChunkEvent` | Token streaming from agent |
| `toolCalls` | `ToolCallEvent` | Agent tool invocations |
| `presence` | `PresenceEvent` | Who's watching |
| `terminal` | `TerminalEvent` | Interactive I/O |
| `workflow` | `WorkflowEvent` | Approval events |
| `agentState` | `AgentStateEvent` | Agent status updates |

### Subscription Pattern

```typescript
// Component mounts -> subscribe to session
const unsubscribe = subscribeToSession(sessionId, {
  onChunk: (event) => {
    // Append to streaming text, trigger line parsing
  },
  onToolCall: (event) => {
    // Update tool calls state
  },
  onPresence: (event) => {
    // Update participants list
  },
  onTerminal: (event) => {
    // Add terminal I/O to stream
  },
  onAgentState: (event) => {
    // Update agent status, turn, progress
  },
  onReconnect: () => {
    // Fetch history to catch up
  },
  onError: (error) => {
    // Handle connection errors
  },
});

// Component unmounts -> cleanup
return () => {
  publishPresence(sessionId, userId, 'leave');
  unsubscribe();
};
```

---

## Error Conditions

| Condition | Error Code | UI Behavior |
|-----------|------------|-------------|
| Session not found | `SESSION_NOT_FOUND` | Show 404 error state |
| Session closed | `SESSION_CLOSED` | Show "Session ended" message, disable input |
| Connection failed | `SESSION_CONNECTION_FAILED` | Show reconnecting indicator, auto-retry |
| Publish failed | `PUBLISH_ERROR` | Show toast, rollback optimistic update |
| Invalid session ID | `VALIDATION_ERROR` | Redirect to session list |

---

## Accessibility

| Feature | Implementation |
|---------|---------------|
| Keyboard navigation | Tab through interactive elements |
| Screen reader | ARIA live regions for stream updates |
| Focus management | Focus input on mount |
| Color contrast | 7:1 ratio for all text |
| Reduced motion | Disable cursor blink animation |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Session Service](../services/session-service.md) | Session CRUD, presence management |
| [Agent Service](../services/agent-service.md) | Agent execution, tool calls |
| [Durable Sessions](../integrations/durable-sessions.md) | Event streaming, schema, hooks |
| [Component Patterns](../implementation/component-patterns.md) | UI component primitives |
| [Database Schema](../database/schema.md) | `sessions` table |
| [Error Catalog](../errors/error-catalog.md) | `SESSION_*` error codes |
| [User Stories](../user-stories.md) | Collaborative session requirements |
