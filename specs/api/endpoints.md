# API Endpoints Specification

## Overview

Complete REST API specification for AgentPane using TanStack Start server routes. All endpoints return JSON with consistent `ok/error` response structure.

---

## Response Format

### Success Response

```typescript
{
  "ok": true,
  "data": T  // Response data type varies by endpoint
}
```

### Error Response

```typescript
{
  "ok": false,
  "error": {
    "code": string,      // Error code from error-catalog.md
    "message": string,   // Human-readable message
    "details"?: object   // Additional error context
  }
}
```

---

## Projects

### GET /api/projects

List all projects.

**Request Schema:**
```typescript
// Query parameters
const listProjectsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: {
    items: Project[],
    nextCursor: string | null,
    hasMore: boolean,
    totalCount: number
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid query parameters |

**Example:**
```bash
curl -X GET "/api/projects?limit=10"
```

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "clx1234567890",
        "name": "AgentPane",
        "path": "~/git/agentpane",
        "config": { "defaultBranch": "main", "maxTurns": 50 },
        "maxConcurrentAgents": 3,
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ],
    "nextCursor": null,
    "hasMore": false,
    "totalCount": 1
  }
}
```

---

### POST /api/projects

Create a new project.

**Request Schema:**
```typescript
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  path: z.string().min(1),
  description: z.string().max(500).optional(),
  config: projectConfigSchema.optional(),
  maxConcurrentAgents: z.number().min(1).max(10).optional(),
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Project
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 400 | `PROJECT_PATH_INVALID` | Path doesn't exist |
| 409 | `PROJECT_PATH_EXISTS` | Project with path already exists |

**Example:**
```bash
curl -X POST "/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "path": "~/git/my-project"}'
```

---

### GET /api/projects/:id

Get project by ID.

**Response Schema:**
```typescript
{
  ok: true,
  data: Project
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `INVALID_ID` | Invalid project ID format |
| 404 | `PROJECT_NOT_FOUND` | Project doesn't exist |

---

### PATCH /api/projects/:id

Update a project.

**Request Schema:**
```typescript
const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: projectConfigSchema.partial().optional(),
  maxConcurrentAgents: z.number().min(1).max(10).optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Project
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 404 | `PROJECT_NOT_FOUND` | Project doesn't exist |

---

### DELETE /api/projects/:id

Delete a project.

**Response Schema:**
```typescript
{
  ok: true,
  data: { deleted: true }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 404 | `PROJECT_NOT_FOUND` | Project doesn't exist |
| 409 | `PROJECT_HAS_RUNNING_AGENTS` | Project has running agents |

---

## Tasks

### GET /api/tasks

List tasks with filtering.

**Request Schema:**
```typescript
const listTasksSchema = z.object({
  projectId: z.string().cuid2(),
  column: z.enum(['backlog', 'in_progress', 'waiting_approval', 'verified']).optional(),
  agentId: z.string().cuid2().optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: {
    items: Task[],
    nextCursor: string | null,
    hasMore: boolean,
    // Column counts for Kanban view
    counts: {
      backlog: number,
      in_progress: number,
      waiting_approval: number,
      verified: number
    }
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid query parameters |

---

### POST /api/tasks

Create a new task.

**Request Schema:**
```typescript
const createTaskSchema = z.object({
  projectId: z.string().cuid2(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  labels: z.array(z.string()).max(10).optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Task  // Created in 'backlog' column by default
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 404 | `PROJECT_NOT_FOUND` | Project doesn't exist |

**Example:**
```bash
curl -X POST "/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "clx1234567890",
    "title": "Implement real-time collaboration",
    "description": "Add presence indicators and cursor tracking",
    "labels": ["feature", "priority:high"]
  }'
```

---

### GET /api/tasks/:id

Get task by ID.

**Response Schema:**
```typescript
{
  ok: true,
  data: Task & {
    // Include related data
    agent?: Agent,
    worktree?: Worktree,
    session?: Session
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 404 | `TASK_NOT_FOUND` | Task doesn't exist |

---

### PATCH /api/tasks/:id

Update a task.

**Request Schema:**
```typescript
const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  labels: z.array(z.string()).max(10).optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Task
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 404 | `TASK_NOT_FOUND` | Task doesn't exist |

---

### DELETE /api/tasks/:id

Delete a task.

**Response Schema:**
```typescript
{
  ok: true,
  data: { deleted: true }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 404 | `TASK_NOT_FOUND` | Task doesn't exist |
| 409 | `TASK_ALREADY_ASSIGNED` | Task has running agent |

---

### POST /api/tasks/:id/move

Move task to a different column (Kanban drag-drop).

**Request Schema:**
```typescript
const moveTaskSchema = z.object({
  column: z.enum(['backlog', 'in_progress', 'waiting_approval', 'verified']),
  position: z.number().min(0),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Task
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 400 | `TASK_INVALID_TRANSITION` | Invalid column transition |
| 404 | `TASK_NOT_FOUND` | Task doesn't exist |
| 409 | `TASK_POSITION_CONFLICT` | Concurrent position update |

**Valid Transitions:**
```
backlog -> in_progress (auto-assigns agent)
in_progress -> waiting_approval (agent completed)
waiting_approval -> verified (user approves)
waiting_approval -> in_progress (user rejects)
```

**Example:**
```bash
curl -X POST "/api/tasks/clx1234567890/move" \
  -H "Content-Type: application/json" \
  -d '{"column": "in_progress", "position": 0}'
```

---

### POST /api/tasks/:id/approve

Approve task changes (merge branch).

**Request Schema:**
```typescript
const approveTaskSchema = z.object({
  approvedBy: z.string().optional(),  // User ID
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Task & {
    mergedAt: string,
    approvedAt: string
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `TASK_NOT_WAITING_APPROVAL` | Task not in waiting_approval |
| 400 | `TASK_NO_DIFF` | No changes to approve |
| 404 | `TASK_NOT_FOUND` | Task doesn't exist |
| 409 | `TASK_ALREADY_APPROVED` | Already approved |
| 409 | `WORKTREE_MERGE_CONFLICT` | Git merge conflict |

---

### POST /api/tasks/:id/reject

Reject task changes (resume agent with feedback).

**Request Schema:**
```typescript
const rejectTaskSchema = z.object({
  reason: z.string().min(1).max(1000),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Task & {
    rejectionCount: number,
    rejectionReason: string
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Missing reason |
| 400 | `TASK_NOT_WAITING_APPROVAL` | Task not in waiting_approval |
| 404 | `TASK_NOT_FOUND` | Task doesn't exist |

---

## Agents

### GET /api/agents

List agents for a project.

**Request Schema:**
```typescript
const listAgentsSchema = z.object({
  projectId: z.string().cuid2(),
  status: z.enum(['idle', 'starting', 'running', 'paused', 'error', 'completed']).optional(),
  type: z.enum(['task', 'conversational', 'background']).optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Agent[]
}
```

---

### POST /api/agents

Create a new agent.

**Request Schema:**
```typescript
const createAgentSchema = z.object({
  projectId: z.string().cuid2(),
  name: z.string().min(1).max(100),
  type: z.enum(['task', 'conversational', 'background']).default('task'),
  config: agentConfigSchema.optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Agent
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 404 | `PROJECT_NOT_FOUND` | Project doesn't exist |

---

### GET /api/agents/:id

Get agent by ID.

**Response Schema:**
```typescript
{
  ok: true,
  data: Agent & {
    currentTask?: Task,
    currentSession?: Session,
    currentWorktree?: Worktree
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 404 | `AGENT_NOT_FOUND` | Agent doesn't exist |

---

### PATCH /api/agents/:id

Update agent configuration.

**Request Schema:**
```typescript
const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: agentConfigSchema.partial().optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Agent
}
```

---

### DELETE /api/agents/:id

Delete an agent.

**Response Schema:**
```typescript
{
  ok: true,
  data: { deleted: true }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `AGENT_NOT_RUNNING` | Agent is running (stop first) |
| 404 | `AGENT_NOT_FOUND` | Agent doesn't exist |

---

### POST /api/agents/:id/start

Start an agent on a task.

**Request Schema:**
```typescript
const startAgentSchema = z.object({
  taskId: z.string().cuid2().optional(),  // If not provided, picks from backlog
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: {
    agent: Agent,
    task: Task,
    session: Session,
    worktree: Worktree
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `AGENT_NO_AVAILABLE_TASK` | No tasks in backlog |
| 404 | `AGENT_NOT_FOUND` | Agent doesn't exist |
| 404 | `TASK_NOT_FOUND` | Specified task doesn't exist |
| 409 | `AGENT_ALREADY_RUNNING` | Agent is already running |
| 409 | `TASK_ALREADY_ASSIGNED` | Task assigned to another agent |
| 429 | `CONCURRENCY_LIMIT_EXCEEDED` | Too many concurrent agents |

**Example:**
```bash
curl -X POST "/api/agents/clx1234567890/start" \
  -H "Content-Type: application/json" \
  -d '{"taskId": "clx0987654321"}'
```

---

### POST /api/agents/:id/stop

Stop a running agent.

**Response Schema:**
```typescript
{
  ok: true,
  data: {
    agent: Agent,  // status: 'paused'
    task: Task     // moved back to appropriate column
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `AGENT_NOT_RUNNING` | Agent not running |
| 404 | `AGENT_NOT_FOUND` | Agent doesn't exist |

---

### GET /api/agents/:id/status

Get agent execution status.

**Response Schema:**
```typescript
{
  ok: true,
  data: {
    status: AgentStatus,
    turn: number,
    progress: number,
    currentTool?: string,
    sessionId?: string,
    taskId?: string,
    startedAt?: string,
    elapsedMs?: number
  }
}
```

---

## Sessions

### POST /api/sessions

Create a new session.

**Request Schema:**
```typescript
const createSessionSchema = z.object({
  projectId: z.string().cuid2(),
  taskId: z.string().cuid2().optional(),
  agentId: z.string().cuid2().optional(),
  title: z.string().max(200).optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: Session & {
    url: string  // Full shareable URL
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 404 | `PROJECT_NOT_FOUND` | Project doesn't exist |

---

### GET /api/sessions/:id

Get session by ID.

**Response Schema:**
```typescript
{
  ok: true,
  data: Session & {
    activeUsers: ActiveUser[],
    viewerCount: number,
    task?: Task,
    agent?: Agent
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 404 | `SESSION_NOT_FOUND` | Session doesn't exist |

---

### GET /api/sessions/:id/stream

Server-Sent Events endpoint for real-time session events.

**Response:**
- Content-Type: `text/event-stream`
- Events: `SessionEvent` objects (see session-service.md)

**Event Format:**
```
event: chunk
data: {"type":"chunk","agentId":"agt_123","text":"Hello","timestamp":1705420800000}

event: tool:start
data: {"type":"tool:start","agentId":"agt_123","tool":"Read","input":{"path":"/src/index.ts"},"timestamp":1705420801000}

event: presence:joined
data: {"type":"presence:joined","userId":"usr_456","timestamp":1705420802000}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 404 | `SESSION_NOT_FOUND` | Session doesn't exist |
| 502 | `SESSION_CONNECTION_FAILED` | Stream connection failed |

**Example:**
```javascript
const eventSource = new EventSource('/api/sessions/clx123/stream');

eventSource.addEventListener('chunk', (e) => {
  const event = JSON.parse(e.data);
  console.log('Token:', event.text);
});

eventSource.addEventListener('tool:start', (e) => {
  const event = JSON.parse(e.data);
  console.log('Tool:', event.tool, event.input);
});
```

---

### GET /api/sessions/:id/history

Get historical session events (replay).

**Request Schema:**
```typescript
const historySchema = z.object({
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  eventTypes: z.array(z.string()).optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: {
    events: SessionEvent[],
    nextCursor: string | null,
    hasMore: boolean
  }
}
```

---

### POST /api/sessions/:id/close

Close a session.

**Response Schema:**
```typescript
{
  ok: true,
  data: Session & {
    closedAt: string
  }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 400 | `SESSION_CLOSED` | Already closed |
| 404 | `SESSION_NOT_FOUND` | Session doesn't exist |

---

### GET /api/sessions/:id/presence

Get active users in session.

**Response Schema:**
```typescript
{
  ok: true,
  data: {
    users: ActiveUser[],
    viewerCount: number
  }
}
```

---

### POST /api/sessions/:id/presence

Update presence (cursor, activity).

**Request Schema:**
```typescript
const presenceUpdateSchema = z.object({
  cursor: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  activeFile: z.string().optional(),
});
```

**Response Schema:**
```typescript
{
  ok: true,
  data: null
}
```

---

## Webhooks

### POST /api/webhooks/github

GitHub webhook handler for push events and config sync.

**Headers:**
- `X-GitHub-Event`: Event type (push, installation, etc.)
- `X-Hub-Signature-256`: HMAC signature for verification

**Request Body:** GitHub webhook payload

**Response Schema:**
```typescript
{
  ok: true,
  data: { received: true }
}
```

**Error Responses:**
| Status | Code | Condition |
|--------|------|-----------|
| 401 | `GITHUB_WEBHOOK_INVALID` | Invalid signature |

**Handled Events:**
- `push`: Sync config if `.agentpane/` files changed
- `installation`: Handle app install/uninstall
- `pull_request`: Auto-create tasks from PRs (optional)

---

## TanStack Start Route Implementation

### Example: Tasks Routes

```typescript
// app/routes/api/tasks/index.ts
import { createServerFileRoute } from '@tanstack/react-start/server';
import { taskService } from '@/lib/services/task-service';
import { handleApiError } from '@/lib/api/error-handler';
import { listTasksSchema, createTaskSchema } from '@/db/schema/validation';

export const ServerRoute = createServerFileRoute().methods({
  // GET /api/tasks
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams);

    const parsed = listTasksSchema.safeParse(params);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid parameters' } },
        { status: 400 }
      );
    }

    const result = await taskService.list(parsed.data);
    if (!result.ok) {
      return handleApiError(result.error);
    }

    return Response.json({ ok: true, data: result.value });
  },

  // POST /api/tasks
  POST: async ({ request }) => {
    const body = await request.json();

    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } },
        { status: 400 }
      );
    }

    const result = await taskService.create(parsed.data);
    if (!result.ok) {
      return handleApiError(result.error);
    }

    return Response.json({ ok: true, data: result.value }, { status: 201 });
  },
});
```

### Example: Task Move Route

```typescript
// app/routes/api/tasks/$id/move.ts
import { createServerFileRoute } from '@tanstack/react-start/server';
import { taskService } from '@/lib/services/task-service';
import { handleApiError } from '@/lib/api/error-handler';
import { moveTaskSchema } from '@/db/schema/validation';

export const ServerRoute = createServerFileRoute().methods({
  POST: async ({ request, params }) => {
    const body = await request.json();

    const parsed = moveTaskSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } },
        { status: 400 }
      );
    }

    const result = await taskService.moveColumn(params.id, parsed.data);
    if (!result.ok) {
      return handleApiError(result.error);
    }

    return Response.json({ ok: true, data: result.value });
  },
});
```

### Example: Session SSE Stream

```typescript
// app/routes/api/sessions/$id/stream.ts
import { createServerFileRoute } from '@tanstack/react-start/server';
import { sessionService } from '@/lib/services/session-service';

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ params, request }) => {
    // Verify session exists
    const session = await sessionService.getById(params.id);
    if (!session.ok) {
      return Response.json(
        { ok: false, error: session.error },
        { status: 404 }
      );
    }

    // Get user ID from auth (simplified)
    const userId = request.headers.get('X-User-ID') ?? 'anonymous';

    // Join session for presence tracking
    await sessionService.join(params.id, userId);

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Subscribe to session events
        for await (const event of sessionService.subscribe(params.id)) {
          const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      },
      cancel() {
        // Leave session on disconnect
        sessionService.leave(params.id, userId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  },
});
```

---

## Rate Limiting

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Read operations (GET) | 1000 | 1 minute |
| Write operations (POST/PATCH) | 100 | 1 minute |
| Agent start/stop | 20 | 1 minute |
| Session stream connect | 10 | 1 minute |
| Webhook handler | 100 | 1 minute |

**Rate Limit Response:**
```typescript
{
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "retryAfter": 30,  // seconds
      "limit": 100,
      "remaining": 0
    }
  }
}
```

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705420800
Retry-After: 30
```

---

## Authentication

All endpoints require authentication via one of:
- `Authorization: Bearer <token>` header
- Session cookie (for browser clients)

**Unauthenticated Response:**
```typescript
{
  "ok": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](/specs/database/schema.md) | Data types and validation schemas |
| [Error Catalog](/specs/errors/error-catalog.md) | Error codes and messages |
| [Session Service](/specs/services/session-service.md) | Session management implementation |
| [AGENTS.md](/AGENTS.md) | TanStack Start server route patterns |
| [User Stories](/specs/user-stories.md) | Feature requirements |
