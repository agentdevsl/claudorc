# Phased Plan: Code-to-Sandbox Experience

## Goal

Make agent execution visible, audible, and traceable. Make it easy to spin up an agent and work on code with full isolation.

---

## Phase 1: Branch Isolation via Worktrees in Container Flow

**Goal:** Each agent writes to an isolated git branch, preventing conflicts and enabling clean diffs.

**User value:** Two agents on the same project can't clobber each other. Every agent run produces a reviewable branch.

### Changes

1. **`src/services/container-agent.service.ts`** — In `startAgent()`, after sandbox validation and before launching agent-runner:
   - Call `worktreeService.create()` to make a task-specific worktree inside the container
   - Set `AGENT_CWD` to the worktree path (e.g., `/workspace/.worktrees/fix-login-abc123`) instead of `/workspace`
   - Store `worktreeId` on the `RunningAgent` record
   - In `handleAgentComplete()`, auto-commit changes via `worktreeService.commit()`
   - Add `WorktreeService` as constructor dependency

2. **`src/services/worktree.service.ts`** — Add `createSandboxCommandRunner(sandbox: Sandbox): CommandRunner` adapter that wraps `sandbox.exec()` so worktree git commands execute inside the container transparently.

3. **`src/db/schema/tasks.ts`** — Add nullable `worktreeId` column (FK to worktrees) so tasks track which worktree the agent used.

4. **Dependency injection** — Wire `WorktreeService` into `ContainerAgentService` at bootstrap.

### Risks
- Non-git projects need a graceful fallback (skip worktree, warn user)
- Worktree creation adds ~1-2s to startup (acceptable)

---

## Phase 2: Live Diff View and File Change Tracking

**Goal:** Real-time visibility into what files the agent is changing, with structured diff on completion.

**User value:** "Changes" tab shows modified files as the agent works. Full diff view for code review when done.

### Changes

1. **`agent-runner/src/event-emitter.ts`** — Add `agent:file_change` event type: `{ path, action: 'create'|'modify'|'delete', additions?, deletions? }`

2. **`agent-runner/src/index.ts`** — In tool result handler, detect file-modifying tools (Write, Edit) and emit `agent:file_change` with parsed path from tool input.

3. **`src/lib/agents/container-bridge.ts`** — Map `agent:file_change` → `container-agent:file_change` in `EVENT_TYPE_MAP`.

4. **`src/app/hooks/use-container-agent.ts`** — Add `fileChanges: FileChange[]` to state. Handle `container-agent:file_change` callback with deduplication.

5. **New: `src/app/components/features/container-agent-panel/container-agent-changes-tab.tsx`** — File list showing changed files with add/delete counts and status icons.

6. **`src/app/components/features/container-agent-panel/container-agent-panel.tsx`** — Add tabbed layout: Stream | Changes. Changes tab renders the new component.

7. **New endpoint: `GET /api/worktrees/:id/diff`** in `src/server/routes/worktrees.ts` — Expose existing `worktreeService.getDiff()` for frontend consumption.

8. **New: `src/app/components/features/diff-viewer.tsx`** — Renders `GitDiff` data (files, hunks, additions/deletions). Displayed in task detail dialog when task is `waiting_approval` and has a `worktreeId`.

### Dependencies
- Phase 1 (worktree provides the diff source and branch isolation)

### Risks
- Tool name detection is heuristic (Write, Edit, Bash with file ops)
- Large diffs need pagination or collapsible sections

---

## Phase 3: Notifications and Audio Feedback

**Goal:** Alert users when an agent needs attention or finishes.

**User value:** Browser notifications + optional sounds when agent completes, errors, or plan is ready. No more checking manually.

### Changes

1. **New: `src/app/hooks/use-agent-notifications.ts`** — Subscribes to complete/error/plan_ready events. Uses `Notification.requestPermission()` + `new Notification()` when tab is not focused (`document.hidden`). Plays audio via `new Audio()`.

2. **`src/app/hooks/use-container-agent.ts`** — In `handleComplete`, `handleError`, `handlePlanReady`, dispatch notification events.

3. **Settings UI** — Add toggles to preferences: "Enable browser notifications", "Enable sound alerts", event type checkboxes. Store in localStorage.

4. **Static assets: `public/sounds/`** — Small audio files (<50KB): completion chime, error alert, attention tone.

5. **Toast integration** — Add `toast.agent()` variant for in-app notification alongside browser notifications.

### Dependencies
- None (standalone). Benefits from Phase 2 (notifications can include file change counts).

### Risks
- Browser Notification API requires permission; handle "denied" gracefully
- Audio autoplay policies; use `AudioContext` resume pattern

---

## Phase 4: Quick-Start Flow and Global Agent Status

**Goal:** Fast agent launch and always-visible status of running agents.

**User value:** See running agents from anywhere. Start an agent with a keyboard shortcut or command palette.

### Changes

1. **New endpoint: `GET /api/agents/running`** in `src/server/routes/agents.ts` — Expose `containerAgentService.getRunningAgents()` with task/project enrichment.

2. **New: `src/app/components/features/global-agent-indicator.tsx`** — Badge in app header showing running agent count. Click opens Radix Popover with agent list (task name, project, duration, link to session). Polls every 5s or uses SSE.

3. **App layout** — Add `GlobalAgentIndicator` to the app shell header.

4. **Keyboard shortcut** — On focused Kanban card, `R` triggers "Run" action. Bind in kanban-board key handler.

5. **Command palette** — New `agent-command-palette.tsx` using existing project-picker pattern. `Cmd+K` → type "run" → select task → start agent.

### Dependencies
- None strictly. Phase 1 improves safety (isolated branches).

### Risks
- Polling creates load; consider SSE for real-time status
- Keyboard shortcuts must not conflict with browser/OS shortcuts

---

## Phase 5: Terminal Widget and Phase Transition Polish

**Goal:** Interactive terminal access to containers and smooth visual transitions.

**User value:** Open a live terminal inside the sandbox. See smooth animations as agent progresses through phases.

### Changes

1. **WebSocket endpoint: `WS /api/sandbox/:id/terminal`** — Bidirectional pipe to tmux session via `sandbox.exec('tmux', ['attach-session', ...])` with streaming I/O over WebSocket.

2. **New: `src/app/components/features/terminal-widget.tsx`** — xterm.js terminal renderer. Connects to WebSocket. Toolbar with session name and detach button.

3. **`src/services/container-agent.service.ts`** — In `startAgent()`, create tmux session via `sandboxService.createTmuxSessionForTask()` for the agent.

4. **`container-agent-panel.tsx`** — Add "Terminal" tab alongside Stream and Changes.

5. **`container-agent-status-breadcrumbs.tsx`** — Add CSS transitions for breadcrumb step completion (opacity, transform, color transitions using existing animation tokens).

6. **New: Agent lifecycle timeline component** — Visual timeline: created → started → planning → approved → executing → completed. Rendered in task detail dialog with timestamps from session events.

### Dependencies
- Phase 1 (worktree context), Phase 2 (tabbed panel layout)

### Risks
- Hono WebSocket adapter support needs verification
- xterm.js is ~200KB; evaluate lighter alternatives
- Terminal access needs auth on WebSocket endpoint

---

## Phase Summary

| Phase | Name | Delivers | Effort |
|-------|------|----------|--------|
| 1 | Branch Isolation | Safety: isolated branches per agent | Medium |
| 2 | Live Diff View | Visibility: see changes in real-time | Medium-Large |
| 3 | Notifications | Audibility: alerts when agent needs you | Small |
| 4 | Quick-Start & Status | Convenience: fast launch, global status | Medium |
| 5 | Terminal & Polish | Polish: interactive terminal, animations | Large |

## Verification (per phase)

- **Phase 1**: Start two agents on same project → each writes to different branch. After completion, `git log` shows separate branches. Diff is clean.
- **Phase 2**: Start agent → open Changes tab → see files appear as agent modifies them. After completion, open diff view in task detail → see full structured diff.
- **Phase 3**: Start agent → switch to different browser tab → receive browser notification on completion. Hear audio cue. Verify settings toggles enable/disable correctly.
- **Phase 4**: Press `Cmd+K` → type "run" → select task → agent starts. Check header indicator shows count. Click indicator → see agent list with links.
- **Phase 5**: Open Terminal tab during agent execution → interact with container shell. Watch breadcrumbs animate through stages. View lifecycle timeline after completion.
