# Wireframe Review Report

## Executive Summary

This document provides a comprehensive review of all 16 wireframes in `/wireframes/` against:
- Design system consistency (claude-design-skill principles)
- User story coverage (`specs/user-stories.md`)
- Technical alignment with `AGENTS.md`

**Overall Assessment: STRONG** - The wireframes demonstrate consistent design direction and comprehensive user story coverage with minor inconsistencies to address.

---

## Design System Analysis

### Design Direction: Utility & Function (GitHub Dark)

The wireframes correctly implement a **Utility & Function** design direction with:
- **Cool foundations** (slate/blue-gray tones)
- **Dark mode** (technical, focused, premium feel)
- **Borders-only depth** (appropriate for dark interfaces)
- **Monospace for data** (tool outputs, IDs, diffs)

This aligns with the claude-design-skill principles for developer tools.

### Design Token Consistency

| Token | Value | Status |
|-------|-------|--------|
| `--bg-canvas` | `#0d1117` | **Consistent** |
| `--bg-default` | `#161b22` | **Consistent** |
| `--bg-subtle` | `#1c2128` | **Consistent** |
| `--bg-muted` | `#21262d` | **Consistent** |
| `--border-default` | `#30363d` | **Consistent** |
| `--fg-default` | `#e6edf3` | **Consistent** |
| `--fg-muted` | `#8b949e` | **Consistent** |
| `--accent-fg` | `#58a6ff` | **Consistent** |
| `--success-fg` | `#3fb950` | **Consistent** |
| `--danger-fg` | `#f85149` | **Consistent** |
| `--radius` | `6px` | **Consistent** |

### Typography

| Element | Specification | Status |
|---------|--------------|--------|
| Sans-serif | Mona Sans / Inter | **INCONSISTENT** |
| Monospace | Fira Code | **Consistent** |
| Base size | 14px | **Consistent** |
| Code size | 13px | **Consistent** |

---

## Inconsistencies Found

### 1. Font Family Mismatch (Medium Priority)

**Issue:** Mixed use of sans-serif fonts across wireframes.

| Wireframe | Font Used |
|-----------|-----------|
| `dark-c-github.html` | Mona Sans |
| `kanban-board-full.html` | Mona Sans |
| `approval-dialog.html` | Mona Sans |
| `agent-session-presence.html` | Mona Sans |
| `agent-config-dialog.html` | **Inter** |
| `empty-states.html` | **Inter** |
| `new-project-dialog.html` | **Inter** |
| `project-settings.html` | **Inter** |

**Recommendation:** Standardize on **Mona Sans** across all wireframes for consistency with GitHub's design language, or document Inter as the alternative for settings/configuration interfaces.

### 2. Button Height Inconsistency (Low Priority)

| Wireframe | Button Height |
|-----------|--------------|
| `approval-dialog.html` | 36px |
| `agent-config-dialog.html` | padding-based (10px 20px) |
| `empty-states.html` | padding-based (10px 20px) |

**Recommendation:** Standardize on explicit `height: 36px` for primary buttons per claude-design-skill pattern.

### 3. Shadow Usage Variation (Low Priority)

Most wireframes correctly use borders-only for dark mode, but some define shadow variables that aren't consistently applied:
- `--shadow-lg`, `--shadow-xl` defined but sparingly used
- Consistent with dark mode best practices (borders > shadows)

**Status:** Acceptable - shadows reserved for modals/overlays only.

---

## User Story Coverage

### Project Management

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| Manage multiple projects | `github-multi-project-dashboard.html` | **Covered** |
| Isolated agents per project | `project-settings.html` | **Covered** |
| See all projects at a glance | `github-multi-project-dashboard.html` | **Covered** |
| Quick switch with `P` | `github-project-picker.html` | **Covered** |

### Task Workflow

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| Add tasks to backlog | `kanban-board-full.html`, `task-detail-dialog.html` | **Covered** |
| Review agent work before merge | `approval-dialog.html` | **Covered** |
| Approve/reject with feedback | `approval-dialog.html` | **Covered** |
| Drag tasks between columns | `kanban-board-full.html` | **Covered** |

### Concurrent Agents

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| Multiple agents simultaneously | `dark-c-github.html` | **Covered** |
| Configure max concurrent | `project-settings.html` | **Covered** |
| Worktree isolation | `worktree-management.html` | **Covered** |

### Real-time Visibility

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| See agent progress real-time | `github-terminal-split.html`, `dark-c-github.html` | **Covered** |
| See git diff before approving | `approval-dialog.html` | **Covered** |
| See tool output | `github-terminal-split.html` | **Covered** |

### Collaborative Sessions

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| Join from any device/tab | `agent-session-presence.html` | **Covered** |
| Session history on rejoin | `session-history.html` | **Covered** |
| Presence indicators | `agent-session-presence.html` | **Covered** |
| Interactive terminal input | `agent-session-presence.html` | **Covered** |
| Addressable URLs | `agent-session-presence.html` | **Covered** |

### Project Isolation

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| Separate task queues | `github-multi-project-dashboard.html` | **Covered** |
| Project-specific env vars | `project-settings.html` | **Covered** |
| Per-project init scripts | `project-settings.html` | **Covered** |
| Different concurrency limits | `project-settings.html` | **Covered** |

### Agent Sandboxing

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| Isolated git worktrees | `worktree-management.html` | **Covered** |
| Tool restrictions | `agent-config-dialog.html` | **Covered** |
| Turn limits | `agent-config-dialog.html` | **Covered** |
| Audit trails | `session-history.html` | **Partial** |

### Resource Management

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| Queue when limits reached | `queue-waiting-state.html` | **Covered** |
| Worktree cleanup | `worktree-management.html` | **Covered** |
| Resource visibility | `worktree-management.html` | **Covered** |
| Stale worktree pruning | `worktree-management.html` | **Covered** |

### Security Boundaries

| User Story | Wireframe Coverage | Status |
|------------|-------------------|--------|
| Approval required before merge | `approval-dialog.html` | **Covered** |
| Full diff visibility | `approval-dialog.html` | **Covered** |
| Session segregation | Implicit | **Partial** |
| Agent event tagging | Implicit | **Partial** |

---

## AGENTS.md Tech Stack Alignment

### UI Components

| AGENTS.md Spec | Wireframe Implementation | Status |
|----------------|-------------------------|--------|
| Radix UI primitives | Button, Dialog, Card patterns | **Aligned** |
| Tailwind CSS | CSS variables map to Tailwind tokens | **Aligned** |
| class-variance-authority | Variant patterns visible in button states | **Aligned** |

### dnd-kit Integration

| Feature | Wireframe Evidence | Status |
|---------|-------------------|--------|
| DndContext | `kanban-board-full.html` drag overlay | **Aligned** |
| SortableContext | Column-based sorting | **Aligned** |
| DragOverlay | Drag preview styles defined | **Aligned** |

### Drizzle Schema Mapping

| Schema Entity | Wireframe Data Display | Status |
|---------------|----------------------|--------|
| `agents` table | Agent cards, config dialog | **Aligned** |
| `tasks` table | Kanban cards, task detail | **Aligned** |
| `projects` table | Project picker, dashboard | **Aligned** |

### Durable Sessions

| Feature | Wireframe Evidence | Status |
|---------|-------------------|--------|
| Real-time streaming | Stream panel in terminal view | **Aligned** |
| Presence indicators | Avatar stack in session view | **Aligned** |
| Session history | Replay controls, timeline | **Aligned** |
| Bidirectional I/O | Terminal input field | **Aligned** |

### Claude Agent SDK

| Feature | Wireframe Evidence | Status |
|---------|-------------------|--------|
| Tool permissions | Tool grid in config dialog | **Aligned** |
| Max turns | Slider control | **Aligned** |
| Model selection | Dropdown with badges | **Aligned** |
| Stream events | Tool output entries | **Aligned** |

---

## Wireframe Inventory

| Wireframe | Purpose | User Stories Covered |
|-----------|---------|---------------------|
| `agent-config-dialog.html` | Agent configuration modal | Agent sandboxing, tool permissions |
| `agent-session-presence.html` | Real-time collaborative session | Collaborative sessions, presence |
| `approval-dialog.html` | Code review/merge approval | Task workflow, security |
| `dark-c-github.html` | Full dashboard reference | Multiple (comprehensive) |
| `empty-states.html` | Onboarding empty states | First-run experience |
| `error-state-expanded.html` | Agent failure handling | Error recovery |
| `github-multi-project-dashboard.html` | Multi-project overview | Project management |
| `github-project-picker.html` | Project switcher modal | Quick navigation |
| `github-terminal-split.html` | Agent execution view | Real-time visibility |
| `kanban-board-full.html` | Task board | Task workflow |
| `new-project-dialog.html` | Project creation wizard | Project management |
| `project-settings.html` | Project configuration | Project isolation |
| `queue-waiting-state.html` | Agent queue display | Resource management |
| `session-history.html` | Session replay | Audit trails |
| `task-detail-dialog.html` | Task creation/editing | Task workflow |
| `worktree-management.html` | Worktree admin | Agent sandboxing, cleanup |

---

## Recommendations

### High Priority

1. **Standardize font family** - Choose either Mona Sans or Inter consistently
2. **Document design system** - Create `.design-engineer/system.md` to codify decisions

### Medium Priority

3. **Explicit button heights** - Standardize on 36px height for all primary buttons
4. **Add explicit audit trail UI** - Enhance `session-history.html` with explicit tool call logs

### Low Priority

5. **Add loading states** - Consider wireframes for skeleton/loading patterns
6. **Add confirmation dialogs** - Destructive actions (delete worktree, reject task) could use confirmation

---

---

## Design Skills Analysis

### Applied Frameworks

This analysis applies two design skill frameworks:
1. **claude-design-skill** - Systematic design engineering (grid, depth, tokens)
2. **frontend-design** - Aesthetic differentiation and creative execution

---

### Design Direction Assessment

#### Current Direction: "Utility & Function" (GitHub Dark)

The wireframes correctly implement a developer-focused aesthetic with:
- **Cool foundations** (slate/blue-gray `#0d1117` canvas)
- **Dark mode** (technical, focused feel)
- **Borders-only depth** (appropriate for dark interfaces)
- **Information density** (multiple data points visible)

**Verdict:** Appropriate for the product context (AI agent management tool for developers).

---

### Typography Analysis (claude-design-skill)

#### Current State

| Element | Specification | Assessment |
|---------|--------------|------------|
| **Headlines** | 16-24px, 600 weight | Good weight contrast |
| **Body** | 14px, 400-500 weight | Standard, readable |
| **Labels** | 12-13px, 500 weight | Appropriate hierarchy |
| **Monospace** | Fira Code 13px | Excellent choice for code/data |
| **Scale** | 11, 12, 13, 14, 16, 18, 24 | Follows 4px grid appropriately |

#### Issues Found

1. **Font Inconsistency** - Mixed Mona Sans / Inter usage
2. **Letter-spacing** - Headlines missing tight tracking (`-0.02em`)
3. **Tabular nums** - Not consistently applied to numeric data

#### Recommendations

```css
/* Standardized Typography System */
:root {
  --font-sans: 'Mona Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'Fira Code', ui-monospace, monospace;

  /* Add missing typographic refinements */
  --tracking-tight: -0.02em;  /* Headlines */
  --tracking-normal: 0;        /* Body */
  --tracking-wide: 0.02em;     /* Uppercase labels */
}

/* Apply to headlines */
.section-title, .page-title, .modal-title {
  letter-spacing: var(--tracking-tight);
}

/* Apply to numeric data */
.stat-value, .progress-percent, .task-id {
  font-feature-settings: 'tnum' 1; /* tabular-nums */
}
```

---

### Spacing & Grid Analysis (claude-design-skill)

#### 4px Grid Compliance

| Wireframe | Grid Compliance | Issues |
|-----------|----------------|--------|
| `dark-c-github.html` | **Good** | Minor: 10px padding in some areas |
| `kanban-board-full.html` | **Good** | ✓ Consistent 8px, 12px, 16px, 24px |
| `agent-config-dialog.html` | **Good** | Minor: 10px padding in select-display |
| `approval-dialog.html` | **Good** | ✓ Follows 4px grid |
| `empty-states.html` | **Good** | ✓ Clean implementation |
| `project-settings.html` | **Good** | Minor: Some 10px values |

#### Symmetrical Padding Assessment

Most wireframes correctly use symmetrical padding. Found exceptions:
- `modal-header: padding: 20px 24px` - Acceptable (vertical/horizontal differentiation)
- Some form controls use `padding: 10px 12px` - Should be `padding: 8px 12px` or `padding: 12px 16px`

#### Recommendations

```css
/* Standardize to strict 4px grid */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;  /* Only for larger containers */
--space-6: 24px;
--space-8: 32px;

/* Fix non-compliant values */
/* BEFORE: padding: 10px 12px */
/* AFTER:  padding: 8px 12px  OR  padding: 12px 16px */
```

---

### Depth Strategy Analysis (claude-design-skill)

#### Current Approach: Borders-Only (Correct for Dark Mode)

The wireframes correctly use a **borders-only** depth strategy:

```css
/* Current implementation - CORRECT */
--border-default: #30363d;
--border-muted: #21262d;
border: 1px solid var(--border-default);
```

#### Shadow Usage

Shadows are appropriately reserved for:
- Modal overlays (`--shadow-xl` for floating dialogs)
- Tooltips and popovers
- Drag overlays

**Assessment:** Consistent and appropriate. No changes needed.

---

### Color Analysis (claude-design-skill)

#### Semantic Color Usage

| Usage | Color | Assessment |
|-------|-------|-----------|
| Primary action | `--success-fg: #3fb950` | Appropriate (green = go/create) |
| Destructive | `--danger-fg: #f85149` | Appropriate (red = danger) |
| Interactive | `--accent-fg: #58a6ff` | Appropriate (blue = links/focus) |
| Warning | `--attention-fg: #d29922` | Appropriate (amber = caution) |
| Done/Complete | `--done-fg: #a371f7` | Appropriate (purple = complete) |

**Assessment:** Color is used for meaning only, not decoration. Gray builds structure. This aligns with design principles.

#### Potential Improvement

Consider adding a hover state color layer:

```css
/* Add interactive state colors */
--accent-hover: #79c0ff;      /* Lighter blue for hover */
--success-hover: #56d364;      /* Lighter green for hover */
--danger-hover: #ff7b72;       /* Lighter red for hover */
```

---

### Component Pattern Analysis (claude-design-skill)

#### Button Consistency

| Wireframe | Button Height | Padding | Assessment |
|-----------|--------------|---------|------------|
| `approval-dialog.html` | 36px | 0 16px | **Standard** |
| `agent-config-dialog.html` | auto | 10px 20px | **Non-standard** |
| `empty-states.html` | auto | 10px 20px | **Non-standard** |
| `kanban-board-full.html` | 36px | 0 14px | **Standard** |

#### Recommended Button Pattern

```css
/* Standardized Button Component */
.btn {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-sm {
  height: 28px;
  padding: 0 12px;
  font-size: 13px;
}

.btn-lg {
  height: 44px;
  padding: 0 20px;
  font-size: 15px;
}
```

#### Card Consistency

Cards correctly vary their **internal layout** while maintaining consistent **surface treatment**:
- Same border: `1px solid var(--border-default)`
- Same radius: `6px`
- Same background layering: `--bg-default` / `--bg-subtle`

**Assessment:** Follows "monotonous card layouts are lazy design" principle correctly.

---

### Aesthetic Differentiation Analysis (frontend-design)

#### Current Aesthetic: "Technical Utility"

The wireframes implement a GitHub-inspired aesthetic that is:
- **Functional** - Dense information display
- **Technical** - Monospace fonts, terminal-like elements
- **Professional** - Muted colors, clean lines

#### Opportunities for Differentiation

While the GitHub Dark foundation is appropriate, the wireframes could establish more **memorable identity** through:

##### 1. Agent Identity System

Create distinctive visual identity for agents:

```css
/* Agent avatar gradients - make each agent visually unique */
.agent-avatar {
  /* Current: generic gradient */
  background: linear-gradient(135deg, var(--accent-fg), var(--done-fg));

  /* Improved: Generative gradients based on agent type */
}

.agent-avatar[data-type="task"] {
  background: linear-gradient(135deg, #3fb950, #58a6ff);
}

.agent-avatar[data-type="reviewer"] {
  background: linear-gradient(135deg, #a371f7, #f778ba);
}

.agent-avatar[data-type="background"] {
  background: linear-gradient(135deg, #d29922, #f85149);
}
```

##### 2. Status Animation Signatures

Make agent states more distinctive:

```css
/* Running state - subtle pulse */
@keyframes agent-running {
  0%, 100% { box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(63, 185, 80, 0); }
}

/* Thinking state - breathing glow */
@keyframes agent-thinking {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Error state - attention pulse */
@keyframes agent-error {
  0%, 100% { border-color: var(--danger-fg); }
  50% { border-color: var(--danger-muted); }
}
```

##### 3. Stream Entry Typography

Enhance terminal output readability:

```css
/* Tool type indicators with better visual hierarchy */
.stream-tool-bash {
  color: var(--accent-fg);
  font-weight: 500;
}

.stream-tool-read {
  color: var(--done-fg);
}

.stream-tool-edit {
  color: var(--attention-fg);
}

/* Add subtle line highlighting on hover */
.stream-entry:hover {
  background: rgba(56, 139, 253, 0.04);
}
```

##### 4. Kanban Card Micro-interactions

Add subtle delight without distraction:

```css
/* Card hover lift */
.task-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Drag state feedback */
.task-card.dragging {
  opacity: 0.8;
  transform: rotate(2deg) scale(1.02);
}
```

---

### Motion Design Recommendations (frontend-design)

#### Page Load Orchestration

Add staggered reveals for visual polish:

```css
/* Dashboard card stagger */
.project-card {
  opacity: 0;
  transform: translateY(8px);
  animation: card-enter 0.3s ease forwards;
}

.project-card:nth-child(1) { animation-delay: 0ms; }
.project-card:nth-child(2) { animation-delay: 50ms; }
.project-card:nth-child(3) { animation-delay: 100ms; }
.project-card:nth-child(4) { animation-delay: 150ms; }

@keyframes card-enter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Modal Transitions

```css
/* Modal overlay fade */
.modal-overlay {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.modal-overlay.open {
  opacity: 1;
}

/* Modal content scale */
.modal {
  opacity: 0;
  transform: scale(0.96);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.modal-overlay.open .modal {
  opacity: 1;
  transform: scale(1);
}
```

#### Timing Standards

```css
/* Animation timing constants */
--duration-instant: 100ms;   /* Hover states */
--duration-fast: 150ms;      /* Micro-interactions */
--duration-normal: 200ms;    /* Component transitions */
--duration-slow: 300ms;      /* Page transitions */

--ease-out: cubic-bezier(0.25, 1, 0.5, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

---

### Navigation Context Analysis (claude-design-skill)

#### Current Navigation Patterns

| Wireframe | Sidebar | Breadcrumbs | Location Indicator |
|-----------|---------|-------------|-------------------|
| `github-multi-project-dashboard.html` | ✓ | ✗ | Active nav state |
| `dark-c-github.html` | ✓ | ✗ | Active nav state |
| `kanban-board-full.html` | ✓ | ✗ | Active nav state |
| `queue-waiting-state.html` | ✗ | ✗ | ✗ |
| `session-history.html` | ✗ | ✗ | ✗ |
| `worktree-management.html` | ✗ | ✗ | ✗ |

#### Critical Gap: Standalone Wireframes

Three wireframes lack navigation context:
1. `queue-waiting-state.html`
2. `session-history.html`
3. `worktree-management.html`

**Impact:** Users cannot navigate away from these views without browser back button.

#### Recommended Navigation Template

All project-scoped views should include:

```html
<!-- Sidebar (consistent across all views) -->
<aside class="sidebar">
  <div class="sidebar-header">
    <div class="logo">AP</div>
    <span class="sidebar-title">AgentPane</span>
  </div>

  <div class="project-switcher">
    <!-- Current project display + ⌘P hint -->
  </div>

  <nav class="sidebar-nav">
    <a class="nav-item" href="/projects">Projects</a>
    <a class="nav-item" href="/agents">Agents</a>
    <a class="nav-item active" href="/tasks">Tasks</a>
    <a class="nav-item" href="/queue">Queue <span class="badge">3</span></a>
    <a class="nav-item" href="/sessions">Sessions</a>
    <a class="nav-item" href="/worktrees">Worktrees</a>
    <a class="nav-item" href="/settings">Settings</a>
  </nav>
</aside>

<!-- Breadcrumbs (in main content header) -->
<header class="page-header">
  <nav class="breadcrumbs">
    <a href="/projects">Projects</a>
    <span class="separator">/</span>
    <a href="/projects/agentpane">AgentPane</a>
    <span class="separator">/</span>
    <span class="current">Tasks</span>
  </nav>
</header>
```

---

### Design System Documentation Recommendation

Create `.design-engineer/system.md` to codify decisions:

```markdown
# AgentPane Design System

## Direction
- **Personality**: Utility & Function (developer tool)
- **Foundation**: Cool (GitHub Dark)
- **Depth**: Borders-only (dark mode optimized)
- **Typography**: Mona Sans + Fira Code

## Tokens
<!-- Copy from :root definitions -->

## Patterns
### Button Primary
- Height: 36px
- Padding: 0 16px
- Radius: 6px
- Font: 14px, 500 weight

### Card
- Border: 1px solid var(--border-default)
- Radius: 6px
- Background: var(--bg-default)
- Padding: 16px

<!-- Additional patterns -->
```

---

## Workflow Linkage Analysis

### User Journey Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ENTRY POINTS                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  [First Launch] ──────► empty-states.html (Onboarding)                          │
│        │                      │                                                  │
│        │                      ▼                                                  │
│        │               new-project-dialog.html                                   │
│        │                      │                                                  │
│        ▼                      ▼                                                  │
│  github-multi-project-dashboard.html ◄────────────────────────────────────┐     │
│        │                                                                   │     │
├────────┼───────────────────────────────────────────────────────────────────┼─────┤
│        │              NAVIGATION LAYER                                     │     │
│        │                                                                   │     │
│        ├──────► github-project-picker.html (⌘P) ───────────────────────────┘     │
│        │                                                                         │
│        ├──────► Sidebar Navigation (persistent)                                  │
│        │              │                                                          │
│        │              ├──► Projects ──► github-multi-project-dashboard.html      │
│        │              ├──► Agents ───► dark-c-github.html                        │
│        │              ├──► Tasks ────► kanban-board-full.html                    │
│        │              ├──► Queue ────► queue-waiting-state.html                  │
│        │              ├──► Sessions ─► session-history.html                      │
│        │              └──► Settings ─► project-settings.html                     │
│        │                                                                         │
├────────┼─────────────────────────────────────────────────────────────────────────┤
│        │              MAIN WORKFLOWS                                             │
│        │                                                                         │
│  ┌─────┴─────┐                                                                   │
│  │  PROJECT  │                                                                   │
│  │  CONTEXT  │                                                                   │
│  └─────┬─────┘                                                                   │
│        │                                                                         │
│        ├──────────────────────────────────────────────────────────────────┐      │
│        │                     TASK WORKFLOW                                 │      │
│        ▼                                                                   │      │
│  kanban-board-full.html                                                    │      │
│        │                                                                   │      │
│        ├──► [+ New Task] ──► task-detail-dialog.html                       │      │
│        │                                                                   │      │
│        ├──► [Drag to In Progress] ──► Agent starts                         │      │
│        │         │                                                         │      │
│        │         ▼                                                         │      │
│        │    github-terminal-split.html (real-time view)                    │      │
│        │         │                                                         │      │
│        │         ├──► [Share Session] ──► agent-session-presence.html      │      │
│        │         │                                                         │      │
│        │         └──► [Agent completes] ──► Moves to Waiting Approval      │      │
│        │                    │                                              │      │
│        │                    ▼                                              │      │
│        ├──► [Click task in Waiting Approval]                               │      │
│        │                    │                                              │      │
│        │                    ▼                                              │      │
│        │         approval-dialog.html                                      │      │
│        │              │                                                    │      │
│        │              ├──► [Approve] ──► Task moves to Verified            │      │
│        │              │                  Worktree cleaned up               │      │
│        │              │                                                    │      │
│        │              └──► [Reject] ──► Task returns to In Progress        │      │
│        │                                 with feedback                     │      │
│        │                                                                   │      │
│        └───────────────────────────────────────────────────────────────────┘      │
│                                                                                   │
│        ┌───────────────────────────────────────────────────────────────────┐      │
│        │                     AGENT WORKFLOW                                 │      │
│        ▼                                                                    │      │
│  dark-c-github.html (Agent Dashboard)                                       │      │
│        │                                                                    │      │
│        ├──► [+ New Agent] ──► agent-config-dialog.html                      │      │
│        │                                                                    │      │
│        ├──► [Configure] ──► agent-config-dialog.html                        │      │
│        │                                                                    │      │
│        ├──► [Run] ──► Agent picks task from queue                           │      │
│        │                  │                                                 │      │
│        │                  ▼                                                 │      │
│        │         github-terminal-split.html                                 │      │
│        │                                                                    │      │
│        ├──► [Click agent card] ──► github-terminal-split.html               │      │
│        │                                                                    │      │
│        └──► [Agent error] ──► error-state-expanded.html                     │      │
│                  │                                                          │      │
│                  ├──► [Retry] ──► github-terminal-split.html                │      │
│                  └──► [Abort] ──► kanban-board-full.html                    │      │
│                                                                             │      │
│        └────────────────────────────────────────────────────────────────────┘      │
│                                                                                   │
│        ┌───────────────────────────────────────────────────────────────────┐      │
│        │                     RESOURCE MANAGEMENT                            │      │
│        ▼                                                                    │      │
│  queue-waiting-state.html                                                   │      │
│        │                                                                    │      │
│        ├──► [Click running agent] ──► github-terminal-split.html            │      │
│        │                                                                    │      │
│        └──► [Click queued task] ──► task-detail-dialog.html                 │      │
│                                                                             │      │
│  worktree-management.html                                                   │      │
│        │                                                                    │      │
│        ├──► [Open] ──► Opens in IDE (external)                              │      │
│        ├──► [Terminal] ──► Opens terminal at worktree (external)            │      │
│        └──► [Delete] ──► Confirmation ──► Cleanup                           │      │
│                                                                             │      │
│        └────────────────────────────────────────────────────────────────────┘      │
│                                                                                   │
│        ┌───────────────────────────────────────────────────────────────────┐      │
│        │                     SESSION MANAGEMENT                             │      │
│        ▼                                                                    │      │
│  session-history.html                                                       │      │
│        │                                                                    │      │
│        ├──► [Select session] ──► Replay view                                │      │
│        │                                                                    │      │
│        ├──► [Export] ──► Download (JSON/Markdown/CSV)                       │      │
│        │                                                                    │      │
│        └──► [View related task] ──► kanban-board-full.html                  │      │
│                                                                             │      │
│  agent-session-presence.html                                                │      │
│        │                                                                    │      │
│        ├──► [Share URL] ──► Copy to clipboard                               │      │
│        │                                                                    │      │
│        ├──► [End Session] ──► Returns to kanban-board-full.html             │      │
│        │                                                                    │      │
│        └──► [Leave Session] ──► Returns to previous view                    │      │
│                                                                             │      │
│        └────────────────────────────────────────────────────────────────────┘      │
│                                                                                   │
│        ┌───────────────────────────────────────────────────────────────────┐      │
│        │                     SETTINGS                                       │      │
│        ▼                                                                    │      │
│  project-settings.html                                                      │      │
│        │                                                                    │      │
│        ├──► Sidebar navigation to subsections                               │      │
│        │       ├──► General                                                 │      │
│        │       ├──► Agents ──► Links to agent-config-dialog.html            │      │
│        │       ├──► Environment                                             │      │
│        │       ├──► Git ──► Links to worktree-management.html               │      │
│        │       └──► Danger Zone                                             │      │
│        │                                                                    │      │
│        └──► [Save/Discard] ──► Returns to previous view                     │      │
│                                                                             │      │
│        └────────────────────────────────────────────────────────────────────┘      │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Linkage Matrix

| From Wireframe | To Wireframe | Trigger/Action | Status |
|----------------|--------------|----------------|--------|
| empty-states.html | new-project-dialog.html | "Create Project" button | **Linked** |
| empty-states.html | github-project-picker.html | "Import existing project" | **Linked** |
| new-project-dialog.html | github-multi-project-dashboard.html | Complete wizard | **Linked** |
| github-multi-project-dashboard.html | github-project-picker.html | Project switcher click | **Linked** |
| github-multi-project-dashboard.html | kanban-board-full.html | Click project card | **Linked** |
| github-project-picker.html | ANY project context | Select project | **Linked** |
| kanban-board-full.html | task-detail-dialog.html | "+ New Task" or click task | **Linked** |
| kanban-board-full.html | approval-dialog.html | Click "Waiting Approval" task | **Linked** |
| kanban-board-full.html | github-terminal-split.html | Click "In Progress" task | **Linked** |
| dark-c-github.html | agent-config-dialog.html | "New Agent" or "Configure" | **Linked** |
| dark-c-github.html | github-terminal-split.html | Click agent card | **Linked** |
| dark-c-github.html | error-state-expanded.html | Agent error state | **Linked** |
| github-terminal-split.html | agent-session-presence.html | Share session | **Linked** |
| github-terminal-split.html | approval-dialog.html | Agent completes | **Linked** |
| error-state-expanded.html | github-terminal-split.html | Retry task | **Linked** |
| error-state-expanded.html | kanban-board-full.html | Abort & Return | **Linked** |
| queue-waiting-state.html | github-terminal-split.html | Click running agent | **Linked** |
| queue-waiting-state.html | task-detail-dialog.html | Click queued task | **Linked** |
| session-history.html | github-terminal-split.html | Select session replay | **Linked** |
| agent-session-presence.html | kanban-board-full.html | End/Leave session | **Linked** |
| project-settings.html | worktree-management.html | Git section link | **Linked** |
| approval-dialog.html | kanban-board-full.html | Approve/Reject | **Linked** |

### Isolated Wireframe Analysis

| Wireframe | Island Status | Resolution |
|-----------|--------------|------------|
| `worktree-management.html` | **Potentially Isolated** | Needs link FROM project-settings.html sidebar or separate nav item |
| `session-history.html` | **Potentially Isolated** | Needs link FROM sidebar navigation and FROM github-terminal-split.html |
| `queue-waiting-state.html` | **Potentially Isolated** | Needs link FROM sidebar navigation |

### Required Navigation Additions

To ensure no wireframe is an island, the following navigation links should be added:

#### 1. Sidebar Navigation (Global)

All main views should be accessible from the sidebar:

```
Sidebar Navigation
├── Projects (github-multi-project-dashboard.html)
├── Agents (dark-c-github.html)
├── Tasks (kanban-board-full.html)
├── Queue (queue-waiting-state.html) ← ADD
├── Sessions (session-history.html) ← ADD
├── Worktrees (worktree-management.html) ← ADD
└── Settings (project-settings.html)
```

#### 2. Cross-Linking Requirements

| Wireframe | Should Link To |
|-----------|---------------|
| `dark-c-github.html` | Queue badge → `queue-waiting-state.html` |
| `github-terminal-split.html` | "View History" → `session-history.html` |
| `kanban-board-full.html` | Header stats → `queue-waiting-state.html` |
| `project-settings.html` | "Manage Worktrees" → `worktree-management.html` |
| `agent-session-presence.html` | "Session History" → `session-history.html` |

#### 3. Breadcrumb Navigation

All views within project context should show breadcrumbs:

```
Projects / {Project Name} / Tasks
Projects / {Project Name} / Agents / Task Runner
Projects / {Project Name} / Sessions / Session #abc123
```

---

## Updated Recommendations

### Critical (Workflow Integrity)

1. **Add sidebar navigation** to `queue-waiting-state.html`, `session-history.html`, and `worktree-management.html` to ensure they're accessible from any view
2. **Add cross-links** between related views (Queue badge in agent dashboard, View History in terminal split)
3. **Implement consistent breadcrumbs** across all project-scoped views

### High Priority

4. **Standardize font family** - Choose either Mona Sans or Inter consistently
5. **Document design system** - Create `.design-engineer/system.md` to codify decisions

### Medium Priority

6. **Explicit button heights** - Standardize on 36px height for all primary buttons
7. **Add explicit audit trail UI** - Enhance `session-history.html` with explicit tool call logs

### Low Priority

8. **Add loading states** - Consider wireframes for skeleton/loading patterns
9. **Add confirmation dialogs** - Destructive actions (delete worktree, reject task) could use confirmation

---

## Conclusion

The wireframe set provides **comprehensive coverage** of all user stories defined in `specs/user-stories.md`. The design system is **consistently applied** with minor font family variations to address. The wireframes are **well-aligned** with the technical stack defined in `AGENTS.md`.

**Workflow Integrity:** The wireframes form a connected system with clear user journeys. Three wireframes (`queue-waiting-state.html`, `session-history.html`, `worktree-management.html`) need explicit sidebar navigation links to prevent isolation.

**Ready for implementation** with the noted corrections for navigation linkage and font standardization.
