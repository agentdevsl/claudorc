# Durable Streams - Future Enhancements

This document captures deferred improvements identified during the PR review of the `feature/durable-sessions` branch. These items are not blocking for the initial implementation but should be addressed in future iterations.

---

## Security

### Authentication on POST /api/streams Endpoint

**Priority:** High
**Source:** code-reviewer agent
**Location:** `src/app/routes/api/streams/index.ts`

**Issue:** The HTTP POST endpoint for writing to session streams performs input validation but has no authentication or authorization checks. Any client can write to any session stream by knowing the sessionId.

**Impact:**
- Unauthenticated users can send commands to active agent sessions
- Presence can be spoofed with arbitrary userIds
- Anyone can inject events into any session stream

**Recommended Fix:**
1. Add authentication middleware to verify user identity
2. Verify the user has access to the session before allowing writes
3. Validate the userId in presence events matches the authenticated user

**Related Files:**
- `src/app/routes/api/streams/index.ts`
- Auth middleware (to be integrated)

---

## Type System

### Type Fragmentation - Multiple SessionEvent Definitions

**Priority:** Medium
**Source:** type-design-analyzer agent

**Issue:** There are 4 different definitions of session event types across the codebase:

| File | Type Name | Event Count | Discriminator |
|------|-----------|-------------|---------------|
| `src/lib/sessions/schema.ts` | `SessionEvent` | 6 channels | `channel` field |
| `src/services/session/types.ts` | `SessionEvent` | 18 types | `type` field |
| `src/lib/streams/client.ts` | `TypedSessionEvent` | 5 channels | `channel` field |
| `src/lib/streams/client.ts` | `SessionEventType` | 9 types | N/A (string union) |

**Impact:**
- Import confusion (which `SessionEvent` to use?)
- Maintenance burden (changes must propagate to multiple files)
- Runtime bugs (mismatched expectations between sender/receiver)

**Recommended Fix:**
1. Establish `src/lib/sessions/schema.ts` as the canonical source of truth
2. Have other files import and extend from there
3. Use Zod schemas consistently for runtime validation

**Related Files:**
- `src/lib/sessions/schema.ts`
- `src/services/session/types.ts`
- `src/lib/streams/client.ts`

---

### Use Zod Validation in DurableStreamsClient

**Priority:** Medium
**Source:** type-design-analyzer agent
**Location:** `src/lib/streams/client.ts`

**Issue:** The `mapRawEventToTyped` function uses unsafe type assertions (`as`) without runtime validation:

```typescript
const data = raw.data as Record<string, unknown>;
// ...
data: data as SessionAgentState,  // No validation
```

**Impact:**
- Malformed events from server could corrupt client state
- Debugging issues when events don't match expected shape

**Recommended Fix:**
Use the Zod schemas from `src/lib/sessions/schema.ts` for parsing:

```typescript
import { chunkSchema, toolCallSchema } from '../sessions/schema';

case 'chunk':
  const parsed = chunkSchema.safeParse(raw.data);
  if (!parsed.success) {
    callbacks.onError?.(new Error(`Invalid chunk: ${parsed.error.message}`));
    return null;
  }
  return { channel: 'chunks', data: parsed.data, offset: raw.offset };
```

---

### SessionWithPresence.status Should Use Enum Type

**Priority:** Low
**Source:** type-design-analyzer agent
**Location:** `src/services/session/types.ts:89`

**Issue:** The `status` field is typed as `string` instead of `SessionStatus`:

```typescript
export type SessionWithPresence = {
  // ...
  status: string,  // Should be SessionStatus from enums.ts
  // ...
};
```

**Recommended Fix:**
```typescript
import type { SessionStatus } from '../../db/schema/enums.js';

export type SessionWithPresence = {
  // ...
  status: SessionStatus,
  // ...
};
```

---

## Resilience

### Add Reconnection Attempt Limit

**Priority:** Medium
**Source:** silent-failure-hunter agent
**Location:** `src/lib/streams/client.ts`

**Issue:** The DurableStreamsClient will attempt to reconnect indefinitely. There's no maximum reconnection attempt limit, which could lead to:
- Infinite reconnection loops consuming resources
- Users seeing repeated reconnection attempts without resolution

**Recommended Fix:**
Add a `maxAttempts` configuration option:

```typescript
export interface ReconnectConfig {
  enabled: boolean;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  maxAttempts: number;  // New: e.g., 10
}
```

When max attempts reached:
1. Stop reconnection
2. Log at error level
3. Call `onError` with descriptive message
4. Consider surfacing to user with "connection lost" state

---

### Background Retry Queue for Failed Persistence

**Priority:** Low
**Source:** silent-failure-hunter agent
**Location:** `src/services/session/session-stream.service.ts`

**Issue:** Event persistence is fire-and-forget. Failures are logged but events could be lost permanently with no retry mechanism.

**Impact:** Session events may not be persisted, causing incomplete session history.

**Recommended Fix:**
1. Implement a background retry queue for failed persistence
2. Add dead-letter handling for events that fail after N retries
3. Consider surfacing persistence failures to monitoring/alerting

---

## Logging

### Replace console.error with Structured Logging

**Priority:** Low
**Source:** silent-failure-hunter agent

**Issue:** Several files use `console.error` instead of the project's structured logging functions. This impacts production monitoring and Sentry integration.

**Files Affected:**
- `src/app/routes/api/streams/index.ts`
- `src/services/durable-streams.service.ts`
- `src/lib/streams/server.ts`

**Recommended Fix:**
Use the project's `logError` function with appropriate error IDs for Sentry tracking.

---

## Code Quality

### Remove Redundant Class-Level Comments

**Priority:** Low
**Source:** comment-analyzer agent

**Issue:** Several service files have class-level comments that merely restate the class name:

```typescript
/**
 * SessionPresenceService handles user presence management
 */
export class SessionPresenceService { ... }
```

**Files Affected:**
- `src/services/session/session-presence.service.ts`
- `src/services/session/session-stream.service.ts`
- `src/services/session/session-crud.service.ts`

**Recommended Fix:**
Remove redundant comments or expand them with meaningful details about implementation choices.

---

### Add Minimum Constraints to Zod ID Fields

**Priority:** Low
**Source:** type-design-analyzer agent
**Location:** `src/lib/sessions/schema.ts`

**Issue:** ID fields use `z.string()` without constraints, allowing empty strings:

```typescript
id: z.string(),  // Could be ""
```

**Recommended Fix:**
```typescript
id: z.string().min(1),
// Or for specific ID formats:
id: z.string().cuid2(),
```

---

## Implementation Tracking

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| Auth on POST /api/streams | High | 4-6h | **Done** |
| Type fragmentation consolidation | Medium | 6-8h | Pending |
| Zod validation in client | Medium | 2-3h | **Done** |
| Reconnection attempt limit | Medium | 1-2h | Pending |
| SessionWithPresence enum | Low | 30min | Pending |
| Persistence retry queue | Low | 4-6h | Pending |
| Structured logging migration | Low | 2-3h | Pending |
| Remove redundant comments | Low | 30min | Pending |
| Zod ID constraints | Low | 30min | **Done** |

---

## References

- Original PR: `feature/durable-sessions`
- Review Date: 2026-01-24
- Review Agents: code-reviewer, silent-failure-hunter, type-design-analyzer, comment-analyzer
