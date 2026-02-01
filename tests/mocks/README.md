# Test Mocks

This directory contains type-safe mock builders for testing AgentPane services and infrastructure.

## Quick Start

For most tests, use **pre-configured scenarios** instead of building mocks manually:

```typescript
import { createTaskServiceScenario } from '../mocks/mock-scenarios';

it('creates a task', async () => {
  const scenario = createTaskServiceScenario();
  const result = await scenario.service.create({
    projectId: 'proj-1',
    title: 'Build feature',
  });
  expect(result.ok).toBe(true);
});
```

See the **Mock Scenarios** section below for complete documentation.

## Available Mocks

### Database Mocks (`mock-builders.ts`) ⭐ NEW

Type-safe database mocking that eliminates the need for `as never` casts.

- **`createMockDatabase(overrides?)`** - Complete Drizzle database mock with all 20 tables

  ```typescript
  import { createMockDatabase, createTableQuery } from '../mocks/mock-builders.js';
  import type { Database } from '../../src/types/database.js';

  const mockDb = createMockDatabase({
    query: {
      projects: createTableQuery([project1, project2]),
    },
  }) as unknown as Database;

  // Use in service constructors - no `as never` needed!
  const service = new ProjectService(mockDb, mockWorktreeService);
  ```

- **`createTableQuery(records)`** - Mock table query API (findFirst/findMany)
- **`createInsertChain(returnValue)`** - Mock insert().values().returning()
- **`createUpdateChain(returnValue)`** - Mock update().set().where().returning()
- **`createDeleteChain()`** - Mock delete().where().run()
- **`createSelectChain(returnValue)`** - Mock select().from().where().all()

See `MIGRATION_GUIDE.md` for migration instructions and `mock-builders.example.test.ts` for working examples.

### Mock Scenarios (`mock-scenarios.ts`) ⭐ RECOMMENDED

**Pre-configured complete test scenarios** that wire together all mocks. Use these instead of building mocks piecemeal.

#### Available Scenarios

1. **`createTaskServiceScenario(overrides?)`** - TaskService with db, worktree, and container agent
2. **`createAgentServiceScenario(overrides?)`** - AgentExecutionService with all dependencies
3. **`createProjectServiceScenario(overrides?)`** - ProjectService with db, worktree, and runner
4. **`createSessionServiceScenario(overrides?)`** - SessionService with db and streams
5. **`createContainerAgentScenario(overrides?)`** - ContainerAgentService with sandbox, API key, etc.
6. **`createFullStackScenario()`** - ALL services wired together with shared data
7. **`createErrorScenario(service, errorType)`** - Scenarios with specific failures injected
8. **`createConcurrencyScenario(taskCount)`** - Race condition testing with multiple tasks

#### Example

```typescript
import { createTaskServiceScenario, createErrorScenario } from '../mocks/mock-scenarios';

it('creates a task', async () => {
  const scenario = createTaskServiceScenario();
  const result = await scenario.service.create({
    projectId: 'proj-1',
    title: 'Build feature',
  });
  expect(result.ok).toBe(true);
});

it('handles API key missing', async () => {
  const scenario = createErrorScenario('containerAgent', 'api_key_missing');
  const apiKey = await scenario.apiKeyService.getDecryptedKey('anthropic');
  expect(apiKey).toBeNull();
});
```

See `mock-scenarios.example.test.ts` for complete examples.

### Service Mocks (`mock-services.ts`)

- `createMockProjectService()` - Project CRUD and configuration
- `createMockTaskService()` - Task management and workflow
- `createMockAgentService()` - Agent lifecycle and execution
- `createMockSessionService()` - Session tracking and events
- `createMockWorktreeService()` - Git worktree management

### Sandbox Mocks (`mock-sandbox.ts`)

Type-safe mocks for Docker sandbox infrastructure without `as never` casts.

#### Core Builders

- **`createMockSandbox(overrides?)`** - Complete sandbox instance with all methods mocked

  ```typescript
  const sandbox = createMockSandbox({
    id: 'test-sandbox',
    status: 'running',
    exec: vi.fn().mockResolvedValue({ exitCode: 0, stdout: 'output', stderr: '' }),
  });

  const result = await sandbox.exec('echo', ['hello']);
  expect(result.exitCode).toBe(0);
  ```

- **`createMockSandboxProvider(sandbox?)`** - Provider with get/create/healthCheck methods

  ```typescript
  const mockSandbox = createMockSandbox({ id: 'test-123' });
  const provider = createMockSandboxProvider(mockSandbox);

  const result = await provider.get('project-123');
  expect(result?.id).toBe('test-123');
  ```

- **`createMockSandboxConfig(overrides?)`** - Default sandbox configuration

  ```typescript
  const config = createMockSandboxConfig({
    projectId: 'my-project',
    memoryMb: 8192,
    env: { NODE_ENV: 'test' },
  });
  ```

#### Stream Utilities

- **`createMockReadableStream(data?)`** - Node.js Readable that emits lines then ends

  ```typescript
  const stream = createMockReadableStream(['line 1', 'line 2']);
  stream.on('data', (chunk) => console.log(chunk.toString()));
  // Output: "line 1\n" then "line 2\n"
  ```

- **`createMockExecStreamResult(overrides?)`** - Mock exec stream with stdout/stderr/wait/kill

  ```typescript
  const result = createMockExecStreamResult({
    stdout: createMockReadableStream(['output line']),
    wait: vi.fn().mockResolvedValue({ exitCode: 0 }),
  });

  const { exitCode } = await result.wait();
  ```

- **`createMockSandboxWithEvents(events)`** - Sandbox that emits JSON event lines

  ```typescript
  const events = [
    { type: 'agent:started', data: { agentId: 'agent-123' } },
    { type: 'agent:completed', data: { success: true } },
  ];

  const sandbox = createMockSandboxWithEvents(events);
  const streamResult = await sandbox.execStream?.({ cmd: 'agent-runner', env: {} });

  streamResult?.stdout.on('data', (chunk) => {
    const event = JSON.parse(chunk.toString());
    console.log('Event:', event.type);
  });
  ```

#### Helper Builders

- **`createMockSandboxInfo(overrides?)`** - Sandbox metadata
- **`createMockExecResult(overrides?)`** - Command execution result

### External Mocks (`external.ts`)

- `mockClaudeSDK` - Claude Agent SDK
- `mockDurableStreams` - Real-time event streaming
- `mockOctokit` - GitHub API client

### Git Mocks (`git.ts`)

- `mockGitCommands` - Git operations (clone, commit, branch, etc.)

## Usage Examples

### Testing Container Agent Service

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMockSandbox, createMockSandboxWithEvents } from '../mocks';

describe('Container Agent', () => {
  it('processes agent events from container', async () => {
    const events = [
      { type: 'agent:started', sessionId: 'session-123' },
      { type: 'chunk', content: 'Working on task...' },
      { type: 'agent:completed', success: true },
    ];

    const sandbox = createMockSandboxWithEvents(events);
    const streamResult = await sandbox.execStream?.({
      cmd: 'agent-runner',
      env: { AGENT_TASK_ID: 'task-123' },
    });

    const chunks: string[] = [];
    streamResult?.stdout.on('data', (chunk) => {
      chunks.push(chunk.toString());
    });

    await new Promise((resolve) => streamResult?.stdout.on('end', resolve));

    expect(chunks).toHaveLength(3);
    const event1 = JSON.parse(chunks[0]);
    expect(event1.type).toBe('agent:started');
  });

  it('handles sandbox exec failures', async () => {
    const sandbox = createMockSandbox({
      exec: vi.fn().mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'Permission denied',
      }),
    });

    const result = await sandbox.exec('npm', ['install']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Permission denied');
  });
});
```

### Testing Sandbox Service

```typescript
import { createMockSandboxProvider, createMockSandbox } from '../mocks';

it('creates sandbox for project', async () => {
  const mockSandbox = createMockSandbox({ projectId: 'project-123' });
  const provider = createMockSandboxProvider(mockSandbox);

  const sandboxService = new SandboxService(db, provider, streamsService);
  const result = await sandboxService.getOrCreateForProject('project-123');

  expect(result.ok).toBe(true);
  expect(result.value?.projectId).toBe('project-123');
});
```

## Mock Scenarios - Complete Documentation

### Overview

Mock scenarios provide **pre-configured, fully-wired service setups** that eliminate the need to build mocks from scratch in every test. Each scenario returns all dependencies properly typed and connected, with sensible defaults that can be overridden.

### Benefits

1. **Reduces Duplication** - No more building mocks from scratch in every test
2. **Consistency** - All tests use the same well-tested mock configurations
3. **Type Safety** - No `as never` casts needed
4. **Maintainability** - Change mock defaults in one place
5. **Readability** - Tests focus on behavior, not mock setup
6. **Coverage** - Error scenarios ensure edge cases are tested

### Scenario Reference

#### 1. TaskService Scenario

```typescript
const scenario = createTaskServiceScenario(overrides?);
// Returns: { db, worktreeService, containerAgentService, service }
```

Pre-configured with:

- Mock database with default project and task
- Mock worktree service (getDiff, merge, remove)
- Mock container agent service (optional)

#### 2. AgentService Scenario

```typescript
const scenario = createAgentServiceScenario(overrides?);
// Returns: { db, worktreeService, taskService, sessionService, service }
```

Pre-configured with:

- Mock database with project, agent, task, session, worktree
- All sub-services mocked and wired together

#### 3. ProjectService Scenario

```typescript
const scenario = createProjectServiceScenario(overrides?);
// Returns: { db, worktreeService, runner, service }
```

Pre-configured with:

- Mock database with default project
- Mock worktree service (prune)
- Mock command runner with git support

#### 4. SessionService Scenario

```typescript
const scenario = createSessionServiceScenario(overrides?);
// Returns: { db, streams, service }
```

Pre-configured with:

- Mock database with default project and session
- Mock streams server with in-memory event storage
- Base URL configuration

#### 5. ContainerAgentService Scenario

```typescript
const scenario = createContainerAgentScenario(overrides?);
// Returns: { db, provider, streams, apiKeyService, worktreeService, service }
```

**Most complex scenario** - includes:

- Mock database with project, task, session, agent, worktree
- Mock sandbox provider with running sandbox
- Mock streams service for event publishing
- Mock API key service returning test token
- Mock worktree service with create/remove support

#### 6. Full Stack Scenario

```typescript
const stack = createFullStackScenario();
```

Returns:

- **Shared data**: project, task, agent, session, worktree
- **Shared mocks**: db, streams, provider, apiKeyService, runner
- **Services**: worktreeService, sessionService, taskService, agentService, projectService, containerAgentService

All services share the same mock database and cross-reference the same entities.

#### 7. Error Scenarios

```typescript
const scenario = createErrorScenario(service, errorType);
```

| Error Type | Behavior |
|------------|----------|
| `db_insert_fail` | DB insert throws |
| `db_update_fail` | DB update throws |
| `worktree_create_fail` | Worktree creation returns error Result |
| `sandbox_not_running` | Sandbox status is 'stopped' |
| `api_key_missing` | API key returns null |
| `exec_stream_fail` | execStream rejects |

Services: `'task'`, `'agent'`, `'project'`, `'session'`, `'containerAgent'`

#### 8. Concurrency Scenario

```typescript
const scenario = createConcurrencyScenario(taskCount?);
// Returns: { db, service, tasks, agent, startAll }
```

Creates:

- Multiple tasks (default: 3)
- Helper to fire concurrent `startAgent` calls
- Useful for testing race conditions and concurrency limits

### Usage Patterns

#### Basic Test

```typescript
import { createTaskServiceScenario } from '../mocks/mock-scenarios';

it('creates a task', async () => {
  const scenario = createTaskServiceScenario();

  const result = await scenario.service.create({
    projectId: 'proj-1',
    title: 'Build feature',
  });

  expect(result.ok).toBe(true);
});
```

#### Overriding Defaults

```typescript
import { createTaskServiceScenario } from '../mocks/mock-scenarios';
import { createMockWorktreeServiceForTask } from '../mocks/mock-services';

it('handles custom worktree behavior', async () => {
  const scenario = createTaskServiceScenario({
    worktreeService: createMockWorktreeServiceForTask({
      getDiff: vi.fn().mockResolvedValue(ok({
        files: [{ path: 'src/app.ts', status: 'modified' }],
        stats: { filesChanged: 1, additions: 10, deletions: 5 },
      }))
    })
  });

  // Test with custom worktree behavior
});
```

#### Error Testing

```typescript
import { createErrorScenario } from '../mocks/mock-scenarios';

it('handles missing API key', async () => {
  const scenario = createErrorScenario('containerAgent', 'api_key_missing');

  const result = await scenario.service.startAgent({
    projectId: 'proj-1',
    taskId: 'task-1',
    sessionId: 'session-1',
    prompt: 'Build feature',
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe('API_KEY_NOT_CONFIGURED');
  }
});
```

#### Integration Testing

```typescript
import { createFullStackScenario } from '../mocks/mock-scenarios';

it('exercises multiple services', async () => {
  const stack = createFullStackScenario();

  // All services share the same data
  expect(stack.project.id).toBe('proj-1');
  expect(stack.task.projectId).toBe('proj-1');

  // Test cross-service interactions
  const taskResult = await stack.taskService.create({
    projectId: stack.project.id,
    title: 'New task',
  });

  expect(taskResult.ok).toBe(true);
});
```

#### Concurrency Testing

```typescript
import { createConcurrencyScenario } from '../mocks/mock-scenarios';

it('respects concurrency limits', async () => {
  const scenario = createConcurrencyScenario(5);

  // Fire 5 concurrent starts
  const results = await scenario.startAll();

  // Verify limits respected
  const successCount = results.filter(r => r.ok).length;
  expect(successCount).toBeLessThanOrEqual(3); // maxConcurrentAgents = 3
});
```

### Migration Guide

**Before:**

```typescript
const mockDb = createMockDatabase();
const mockWorktreeService = {
  getDiff: vi.fn().mockResolvedValue(ok({ files: [], stats: {} })),
  merge: vi.fn().mockResolvedValue(ok(undefined)),
  remove: vi.fn().mockResolvedValue(ok(undefined)),
};
const mockContainerAgent = {
  startAgent: vi.fn().mockResolvedValue(ok(undefined)),
  stopAgent: vi.fn().mockResolvedValue(ok(undefined)),
  // ... more methods
};
const service = new TaskService(mockDb as never, mockWorktreeService);
service.setContainerAgentService(mockContainerAgent);
```

**After:**

```typescript
const scenario = createTaskServiceScenario();
// Everything is already wired and typed correctly
```

## Design Principles

1. **No `as never` casts** - All mocks are fully typed
2. **Sensible defaults** - Mocks return successful responses by default
3. **Easy overrides** - Pass partial objects to customize behavior
4. **Real implementations** - Streams use Node.js Readable, not fake objects
5. **Composable** - Build complex scenarios from simple builders

## Adding New Mocks

When adding mocks:

1. **Use proper types** from source files (not `any` or `never`)
2. **Provide sensible defaults** for success cases
3. **Document with JSDoc** including examples
4. **Test the mock** with a `.test.ts` file
5. **Export from `index.ts`** for easy imports
