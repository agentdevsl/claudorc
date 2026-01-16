# AgentService Specification

## Overview

The AgentService manages agent lifecycle, execution, and concurrency control for the AgentPane multi-agent task management system. It coordinates with the WorktreeService for isolated execution environments and publishes real-time events via Durable Streams.

## Related Wireframes

- [Agent Configuration Dialog](../wireframes/agent-config-dialog.html) - Agent creation/update UI
- [Error State Expanded](../wireframes/error-state-expanded.html) - Error handling and retry UI
- [Queue Waiting State](../wireframes/queue-waiting-state.html) - Concurrency and queue management UI

---

## Interface Definition

```typescript
// lib/services/agent-service.ts
import type { Result } from '@/lib/utils/result';
import type { Agent, NewAgent, AgentConfig, AgentStatus } from '@/db/schema';
import type { AgentError, ConcurrencyError, ValidationError } from '@/lib/errors';

export interface AgentExecutionContext {
  agentId: string;
  taskId: string;
  projectId: string;
  sessionId: string;
  cwd: string;                    // Worktree path
  allowedTools: string[];         // Tool whitelist
  maxTurns: number;               // Execution limit
  env: Record<string, string>;    // Isolated environment
}

export interface AgentRunResult {
  runId: string;
  status: 'completed' | 'error' | 'turn_limit' | 'paused';
  turnCount: number;
  result?: string;
  error?: string;
  diff?: string;
}

export interface QueuePosition {
  taskId: string;
  position: number;
  estimatedWaitMinutes: number;
}

export interface IAgentService {
  // CRUD Operations
  create(input: NewAgent): Promise<Result<Agent, ValidationError>>;
  getById(id: string): Promise<Result<Agent, AgentError>>;
  list(projectId: string): Promise<Result<Agent[], never>>;
  update(id: string, input: Partial<AgentConfig>): Promise<Result<Agent, AgentError | ValidationError>>;
  delete(id: string): Promise<Result<void, AgentError>>;

  // Execution Control
  start(agentId: string, taskId: string): Promise<Result<AgentRunResult, AgentError | ConcurrencyError>>;
  stop(agentId: string): Promise<Result<void, AgentError>>;
  pause(agentId: string): Promise<Result<void, AgentError>>;
  resume(agentId: string, feedback?: string): Promise<Result<AgentRunResult, AgentError>>;

  // Concurrency Management
  checkAvailability(projectId: string): Promise<Result<boolean, never>>;
  queueTask(projectId: string, taskId: string): Promise<Result<QueuePosition, ConcurrencyError>>;
  getRunningCount(projectId: string): Promise<Result<number, never>>;
  getQueuedTasks(projectId: string): Promise<Result<QueuePosition[], never>>;

  // Hooks Integration (for event publishing)
  registerPreToolUseHook(agentId: string, hook: PreToolUseHook): void;
  registerPostToolUseHook(agentId: string, hook: PostToolUseHook): void;
}

// Hook types for Claude Agent SDK integration
export type PreToolUseHook = (input: {
  tool_name: string;
  tool_input: Record<string, unknown>;
}) => Promise<{ deny?: boolean; reason?: string }>;

export type PostToolUseHook = (input: {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
}) => Promise<void>;
```

---

## CRUD Operations

### create

Creates a new agent with validated configuration.

```typescript
async create(input: NewAgent): Promise<Result<Agent, ValidationError>> {
  // 1. Validate input using createAgentSchema
  const validation = createAgentSchema.safeParse(input);
  if (!validation.success) {
    return err(ValidationErrors.VALIDATION_ERROR(validation.error.errors));
  }

  // 2. Validate project exists
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });
  if (!project) {
    return err(ValidationErrors.INVALID_ID('projectId'));
  }

  // 3. Apply defaults from project config
  const config: AgentConfig = {
    allowedTools: input.config?.allowedTools ?? project.config.allowedTools,
    maxTurns: input.config?.maxTurns ?? project.config.maxTurns,
    model: input.config?.model ?? project.config.model,
    ...input.config,
  };

  // 4. Insert agent
  const [agent] = await db.insert(agents).values({
    ...input,
    config,
  }).returning();

  // 5. Publish event
  publishAgentEvent(agent.id, {
    type: 'agent:created',
    payload: agent,
    timestamp: Date.now(),
  });

  return ok(agent);
}
```

### getById

Retrieves an agent by ID with its current state.

```typescript
async getById(id: string): Promise<Result<Agent, AgentError>> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, id),
    with: {
      currentTask: true,
      project: true,
    },
  });

  if (!agent) {
    return err(AgentErrors.NOT_FOUND);
  }

  return ok(agent);
}
```

### list

Lists all agents for a project with optional status filter.

```typescript
async list(
  projectId: string,
  filter?: { status?: AgentStatus }
): Promise<Result<Agent[], never>> {
  const conditions = [eq(agents.projectId, projectId)];

  if (filter?.status) {
    conditions.push(eq(agents.status, filter.status));
  }

  const result = await db.query.agents.findMany({
    where: and(...conditions),
    orderBy: [desc(agents.updatedAt)],
  });

  return ok(result);
}
```

### update

Updates agent configuration with validation.

```typescript
async update(
  id: string,
  input: Partial<AgentConfig>
): Promise<Result<Agent, AgentError | ValidationError>> {
  // 1. Get existing agent
  const existing = await this.getById(id);
  if (!existing.ok) return existing;

  // 2. Cannot update running agent's tools/model
  if (existing.value.status === 'running') {
    if (input.allowedTools || input.model) {
      return err(AgentErrors.ALREADY_RUNNING(existing.value.currentTaskId));
    }
  }

  // 3. Validate config changes
  if (input.allowedTools) {
    const invalidTools = input.allowedTools.filter(
      t => !VALID_TOOLS.includes(t)
    );
    if (invalidTools.length > 0) {
      return err(ValidationErrors.INVALID_ENUM_VALUE(
        'allowedTools',
        invalidTools.join(', '),
        VALID_TOOLS
      ));
    }
  }

  // 4. Merge and update
  const [agent] = await db.update(agents)
    .set({
      config: { ...existing.value.config, ...input },
      updatedAt: new Date(),
    })
    .where(eq(agents.id, id))
    .returning();

  return ok(agent);
}
```

### delete

Deletes an agent (only if idle).

```typescript
async delete(id: string): Promise<Result<void, AgentError>> {
  const existing = await this.getById(id);
  if (!existing.ok) return existing;

  // Cannot delete running agent
  if (existing.value.status === 'running') {
    return err(AgentErrors.ALREADY_RUNNING(existing.value.currentTaskId));
  }

  await db.delete(agents).where(eq(agents.id, id));

  // Publish event
  publishAgentEvent(id, {
    type: 'agent:deleted',
    payload: { id },
    timestamp: Date.now(),
  });

  return ok(undefined);
}
```

---

## Execution Control

### start

Starts an agent on a task with worktree isolation.

```typescript
async start(
  agentId: string,
  taskId: string
): Promise<Result<AgentRunResult, AgentError | ConcurrencyError>> {
  // 1. Get agent
  const agentResult = await this.getById(agentId);
  if (!agentResult.ok) return agentResult;
  const agent = agentResult.value;

  // 2. Check if already running
  if (agent.status === 'running') {
    return err(AgentErrors.ALREADY_RUNNING(agent.currentTaskId));
  }

  // 3. Check concurrency limits
  const available = await this.checkAvailability(agent.projectId);
  if (!available.value) {
    // Queue the task instead
    return this.queueTask(agent.projectId, taskId);
  }

  // 4. Get task
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) {
    return err(AgentErrors.NO_AVAILABLE_TASK);
  }

  // 5. Create worktree via WorktreeService
  const worktreeResult = await worktreeService.create({
    projectId: agent.projectId,
    taskId,
    branch: `agent/${agentId}/${taskId}`,
  });
  if (!worktreeResult.ok) {
    return err(AgentErrors.EXECUTION_ERROR(worktreeResult.error.message));
  }

  // 6. Create execution context
  const context: AgentExecutionContext = {
    agentId,
    taskId,
    projectId: agent.projectId,
    sessionId: createId(),
    cwd: worktreeResult.value.path,
    allowedTools: agent.config.allowedTools,
    maxTurns: agent.config.maxTurns,
    env: await this.buildEnv(worktreeResult.value.path),
  };

  // 7. Update agent status
  await db.update(agents).set({
    status: 'running',
    currentTaskId: taskId,
    currentSessionId: context.sessionId,
    currentWorktreeId: worktreeResult.value.id,
    updatedAt: new Date(),
  }).where(eq(agents.id, agentId));

  // 8. Create agent run record
  const [run] = await db.insert(agentRuns).values({
    agentId,
    taskId,
    projectId: agent.projectId,
    sessionId: context.sessionId,
    status: 'running',
    prompt: task.description ?? task.title,
  }).returning();

  // 9. Publish start event
  publishAgentEvent(agentId, {
    type: 'agent:started',
    payload: { agentId, taskId, sessionId: context.sessionId },
    timestamp: Date.now(),
  });

  // 10. Execute agent (non-blocking)
  this.executeAgent(context, run.id).catch(error => {
    this.handleExecutionError(agentId, run.id, error);
  });

  return ok({
    runId: run.id,
    status: 'completed',
    turnCount: 0,
  });
}
```

### executeAgent (private)

Executes the Claude Agent SDK query with hooks.

```typescript
private async executeAgent(
  context: AgentExecutionContext,
  runId: string
): Promise<AgentRunResult> {
  let turnCount = 0;
  const results: string[] = [];

  try {
    for await (const message of query({
      prompt: await this.buildPrompt(context),
      options: {
        allowedTools: context.allowedTools,
        model: await this.getModel(context.agentId),
        maxTurns: context.maxTurns,
        cwd: context.cwd,
        hooks: {
          PreToolUse: [{
            hooks: [async (input) => {
              // Check tool whitelist
              if (!context.allowedTools.includes(input.tool_name)) {
                publishAgentEvent(context.agentId, {
                  type: 'tool:denied',
                  tool: input.tool_name,
                  reason: 'Tool not in whitelist',
                  timestamp: Date.now(),
                });
                return { deny: true };
              }

              // Publish tool start event
              publishAgentEvent(context.agentId, {
                type: 'tool:start',
                tool: input.tool_name,
                input: input.tool_input,
                timestamp: Date.now(),
              });

              // Run registered hooks
              for (const hook of this.preToolHooks.get(context.agentId) ?? []) {
                const result = await hook(input);
                if (result.deny) return result;
              }

              return {};
            }],
          }],
          PostToolUse: [{
            hooks: [async (input) => {
              // Publish tool result event
              publishAgentEvent(context.agentId, {
                type: 'tool:result',
                tool: input.tool_name,
                input: input.tool_input,
                output: input.tool_response,
                timestamp: Date.now(),
              });

              // Create audit log
              await db.insert(auditLogs).values({
                agentId: context.agentId,
                agentRunId: runId,
                taskId: context.taskId,
                projectId: context.projectId,
                tool: input.tool_name,
                status: 'complete',
                input: input.tool_input,
                output: { response: input.tool_response },
                turnNumber: turnCount,
              });

              // Run registered hooks
              for (const hook of this.postToolHooks.get(context.agentId) ?? []) {
                await hook(input);
              }

              return {};
            }],
          }],
        },
      },
    })) {
      // Handle stream events
      if (message.type === 'stream_event') {
        publishAgentEvent(context.agentId, {
          type: 'stream:token',
          event: message.event,
          timestamp: Date.now(),
        });
      }

      // Track turns
      if ('result' in message) {
        turnCount++;
        results.push(message.result);

        // Update run progress
        await db.update(agentRuns).set({
          turnCount,
        }).where(eq(agentRuns.id, runId));

        // Publish turn event
        publishAgentEvent(context.agentId, {
          type: 'agent:turn',
          turn: turnCount,
          maxTurns: context.maxTurns,
          timestamp: Date.now(),
        });
      }
    }

    // Execution completed successfully
    return this.completeExecution(context, runId, {
      status: 'completed',
      turnCount,
      result: results.join('\n'),
    });

  } catch (error) {
    if (error.message?.includes('max turns')) {
      return this.completeExecution(context, runId, {
        status: 'turn_limit',
        turnCount,
        result: results.join('\n'),
      });
    }
    throw error;
  }
}
```

### stop

Stops a running agent immediately.

```typescript
async stop(agentId: string): Promise<Result<void, AgentError>> {
  const agent = await this.getById(agentId);
  if (!agent.ok) return agent;

  if (agent.value.status !== 'running') {
    return err(AgentErrors.NOT_RUNNING);
  }

  // Signal abort to execution
  this.abortControllers.get(agentId)?.abort();

  // Update status
  await db.update(agents).set({
    status: 'idle',
    currentTaskId: null,
    currentSessionId: null,
    updatedAt: new Date(),
  }).where(eq(agents.id, agentId));

  // Publish event
  publishAgentEvent(agentId, {
    type: 'agent:stopped',
    payload: { agentId },
    timestamp: Date.now(),
  });

  return ok(undefined);
}
```

### pause

Pauses an agent for user input (approval workflow).

```typescript
async pause(agentId: string): Promise<Result<void, AgentError>> {
  const agent = await this.getById(agentId);
  if (!agent.ok) return agent;

  if (agent.value.status !== 'running') {
    return err(AgentErrors.NOT_RUNNING);
  }

  // Update status
  await db.update(agents).set({
    status: 'paused',
    updatedAt: new Date(),
  }).where(eq(agents.id, agentId));

  // Publish event
  publishAgentEvent(agentId, {
    type: 'agent:paused',
    payload: { agentId, reason: 'Waiting for user input' },
    timestamp: Date.now(),
  });

  return ok(undefined);
}
```

### resume

Resumes a paused agent with optional feedback.

```typescript
async resume(
  agentId: string,
  feedback?: string
): Promise<Result<AgentRunResult, AgentError>> {
  const agent = await this.getById(agentId);
  if (!agent.ok) return agent;

  if (agent.value.status !== 'paused') {
    return err(AgentErrors.NOT_RUNNING);
  }

  // Get the current task and run
  const run = await db.query.agentRuns.findFirst({
    where: eq(agentRuns.sessionId, agent.value.currentSessionId),
    orderBy: [desc(agentRuns.startedAt)],
  });

  if (!run) {
    return err(AgentErrors.NO_AVAILABLE_TASK);
  }

  // Resume with feedback injected into context
  const context = await this.restoreContext(agent.value, feedback);

  // Update status
  await db.update(agents).set({
    status: 'running',
    updatedAt: new Date(),
  }).where(eq(agents.id, agentId));

  // Publish event
  publishAgentEvent(agentId, {
    type: 'agent:resumed',
    payload: { agentId, feedback },
    timestamp: Date.now(),
  });

  // Continue execution
  this.executeAgent(context, run.id).catch(error => {
    this.handleExecutionError(agentId, run.id, error);
  });

  return ok({
    runId: run.id,
    status: 'completed',
    turnCount: run.turnCount,
  });
}
```

---

## Concurrency Management

### checkAvailability

Checks if a new agent can start for a project.

```typescript
async checkAvailability(projectId: string): Promise<Result<boolean, never>> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  const runningCount = await this.getRunningCount(projectId);

  return ok(runningCount.value < (project?.maxConcurrentAgents ?? 3));
}
```

### getRunningCount

Gets the count of currently running agents.

```typescript
async getRunningCount(projectId: string): Promise<Result<number, never>> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(agents)
    .where(
      and(
        eq(agents.projectId, projectId),
        eq(agents.status, 'running')
      )
    );

  return ok(result[0]?.count ?? 0);
}
```

### queueTask

Adds a task to the queue when concurrency limit is reached.

```typescript
async queueTask(
  projectId: string,
  taskId: string
): Promise<Result<QueuePosition, ConcurrencyError>> {
  // Get current queue size
  const queuedTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.projectId, projectId),
      eq(tasks.column, 'backlog'),
      isNotNull(tasks.agentId)
    ),
    orderBy: [asc(tasks.position)],
  });

  const maxQueueSize = 50; // Configurable
  if (queuedTasks.length >= maxQueueSize) {
    return err(ConcurrencyErrors.QUEUE_FULL(queuedTasks.length, maxQueueSize));
  }

  // Calculate position
  const position = queuedTasks.length + 1;
  const avgTaskDuration = 5; // minutes, could be calculated from history
  const runningCount = (await this.getRunningCount(projectId)).value;
  const estimatedWait = (position * avgTaskDuration) / Math.max(runningCount, 1);

  // Publish queue event
  publishAgentEvent('system', {
    type: 'task:queued',
    payload: { taskId, position, estimatedWaitMinutes: estimatedWait },
    timestamp: Date.now(),
  });

  return ok({
    taskId,
    position,
    estimatedWaitMinutes: estimatedWait,
  });
}
```

### getQueuedTasks

Gets all queued tasks with positions.

```typescript
async getQueuedTasks(projectId: string): Promise<Result<QueuePosition[], never>> {
  const queuedTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.projectId, projectId),
      eq(tasks.column, 'backlog'),
      isNotNull(tasks.agentId)
    ),
    orderBy: [asc(tasks.position)],
  });

  const runningCount = (await this.getRunningCount(projectId)).value;
  const avgTaskDuration = 5;

  const positions: QueuePosition[] = queuedTasks.map((task, index) => ({
    taskId: task.id,
    position: index + 1,
    estimatedWaitMinutes: ((index + 1) * avgTaskDuration) / Math.max(runningCount, 1),
  }));

  return ok(positions);
}
```

---

## Business Rules

### Turn Limits

- Default max turns: 50 (configurable per agent)
- Warn at 80% of limit (40 turns)
- Pause at 100% with option to extend or approve
- Turn limit exceeded is not an error, but a workflow state

### Tool Whitelisting

- Default tools: `['Read', 'Edit', 'Bash', 'Glob', 'Grep']`
- Tools can be added/removed via agent config
- Bash tool shows warning in UI (security sensitive)
- All tool calls logged to audit trail

### Concurrency Rules

- Default max concurrent agents: 3 per project (configurable)
- Tasks queue automatically when limit reached
- FIFO queue ordering with priority support
- Queue position updates broadcast via events

### Isolation Requirements

- Each agent execution runs in isolated git worktree
- Environment variables copied from project `.env`
- Dependencies installed per worktree
- `cwd` scoped to worktree path

---

## Side Effects

### Database Operations

| Operation | Tables Affected |
|-----------|-----------------|
| `create` | `agents` |
| `start` | `agents`, `agent_runs`, `tasks`, `worktrees` |
| `stop` | `agents`, `agent_runs` |
| `pause` | `agents` |
| `resume` | `agents`, `agent_runs` |
| Tool execution | `audit_logs` |

### Event Publishing

All events published via Durable Streams to `agent:{agentId}` channel:

| Event Type | When |
|------------|------|
| `agent:created` | New agent created |
| `agent:started` | Agent begins execution |
| `agent:turn` | Each turn completed |
| `agent:paused` | Agent paused for input |
| `agent:resumed` | Agent resumed |
| `agent:stopped` | Agent manually stopped |
| `agent:completed` | Execution finished |
| `agent:error` | Execution failed |
| `tool:start` | Before tool execution |
| `tool:result` | After tool execution |
| `tool:denied` | Tool blocked by whitelist |
| `stream:token` | Token streamed |
| `task:queued` | Task added to queue |

### Worktree Coordination

- `start`: Creates worktree via `WorktreeService.create()`
- `completeExecution`: Generates diff via `WorktreeService.getDiff()`
- Approval: Merges via `WorktreeService.merge()`
- Cleanup: Removes via `WorktreeService.remove()`

---

## Error Conditions

| Error Code | HTTP | Condition |
|------------|------|-----------|
| `AGENT_NOT_FOUND` | 404 | Agent ID doesn't exist |
| `AGENT_ALREADY_RUNNING` | 409 | Attempting to start running agent |
| `AGENT_NOT_RUNNING` | 400 | Attempting to stop/pause idle agent |
| `AGENT_TURN_LIMIT_EXCEEDED` | 200 | Max turns reached (workflow, not error) |
| `AGENT_NO_AVAILABLE_TASK` | 400 | No task to execute |
| `AGENT_TOOL_NOT_ALLOWED` | 403 | Tool not in whitelist |
| `AGENT_EXECUTION_ERROR` | 500 | Runtime execution failure |
| `CONCURRENCY_LIMIT_EXCEEDED` | 429 | Max agents reached |
| `QUEUE_FULL` | 429 | Task queue at capacity |
| `VALIDATION_ERROR` | 400 | Invalid input data |

---

## Implementation Outline

```typescript
// lib/services/agent-service.ts
import { query, tool } from '@anthropic-ai/claude-agent-sdk';
import { db } from '@/db/client';
import { agents, agentRuns, tasks, auditLogs } from '@/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { publishAgentEvent } from '@/lib/streams/server';
import { worktreeService } from './worktree-service';
import { ok, err, type Result } from '@/lib/utils/result';
import { AgentErrors, ConcurrencyErrors, ValidationErrors } from '@/lib/errors';
import { createAgentSchema } from '@/db/schema/validation';

const VALID_TOOLS = ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob', 'WebFetch', 'TodoWrite'];

export class AgentService implements IAgentService {
  private preToolHooks = new Map<string, PreToolUseHook[]>();
  private postToolHooks = new Map<string, PostToolUseHook[]>();
  private abortControllers = new Map<string, AbortController>();

  // ... implement all interface methods
}

export const agentService = new AgentService();
```

---

## State Machine Coordination

The AgentService coordinates with the Agent State Machine for valid transitions:

```
idle -> starting -> running -> paused -> running -> completed
                          \-> error
                          \-> completed (turn limit)
```

See [Agent State Machine](../state-machines/agent-state-machine.md) for transition rules.

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](../database/schema.md) | `agents`, `agent_runs`, `audit_logs` tables |
| [Error Catalog](../errors/error-catalog.md) | Agent and concurrency errors |
| [WorktreeService](./worktree-service.md) | Worktree lifecycle coordination |
| [State Machines](../state-machines/) | Agent status transitions |
| [User Stories](../user-stories.md) | Concurrent agents, real-time visibility |
