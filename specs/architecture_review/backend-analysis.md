# Backend Architecture Analysis

## 1. API Handlers - Critical Simplification Needed

**File**: `/src/server/api-handlers.ts` (1,676 LOC)

### Problem: Repetitive Error Wrapping

Every handler follows this boilerplate pattern repeated 100+ times:

```typescript
// Lines 75-82: Example pattern repeated throughout
if (!result.ok) {
  return {
    ok: false,
    error: { code: result.error.code, message: result.error.message, status: result.error.status },
  };
}
return { ok: true, data: result.value };
```

### Simplification Strategy

Create a wrapper utility to eliminate this:

```typescript
// Instead of the pattern above, use:
const apiHandler = <T>(result: Result<T, AppError>): ApiResponse<T> =>
  result.ok
    ? { ok: true, data: result.value }
    : { ok: false, error: result.error };
```

### Impact

| Handler | Current LOC | After Refactor |
|---------|-------------|----------------|
| `listProjects` (lines 48-83) | 36 | 4 |
| `createProject` (lines 130-201) | 72 | 12 |
| `getTask` (lines 488-511) | 24 | 3 |
| `listSessions` (lines 843-875) | 33 | 4 |

**Total reduction**: ~1,250 lines (75%)

---

## 2. Duplicate Route Sets - Remove Entirely

### Critical Issue: 100% Code Duplication

Two nearly identical API route sets exist:
- `/src/app/routes/-api/` (legacy internal API - 80 files)
- `/src/app/routes/api/` (current API)

### Examples of Duplication

| Route | File 1 (LOC) | File 2 (LOC) | Identical? |
|-------|--------------|--------------|------------|
| Agents | `/routes/-api/agents.ts` (71) | `/routes/api/agents.ts` (72) | Yes |
| Projects | `/routes/-api/projects.ts` (86) | `/routes/api/projects.ts` (86) | Yes |
| Tasks | `/routes/-api/tasks.ts` (73) | `/routes/api/tasks.ts` (73) | Yes |
| Sessions | `/routes/-api/sessions.ts` | `/routes/api/sessions.ts` | Yes |

### Recommendation

**Delete `/src/app/routes/-api/` entirely** - serves no purpose. The `/api/` routes implement all functionality with modern patterns using `withErrorHandling` middleware.

**Impact**: Remove ~800 LOC (30% of route files)

---

## 3. Services Layer - Split Large Services

**Total**: 7,310 LOC across services

### Giant Services Problem

| Service | LOC | Issues |
|---------|-----|--------|
| `session.service.ts` | 705 | Streams, events, history, presence, summaries all mixed |
| `plan-mode.service.ts` | 682 | Claude client + turn management + GitHub issue creation |
| `agent.service.ts` | 663 | Lifecycle + streaming + hooks + queue management |
| `task-creation.service.ts` | 653 | AI task generation mixed with database operations |
| `worktree.service.ts` | 590 | Git operations + status + pruning + diff parsing |
| `template.service.ts` | 535 | GitHub sync + schema validation + caching |

### Recommended Splits

**SessionService** → Split into:
- `SessionLifecycleService` - create/close/list/filter
- `SessionEventsService` - event persistence/retrieval
- `SessionPresenceService` - user presence tracking
- `SessionSummaryService` - analytics computation

**AgentService** → Extract:
- `AgentHooksService` - pre/post tool hooks (lines with `private preToolHooks`, `private postToolHooks`)
- `AgentQueueService` - queue position logic (lines 47-60)
- `AgentStreamingService` - streaming logic

**PlanModeService** → Extract:
- `ClaudeClientManager` - client initialization (lines 77-100)
- `PlanTurnService` - turn management
- Keep `GitHubIssueCreator` delegation (already good pattern)

---

## 4. Duplicate Service Files

### Critical: Two Nearly Identical GitHub Token Services

| File | LOC | Location |
|------|-----|----------|
| `github-token.service.ts` | 496 | `/src/services/` |
| `github-token.service.ts` | 474 | `/src/server/` |

These are **95% identical** - only import paths differ.

### Recommendation

Remove `/src/server/github-token.service.ts` and consolidate to single service.

---

## 5. State Machines - Already Well-Designed

**Files**: `/src/lib/state-machines/` (692 LOC total)

| Machine | LOC | Assessment |
|---------|-----|------------|
| Worktree Lifecycle | 194 | Good - clear state transitions |
| Session Lifecycle | 183 | Good - focused responsibility |
| Agent Lifecycle | 156 | Good - concise logic |
| Task Workflow | 159 | Good - manageable |

**Status**: Well-structured, no changes needed.

Each follows proper separation:
- `/machine.ts` - State logic
- `/guards.ts` - Transition guards (4-16 LOC each)
- `/types.ts` - Type definitions
- `/actions.ts` - Side effects

### Minor Opportunity

Consolidate to use shared `/src/lib/utils/result.ts` type definition for consistency.

---

## 6. Database Layer - Acceptable Complexity

**Schema Files**: `/src/db/schema/` (1,128 LOC)

### Assessment

Relations file (`relations.ts` - 204 LOC) is extensive but necessary:
- 13 major relation definitions
- Projects have 8 relationships
- Tasks have 6 relationships
- Sessions have 4 relationships

**Status**: Appropriate complexity for the domain.

### Minor Opportunity

**Session Event Type Bloat** (`session.service.ts` lines 19-37): 19 event types is excessive.

Consolidate to 8 core types:
- `agent:*` - agent lifecycle events
- `tool:*` - tool execution events
- `approval:*` - approval workflow events
- `presence:*` - user presence events

Use event metadata instead of separate types.

---

## Summary: Backend Simplification Priorities

### Phase 1 (High Impact)
1. ✅ Create API handler wrapper utility (-1,250 LOC)
2. ✅ Delete `-api/` route directory (-800 LOC)
3. ✅ Consolidate duplicate github-token.service.ts (-470 LOC)

### Phase 2 (Medium Impact)
4. Split SessionService into 4 focused services
5. Extract hooks/queue/streaming from AgentService
6. Consolidate session event types

### Phase 3 (Low Priority)
7. Standardize Result type usage across state machines
8. Clean up unused service methods
