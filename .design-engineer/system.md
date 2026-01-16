# AgentPane Design System

## Design Direction

- **Personality**: Utility & Function (developer tool)
- **Foundation**: Cool (GitHub Dark - slate/blue-gray)
- **Depth**: Borders-only (dark mode optimized)
- **Typography**: Mona Sans + Fira Code

---

## Design Tokens

```css
:root {
  /* Background colors */
  --bg-canvas: #0d1117;
  --bg-default: #161b22;
  --bg-subtle: #1c2128;
  --bg-muted: #21262d;
  --bg-emphasis: #30363d;

  /* Border colors */
  --border-default: #30363d;
  --border-muted: #21262d;
  --border-subtle: rgba(240, 246, 252, 0.1);

  /* Foreground colors */
  --fg-default: #e6edf3;
  --fg-muted: #8b949e;
  --fg-subtle: #6e7681;

  /* Accent colors */
  --accent-fg: #58a6ff;
  --accent-emphasis: #1f6feb;
  --accent-muted: rgba(56, 139, 253, 0.15);
  --accent-hover: #79c0ff;

  /* Success colors */
  --success-fg: #3fb950;
  --success-emphasis: #238636;
  --success-muted: rgba(46, 160, 67, 0.15);
  --success-hover: #56d364;

  /* Danger colors */
  --danger-fg: #f85149;
  --danger-emphasis: #da3633;
  --danger-muted: rgba(248, 81, 73, 0.15);
  --danger-hover: #ff7b72;

  /* Attention colors */
  --attention-fg: #d29922;
  --attention-muted: rgba(187, 128, 9, 0.15);

  /* Done/Complete colors */
  --done-fg: #a371f7;
  --done-muted: rgba(163, 113, 247, 0.15);

  /* Border radius */
  --radius: 6px;
  --radius-sm: 4px;
  --radius-lg: 12px;

  /* Shadows (reserved for modals/overlays only) */
  --shadow-md: 0 3px 6px rgba(1, 4, 9, 0.3);
  --shadow-lg: 0 8px 24px rgba(1, 4, 9, 0.4);
  --shadow-xl: 0 12px 48px rgba(1, 4, 9, 0.5);

  /* Typography */
  --font-sans: 'Mona Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Fira Code', ui-monospace, SFMono-Regular, monospace;

  /* Letter spacing */
  --tracking-tight: -0.02em;   /* Headlines */
  --tracking-normal: 0;         /* Body */
  --tracking-wide: 0.02em;      /* Uppercase labels */

  /* Spacing (4px grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Animation timing */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;

  /* Easing */
  --ease-out: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Typography Scale

| Element | Size | Weight | Tracking | Usage |
|---------|------|--------|----------|-------|
| Page Title | 24px | 600 | tight | Main page headers |
| Section Title | 16px | 600 | tight | Section headers |
| Modal Title | 18px | 600 | tight | Dialog headers |
| Body | 14px | 400 | normal | Default text |
| Body Medium | 14px | 500 | normal | Emphasized body |
| Label | 13px | 500 | normal | Form labels |
| Small | 12px | 400-500 | normal | Secondary text |
| Tiny | 11px | 500 | wide | Uppercase labels |
| Code | 13px | 400 | normal | Monospace content |

### Numeric Data

Always use tabular figures for numeric data:

```css
.stat-value, .progress-percent, .task-id, .turn-count {
  font-feature-settings: 'tnum' 1;
}
```

---

## Component Patterns

### Button Primary

```css
.btn {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-sm { height: 28px; padding: 0 12px; font-size: 13px; }
.btn-lg { height: 44px; padding: 0 20px; font-size: 15px; }
```

### Card

```css
.card {
  background: var(--bg-default);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  padding: var(--space-4);
}

.card:hover {
  border-color: var(--fg-subtle);
}
```

### Card with Hover Lift

```css
.card-interactive {
  transition: transform var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}

.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

### Form Input

```css
.input {
  height: 36px;
  padding: 0 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  color: var(--fg-default);
  font-size: 14px;
  transition: border-color var(--duration-fast),
              box-shadow var(--duration-fast);
}

.input:focus {
  outline: none;
  border-color: var(--accent-fg);
  box-shadow: 0 0 0 3px var(--accent-muted);
}
```

### Badge

```css
.badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 10px;
  background: var(--bg-emphasis);
  color: var(--fg-muted);
}

.badge-success { background: var(--success-muted); color: var(--success-fg); }
.badge-danger { background: var(--danger-muted); color: var(--danger-fg); }
.badge-attention { background: var(--attention-muted); color: var(--attention-fg); }
.badge-accent { background: var(--accent-muted); color: var(--accent-fg); }
```

---

## Agent Identity System

### Agent Avatars by Type

```css
.agent-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
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

.agent-avatar[data-type="conversational"] {
  background: linear-gradient(135deg, #58a6ff, #a371f7);
}
```

### Status Animations

```css
/* Running - pulse */
@keyframes agent-running {
  0%, 100% { box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(63, 185, 80, 0); }
}

/* Thinking - breathing */
@keyframes agent-thinking {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Error - attention pulse */
@keyframes agent-error {
  0%, 100% { border-color: var(--danger-fg); }
  50% { border-color: rgba(248, 81, 73, 0.4); }
}

/* Status dot pulse */
@keyframes status-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}
```

---

## Motion Design

### Page Load - Staggered Cards

```css
.card-stagger {
  opacity: 0;
  transform: translateY(8px);
  animation: card-enter var(--duration-slow) var(--ease-out) forwards;
}

.card-stagger:nth-child(1) { animation-delay: 0ms; }
.card-stagger:nth-child(2) { animation-delay: 50ms; }
.card-stagger:nth-child(3) { animation-delay: 100ms; }
.card-stagger:nth-child(4) { animation-delay: 150ms; }
.card-stagger:nth-child(5) { animation-delay: 200ms; }
.card-stagger:nth-child(6) { animation-delay: 250ms; }

@keyframes card-enter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Modal Transitions

```css
.modal-overlay {
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modal-overlay.open {
  opacity: 1;
}

.modal {
  opacity: 0;
  transform: scale(0.96);
  transition: opacity var(--duration-normal) var(--ease-out),
              transform var(--duration-normal) var(--ease-out);
}

.modal-overlay.open .modal {
  opacity: 1;
  transform: scale(1);
}
```

### Drag State

```css
.dragging {
  opacity: 0.8;
  transform: rotate(2deg) scale(1.02);
  box-shadow: var(--shadow-lg);
}
```

---

## Navigation Template

All project-scoped views must include:

### Sidebar

```html
<aside class="sidebar">
  <div class="sidebar-header">
    <div class="logo">
      <svg><!-- AgentPane logo --></svg>
    </div>
    <span class="sidebar-title">AgentPane</span>
  </div>

  <div class="project-switcher">
    <div class="project-avatar">AP</div>
    <div class="project-info">
      <span class="project-name">Project Name</span>
      <span class="project-path">~/git/project</span>
    </div>
    <kbd>⌘P</kbd>
  </div>

  <nav class="sidebar-nav">
    <div class="nav-section">
      <span class="nav-section-title">Workspace</span>
      <a class="nav-item" href="/projects">
        <svg><!-- icon --></svg>
        Projects
      </a>
      <a class="nav-item active" href="/agents">
        <svg><!-- icon --></svg>
        Agents
        <span class="nav-badge">3</span>
      </a>
      <a class="nav-item" href="/tasks">
        <svg><!-- icon --></svg>
        Tasks
        <span class="nav-badge">12</span>
      </a>
      <a class="nav-item" href="/queue">
        <svg><!-- icon --></svg>
        Queue
        <span class="nav-badge active">2</span>
      </a>
    </div>

    <div class="nav-section">
      <span class="nav-section-title">History</span>
      <a class="nav-item" href="/sessions">
        <svg><!-- icon --></svg>
        Sessions
      </a>
      <a class="nav-item" href="/worktrees">
        <svg><!-- icon --></svg>
        Worktrees
      </a>
    </div>

    <div class="nav-section">
      <span class="nav-section-title">Project</span>
      <a class="nav-item" href="/settings">
        <svg><!-- icon --></svg>
        Settings
      </a>
    </div>
  </nav>

  <div class="sidebar-footer">
    <div class="user-menu">
      <div class="user-avatar">SL</div>
      <span class="user-name">Simon Lynch</span>
    </div>
  </div>
</aside>
```

### Breadcrumbs

```html
<header class="page-header">
  <nav class="breadcrumbs">
    <a href="/projects">Projects</a>
    <span class="separator">/</span>
    <a href="/projects/agentpane">AgentPane</a>
    <span class="separator">/</span>
    <span class="current">Tasks</span>
  </nav>

  <div class="page-actions">
    <!-- Page-specific actions -->
  </div>
</header>
```

---

## Stream Entry Colors

Tool output in agent stream views:

```css
.stream-tool-bash    { color: var(--accent-fg); }
.stream-tool-read    { color: var(--done-fg); }
.stream-tool-edit    { color: var(--attention-fg); }
.stream-tool-write   { color: var(--success-fg); }
.stream-tool-grep    { color: var(--fg-muted); }
.stream-tool-glob    { color: var(--fg-muted); }
.stream-result       { color: var(--success-fg); }
.stream-error        { color: var(--danger-fg); }
.stream-stdout       { color: var(--fg-muted); }
.stream-stderr       { color: var(--danger-fg); }
```

---

## Self-Validation Checklist

Before finalizing any UI work:

1. **Spacing**: All values on 4px grid (4, 8, 12, 16, 20, 24, 32)?
2. **Depth**: Using borders-only, shadows only for overlays?
3. **Typography**: Using Mona Sans + Fira Code consistently?
4. **Buttons**: Height 36px with 16px horizontal padding?
5. **Cards**: Same border, radius, background treatment?
6. **Color**: Used only for meaning, not decoration?
7. **Navigation**: Sidebar and breadcrumbs present?
8. **Motion**: Using defined timing constants?
