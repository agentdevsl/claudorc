# Infrastructure Analysis

## 1. Utility Functions - Replace with Libraries

### cn.ts - Replace with clsx

**File**: `/src/lib/utils/cn.ts` (26 lines)

**Issue**: Custom `cn()` function duplicates functionality available in `clsx` npm package.

**Current**:
```typescript
// Custom recursive implementation handling arrays, objects, conditionals
export function cn(...inputs: ClassValue[]): string {
  // 26 lines of custom logic
}
```

**Recommendation**:
```bash
npm install clsx
```
```typescript
import { clsx } from 'clsx';
export { clsx as cn };
```

**Impact**: -26 lines, better tested library, no maintenance burden

---

### deep-merge.ts - Simplify or Replace

**File**: `/src/lib/utils/deep-merge.ts` (81 lines)

**Issue**: Complex deep merge with circular reference handling that may be premature optimization.

**Current Usage**: Only used in `config-service.ts` (3 places)

**Alternatives**:
1. `structuredClone()` (native JS) + `Object.assign()` for most cases
2. `lodash.merge` if complex merge needed

**Impact**: -50 lines if simplified

---

### result.ts - Consolidate Pattern

**File**: `/src/lib/utils/result.ts` (26 lines)

**Issue**: Custom Result type duplicated in `cursor.ts` as `CursorResult`.

**Recommendation**: Single Result type definition, remove CursorResult duplication.

---

## 2. API Client - Duplicate Fetch Functions

**File**: `/src/lib/api/client.ts` (945 lines)

### Problem: 95% Identical Functions

`apiFetch()` (lines 20-68) and `apiServerFetch()` (lines 72-100) are nearly identical:
- Same error handling logic
- Same fetch parameter building
- Only difference: API_BASE URL prepend

**Current**:
```typescript
async function apiFetch<T>(path: string, options?: FetchOptions): Promise<ApiResponse<T>> {
  // 48 lines of logic
}

async function apiServerFetch<T>(path: string, options?: FetchOptions): Promise<ApiResponse<T>> {
  // 28 lines of nearly identical logic
}
```

**Recommendation**:
```typescript
async function apiFetch<T>(
  path: string,
  options: FetchOptions & { baseUrl?: string } = {}
): Promise<ApiResponse<T>> {
  const url = `${options.baseUrl || API_BASE}${path}`;
  // single shared implementation
}
```

**Impact**: -50 lines, DRY principle

---

## 3. Error Handling - Fragmented Definitions

**Location**: `/src/lib/errors/` (14 files, 1,418 LOC)

### Problem: Scattered Error Definitions

Each domain has its own error file with repetitive `createError()` calls:

| File | Pattern |
|------|---------|
| `agent-errors.ts` | `AgentErrors.NOT_FOUND = createError(...)` |
| `task-errors.ts` | `TaskErrors.NOT_FOUND = createError(...)` |
| `session-errors.ts` | `SessionErrors.NOT_FOUND = createError(...)` |
| `worktree-errors.ts` | `WorktreeErrors.NOT_FOUND = createError(...)` |
| `github-errors.ts` | `GitHubErrors.NOT_FOUND = createError(...)` |
| `marketplace-errors.ts` | `MarketplaceErrors.NOT_FOUND = createError(...)` |
| `sandbox-errors.ts` (151 LOC) | Largest file |
| ... 7 more files | Same pattern |

**Issues**:
- `createError()` called 50+ times across codebase
- Type union for each error file manually maintained
- No shared validation or DRY for common HTTP status codes

### Recommendation: Centralized Error Registry

```typescript
// Instead of scattered files:
// agent-errors.ts: AgentErrors.NOT_FOUND = createError('AGENT_NOT_FOUND', 'Agent not found', 404)
// task-errors.ts: TaskErrors.NOT_FOUND = createError('TASK_NOT_FOUND', 'Task not found', 404)

// Consolidate to:
const ErrorCodes = {
  AGENT_NOT_FOUND: { code: 'AGENT_NOT_FOUND', message: 'Agent not found', status: 404 },
  TASK_NOT_FOUND: { code: 'TASK_NOT_FOUND', message: 'Task not found', status: 404 },
  SESSION_NOT_FOUND: { code: 'SESSION_NOT_FOUND', message: 'Session not found', status: 404 },
  // ... all errors in one place
} as const;

// Auto-generate types from registry
type ErrorCode = keyof typeof ErrorCodes;
```

**Impact**: -990 LOC (70%), globally searchable error codes

---

## 4. Vite Configuration - Over-Engineered Stubs

**File**: `/vite.config.ts` (394 lines)

### Problem: 330 Lines of Repetitive Stubs

`serverOnlyStubs()` plugin (lines 14-344) manually stubs 20+ modules:

| Module | Lines | Pattern |
|--------|-------|---------|
| EventEmitter | 15 | Repetitive stub pattern |
| Crypto | 9 | Same pattern |
| Stream | 10 | Same pattern |
| ... 17 more | ~250 | All identical structure |

**Current Pattern** (repeated 30+ times):
```typescript
if (id === '\0module-stub') {
  return {
    code: `export default ${JSON.stringify(stub)}`,
    map: null
  };
}
```

### Recommendation: Meta-Generate Stubs

```typescript
const stubModules = {
  'node:events': { EventEmitter: class {} },
  'node:crypto': { randomBytes: () => Buffer.alloc(0) },
  'node:stream': { Readable: class {}, Writable: class {} },
  // ... all stubs as data
};

function serverOnlyStubs(): Plugin {
  return {
    name: 'server-only-stubs',
    resolveId(id) {
      if (stubModules[id]) return `\0stub:${id}`;
    },
    load(id) {
      if (id.startsWith('\0stub:')) {
        const moduleName = id.replace('\0stub:', '');
        return generateStubCode(stubModules[moduleName]);
      }
    }
  };
}
```

**Alternative**: Use `@rollup/plugin-virtual` or conditional `browser` field in package.json

**Impact**: -250 lines (75% of plugin)

---

## 5. Template Merge - Repetitive Logic

**File**: `/src/lib/config/template-merge.ts` (200 lines)

### Problem: Same Merge Logic 3x

Lines 63-158 follow identical pattern for skills, commands, and agents:

```typescript
// Pattern repeated 3 times with minor variations
function mergeSkills(base: Skill[], override: Skill[]): Skill[] {
  const merged = new Map(base.map(s => [s.id, s]));
  for (const skill of override) {
    merged.set(skill.id, skill);
  }
  return Array.from(merged.values());
}

function mergeCommands(base: Command[], override: Command[]): Command[] {
  // Same logic, different type
}

function mergeAgents(base: Agent[], override: Agent[]): Agent[] {
  // Same logic, different type
}
```

### Recommendation: Generic Merge Function

```typescript
const mergeByKey = <T extends { id: string }>(
  base: T[],
  override: T[],
  key: keyof T = 'id'
): T[] => {
  const merged = new Map(base.map(item => [item[key], item]));
  for (const item of override) {
    merged.set(item[key], item);
  }
  return Array.from(merged.values());
};

// Usage
const mergedSkills = mergeByKey(baseSkills, overrideSkills);
const mergedCommands = mergeByKey(baseCommands, overrideCommands);
const mergedAgents = mergeByKey(baseAgents, overrideAgents);
```

**Impact**: -80 lines

---

## 6. Test Infrastructure - Simplify Cleanup

**File**: `/tests/helpers/database.ts` (106 lines)

### Problem: Manual Foreign Key Cleanup

`clearTestDatabase()` manually deletes 11 tables in foreign key order (lines 49-60):

```typescript
// Current: Manual deletion in FK order
await testDb.delete(sessionEvents);
await testDb.delete(sessions);
await testDb.delete(agentExecutions);
await testDb.delete(tasks);
// ... 7 more tables
```

### Recommendation

```typescript
// Use SQLite pragmas for simpler cleanup
export async function clearTestDatabase(): Promise<void> {
  if (!testDb || !testSqlite) return;
  testSqlite.exec('PRAGMA foreign_keys = OFF');
  // Single statement to clear all
  const tables = testSqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all();
  for (const { name } of tables) {
    testSqlite.exec(`DELETE FROM ${name}`);
  }
  testSqlite.exec('PRAGMA foreign_keys = ON');
}
```

**Alternative**: Use transaction rollback pattern for test isolation

---

### Test Mocks - Remove Lazy Requires

**File**: `/tests/mocks/index.ts` (60 lines)

**Issue**: `createAllServiceMocks()` and `createAllExternalMocks()` use dynamic `require()` inside functions (lines 33-44, 50-58).

**Recommendation**: Static imports for better tree shaking and simpler code

---

## 7. Type Definitions - Scattered Locations

### Problem: API Types in Multiple Files

| Type | Location |
|------|----------|
| `ApiResponse<T>` | `/src/lib/api/response.ts` |
| `ApiContext` | `/src/lib/api/middleware.ts` |
| `ApiError` | `/src/lib/errors/base.ts` |

### Recommendation

Create `/src/lib/api/types.ts` as single source of truth for all API types.

---

## 8. Config Service - Minor Complexity

**File**: `/src/lib/config/config-service.ts` (93 lines)

**Minor Issues**:
- `parseEnvNumber()` (lines 45-52) is trivial - could inline or use `envalid` library
- Custom Result pattern for every operation adds cognitive overhead

---

## Summary: Infrastructure Simplification Priorities

### Phase 1 (Quick Wins)
1. ✅ Replace `cn.ts` with `clsx` (-26 lines)
2. ✅ Consolidate `apiFetch()`/`apiServerFetch()` (-50 lines)
3. ✅ Simplify test database cleanup (-20 lines)

### Phase 2 (Medium Effort)
4. Extract generic merge logic from template-merge.ts (-80 lines)
5. Centralize error definitions (-990 lines)
6. Consolidate API types to single file

### Phase 3 (Larger Effort)
7. Simplify Vite stub plugin (-250 lines)
8. Replace deep-merge.ts with simpler approach (-50 lines)
9. Remove lazy requires from test mocks

---

## File Reference

| File | LOC | Issue | Action |
|------|-----|-------|--------|
| `/src/lib/utils/cn.ts` | 26 | Duplicates clsx | Replace |
| `/src/lib/utils/deep-merge.ts` | 81 | Over-complex | Simplify |
| `/src/lib/api/client.ts` | 945 | Duplicate fetches | Consolidate |
| `/src/lib/config/template-merge.ts` | 200 | 3x repetition | Generic function |
| `/src/lib/errors/` | 1,418 | 14 scattered files | Centralize |
| `/vite.config.ts` | 394 | 330 lines stubs | Meta-generate |
| `/tests/helpers/database.ts` | 106 | Manual cleanup | Use pragmas |
| `/tests/mocks/index.ts` | 60 | Lazy requires | Static imports |
