# Test Mocks

This directory contains type-safe mock builders for testing AgentPane services and infrastructure.

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

### Service Mocks (`services.ts`)

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
