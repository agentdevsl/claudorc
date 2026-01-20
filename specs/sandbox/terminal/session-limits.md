# Session Limits Specification

## Overview

Session limits protect the sandbox from resource exhaustion by controlling the number of concurrent terminal sessions and their resource consumption.

## Configuration

### Constants

```typescript
// apps/server/src/services/terminal-service.ts

export const MIN_MAX_SESSIONS = 1;
export const MAX_MAX_SESSIONS = 1000;

// Default: effectively unlimited for most use cases
let maxSessions = parseInt(process.env.TERMINAL_MAX_SESSIONS || '1000', 10);
```

### Environment Variable

| Variable | Purpose | Default | Range |
|----------|---------|---------|-------|
| `TERMINAL_MAX_SESSIONS` | Maximum concurrent terminals | `1000` | 1-1000 |

## Session Limit Enforcement

### Create Session Check

```typescript
async createSession(options: TerminalOptions = {}): Promise<TerminalSession | null> {
  // Check session limit
  if (this.sessions.size >= maxSessions) {
    logger.error(`Max sessions (${maxSessions}) reached, refusing new session`);
    return null;
  }

  // Create session...
}
```

### Session Count API

```typescript
// Get current count
getSessionCount(): number {
  return this.sessions.size;
}

// Get maximum allowed
getMaxSessions(): number {
  return maxSessions;
}

// Update maximum (within bounds)
setMaxSessions(limit: number): void {
  if (limit >= MIN_MAX_SESSIONS && limit <= MAX_MAX_SESSIONS) {
    maxSessions = limit;
    logger.info(`Max sessions limit updated to ${limit}`);
  }
}
```

## Resource Constraints

### Per-Session Limits

| Resource | Limit | Purpose |
|----------|-------|---------|
| Scrollback buffer | 50KB | Memory management |
| Output batch size | 4KB | Network efficiency |
| Output throttle | 4ms | CPU management |

### Memory Configuration

```typescript
const MAX_SCROLLBACK_SIZE = 50000;  // ~50KB per terminal
const OUTPUT_BATCH_SIZE = 4096;     // 4KB batches
```

### Scrollback Trimming

```typescript
session.scrollbackBuffer += data;
if (session.scrollbackBuffer.length > MAX_SCROLLBACK_SIZE) {
  // Keep most recent data
  session.scrollbackBuffer = session.scrollbackBuffer.slice(-MAX_SCROLLBACK_SIZE);
}
```

## Throttling

### Output Throttling

```typescript
const OUTPUT_THROTTLE_MS = 4;  // ~250fps max update rate

// Buffer and batch output
if (!session.flushTimeout) {
  session.flushTimeout = setTimeout(flushOutput, OUTPUT_THROTTLE_MS);
}
```

### Resize Debouncing

```typescript
// Suppress output during resize
session.resizeDebounceTimeout = setTimeout(() => {
  session.resizeInProgress = false;
}, 150);  // 150ms settle time
```

## Session Lifecycle Limits

### Creation Rate

No explicit rate limiting on session creation - controlled by `maxSessions` count.

### Session Timeout

No built-in idle timeout - sessions persist until:
- Explicitly killed
- Process exits
- Server restarts

### Termination Grace Period

```typescript
// SIGTERM first, wait 1s, then SIGKILL
this.killPtyProcess(session.pty, 'SIGTERM');

setTimeout(() => {
  if (this.sessions.has(sessionId)) {
    this.killPtyProcess(session.pty, 'SIGKILL');
    this.sessions.delete(sessionId);
  }
}, 1000);
```

## Monitoring

### Session Statistics

```typescript
// Get all sessions with metadata
getAllSessions(): Array<{
  id: string;
  cwd: string;
  createdAt: Date;
  shell: string;
}> {
  return Array.from(this.sessions.values()).map((s) => ({
    id: s.id,
    cwd: s.cwd,
    createdAt: s.createdAt,
    shell: s.shell,
  }));
}
```

### Health Endpoint

```typescript
// GET /api/terminal/status
{
  activeSessionCount: 5,
  maxSessions: 1000,
  utilization: 0.005,  // 0.5%
}
```

## Error Handling

### Session Limit Exceeded

When `maxSessions` is reached:

1. `createSession` returns `null`
2. Error is logged
3. Client receives appropriate error response

```typescript
// API handler
const session = await terminalService.createSession(options);
if (!session) {
  return res.status(503).json({
    error: 'Maximum terminal sessions reached',
    maxSessions: terminalService.getMaxSessions(),
    currentSessions: terminalService.getSessionCount(),
  });
}
```

### Resource Exhaustion Recovery

```typescript
// Cleanup all sessions on shutdown
cleanup(): void {
  logger.info(`Cleaning up ${this.sessions.size} sessions`);
  this.sessions.forEach((session, id) => {
    try {
      if (session.flushTimeout) {
        clearTimeout(session.flushTimeout);
      }
      this.killPtyProcess(session.pty);
    } catch {
      // Ignore errors during cleanup
    }
    this.sessions.delete(id);
  });
}
```

## Best Practices

### Production Configuration

```yaml
# docker-compose.yml
environment:
  - TERMINAL_MAX_SESSIONS=100  # Reasonable limit for production
```

### Monitoring Alerts

Set up alerts for:
- Session count > 80% of max
- Rapid session creation (potential DoS)
- Sessions with large scrollback buffers

### Graceful Degradation

1. Return 503 when limit reached
2. Provide clear error message
3. Include current/max counts in response
4. Log for monitoring

## Security Considerations

### DoS Protection

- Hard limit on session count
- Throttled output prevents CPU exhaustion
- Bounded scrollback prevents memory exhaustion

### Resource Isolation

- Each session has independent buffers
- No shared state between sessions
- Session cleanup releases all resources

## Testing

### Unit Tests

```typescript
describe('Session Limits', () => {
  it('enforces max sessions', async () => {
    terminalService.setMaxSessions(2);

    const s1 = await terminalService.createSession({});
    const s2 = await terminalService.createSession({});
    const s3 = await terminalService.createSession({});

    expect(s1).not.toBeNull();
    expect(s2).not.toBeNull();
    expect(s3).toBeNull();  // Limit reached
  });

  it('allows session after one is killed', async () => {
    terminalService.setMaxSessions(1);

    const s1 = await terminalService.createSession({});
    expect(s1).not.toBeNull();

    terminalService.killSession(s1!.id);
    await sleep(100);  // Wait for cleanup

    const s2 = await terminalService.createSession({});
    expect(s2).not.toBeNull();
  });
});
```

### Load Tests

```typescript
describe('Resource Limits', () => {
  it('trims scrollback buffer', async () => {
    const session = await terminalService.createSession({});
    // Generate more than MAX_SCROLLBACK_SIZE of output
    session.pty.write('yes | head -n 100000\n');
    await sleep(1000);

    expect(session.scrollbackBuffer.length).toBeLessThanOrEqual(MAX_SCROLLBACK_SIZE);
  });
});
```

## Related Documents

- [Terminal Service](./terminal-service.md) - Core terminal functionality
- [Environment Variables](../security/environment-variables.md) - Configuration
- [Operations](../../application/operations/monitoring.md) - Monitoring setup
