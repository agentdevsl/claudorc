# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Note**: This project uses AGENTS.md files for detailed guidance and has comprehensive specifications in `/specs/application`.

## Primary References

1. **AGENTS.md** - Development guidelines and tech stack: `./AGENTS.md`
2. **Specifications** - Complete application specs: `/specs/application/README.md`

## Application Specifications

The `/specs/application` directory contains **100% complete specifications** for building AgentPane. Always consult these before implementing features.

### Specification Structure

```
specs/application/
├── README.md                    # Spec overview and document tree
├── user-stories.md              # 23 user stories with acceptance criteria
│
├── api/                         # REST API (28 endpoints)
│   ├── endpoints.md             # All API endpoints
│   └── pagination.md            # Cursor-based pagination
│
├── architecture/                # System Architecture
│   └── app-bootstrap.md         # 6-phase initialization
│
├── components/                  # UI Components (19 specs)
│   ├── kanban-board.md          # Task board with drag-drop
│   ├── approval-dialog.md       # Code review modal
│   ├── agent-session-view.md    # Real-time agent UI
│   ├── task-detail-dialog.md    # Task editor
│   ├── new-project-dialog.md    # Project wizard
│   ├── project-picker.md        # Command palette
│   ├── form-inputs.md           # Form components
│   ├── toast-notifications.md   # Toast system
│   ├── breadcrumbs.md           # Navigation
│   ├── loading-skeletons.md     # Loading states
│   ├── agent-config-dialog.md   # Agent execution settings
│   ├── theme-toggle.md          # Light/dark/system theme
│   ├── empty-states.md          # Empty state presets
│   ├── project-settings.md      # Project configuration
│   ├── session-history.md       # Session list with filters
│   ├── worktree-management.md   # Git worktree management
│   ├── queue-waiting-state.md   # Queue position display
│   ├── github-app-setup.md      # GitHub OAuth integration
│   └── error-state.md           # Error visualization
│
├── configuration/               # Configuration
│   └── config-management.md     # Project config, env vars
│
├── database/                    # Database
│   └── schema.md                # Drizzle schema (9 tables)
│
├── errors/                      # Error Handling
│   └── error-catalog.md         # 44 error codes
│
├── implementation/              # Implementation Patterns
│   ├── component-patterns.md    # CVA, Radix patterns
│   ├── animation-system.md      # Animation tokens
│   └── mobile-responsive.md     # Responsive design
│
├── integrations/                # External Integrations
│   ├── claude-agent-sdk.md      # Claude SDK
│   ├── github-app.md            # GitHub OAuth
│   ├── durable-sessions.md      # Real-time sync
│   └── git-worktrees.md         # Git isolation
│
├── operations/                  # DevOps
│   ├── deployment.md            # Docker, CI/CD
│   └── monitoring.md            # Logging, metrics
│
├── routing/                     # Routing
│   └── routes.md                # TanStack Router
│
├── security/                    # Security
│   ├── authentication.md        # OAuth, sessions
│   ├── sandbox.md               # Container isolation, DevContainers
│   └── security-model.md        # Tool sandbox, audit logging
│
├── services/                    # Business Logic (5 services)
│   ├── agent-service.md         # Agent lifecycle
│   ├── task-service.md          # Task workflow
│   ├── project-service.md       # Project CRUD
│   ├── session-service.md       # Sessions
│   └── worktree-service.md      # Git worktrees
│
├── state-machines/              # State Machines (4 machines)
│   ├── agent-lifecycle.md       # idle → completed
│   ├── task-workflow.md         # backlog → verified
│   ├── session-lifecycle.md     # active → closed
│   └── worktree-lifecycle.md    # creating → removed
│
├── testing/                     # Testing
│   ├── test-cases.md            # 164+ test cases
│   └── test-infrastructure.md   # Mocks, factories
│
└── wireframes/                  # Visual Designs (20 HTML files)
    ├── design-tokens.css        # Design system
    └── *.html                   # UI wireframes
```

### Using Specifications

| Task | Start With |
|------|------------|
| **New feature** | `user-stories.md` → `wireframes/` → component spec |
| **API work** | `api/endpoints.md` → service spec |
| **UI component** | `components/*.md` → `implementation/component-patterns.md` |
| **State logic** | `state-machines/*.md` → service spec |
| **Database** | `database/schema.md` |
| **Testing** | `testing/test-infrastructure.md` → `test-cases.md` |
| **Deployment** | `operations/deployment.md` |
| **Debugging** | `errors/error-catalog.md` → `operations/monitoring.md` |

## Additional Component-Specific Guidance

For detailed module-specific implementation guides, also check for AGENTS.md files in subdirectories throughout the project. These component-specific AGENTS.md files contain targeted guidance for working with those particular areas of the codebase.

If you need to ask the user a question use the tool AskUserQuestion - this is useful during speckit.clarify

## Updating Documentation

When you discover new information that would be helpful for future development work:

- **Update existing AGENTS.md files** when you learn implementation details, debugging insights, or architectural patterns specific to that component
- **Create new AGENTS.md files** in relevant directories when working with areas that don't yet have documentation
- **Update specs** when implementation reveals gaps or corrections needed
- **Add valuable insights** such as common pitfalls, debugging techniques, dependency relationships, or implementation patterns

## Development

### Starting the Server

```bash
npm run dev
```

This starts both servers concurrently:
- **Frontend**: Vite dev server on port 3000
- **API**: Backend server on port 3001

The startup script includes health checks to ensure both servers are ready before development begins.

### Common Issues

- **API offline**: If API requests fail, check that port 3001 is running. Restart with `npm run dev`.
- **Frontend not loading**: Ensure port 3000 is available and Vite started successfully.

## Important: Use Subagents Liberally

When performing any research, concurrent subagents can be used for performance and isolation. Use parallel tool calls and tasks where possible.

## Use this teck stack

| Layer              | Technology       | Package                                                                                             | Version          |
| ------------------ | ---------------- | --------------------------------------------------------------------------------------------------- | ---------------- |
| Runtime            | Bun              | https://bun.sh                                                                                      | 1.3.6            |
| Framework          | TanStack Start   | @tanstack/react-start (https://github.com/TanStack/router)                                          | 1.150.0          |
| Database           | SQLite           | better-sqlite3 (https://github.com/WiseLibs/better-sqlite3)                                         | 12.6.2           |
| ORM                | Drizzle          | drizzle-orm + drizzle-kit (https://github.com/drizzle-team/drizzle-orm)                             | 0.45.1           |
| Client State       | TanStack DB      | @tanstack/db + @tanstack/react-db (https://github.com/TanStack/db)                                  | 0.5.20 / 0.1.64  |
| Agent Events       | Durable Streams  | @durable-streams/client + @durable-streams/state (https://github.com/durable-streams/durable-streams) | 0.1.5            |
| AI / Agents        | Claude Agent SDK | @anthropic-ai/claude-agent-sdk (https://github.com/anthropics/claude-agent-sdk-typescript)          | 0.2.9            |
| UI                 | Radix + Tailwind | @radix-ui/* + tailwindcss (https://github.com/radix-ui/primitives)                                  | 1.2.4 / 4.1.18   |
| Drag & Drop        | dnd-kit          | @dnd-kit/core + @dnd-kit/sortable (https://github.com/clauderic/dnd-kit)                            | 6.3.1            |
| Testing            | Vitest           | vitest (https://github.com/vitest-dev/vitest)                                                       | 4.0.17           |
| UI Testing         | Agent Browser    | agent-browser (https://github.com/vercel-labs/agent-browser)                                        | 0.5.0            |
| Linting/Formatting | Biome            | @biomejs/biome (https://github.com/biomejs/biome)                                                   | 2.3.11           |
| CI/CD              | GitHub Actions   | https://github.com/features/actions                                                                 | -                |

### Utility Libraries

| Package                  | Version | Purpose                         |
| ------------------------ | ------- | ------------------------------- |
| class-variance-authority | 0.7.1   | Component variant styling (cva) |
| @paralleldrive/cuid2     | 3.0.6   | Secure collision-resistant IDs  |
| zod                      | 4.3.5   | Schema validation               |
| @radix-ui/react-slot     | 1.2.4   | asChild prop support            |
| @tailwindcss/vite        | 4.1.18  | Tailwind v4 Vite plugin         |