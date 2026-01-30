# Mock Builders Migration Guide

This guide shows how to migrate from `as never` mocks to type-safe mock builders.

## Overview

The `mock-builders.ts` module provides type-safe database mocking that eliminates the need for `as never` type assertions. It matches the Drizzle ORM API surface and works seamlessly with service constructor duck typing.

## Quick Start

```typescript
import { createMockDatabase, createTableQuery } from '../mocks/mock-builders.js';
import type { Database } from '../../src/types/database.js';

// Create a mock database
const mockDb = createMockDatabase() as unknown as Database;

// Pass to service constructors - no `as never` needed!
const service = new ProjectService(mockDb, mockWorktreeService);
```

## Before & After Examples

### Example 1: Basic Mock Database

**Before (using `as never`):**

```typescript
const mockDb = {
  query: {
    projects: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn(),
    }),
  }),
} as never; // ❌ Loses type safety
```

**After (using mock builders):**

```typescript
const mockDb = createMockDatabase({
  query: {
    projects: createTableQuery([mockProject]),
  },
}) as unknown as Database; // ✅ Type-safe
```

### Example 2: Service Constructor

**Before:**

```typescript
const agentService = new AgentService(
  db as never, // ❌ Type assertion needed
  mockWorktreeService,
  mockTaskService,
  mockSessionService
);
```

**After:**

```typescript
const mockDb = createMockDatabase() as unknown as Database;

const agentService = new AgentService(
  mockDb, // ✅ No type assertion needed
  mockWorktreeService,
  mockTaskService,
  mockSessionService
);
```

### Example 3: Custom Query Responses

**Before:**

```typescript
const mockDb = {
  query: {
    tasks: {
      findFirst: vi.fn().mockResolvedValue(mockTask),
      findMany: vi.fn().mockResolvedValue([mockTask]),
    },
  },
} as never;
```

**After:**

```typescript
const mockDb = createMockDatabase({
  query: {
    tasks: createTableQuery([mockTask]),
  },
}) as unknown as Database;

// Or customize specific methods:
mockDb.query.tasks.findFirst.mockResolvedValue(mockTask);
mockDb.query.tasks.findMany.mockResolvedValue([mockTask]);
```

### Example 4: Insert/Update/Delete Chains

**Before:**

```typescript
const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([newRecord]),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([updatedRecord]),
      }),
    }),
  }),
} as never;
```

**After:**

```typescript
import { createInsertChain, createUpdateChain } from '../mocks/mock-builders.js';

const mockDb = createMockDatabase() as unknown as Database;

// Customize insert
mockDb.insert.mockReturnValue(createInsertChain([newRecord]));

// Customize update
mockDb.update.mockReturnValue(createUpdateChain([updatedRecord]));
```

### Example 5: Transaction Support

**Before:**

```typescript
const mockDb = {
  transaction: vi.fn().mockImplementation(async (cb) => cb(mockDb)),
} as never;
```

**After:**

```typescript
const mockDb = createMockDatabase() as unknown as Database;

// Transaction is already implemented!
await mockDb.transaction(async (tx) => {
  // tx is the same mockDb instance
  await tx.query.projects.findFirst();
});
```

## API Reference

### Core Functions

#### `createMockDatabase(overrides?): MockDatabase`

Creates a complete mock database with all tables initialized.

```typescript
const mockDb = createMockDatabase({
  query: {
    projects: createTableQuery([project1, project2]),
  },
});
```

#### `createTableQuery<T>(records): MockTableQuery<T>`

Creates a mock table query API with `findFirst` and `findMany`.

```typescript
const projectsQuery = createTableQuery([project1, project2]);
await projectsQuery.findFirst(); // returns project1
await projectsQuery.findMany(); // returns [project1, project2]
```

#### `createInsertChain<T>(returnValue): MockInsertChain<T>`

Creates a chainable insert mock.

```typescript
const insertChain = createInsertChain([newRecord]);
const [result] = await insertChain.values(data).returning();
```

#### `createUpdateChain<T>(returnValue): MockUpdateChain<T>`

Creates a chainable update mock.

```typescript
const updateChain = createUpdateChain([updatedRecord]);
const [result] = await updateChain.set(data).where(condition).returning();
```

#### `createDeleteChain(): MockDeleteChain`

Creates a chainable delete mock.

```typescript
const deleteChain = createDeleteChain();
await deleteChain.where(condition).run();
```

#### `createSelectChain<T>(returnValue): MockSelectChain<T>`

Creates a chainable select mock.

```typescript
const selectChain = createSelectChain([record1, record2]);
const results = await selectChain.from(table).where(condition).all();
```

### Utility Types

#### `MockFn<T>`

Type-safe wrapper for vitest mock functions.

```typescript
const mockFn: MockFn<(id: string) => Promise<Project>> = vi.fn();
```

#### `DeepPartial<T>`

Makes all properties and nested properties optional.

```typescript
type PartialProject = DeepPartial<Project>;
```

## Available Tables

All schema tables are available in `mockDb.query`:

- `projects`
- `agents`
- `tasks`
- `sessions`
- `worktrees`
- `agentRuns`
- `sessionEvents`
- `sessionSummaries`
- `sandboxConfigs`
- `sandboxInstances`
- `apiKeys`
- `githubTokens`
- `githubInstallations`
- `repositoryConfigs`
- `settings`
- `auditLogs`
- `planSessions`
- `templates`
- `marketplaces`
- `workflows`

## Migration Checklist

When migrating a test file:

1. ✅ Import `createMockDatabase` from `../mocks/mock-builders.js`
2. ✅ Replace manual mock object with `createMockDatabase()`
3. ✅ Remove all `as never` type assertions
4. ✅ Cast to `Database` type: `as unknown as Database`
5. ✅ Use `createTableQuery()` for pre-populated data
6. ✅ Use chainable builders for custom insert/update/delete behavior
7. ✅ Run type checker: `bun run typecheck`
8. ✅ Run tests: `bun run test`

## Common Patterns

### Pattern: Service with Multiple Dependencies

```typescript
import { createMockDatabase } from '../mocks/mock-builders.js';
import type { Database } from '../../src/types/database.js';

const mockDb = createMockDatabase() as unknown as Database;

const mockWorktreeService = {
  create: vi.fn(),
  remove: vi.fn(),
};

const mockTaskService = {
  moveColumn: vi.fn().mockResolvedValue({ ok: true, value: {} }),
};

const service = new AgentService(
  mockDb,
  mockWorktreeService,
  mockTaskService,
  mockSessionService
);
```

### Pattern: Pre-populate Multiple Tables

```typescript
const mockDb = createMockDatabase({
  query: {
    projects: createTableQuery([project1, project2]),
    tasks: createTableQuery([task1, task2, task3]),
    agents: createTableQuery([agent1]),
  },
}) as unknown as Database;
```

### Pattern: Override Specific Methods

```typescript
const mockDb = createMockDatabase() as unknown as Database;

// Override findFirst to return specific data
mockDb.query.projects.findFirst.mockResolvedValue(myProject);

// Override findMany to return empty array
mockDb.query.tasks.findMany.mockResolvedValue([]);
```

## Benefits

✅ **Type Safety**: No more `as never` - full TypeScript checking
✅ **Auto-complete**: IDE suggestions for all methods and properties
✅ **Maintainability**: Centralized mock infrastructure
✅ **Consistency**: Same patterns across all tests
✅ **Duck Typing**: Works seamlessly with service constructor injection
✅ **Extensibility**: Easy to add new tables or methods

## Troubleshooting

### Type error: "Type 'MockDatabase' is not assignable to type 'Database'"

Use the double cast pattern:

```typescript
const mockDb = createMockDatabase() as unknown as Database;
```

### Mock method not called as expected

Make sure you're using the mock returned by `createMockDatabase`:

```typescript
const mockDb = createMockDatabase();
mockDb.query.projects.findFirst.mockResolvedValue(myProject);

// Later in test:
expect(mockDb.query.projects.findFirst).toHaveBeenCalled();
```

### Need to customize a chain

Use the chainable builder functions:

```typescript
import { createInsertChain } from '../mocks/mock-builders.js';

const mockDb = createMockDatabase() as unknown as Database;
mockDb.insert.mockReturnValue(createInsertChain([myRecord]));
```

## See Also

- `tests/mocks/mock-builders.ts` - Source code
- `tests/mocks/mock-builders.example.test.ts` - Working examples
- `src/types/database.ts` - Database type definition
