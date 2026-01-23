# AgentPane

**Multi-agent AI development assistant with real-time task management and code review workflows**

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Overview

AgentPane is a multi-agent AI development platform that enables concurrent AI agents to work on different tasks with full project isolation. It provides a visual Kanban board for task management, real-time streaming of agent progress, and integrated code review workflows.

## Features

- **Multi-Agent Concurrency** - Multiple AI agents working simultaneously on different tasks
- **Kanban Task Board** - Visual workflow: Backlog → In Progress → Waiting Approval → Verified
- **Real-time Streaming** - Live agent progress via Durable Streams
- **Code Review Workflow** - Approve or reject changes before merge with diff visualization
- **Git Worktree Isolation** - Each agent works in an isolated git worktree
- **Workflow Designer** - Visual AI-powered workflow editor with drag-and-drop
- **Session Replay** - Full session history with timeline and event filtering
- **GitHub Integration** - OAuth authentication, repository sync, and webhook support

## Wireframes

Visual designs are available in [`/specs/application/wireframes/`](specs/application/wireframes/):

| Component | Wireframe |
|-----------|-----------|
| Kanban Board | [kanban-board-full.html](specs/application/wireframes/kanban-board-full.html) |
| Workflow Designer | [workflow-designer.html](specs/application/wireframes/workflow-designer.html) |
| Task Detail | [task-detail-dialog.html](specs/application/wireframes/task-detail-dialog.html) |
| Code Review | [approval-dialog.html](specs/application/wireframes/approval-dialog.html) |
| Session History | [session-history.html](specs/application/wireframes/session-history.html) |
| Agent Config | [agent-config-dialog.html](specs/application/wireframes/agent-config-dialog.html) |
| Project Settings | [project-settings.html](specs/application/wireframes/project-settings.html) |

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | [Bun](https://bun.sh) | 1.3.6+ |
| Framework | [TanStack Start](https://tanstack.com/start) | 1.150.0 |
| Database | [SQLite](https://github.com/WiseLibs/better-sqlite3) | better-sqlite3 12.6.2 |
| ORM | [Drizzle](https://orm.drizzle.team) | 0.45.1 |
| Client State | [TanStack DB](https://tanstack.com/db) | 0.5.20 |
| Real-time | [Durable Streams](https://github.com/durable-streams/durable-streams) | 0.1.5 |
| AI/Agents | [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-typescript) | 0.2.12 |
| UI | [Radix](https://radix-ui.com) + [Tailwind](https://tailwindcss.com) | 4.1.18 |
| Flow Editor | [React Flow](https://reactflow.dev) | 12.10.0 |
| Drag & Drop | [dnd-kit](https://dndkit.com) | 6.3.1 |
| Testing | [Vitest](https://vitest.dev) | 4.0.16 |
| Linting | [Biome](https://biomejs.dev) | 2.3.11 |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.3.6+
- [Node.js](https://nodejs.org) 24.0.0+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/agentpane.git
cd agentpane

# Install dependencies
bun install

# Set up the database
bun run db:push
```

### Development

```bash
# Start development servers (frontend + API)
bun run dev
```

This starts:

- **Frontend**: Vite dev server on port 3000
- **API**: Backend server on port 3001

### Build

```bash
# Production build
bun run build
```

## Project Structure

```
├── src/
│   ├── app/              # Routes, pages, and UI components
│   ├── db/               # Database schema and migrations
│   ├── lib/              # Core libraries and utilities
│   ├── server/           # Backend API services
│   ├── services/         # Business logic services
│   └── types/            # TypeScript type definitions
├── specs/
│   └── application/      # Complete application specifications
│       ├── api/          # REST API (28 endpoints)
│       ├── components/   # UI component specs (19 specs)
│       ├── database/     # Database schema
│       ├── services/     # Service layer specs
│       ├── state-machines/ # State machine definitions
│       ├── testing/      # Test infrastructure
│       └── wireframes/   # Visual designs (20+ HTML files)
├── tests/                # Test suites
└── scripts/              # Development scripts
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development servers |
| `bun run build` | Production build |
| `bun run test` | Run tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:coverage` | Run tests with coverage |
| `bun run test:ui` | Run UI tests |
| `bun run lint` | Lint code |
| `bun run lint:fix` | Lint and fix code |
| `bun run format` | Format code |
| `bun run typecheck` | Type check |
| `bun run db:generate` | Generate database migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:studio` | Open Drizzle Studio |

## Documentation

- **Specifications**: [`/specs/application/README.md`](specs/application/README.md) - Complete application specifications
- **Development Guide**: [`CLAUDE.md`](CLAUDE.md) - AI-assisted development instructions
- **Component Guides**: `AGENTS.md` files in subdirectories for module-specific guidance

## License

[MIT](LICENSE)
