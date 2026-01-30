# Plan: Claude Code CLI Monitor Page

## Overview

Add a dedicated page to monitor Claude Code CLI sessions running on the host machine. A daemon service watches `~/.claude/projects/` for JSONL session logs, parses them incrementally, and streams session state to the frontend via SSE. The feature is gated behind a `cli_monitor_enabled` global setting.

**Reference:** Inspired by [claude-code-ui](https://github.com/KyleAMathews/claude-code-ui) — same daemon/watcher pattern, adapted into AgentPane's existing architecture.

**Key constraint:** Sessions are in-memory only — no SQLite persistence needed for CLI monitor events.

---

## Architecture

```
~/.claude/projects/**/*.jsonl
    │  (fs.watch / chokidar)
    ▼
CliMonitorService (in-memory Map<sessionId, CliSession>)
    │  (publish)
    ▼
InMemoryDurableStreamsServer (stream: 'cli-monitor')
    │  (SSE)
    ▼
GET /api/cli-monitor/stream → EventSource
    │
    ▼
/cli-monitor page → CliSessionCard components
```

---

## Wireframes

Five design variations created at `specs/application/wireframes/`:

| File | Design Concept | Description |
|------|---------------|-------------|
| `cli-monitor.html` | **Dashboard** (primary) | Cards + stream layout, monitor bar, session cards grouped by project, right panel with live terminal stream |
| `cli-monitor-terminal.html` | **Terminal/tmux** | Multi-pane terminal layout showing live streams from multiple sessions simultaneously |
| `cli-monitor-timeline.html` | **Timeline/Swimlane** | Horizontal swimlane timeline with sessions as duration bars grouped by project |
| `cli-monitor-heatmap.html` | **Mission Control** | Orbital/radial visualization — sessions as glowing nodes orbiting a central status hub, telemetry HUD strip |
| `cli-monitor-matrix.html` | **Matrix Console** | Green-on-black cyberpunk terminal — sessions as vertical streaming columns, CRT effects, floating HUD panels |

---

## New Files

### 1. `src/services/cli-monitor/types.ts` — Type definitions

```typescript
export type CliSessionStatus =
  | 'working' | 'waiting_for_approval' | 'waiting_for_input' | 'idle';

export interface CliSession {
  sessionId: string;
  filePath: string;
  cwd: string;
  gitBranch?: string;
  status: CliSessionStatus;
  messageCount: number;
  goal?: string;
  recentOutput?: string;
  pendingToolUse?: { toolName: string; toolId: string };
  startedAt: number;
  lastActivityAt: number;
  lastReadOffset: number;
}
```

Event types: `cli-monitor:snapshot`, `cli-monitor:session-update`, `cli-monitor:session-removed`

### 2. `src/services/cli-monitor/cli-monitor.service.ts` — Daemon service

Core responsibilities:
- Watch `~/.claude/projects/` recursively for `.jsonl` files (use `fs.watch` initially, Bun-native)
- Maintain `Map<string, CliSession>` in memory
- Tail-read JSONL files from tracked byte offset on each change
- Derive session status from events (working/waiting_for_approval/waiting_for_input/idle)
- Publish updates to `InMemoryDurableStreamsServer` on stream `cli-monitor`
- Idle detection: 5min of no file activity → mark session idle
- Scan existing files on startup to catch already-running sessions
- Track ALL sessions (including completed/idle), not just active ones
- Use **chokidar** for file watching (cross-platform, robust)

Public API:
- `start()` / `stop()` — lifecycle
- `isActive()` — running check
- `getSessions()` — snapshot of all sessions

### 3. `src/services/cli-monitor/index.ts` — Barrel export

### 4. `src/server/routes/cli-monitor.ts` — API routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cli-monitor/sessions` | GET | List all active CLI sessions |
| `/api/cli-monitor/stream` | GET | SSE endpoint for real-time updates |
| `/api/cli-monitor/toggle` | POST | Enable/disable monitor (updates setting + starts/stops service) |

SSE endpoint follows the same pattern as `src/server/routes/sessions.ts`:
- On connect: send `cli-monitor:snapshot` with all current sessions
- Subscribe to `cli-monitor` stream for live updates via `addRealtimeSubscriber`
- 15s keep-alive ping
- Cleanup on disconnect

### 5. `src/app/routes/cli-monitor/index.tsx` — Frontend page

- LayoutShell with "CLI Monitor" breadcrumb
- Enable/disable toggle in header actions
- Empty state when disabled (with "Enable" CTA)
- Session cards grid when enabled
- SSE subscription via `EventSource` to `/api/cli-monitor/stream`
- State management: `useState<CliSession[]>` updated from SSE events

### 6. `src/app/components/features/cli-monitor/cli-session-card.tsx` — Session card

Card showing:
- Project name (extracted from cwd), git branch badge
- Status indicator (color-coded: green=working, yellow=waiting, gray=idle)
- Message count, time since start
- Recent output in monospace (truncated)
- Goal/prompt if available

Sessions grouped by repository/project. Show ALL sessions including completed and idle.

Status colors via CVA variants matching existing design tokens.

---

## Modified Files

### 7. `src/server/api.ts` — Service initialization

After existing service init (line ~460), add:
```typescript
// CLI Monitor Service (optional - enabled via settings)
let cliMonitorService: CliMonitorService | null = null;
const cliMonitorSetting = db.query.settings.findFirst({
  where: eq(settings.key, 'cli_monitor_enabled'),
});
if (cliMonitorSetting?.value === '"true"' || cliMonitorSetting?.value === 'true') {
  cliMonitorService = new CliMonitorService(inMemoryStreamsServer);
  await cliMonitorService.start();
}
```

Pass `cliMonitorService` to router dependencies.

### 8. `src/server/router.ts` — Mount routes

- Add `cliMonitorService` to `RouterDependencies` interface
- Import and mount: `app.route('/api/cli-monitor', createCliMonitorRoutes(...))`

### 9. `src/lib/api/client.ts` — API client

Add `cliMonitor` namespace:
- `listSessions()` → GET `/api/cli-monitor/sessions`
- `toggle(enabled: boolean)` → POST `/api/cli-monitor/toggle`

### 10. `src/app/components/features/sidebar.tsx` — Navigation

Add "CLI Monitor" link to ORGANIZATION section, conditionally rendered:
- Fetch `cli_monitor_enabled` setting on mount
- Show `Terminal` icon from Phosphor, route to `/cli-monitor`

### 11. `src/app/routes/settings/preferences.tsx` — Settings toggle

Add new `ConfigSection` for "CLI Monitor" with toggle:
- Setting key: `cli_monitor_enabled`
- On toggle: calls `POST /api/cli-monitor/toggle` to start/stop daemon dynamically

---

## JSONL Parsing Strategy

Claude Code CLI writes JSONL to `~/.claude/projects/{project-hash}/{session-id}.jsonl`. Each line is a JSON object with fields like:

```jsonl
{"type":"system","cwd":"/path/to/project","sessionId":"abc123","gitBranch":"main"}
{"type":"assistant","message":{"role":"assistant","content":[...]}}
{"type":"tool_use","tool":{"name":"Read","id":"toolu_123"}}
{"type":"tool_result","tool_result":{"tool_use_id":"toolu_123",...}}
{"type":"result","subtype":"success"}
```

Status derivation:
- `tool_use` event → `waiting_for_approval` (if permission required)
- `tool_result` / `assistant` streaming → `working`
- `result` / turn end → `waiting_for_input`
- No activity for 5 minutes → `idle`

**Note:** The exact JSONL format will need to be confirmed by inspecting actual `~/.claude/projects/` files during implementation. The parser should be defensive and skip unrecognized event types.

---

## Verification

1. **Unit tests** for `CliMonitorService`: JSONL parsing, status derivation, session lifecycle
2. **Manual testing:**
   - Enable setting in preferences → verify daemon starts (check server logs)
   - Open a Claude Code CLI session → verify it appears on `/cli-monitor` page
   - Interact with CLI session → verify status updates in real-time
   - Disable setting → verify daemon stops and page shows disabled state
3. **Edge cases:** Multiple concurrent CLI sessions, long-running sessions, sessions in nested project directories

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/services/cli-monitor/types.ts` |
| Create | `src/services/cli-monitor/cli-monitor.service.ts` |
| Create | `src/services/cli-monitor/index.ts` |
| Create | `src/server/routes/cli-monitor.ts` |
| Create | `src/app/routes/cli-monitor/index.tsx` |
| Create | `src/app/components/features/cli-monitor/cli-session-card.tsx` |
| Modify | `src/server/api.ts` |
| Modify | `src/server/router.ts` |
| Modify | `src/lib/api/client.ts` |
| Modify | `src/app/components/features/sidebar.tsx` |
| Modify | `src/app/routes/settings/preferences.tsx` |
| Add dep | `chokidar` (file watching) |
