# Test Cases Catalog

## Overview

Comprehensive test case catalog for AgentPane, organized by feature area. Each test case includes a checkbox for TDD tracking, priority level, and test type classification.

**Test Types**:
- `Unit`: Isolated function/component tests
- `Integration`: Multi-component interaction tests
- `E2E`: Full system flow tests via Agent Browser

**Priority Levels**:
- `P0`: Critical - must pass for release
- `P1`: High - core functionality
- `P2`: Medium - important features
- `P3`: Low - edge cases and polish

---

## 1. Project Management

### 1.1 Project CRUD Operations

- [ ] **PM-001** `Unit` `P0` - Create project with valid path
- [ ] **PM-002** `Unit` `P0` - Create project fails for non-existent path
- [ ] **PM-003** `Unit` `P0` - Create project fails for non-git repository
- [ ] **PM-004** `Unit` `P1` - Update project name
- [ ] **PM-005** `Unit` `P1` - Update project configuration
- [ ] **PM-006** `Unit` `P0` - Delete project removes all associated tasks
- [ ] **PM-007** `Unit` `P0` - Delete project removes all associated worktrees
- [ ] **PM-008** `Unit` `P2` - List projects returns all user projects
- [ ] **PM-009** `Unit` `P2` - Get project by ID returns correct project
- [ ] **PM-010** `Unit` `P2` - Get project by ID returns 404 for invalid ID

### 1.2 Project Configuration

- [ ] **PM-011** `Unit` `P1` - Default config applied when none specified
- [ ] **PM-012** `Unit` `P1` - Custom allowedTools validated against whitelist
- [ ] **PM-013** `Unit` `P1` - maxTurns validated (1-200 range)
- [ ] **PM-014** `Unit` `P2` - worktreeRoot directory created if missing
- [ ] **PM-015** `Unit` `P2` - envFile path validated
- [ ] **PM-016** `Unit` `P2` - initScript path validated
- [ ] **PM-017** `Integration` `P1` - Config sync from GitHub .agentpane/

### 1.3 Project Import

- [ ] **PM-018** `Integration` `P1` - Import project from local path
- [ ] **PM-019** `Integration` `P1` - Import project from GitHub repository
- [ ] **PM-020** `Integration` `P2` - Import detects existing .agentpane config
- [ ] **PM-021** `E2E` `P2` - Project picker shows recent projects

---

## 2. Task Workflow (Kanban)

### 2.1 Task CRUD Operations

- [ ] **TW-001** `Unit` `P0` - Create task with required fields
- [ ] **TW-002** `Unit` `P0` - Create task assigns unique CUID2 ID
- [ ] **TW-003** `Unit` `P1` - Create task sets default column to 'backlog'
- [ ] **TW-004** `Unit` `P1` - Update task title
- [ ] **TW-005** `Unit` `P1` - Update task description
- [ ] **TW-006** `Unit` `P0` - Delete task removes from database
- [ ] **TW-007** `Unit` `P2` - List tasks by project returns correct tasks
- [ ] **TW-008** `Unit` `P2` - List tasks by column returns filtered results

### 2.2 Kanban Column Transitions

- [ ] **TW-009** `Unit` `P0` - Task moves from 'backlog' to 'todo'
- [ ] **TW-010** `Unit` `P0` - Task moves from 'todo' to 'in_progress'
- [ ] **TW-011** `Unit` `P0` - Task moves from 'in_progress' to 'review'
- [ ] **TW-012** `Unit` `P0` - Task moves from 'review' to 'done'
- [ ] **TW-013** `Unit` `P0` - Task moves from 'done' to 'verified'
- [ ] **TW-014** `Unit` `P1` - Invalid column transition rejected (e.g., backlog -> done)
- [ ] **TW-015** `Unit` `P1` - Task requeue moves back to 'todo'
- [ ] **TW-016** `Integration` `P0` - Column change triggers worktree creation (todo -> in_progress)
- [ ] **TW-017** `Integration` `P0` - Column change triggers merge (review -> done with approval)
- [ ] **TW-018** `Unit` `P2` - Column change updates timestamp

### 2.3 Drag and Drop

- [ ] **TW-019** `E2E` `P1` - Drag task between columns updates position
- [ ] **TW-020** `E2E` `P1` - Drag task reorders within same column
- [ ] **TW-021** `E2E` `P2` - Drag feedback shows valid drop targets
- [ ] **TW-022** `E2E` `P2` - Invalid drop target shows error indicator
- [ ] **TW-023** `E2E` `P2` - Optimistic update reverts on server error

### 2.4 Task Dependencies

- [ ] **TW-024** `Unit` `P2` - Add dependency between tasks
- [ ] **TW-025** `Unit` `P2` - Remove task dependency
- [ ] **TW-026** `Unit` `P2` - Circular dependency rejected
- [ ] **TW-027** `Unit` `P2` - Task with unmet dependencies cannot start
- [ ] **TW-028** `Unit` `P3` - Dependency graph computed correctly

---

## 3. Agent Execution

### 3.1 Agent Lifecycle

- [ ] **AE-001** `Integration` `P0` - Agent spawns when task moved to 'in_progress'
- [ ] **AE-002** `Integration` `P0` - Agent receives correct task context
- [ ] **AE-003** `Integration` `P0` - Agent runs in isolated worktree
- [ ] **AE-004** `Integration` `P0` - Agent completes and moves task to 'review'
- [ ] **AE-005** `Integration` `P1` - Agent can be stopped mid-execution
- [ ] **AE-006** `Integration` `P1` - Agent cleanup on error
- [ ] **AE-007** `Unit` `P2` - Agent status tracked (idle, running, error)

### 3.2 Turn Limits

- [ ] **AE-008** `Integration` `P0` - Agent respects maxTurns configuration
- [ ] **AE-009** `Integration` `P0` - Agent pauses at turn limit
- [ ] **AE-010** `Integration` `P1` - Turn limit can be extended via UI
- [ ] **AE-011** `Unit` `P2` - Turn count persisted across restarts
- [ ] **AE-012** `Unit` `P2` - Turn count displayed in real-time

### 3.3 Tool Restrictions

- [ ] **AE-013** `Integration` `P0` - Agent only uses allowedTools
- [ ] **AE-014** `Integration` `P0` - Bash tool restricted in sandbox mode
- [ ] **AE-015** `Integration` `P1` - disallowedTools blocks specific commands
- [ ] **AE-016** `Unit` `P1` - Tool whitelist validation at config load
- [ ] **AE-017** `Integration` `P2` - MCP tool access controlled by config

### 3.4 Concurrency

- [ ] **AE-018** `Integration` `P0` - Multiple agents run in parallel (up to maxConcurrentAgents)
- [ ] **AE-019** `Integration` `P0` - Agents isolated in separate worktrees
- [ ] **AE-020** `Integration` `P1` - Queue tasks when at concurrency limit
- [ ] **AE-021** `Integration` `P1` - Next queued task starts when slot opens
- [ ] **AE-022** `Unit` `P2` - Concurrent agent count displayed correctly

### 3.5 Agent Output

- [ ] **AE-023** `Integration` `P0` - Agent messages streamed to UI
- [ ] **AE-024** `Integration` `P1` - Tool calls displayed with results
- [ ] **AE-025** `Integration` `P1` - Agent errors displayed with context
- [ ] **AE-026** `Unit` `P2` - Output persisted for history view
- [ ] **AE-027** `E2E` `P2` - Output virtualized for large outputs

---

## 4. Worktree Lifecycle

### 4.1 Worktree Creation

- [ ] **WL-001** `Integration` `P0` - Worktree created with correct branch name
- [ ] **WL-002** `Integration` `P0` - Worktree based on configured base branch
- [ ] **WL-003** `Integration` `P0` - .env file copied to worktree
- [ ] **WL-004** `Integration` `P0` - Dependencies installed via `bun install`
- [ ] **WL-005** `Integration` `P1` - initScript executed after setup
- [ ] **WL-006** `Integration` `P1` - Creation failure cleans up partial state
- [ ] **WL-007** `Unit` `P2` - Worktree status updates to 'active' on success

### 4.2 Worktree Merge

- [ ] **WL-008** `Integration` `P0` - Merge succeeds on task approval
- [ ] **WL-009** `Integration` `P0` - Merge creates commit in base branch
- [ ] **WL-010** `Integration` `P0` - Conflict detected and reported
- [ ] **WL-011** `Integration` `P1` - Dirty worktree blocks merge
- [ ] **WL-012** `Integration` `P1` - Merge aborted on conflict preserves state
- [ ] **WL-013** `Unit` `P2` - Merge timestamp recorded

### 4.3 Worktree Cleanup

- [ ] **WL-014** `Integration` `P0` - Worktree removed after successful merge
- [ ] **WL-015** `Integration` `P0` - Branch deleted after worktree removal
- [ ] **WL-016** `Integration` `P1` - Stale worktrees detected (no activity)
- [ ] **WL-017** `Integration` `P1` - Orphaned worktrees detected (no task)
- [ ] **WL-018** `Integration` `P2` - Pruning respects safety rules
- [ ] **WL-019** `Unit` `P2` - Disk usage calculated correctly

### 4.4 Worktree Recovery

- [ ] **WL-020** `Integration` `P1` - Stuck 'creating' state recovered
- [ ] **WL-021** `Integration` `P1` - Force removal for error state
- [ ] **WL-022** `Integration` `P2` - Database state synced with git state

---

## 5. Session and Real-time

### 5.1 Session Management

- [ ] **SR-001** `Unit` `P0` - Session created for new client
- [ ] **SR-002** `Unit` `P0` - Session persists across page reloads
- [ ] **SR-003** `Unit` `P1` - Session cleanup on disconnect
- [ ] **SR-004** `Unit` `P2` - Multiple sessions per user supported
- [ ] **SR-005** `Unit` `P2` - Session activity tracked

### 5.2 Real-time Updates (Durable Streams)

- [ ] **SR-006** `Integration` `P0` - Task changes broadcast to clients
- [ ] **SR-007** `Integration` `P0` - Agent status updates broadcast
- [ ] **SR-008** `Integration` `P0` - Agent messages streamed in real-time
- [ ] **SR-009** `Integration` `P1` - Client reconnects after disconnect
- [ ] **SR-010** `Integration` `P1` - Missed events replayed on reconnect
- [ ] **SR-011** `Integration` `P2` - Stream backpressure handled

### 5.3 Optimistic Updates

- [ ] **SR-012** `Integration` `P0` - UI updates optimistically on drag
- [ ] **SR-013** `Integration` `P0` - Optimistic update reverted on error
- [ ] **SR-014** `Integration` `P1` - Conflict resolution for concurrent edits
- [ ] **SR-015** `Unit` `P2` - TanStack DB state synchronized

---

## 6. GitHub Integration

### 6.1 OAuth Flow

- [ ] **GH-001** `Integration` `P0` - OAuth authorization URL generated correctly
- [ ] **GH-002** `Integration` `P0` - OAuth callback exchanges code for token
- [ ] **GH-003** `Integration` `P0` - User info retrieved after auth
- [ ] **GH-004** `Integration` `P1` - OAuth state validated (CSRF protection)
- [ ] **GH-005** `Integration` `P1` - OAuth error handled gracefully
- [ ] **GH-006** `Unit` `P2` - Token stored securely

### 6.2 Installation Management

- [ ] **GH-007** `Integration` `P0` - App installation detected
- [ ] **GH-008** `Integration` `P0` - Installation repositories listed
- [ ] **GH-009** `Integration` `P1` - Installation suspension handled
- [ ] **GH-010** `Integration` `P1` - Installation deletion handled
- [ ] **GH-011** `Integration` `P2` - Permission changes detected

### 6.3 Repository Operations

- [ ] **GH-012** `Integration` `P0` - Repository content fetched
- [ ] **GH-013** `Integration` `P0` - Repository branches listed
- [ ] **GH-014** `Integration` `P1` - Private repository access works
- [ ] **GH-015** `Integration` `P2` - Rate limiting handled

### 6.4 Configuration Sync

- [ ] **GH-016** `Integration` `P0` - .agentpane/config.json fetched and parsed
- [ ] **GH-017** `Integration` `P0` - Invalid config validation reported
- [ ] **GH-018** `Integration` `P0` - Config changes on push detected
- [ ] **GH-019** `Integration` `P1` - Prompt files fetched from .agentpane/prompts/
- [ ] **GH-020** `Integration` `P1` - Sync error stored for display
- [ ] **GH-021** `Unit` `P2` - Config schema validation comprehensive

### 6.5 Webhook Handling

- [ ] **GH-022** `Integration` `P0` - Webhook signature verified
- [ ] **GH-023** `Integration` `P0` - Push event triggers config sync
- [ ] **GH-024** `Integration` `P1` - Installation event updates database
- [ ] **GH-025** `Integration` `P1` - PR event logged
- [ ] **GH-026** `Integration` `P2` - Issues event logged
- [ ] **GH-027** `Unit` `P2` - Invalid signature rejected

### 6.6 Pull Request Operations

- [ ] **GH-028** `Integration` `P1` - PR created for approved task
- [ ] **GH-029** `Integration` `P1` - PR merged via API
- [ ] **GH-030** `Integration` `P2` - PR comment added
- [ ] **GH-031** `Integration` `P2` - PR status checked

---

## 7. Error Handling

### 7.1 Client-Side Errors

- [ ] **EH-001** `Unit` `P0` - Network error displayed to user
- [ ] **EH-002** `Unit` `P0` - Validation error displayed inline
- [ ] **EH-003** `Unit` `P1` - Retry mechanism for transient errors
- [ ] **EH-004** `Unit` `P2` - Error boundary catches React errors
- [ ] **EH-005** `E2E` `P2` - Error toast displays with action

### 7.2 Server-Side Errors

- [ ] **EH-006** `Unit` `P0` - 400 returned for validation errors
- [ ] **EH-007** `Unit` `P0` - 404 returned for not found
- [ ] **EH-008** `Unit` `P0` - 500 returned for unexpected errors
- [ ] **EH-009** `Unit` `P1` - Error logged with correlation ID
- [ ] **EH-010** `Unit` `P2` - Error context preserved in chain

### 7.3 Agent Errors

- [ ] **EH-011** `Integration` `P0` - Agent error captured and displayed
- [ ] **EH-012** `Integration` `P0` - Agent timeout handled
- [ ] **EH-013** `Integration` `P1` - Agent crash recovered
- [ ] **EH-014** `Integration` `P2` - Error feedback allows retry

### 7.4 Git Errors

- [ ] **EH-015** `Integration` `P0` - Merge conflict reported with files
- [ ] **EH-016** `Integration` `P0` - Worktree creation failure handled
- [ ] **EH-017** `Integration` `P1` - Branch already exists handled
- [ ] **EH-018** `Integration` `P2` - Dirty worktree detected

---

## 8. End-to-End Scenarios

### 8.1 Full Task Lifecycle (Agent Browser)

- [ ] **E2E-001** `E2E` `P0` - Create project from local path
- [ ] **E2E-002** `E2E` `P0` - Create task in backlog
- [ ] **E2E-003** `E2E` `P0` - Drag task to in_progress starts agent
- [ ] **E2E-004** `E2E` `P0` - Agent completes task and moves to review
- [ ] **E2E-005** `E2E` `P0` - Open approval dialog shows diff
- [ ] **E2E-006** `E2E` `P0` - Approve task merges changes
- [ ] **E2E-007** `E2E` `P0` - Task moves to done after approval

### 8.2 Multi-Agent Scenario

- [ ] **E2E-008** `E2E` `P1` - Multiple tasks started concurrently
- [ ] **E2E-009** `E2E` `P1` - Each agent in separate worktree
- [ ] **E2E-010** `E2E` `P1` - Agent messages interleaved correctly
- [ ] **E2E-011** `E2E` `P2` - Concurrent approvals work

### 8.3 GitHub Flow

- [ ] **E2E-012** `E2E` `P1` - OAuth login via GitHub
- [ ] **E2E-013** `E2E` `P1` - Import project from GitHub
- [ ] **E2E-014** `E2E` `P2` - Config synced from repository
- [ ] **E2E-015** `E2E` `P2` - Webhook triggers config refresh

### 8.4 Error Recovery

- [ ] **E2E-016** `E2E` `P1` - Reject task with feedback
- [ ] **E2E-017** `E2E` `P1` - Task requeued after rejection
- [ ] **E2E-018** `E2E` `P2` - Agent retries on failure
- [ ] **E2E-019** `E2E` `P2` - Merge conflict resolved manually

### 8.5 Dashboard and Navigation

- [ ] **E2E-020** `E2E` `P2` - Multi-project dashboard displays all projects
- [ ] **E2E-021** `E2E` `P2` - Project picker opens with Cmd+P
- [ ] **E2E-022** `E2E` `P2` - Keyboard navigation works in picker
- [ ] **E2E-023** `E2E` `P3` - Project stats calculated correctly

---

## 9. Performance and Load

### 9.1 Database Performance

- [ ] **PL-001** `Integration` `P2` - 100 tasks load under 500ms
- [ ] **PL-002** `Integration` `P2` - Task drag update under 100ms
- [ ] **PL-003** `Integration` `P2` - Query N+1 problems avoided
- [ ] **PL-004** `Integration` `P3` - Indexes used for common queries

### 9.2 Real-time Performance

- [ ] **PL-005** `Integration` `P2` - Stream latency under 100ms
- [ ] **PL-006** `Integration` `P2` - 10 concurrent streams handled
- [ ] **PL-007** `Integration` `P3` - Memory stable with long streams

### 9.3 Agent Performance

- [ ] **PL-008** `Integration` `P2` - Agent spawn time under 2s
- [ ] **PL-009** `Integration` `P2` - Worktree creation under 30s
- [ ] **PL-010** `Integration` `P3` - Agent memory usage bounded

---

## Test Configuration

### Agent Browser Setup

```typescript
// tests/e2e/setup.ts
import { AgentBrowser } from 'agent-browser';

export const browser = new AgentBrowser({
  headless: process.env.CI === 'true',
  baseUrl: 'http://localhost:5173',
  timeout: 30000,
});

export async function setupTestProject() {
  // Create test project with known state
}

export async function cleanupTestProject() {
  // Remove test data and worktrees
}
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'app/**/*.ts'],
      exclude: ['**/*.d.ts', '**/types.ts'],
    },
  },
});
```

### Test Data Factories

```typescript
// tests/factories.ts
import { createId } from '@paralleldrive/cuid2';
import type { Project, Task } from '@/db/schema';

export function createTestProject(overrides?: Partial<Project>): Project {
  return {
    id: createId(),
    name: 'Test Project',
    path: '/tmp/test-project',
    config: {
      allowedTools: ['Read', 'Edit', 'Bash'],
      maxTurns: 50,
      worktreeRoot: '.worktrees',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestTask(projectId: string, overrides?: Partial<Task>): Task {
  return {
    id: createId(),
    projectId,
    title: 'Test Task',
    description: 'A test task for testing',
    column: 'backlog',
    position: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

---

## Cross-References

| Spec | Test Coverage |
|------|---------------|
| [User Stories](../user-stories.md) | All acceptance criteria |
| [Database Schema](../database/schema.md) | PM, TW, AE sections |
| [Error Catalog](../errors/error-catalog.md) | EH section |
| [Git Worktrees](../integrations/git-worktrees.md) | WL section |
| [GitHub App](../integrations/github-app.md) | GH section |
