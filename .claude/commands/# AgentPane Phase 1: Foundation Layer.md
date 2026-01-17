# AgentPane Phase 1: Foundation Layer

You are a software engineering agent implementing the foundation layer for AgentPane.

## Context

**Repository:** agentdevsl/claudorc
**Issue:** [#4 - Phase 1: Foundation Layer](https://github.com/agentdevsl/claudorc/issues/4)

## Reference Documents

Read these specs before starting implementation:

1. `specs/implementation/phase-1-foundation.md` - Detailed phase specification
2. `specs/implementation/tasks.md` - Task breakdown (F-001 to F-064)

## Scope

| Section | Task IDs | Description |
|---------|----------|-------------|
| 1.1 Core Utilities | F-001 to F-007 | Result<T,E> type, ok/err constructors, helpers |
| 1.2 Error System | F-008 to F-017 | AppError interface, 44 error codes, 8 categories |
| 1.3 Database Schema | F-018 to F-031 | Drizzle schema, 9 tables, PGlite initialization |
| 1.4 Bootstrap Service | F-032 to F-044 | 6-phase bootstrap, React provider |
| 1.5 State Machines | F-045 to F-059 | Agent, Task, Session, Worktree lifecycles |
| 1.6 Configuration | F-060 to F-064 | Config system with hot-reload support |

**Total: 64 tasks (52 P0, 11 P1, 1 P2)**

## Critical Path

```
F-001 (Result) → F-008 (Errors) → F-029 (PGlite) → F-039 (Bootstrap)
```

Complete these tasks in order as they have dependencies.

## Implementation Order

1. **Start with Core Utilities (F-001 to F-007)**
   - Implement `Result<T,E>` type
   - Create `ok()` and `err()` constructors
   - Add helper methods (isOk, isErr, unwrap, unwrapOr, map, mapErr)

2. **Build Error System (F-008 to F-017)**
   - Define `AppError` interface
   - Implement 44 error codes across 8 categories
   - Create error factory functions

3. **Set Up Database Schema (F-018 to F-031)**
   - Define Drizzle schema for 9 tables
   - Configure PGlite initialization
   - Create migration system

4. **Implement Bootstrap Service (F-032 to F-044)**
   - Build 6-phase bootstrap sequence
   - Create React provider/context
   - Handle initialization errors gracefully

5. **Create State Machines (F-045 to F-059)**
   - Agent lifecycle state machine
   - Task lifecycle state machine
   - Session lifecycle state machine
   - Worktree lifecycle state machine

6. **Configure System (F-060 to F-064)**
   - Implement configuration loading
   - Add hot-reload support
   - Validate configuration on load

## Tech Stack

- **Language:** TypeScript
- **Database:** PGlite with Drizzle ORM
- **State Machines:** XState or custom implementation
- **UI Framework:** React (for providers/context)

## Test Requirements

| Component | Required Tests |
|-----------|----------------|
| Result utilities | 8 tests |
| Error system | 44 tests (one per error code) |
| Schema | 15 tests |
| Bootstrap | 12 tests |
| State machines | 20 tests |
| Configuration | 8 tests |

## Commands

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Completion Criteria

- [ ] All P0 tasks completed (52 tasks)
- [ ] Unit tests passing for each component
- [ ] Database migrations working
- [ ] Bootstrap sequence completing successfully
- [ ] Type checking passes with no errors
- [ ] Linting passes with no warnings

## Working Process

1. Read the spec files first - understand the full scope
2. Work through critical path tasks in order
3. Write tests alongside implementation (TDD preferred)
4. Commit after completing each logical unit (e.g., one section)