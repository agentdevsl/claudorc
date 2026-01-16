# Langfuse Integration Tasks

## Phase 1: Quick Win (Observation Types)

### Task 1.1: Update Session Observation Type

- [ ] Change `OBSERVATION_TYPE` from `"span"` to `"agent"` for session spans
- [ ] Location: `src/langfuse-hook.ts:116`
- [ ] Test: Verify session appears as agent in Langfuse UI

### Task 1.2: Update Subagent Observation Type

- [ ] Modify PostToolUse handler to detect Task tool
- [ ] Set `OBSERVATION_TYPE` to `"agent"` when `isSubagentTool(event.tool_name)` is true
- [ ] Location: `src/langfuse-hook.ts:219-237`
- [ ] Test: Verify Task tool calls appear as nested agents

### Task 1.3: Rebuild and Validate

- [ ] Run `npm run build`
- [ ] Test with manual event injection
- [ ] Verify traces appear correctly in Langfuse

---

## Phase 2: Native API Migration

### Task 2.1: Add @langfuse/tracing Dependency

- [ ] Run `npm install @langfuse/tracing`
- [ ] Verify version compatibility with existing @langfuse/otel

### Task 2.2: Create Tracing Module Structure

- [ ] Create `src/tracing/` directory
- [ ] Create `src/tracing/index.ts` with exports
- [ ] Create `src/tracing/types.ts` with TypeScript interfaces

### Task 2.3: Implement TracerProvider Setup

- [ ] Create `src/tracing/provider.ts`
- [ ] Use `setLangfuseTracerProvider()` for isolated provider
- [ ] Configure LangfuseSpanProcessor with existing env vars
- [ ] Export `initTracing()` and `shutdownTracing()` functions

### Task 2.4: Create Observation Factory Functions

- [ ] Create `src/tracing/observations.ts`
- [ ] Implement `createSessionAgent(event)` → LangfuseAgent
- [ ] Implement `createToolObservation(event, parentContext)` → LangfuseTool
- [ ] Implement `createSubagentObservation(event, parentContext)` → LangfuseAgent
- [ ] Implement `createEventObservation(event, parentContext)` → LangfuseEvent

### Task 2.5: Refactor Main Hook to Use Native API

- [ ] Replace `tracer.startSpan()` with `startObservation()`
- [ ] Replace manual LANGFUSE_ATTRS with typed attribute objects
- [ ] Update PreToolUse handler to use observation factories
- [ ] Update PostToolUse handler to use `updateActiveObservation()`
- [ ] Update Stop handler to use `obs.end()`

### Task 2.6: Update Tests

- [ ] Update `langfuse-hook.test.ts` for new API
- [ ] Add tests for observation type correctness
- [ ] Add tests for agent vs tool classification

---

## Phase 3: Span ID Persistence

### Task 3.1: Create Persistence Module

- [ ] Create `src/tracing/persistence.ts`
- [ ] Define `SpanState` interface:
  ```typescript
  interface SpanState {
    traceId: string;
    sessionSpanId: string;
    activeSpans: Record<string, { spanId: string; startTime: number }>;
  }
  ```

### Task 3.2: Implement File-Based Storage

- [ ] Implement `getStatePath(sessionId)` → `/tmp/langfuse-${sessionId}.json`
- [ ] Implement `loadSpanState(sessionId)` → SpanState | null
- [ ] Implement `saveSpanState(sessionId, state)` → void
- [ ] Implement `deleteSpanState(sessionId)` → void
- [ ] Use atomic writes with temp file + rename

### Task 3.3: Implement Deterministic Trace IDs

- [ ] Use `createTraceId(event.session_id)` for consistent trace IDs
- [ ] Store traceId in SpanState on first event
- [ ] Reuse stored traceId for all subsequent events

### Task 3.4: Link PreToolUse and PostToolUse

- [ ] In PreToolUse: store `{ spanId, startTime }` keyed by `tool_use_id`
- [ ] In PostToolUse: retrieve stored spanId, calculate duration
- [ ] Use `parentSpanContext` to link tool span to session

### Task 3.5: Calculate Accurate Durations

- [ ] Store `Date.now()` in PreToolUse
- [ ] Calculate `duration = Date.now() - startTime` in PostToolUse
- [ ] Pass duration to observation or set as attribute

### Task 3.6: Clean Up State on Session End

- [ ] In Stop handler: delete state file
- [ ] Handle orphaned state files (cleanup old files on init)

---

## Phase 4: Enhanced Agent Features

### Task 4.1: Add Agent Metadata

- [ ] Track tool count per session
- [ ] Track subagent count per session
- [ ] Store in session agent's metadata

### Task 4.2: Implement Error Classification

- [ ] Use existing `analyzeToolResult()` for error detection
- [ ] Set `level: "ERROR"` on failed observations
- [ ] Include `statusMessage` with error details

### Task 4.3: Add Subagent Nesting

- [ ] When Task tool starts, create nested agent observation
- [ ] Set parent context to session agent
- [ ] Track subagent's internal tools (if visible via SubagentStop)

### Task 4.4: Performance Metrics

- [ ] Calculate average tool duration
- [ ] Track retry counts (if detectable)
- [ ] Add to session agent metadata on Stop

---

## Validation Tasks

### Task V.1: Manual Testing

- [ ] Trigger various tool calls in Claude Code
- [ ] Verify all observations appear in Langfuse
- [ ] Check parent-child relationships are correct
- [ ] Verify durations are accurate

### Task V.2: UI Verification

- [ ] Sessions appear as "Agent" type
- [ ] Tools appear as "Tool" type
- [ ] Subagents appear as nested "Agent" type
- [ ] Error observations show error level

### Task V.3: Regression Testing

- [ ] Run existing test suite
- [ ] Compare trace output before/after migration
- [ ] Verify no data loss

---

## Dependencies

```
Phase 1 → No dependencies (can start immediately)
Phase 2 → Depends on Phase 1 completion
Phase 3 → Depends on Phase 2 completion
Phase 4 → Depends on Phase 3 completion
```

## Estimated Effort

| Phase      | Tasks  | Effort          |
| ---------- | ------ | --------------- |
| Phase 1    | 3      | 1 hour          |
| Phase 2    | 6      | 4-6 hours       |
| Phase 3    | 6      | 2-3 hours       |
| Phase 4    | 4      | 2-3 hours       |
| Validation | 3      | 1-2 hours       |
| **Total**  | **22** | **10-15 hours** |
