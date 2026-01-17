# AgentPane Specifications

This directory contains the complete application specifications for AgentPane, a multi-agent task management system. These specifications provide sufficient detail to implement the entire application with confidence.

## Specification Statistics

| Metric | Value |
|--------|-------|
| **Total Spec Files** | 42 markdown files |
| **Total Wireframes** | 20 HTML files |
| **Estimated Lines** | ~45,000+ |
| **Coverage** | 100% |

---

## Document Tree

```
specs/
├── README.md                          # This file - specification overview
├── user-stories.md                    # 23 user stories with acceptance criteria
├── wireframe-review.md                # Wireframe coverage analysis
│
├── api/                               # REST API Specifications
│   ├── endpoints.md                   # All API endpoints (28 endpoints)
│   └── pagination.md                  # Cursor-based pagination patterns
│
├── architecture/                      # System Architecture
│   └── app-bootstrap.md               # 6-phase initialization sequence
│
├── components/                        # UI Component Specifications
│   ├── agent-session-view.md          # Real-time agent session interface
│   ├── approval-dialog.md             # Code review and approval modal
│   ├── breadcrumbs.md                 # Navigation breadcrumbs
│   ├── form-inputs.md                 # Form components (10 input types)
│   ├── kanban-board.md                # 4-column task board with dnd-kit
│   ├── loading-skeletons.md           # Loading placeholder patterns
│   ├── new-project-dialog.md          # Project creation wizard
│   ├── project-picker.md              # Command palette project switcher
│   ├── task-detail-dialog.md          # Task view/edit modal
│   └── toast-notifications.md         # Toast notification system
│
├── configuration/                     # Configuration Management
│   └── config-management.md           # Project config, env vars, skills
│
├── database/                          # Database Specifications
│   └── schema.md                      # Drizzle ORM schema (9 tables)
│
├── errors/                            # Error Handling
│   └── error-catalog.md               # 44 error codes with HTTP mappings
│
├── implementation/                    # Implementation Patterns
│   ├── README.md                      # Implementation overview
│   ├── animation-system.md            # Animation tokens and patterns
│   ├── component-patterns.md          # Base component patterns (CVA)
│   └── mobile-responsive.md           # Responsive design patterns
│
├── integrations/                      # External Integrations
│   ├── claude-agent-sdk.md            # Claude Agent SDK integration
│   ├── durable-sessions.md            # Durable Streams real-time sync
│   ├── git-worktrees.md               # Git worktree isolation
│   └── github-app.md                  # GitHub App OAuth and webhooks
│
├── operations/                        # Operations & DevOps
│   ├── deployment.md                  # Docker, CI/CD, startup sequence
│   └── monitoring.md                  # Logging, metrics, alerting
│
├── routing/                           # Application Routing
│   └── routes.md                      # TanStack Router route definitions
│
├── security/                          # Security Specifications
│   ├── authentication.md              # OAuth, sessions, API tokens
│   ├── sandbox.md                     # Container isolation, DevContainers
│   └── security-model.md              # Tool sandboxing, audit logging
│
├── services/                          # Business Logic Services
│   ├── agent-service.md               # Agent lifecycle management
│   ├── project-service.md             # Project CRUD and config
│   ├── session-service.md             # Real-time session management
│   ├── task-service.md                # Task workflow and kanban
│   └── worktree-service.md            # Git worktree operations
│
├── state-machines/                    # State Machine Definitions
│   ├── agent-lifecycle.md             # Agent execution states
│   ├── session-lifecycle.md           # Session connection states
│   ├── task-workflow.md               # Kanban column transitions
│   └── worktree-lifecycle.md          # Git worktree states
│
├── testing/                           # Testing Specifications
│   ├── test-cases.md                  # 164+ test case definitions
│   └── test-infrastructure.md         # Mocks, factories, CI setup
│
└── wireframes/                        # Visual Wireframes (HTML)
    ├── design-tokens.css              # CSS design system tokens
    ├── agent-config-dialog.html       # Agent configuration
    ├── agent-session-presence.html    # Session with presence
    ├── approval-dialog.html           # Approval review UI
    ├── empty-states.html              # Empty state patterns
    ├── error-state-expanded.html      # Error display patterns
    ├── github-app-setup.html          # GitHub App installation
    ├── github-multi-project-dashboard.html  # Multi-project view
    ├── github-project-picker.html     # Project selection
    ├── github-terminal-split.html     # Terminal split view
    ├── kanban-board-full.html         # Full kanban board
    ├── mobile-responsive.html         # Mobile layouts
    ├── new-project-dialog.html        # New project wizard
    ├── project-settings.html          # Project configuration
    ├── queue-waiting-state.html       # Queue/waiting UI
    ├── session-history.html           # Session history view
    ├── task-detail-dialog.html        # Task detail modal
    ├── theme-toggle.html              # Theme switching
    └── worktree-management.html       # Worktree management
```

---

## Specification Categories

### Core Application

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [user-stories.md](./user-stories.md) | Requirements | 23 user stories, acceptance criteria, data models |
| [app-bootstrap.md](./architecture/app-bootstrap.md) | Initialization | 6-phase startup, error recovery, seeding |

### API Layer

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [endpoints.md](./api/endpoints.md) | REST API | 28 endpoints, request/response schemas |
| [pagination.md](./api/pagination.md) | Pagination | Cursor encoding, Drizzle patterns, React Query |
| [routes.md](./routing/routes.md) | Routing | TanStack Router, guards, loaders |

### Data Layer

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [schema.md](./database/schema.md) | Database | 9 tables, indexes, relationships |
| [config-management.md](./configuration/config-management.md) | Configuration | Project config, env vars, skills, commands |

### UI Components

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [kanban-board.md](./components/kanban-board.md) | Task Board | 4 columns, drag-drop, multi-select |
| [approval-dialog.md](./components/approval-dialog.md) | Code Review | Diff viewer, approve/reject flow |
| [agent-session-view.md](./components/agent-session-view.md) | Agent UI | Streaming, presence, activity feed |
| [task-detail-dialog.md](./components/task-detail-dialog.md) | Task Editor | View/edit modes, actions by state |
| [new-project-dialog.md](./components/new-project-dialog.md) | Project Creation | Wizard flow, validation |
| [project-picker.md](./components/project-picker.md) | Project Switch | Command palette, search |
| [form-inputs.md](./components/form-inputs.md) | Form Components | 10 input types, validation |
| [toast-notifications.md](./components/toast-notifications.md) | Notifications | 6 toast types, positioning |
| [breadcrumbs.md](./components/breadcrumbs.md) | Navigation | Route integration, truncation |
| [loading-skeletons.md](./components/loading-skeletons.md) | Loading States | Primitives, composites, pages |

### Services

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [agent-service.md](./services/agent-service.md) | Agent Logic | Start/stop, concurrency, hooks |
| [task-service.md](./services/task-service.md) | Task Logic | CRUD, workflow, approval |
| [project-service.md](./services/project-service.md) | Project Logic | CRUD, config sync |
| [session-service.md](./services/session-service.md) | Session Logic | Create, join, presence |
| [worktree-service.md](./services/worktree-service.md) | Git Logic | Create, merge, cleanup |

### State Machines

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [agent-lifecycle.md](./state-machines/agent-lifecycle.md) | Agent States | idle → running → completed |
| [task-workflow.md](./state-machines/task-workflow.md) | Task States | backlog → verified |
| [session-lifecycle.md](./state-machines/session-lifecycle.md) | Session States | active → closed |
| [worktree-lifecycle.md](./state-machines/worktree-lifecycle.md) | Worktree States | creating → removed |

### Security

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [authentication.md](./security/authentication.md) | Auth | GitHub OAuth, sessions, tokens |
| [sandbox.md](./security/sandbox.md) | Isolation | Docker containers, DevContainers, resource limits |
| [security-model.md](./security/security-model.md) | Security | Tool sandbox, audit logging |

### Integrations

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [claude-agent-sdk.md](./integrations/claude-agent-sdk.md) | AI | Query API, tools, hooks |
| [github-app.md](./integrations/github-app.md) | GitHub | OAuth, webhooks, config sync |
| [durable-sessions.md](./integrations/durable-sessions.md) | Real-time | Streams, presence, events |
| [git-worktrees.md](./integrations/git-worktrees.md) | Git | Isolation, merge, cleanup |

### Operations

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [deployment.md](./operations/deployment.md) | Deployment | Docker, CI/CD, troubleshooting |
| [monitoring.md](./operations/monitoring.md) | Observability | Logging, metrics, alerts |

### Testing

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [test-cases.md](./testing/test-cases.md) | Test Cases | 164+ test definitions |
| [test-infrastructure.md](./testing/test-infrastructure.md) | Test Setup | Mocks, factories, CI |

### Implementation Patterns

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [component-patterns.md](./implementation/component-patterns.md) | Base Components | Button, Dialog, CVA patterns |
| [animation-system.md](./implementation/animation-system.md) | Animation | Timing, easing, keyframes |
| [mobile-responsive.md](./implementation/mobile-responsive.md) | Responsive | Breakpoints, touch, adaptation |

### Errors

| Spec | Purpose | Key Contents |
|------|---------|--------------|
| [error-catalog.md](./errors/error-catalog.md) | Error Codes | 44 error types, HTTP mapping |

---

## How to Use These Specifications

### For Implementation

1. **Start with user-stories.md** - Understand requirements and acceptance criteria
2. **Review wireframes/** - See visual designs and interactions
3. **Read relevant service spec** - Understand business logic
4. **Check component spec** - Get UI implementation details
5. **Reference state machine** - Understand state transitions
6. **Follow implementation patterns** - Use consistent coding patterns

### For New Features

1. Add user story to `user-stories.md`
2. Create wireframe in `wireframes/`
3. Add component spec if new UI needed
4. Update relevant service spec
5. Add state machine if new workflow
6. Add test cases to `testing/`

### For Bug Fixes

1. Check error catalog for error codes
2. Review state machine for valid transitions
3. Check service spec for business rules
4. Verify against wireframe/component spec

---

## Design System Quick Reference

### Colors (GitHub Dark Theme)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-canvas` | #0d1117 | Page background |
| `--bg-default` | #161b22 | Card/modal background |
| `--bg-subtle` | #1c2128 | Secondary background |
| `--bg-muted` | #21262d | Tertiary/skeleton |
| `--border-default` | #30363d | Borders |
| `--fg-default` | #e6edf3 | Primary text |
| `--fg-muted` | #8b949e | Secondary text |
| `--accent-fg` | #58a6ff | Links, primary actions |
| `--success-fg` | #3fb950 | Success states |
| `--danger-fg` | #f85149 | Error states |

### Spacing (4px Grid)

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |

### Animation Timing

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | 50ms | Immediate feedback |
| `--duration-fast` | 150ms | Micro-interactions |
| `--duration-normal` | 200ms | Standard transitions |
| `--duration-slow` | 300ms | Complex animations |

---

## Cross-Reference Index

### By Feature

| Feature | Specs |
|---------|-------|
| **Project Management** | user-stories, project-service, new-project-dialog, project-picker, routes |
| **Task Workflow** | task-service, task-workflow, kanban-board, task-detail-dialog, approval-dialog |
| **Agent Execution** | agent-service, agent-lifecycle, agent-session-view, claude-agent-sdk |
| **Real-time Collaboration** | session-service, session-lifecycle, durable-sessions |
| **Git Integration** | worktree-service, worktree-lifecycle, git-worktrees, github-app |
| **Authentication** | authentication, security-model, routes |
| **Configuration** | config-management, project-service |

### By Technology

| Tech | Specs |
|------|-------|
| **TanStack Router** | routes, breadcrumbs |
| **TanStack DB** | architecture, services |
| **Drizzle ORM** | schema, pagination, services |
| **Radix UI** | All component specs |
| **dnd-kit** | kanban-board |
| **Durable Streams** | durable-sessions, session-service |
| **Claude Agent SDK** | claude-agent-sdk, agent-service |
| **XState** | All state-machines |
| **Vitest** | test-cases, test-infrastructure |

---

## Maintenance

### Adding New Specs

1. Create file in appropriate directory
2. Follow existing spec format and structure
3. Add to this README document tree
4. Cross-reference related specs
5. Update CLAUDE.md if needed

### Spec Format Guidelines

- Use TypeScript interfaces for all types
- Include implementation outlines with code examples
- Reference related specs with relative links
- Follow GitHub dark theme for visual specs
- Include accessibility requirements
- Add error handling specifications
