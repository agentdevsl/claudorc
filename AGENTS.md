# AgentPane Development Guidelines

## AI Assistant Rules

> **Read this section first.** These are hard constraints for code generation.

### MUST

- Use TypeScript with strict mode for all new code
- Use `async/await` for all asynchronous code - never callbacks
- Use Vitest for unit/integration tests, Agent Browser for E2E
- Write tests FIRST before implementation (TDD)
- Use Biome for linting and formatting
- Use environment variables for all configuration (never hardcode secrets)
- Use explicit return types for public functions
- Use `const` by default, `let` only when mutation is required
- Implement proper error handling with Result types for expected errors
- Follow local-first architecture patterns
- Use dependency injection for testability

### NEVER

- Use `any` type without explicit justification
- Use `var` - always use `const` or `let`
- Store secrets in code or version control
- Use synchronous file/network operations in async contexts
- Disable TypeScript strict checks
- Skip error handling for async operations
- Use mutable global state
- Commit `.env` files or credentials
- Write implementation code without corresponding tests
- Block the UI on network requests (local-first)

### PREFER

- Open source libraries over proprietary solutions
- Functional programming patterns over imperative
- Composition over inheritance
- Small, focused functions (< 30 lines)
- Early returns with guard clauses
- Template literals over string concatenation
- Optional chaining (`?.`) and nullish coalescing (`??`)
- Named exports over default exports
- Descriptive variable names over comments
- Result types over thrown exceptions for expected errors
- Optimistic UI updates with sync reconciliation

---

## Tech Stack (AgentPane Dev Stack)

| Layer              | Technology       | Package                                                                                             | Version          |
| ------------------ | ---------------- | --------------------------------------------------------------------------------------------------- | ---------------- |
| Runtime            | Bun              | https://bun.sh                                                                                      | 1.3.6            |
| Framework          | TanStack Start   | @tanstack/react-start (https://github.com/TanStack/router)                                          | 1.150.0          |
| Database           | PGlite           | @electric-sql/pglite (https://github.com/electric-sql/pglite)                                       | 0.3.15           |
| ORM                | Drizzle          | drizzle-orm + drizzle-kit (https://github.com/drizzle-team/drizzle-orm)                             | 0.45.1           |
| Client State       | TanStack DB      | @tanstack/db + @tanstack/react-db (https://github.com/TanStack/db)                                  | 0.5.20 / 0.1.64  |
| Agent Events       | Durable Streams  | @durable-streams/client + @durable-streams/state (https://github.com/durable-streams/durable-streams) | 0.1.5            |
| AI / Agents        | Claude Agent SDK | @anthropic-ai/claude-agent-sdk (https://github.com/anthropics/claude-agent-sdk-typescript)          | 0.2.9            |
| UI                 | Radix + Tailwind | @radix-ui/* + tailwindcss (https://github.com/radix-ui/primitives)                                  | 1.2.4 / 4.1.18   |
| Drag & Drop        | dnd-kit          | @dnd-kit/core + @dnd-kit/sortable (https://github.com/clauderic/dnd-kit)                            | 6.3.1            |
| Testing            | Vitest           | vitest (https://github.com/vitest-dev/vitest)                                                       | 4.0.17           |
| UI Testing         | Agent Browser    | agent-browser (https://github.com/vercel-labs/agent-browser)                                        | 0.5.0            |
| Linting/Formatting | Biome            | @biomejs/biome (https://github.com/biomejs/biome)                                                   | 2.3.11           |
| CI/CD              | GitHub Actions   | https://github.com/features/actions                                                                 | -                |

### Utility Libraries

| Package                  | Version | Purpose                         |
| ------------------------ | ------- | ------------------------------- |
| class-variance-authority | 0.7.1   | Component variant styling (cva) |
| @paralleldrive/cuid2     | 3.0.6   | Secure collision-resistant IDs  |
| zod                      | 4.3.5   | Schema validation               |
| @radix-ui/react-slot     | 1.2.4   | asChild prop support            |
| @tailwindcss/vite        | 4.1.18  | Tailwind v4 Vite plugin         |

### Future Additions (When Needed)

| Layer            | Technology   | When to Add                             |
| ---------------- | ------------ | --------------------------------------- |
| Multi-user sync  | Electric SQL | When you need multi-client data sync    |
| Server mutations | tRPC         | When you need server-side validation    |
| Server database  | Postgres     | When you need persistent server storage |
| Auth             | Better Auth  | When you need user authentication       |

---

## Architecture: Local-First (Simplified)

This project follows local-first architecture, simplified for single-developer use:

1. **Data lives on the client** - PGlite runs in the browser (persists to IndexedDB)
2. **Instant UI** - No loading states, no network latency for data
3. **Offline-capable** - App works without network
4. **Real-time agent events** - Durable Streams for agent progress

### Data Flow

```text
┌──────────────────────────────────────────────────────────────┐
│                         Client                                │
│  ┌──────────┐    ┌────────────┐    ┌──────────────────┐      │
│  │    UI    │◄───│  TanStack  │◄───│     PGlite       │      │
│  │  (React) │    │     DB     │    │  (IndexedDB) │      │
│  └────┬─────┘    └────────────┘    └──────────────────┘      │
│       │                                                       │
│       │ subscribe to agent events                             │
│       ▼                                                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Durable Streams Client                     │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Local Server (Bun)                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Durable Streams Server                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                              ▲                                │
│                              │ publishes events               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Claude Agent SDK                           │  │
│  │         (runs agents, streams progress)                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### How It Works

| Operation      | Where           | How                                    |
| -------------- | --------------- | -------------------------------------- |
| Read data      | Client          | PGlite → TanStack DB → UI (instant)    |
| Write data     | Client          | UI → TanStack DB → PGlite (instant)    |
| Run agent      | Server          | API call triggers Claude Agent SDK     |
| Agent progress | Server → Client | Durable Streams (real-time)            |

---

## Project Structure

```text
agentpane/
├── app/
│   ├── routes/              # TanStack Start file-based routes
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Home route
│   │   ├── agents/
│   │   │   ├── index.tsx    # /agents
│   │   │   └── $id.tsx      # /agents/:id
│   │   └── api/
│   │       ├── agents.ts    # Agent API endpoints
│   │       └── streams.ts   # Durable Streams endpoint
│   ├── components/
│   │   ├── ui/              # Radix-based primitives
│   │   └── features/        # Feature-specific components
│   └── client.tsx           # Client entry
├── db/
│   ├── schema/              # Drizzle schemas
│   │   ├── agents.ts
│   │   ├── tasks.ts
│   │   └── index.ts
│   └── client.ts            # PGlite client setup
├── lib/
│   ├── agents/              # Claude Agent SDK definitions
│   ├── streams/             # Durable Streams setup
│   ├── state/               # TanStack DB collections
│   └── utils/               # Shared utilities
├── tests/
│   ├── unit/                # Vitest unit tests
│   ├── integration/         # Vitest integration tests
│   └── e2e/                 # Agent Browser E2E tests
├── package.json
├── tsconfig.json
├── biome.json
├── vitest.config.ts
└── app.config.ts            # TanStack Start config
```

---

## TanStack Start Routes

### File-Based Routing

```typescript
// app/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  ),
});
```

```typescript
// app/routes/agents/$id.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/agents/$id')({
  loader: async ({ params }) => {
    // Data loads from local PGlite - instant
    return getAgent(params.id);
  },
  component: AgentDetail,
});

function AgentDetail() {
  const agent = Route.useLoaderData();
  return <AgentView agent={agent} />;
}
```

### Server Routes

```typescript
// app/routes/api/agents.ts
import { createServerFileRoute } from '@tanstack/react-start/server';

// Note: Use @tanstack/react-start (not @tanstack/start which is deprecated)
// Path is inferred from file location, use .methods() for HTTP handlers
export const ServerRoute = createServerFileRoute().methods({
  GET: async () => {
    const agents = await db.select().from(agentsTable);
    return Response.json(agents);
  },
  POST: async ({ request }) => {
    const body = await request.json();
    const agent = await db.insert(agentsTable).values(body).returning();
    return Response.json(agent[0], { status: 201 });
  },
});
```

---

## Drizzle + PGlite Schema

### Domain-Split Schemas

```typescript
// db/schema/agents.ts
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const agents = pgTable('agents', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  type: text('type', { enum: ['task', 'conversational', 'background'] }).notNull(),
  config: jsonb('config').$type<AgentConfig>(),
  status: text('status', { enum: ['idle', 'running', 'paused', 'error'] }).default('idle'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
```

```typescript
// db/schema/index.ts
export * from './agents';
export * from './tasks';
export * from './sessions';
```

### PGlite Client

```typescript
// db/client.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';

// Use IndexedDB for cross-browser compatibility (Safari doesn't support OPFS)
const pglite = new PGlite('idb://agentpane');
export const db = drizzle(pglite, { schema });
```

---

## Durable Streams (Agent Events)

Real-time streaming for agent progress and tool outputs.
Pattern from [claude-code-ui](https://github.com/KyleAMathews/claude-code-ui).

### Server (Publisher)

```typescript
// lib/streams/server.ts
import { DurableStreamsServer } from '@durable-streams/server';
import { StateProtocol } from '@durable-streams/state';

const streams = new DurableStreamsServer();

// Publish agent events with typed state protocol
export function publishAgentState(agentId: string, state: AgentState) {
  streams.publish(`agent:${agentId}`, {
    type: 'state:update',
    payload: state,
    timestamp: Date.now(),
  });
}

export function publishAgentStep(agentId: string, step: AgentStep) {
  streams.publish(`agent:${agentId}`, {
    type: 'agent:step',
    payload: step,
    timestamp: Date.now(),
  });
}
```

### Client (Subscriber)

```typescript
// lib/streams/client.ts
import { DurableStreamsClient } from '@durable-streams/client';
import { StateProtocol } from '@durable-streams/state';

const client = new DurableStreamsClient({ url: '/api/streams' });

// Subscribe to agent events
export function subscribeToAgent(
  agentId: string,
  callbacks: {
    onState: (state: AgentState) => void;
    onStep: (step: AgentStep) => void;
  }
) {
  return client.subscribe(`agent:${agentId}`, (event) => {
    if (event.type === 'state:update') {
      callbacks.onState(event.payload);
    } else if (event.type === 'agent:step') {
      callbacks.onStep(event.payload);
    }
  });
}
```

### React Hook

```typescript
// lib/streams/hooks.ts
import { useEffect, useState } from 'react';
import { subscribeToAgent } from './client';

export function useAgentStream(agentId: string) {
  const [state, setState] = useState<AgentState | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAgent(agentId, {
      onState: setState,
      onStep: (step) => setSteps((prev) => [...prev, step]),
    });
    return unsubscribe;
  }, [agentId]);

  return { state, steps };
}
```

### Tool Output Streaming (Claude SDK + Durable Streams)

Combine Claude Agent SDK hooks with Durable Streams for real-time tool visualization:

```typescript
// lib/agents/runner-with-tools.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { publishAgentStep } from '../streams/server';

export async function runAgentWithToolStreaming(agentId: string, task: string) {
  for await (const message of query({
    prompt: task,
    options: {
      includePartialMessages: true,
      hooks: {
        PreToolUse: [{
          hooks: [async (input) => {
            publishAgentStep(agentId, {
              type: 'tool:start',
              tool: input.tool_name,
              input: input.tool_input,
              timestamp: Date.now(),
            });
            return {};
          }]
        }],
        PostToolUse: [{
          hooks: [async (input) => {
            publishAgentStep(agentId, {
              type: 'tool:result',
              tool: input.tool_name,
              input: input.tool_input,
              output: input.tool_response,
              timestamp: Date.now(),
            });
            return {};
          }]
        }]
      }
    }
  })) {
    if (message.type === 'stream_event') {
      publishAgentStep(agentId, {
        type: 'stream:token',
        event: message.event,
        timestamp: Date.now(),
      });
    }
  }
}
```

```typescript
// lib/streams/hooks.ts - Extended for tool output
export function useAgentToolStream(agentId: string) {
  const [tools, setTools] = useState<ToolExecution[]>([]);
  const [streaming, setStreaming] = useState('');

  useEffect(() => {
    return subscribeToAgent(agentId, {
      onState: () => {},
      onStep: (step) => {
        switch (step.type) {
          case 'tool:start':
            setTools(prev => [...prev, {
              id: step.tool,
              status: 'running',
              input: step.input
            }]);
            break;
          case 'tool:result':
            setTools(prev => prev.map(t =>
              t.id === step.tool
                ? { ...t, status: 'complete', output: step.output }
                : t
            ));
            break;
          case 'stream:token':
            if (step.event?.delta?.text) {
              setStreaming(prev => prev + step.event.delta.text);
            }
            break;
        }
      }
    });
  }, [agentId]);

  return { tools, streaming };
}
```

---

## TanStack DB Client State

```typescript
// lib/state/collections.ts
import { createCollection } from '@tanstack/db';
import type { Agent, Task } from '../../db/schema';

export const agentsCollection = createCollection<Agent>({
  id: 'agents',
  primaryKey: 'id',
});

export const tasksCollection = createCollection<Task>({
  id: 'tasks',
  primaryKey: 'id',
});
```

### React Hooks

```typescript
// lib/state/hooks.ts
import { useQuery } from '@tanstack/react-db';
import { agentsCollection, tasksCollection } from './collections';

// Reactive queries with @tanstack/react-db
export function useAgents() {
  return useQuery(agentsCollection, (q) => q.orderBy('createdAt', 'desc'));
}

export function useAgent(id: string) {
  return useQuery(agentsCollection, (q) => q.where('id', '==', id).first());
}

export function useRunningAgents() {
  return useQuery(agentsCollection, (q) => q.where('status', '==', 'running'));
}

export function useAgentTasks(agentId: string) {
  return useQuery(tasksCollection, (q) => q.where('agentId', '==', agentId));
}
```

### Mutations

```typescript
// lib/state/mutations.ts
import { agentsCollection } from './collections';
import { db } from '../../db/client';
import { agents } from '../../db/schema';

// Write to both TanStack DB (UI) and PGlite (persistence)
export async function createAgent(input: NewAgent) {
  // Persist to PGlite
  const [agent] = await db.insert(agents).values(input).returning();

  // Update TanStack DB for instant UI
  agentsCollection.insert(agent);

  return agent;
}

export async function updateAgentStatus(id: string, status: AgentStatus) {
  await db.update(agents).set({ status }).where(eq(agents.id, id));
  agentsCollection.update(id, { status });
}
```

---

## Claude Agent SDK

The Claude Agent SDK uses a function-based API with `query()` as the main entry point.
See [official docs](https://platform.claude.com/docs/en/agent-sdk/typescript) for full reference.

### Running an Agent Query

```typescript
// lib/agents/task-agent.ts
import { query } from '@anthropic-ai/claude-agent-sdk';

// The SDK uses query() - an async generator that yields messages
export async function executeTask(task: string) {
  const messages: string[] = [];

  for await (const message of query({
    prompt: task,
    options: {
      allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
      model: 'claude-sonnet-4-20250514',
      maxTurns: 50,
    },
  })) {
    if ('result' in message) {
      messages.push(message.result);
    }
  }

  return messages;
}
```

### Custom Tool Definition

```typescript
// lib/agents/tools/file-read.ts
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// Use tool() function with (name, description, schema, handler) signature
export const fileReadTool = tool(
  'read_file',
  'Read contents of a file',
  z.object({
    path: z.string().describe('Path to the file'),
  }),
  async (args) => {
    const content = await Bun.file(args.path).text();
    // Return CallToolResult format
    return { content: [{ type: 'text', text: content }] };
  }
);
```

### Running Agents with Stream Publishing

```typescript
// lib/agents/runner.ts
import { query } from '@anthropic-ai/claude-agent-sdk';
import { publishAgentState, publishAgentStep } from '../streams/server';
import { db } from '../../db/client';
import { agents } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function runAgent(agentId: string, task: string) {
  // Update status in DB
  await db.update(agents).set({ status: 'running' }).where(eq(agents.id, agentId));

  // Publish real-time event via Durable Streams
  publishAgentState(agentId, { status: 'running' });

  try {
    const results: string[] = [];

    // Use query() async generator to stream agent progress
    for await (const message of query({
      prompt: task,
      options: {
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
        maxTurns: 50,
      },
    })) {
      // Stream each step in real-time
      publishAgentStep(agentId, { type: 'message', data: message });

      if ('result' in message) {
        results.push(message.result);
      }
    }

    await db.update(agents).set({ status: 'idle' }).where(eq(agents.id, agentId));
    publishAgentState(agentId, { status: 'completed', results });

    return results;
  } catch (error) {
    await db.update(agents).set({ status: 'error' }).where(eq(agents.id, agentId));
    publishAgentState(agentId, { status: 'error', error: String(error) });
    throw error;
  }
}
```

---

## UI Components (Radix + Tailwind)

### Component Structure (shadcn/ui style)

```typescript
// app/components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
```

---

## Drag & Drop (dnd-kit)

### Kanban Board

```typescript
// app/components/features/kanban-board.tsx
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export function KanbanBoard({ columns }: { columns: Column[] }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex gap-4">
        {columns.map((column) => (
          <Column key={column.id} column={column} />
        ))}
      </div>
      <DragOverlay>
        {activeId ? <TaskCard task={findTask(activeId)} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### Sortable List

```typescript
// app/components/features/sortable-list.tsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
```

---

## Testing

### Unit Tests (Vitest)

```typescript
// tests/unit/agents/task-agent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskAgent } from '@/lib/agents/task-agent';

describe('TaskAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute a simple task', async () => {
    const result = await taskAgent.run('List files in current directory');

    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('should respect max turns limit', async () => {
    const agent = taskAgent.withConfig({ maxTurns: 3 });

    await expect(agent.run('Infinite loop task')).rejects.toThrow('Max turns exceeded');
  });
});

// tests/unit/state/collections.test.ts
import { describe, it, expect } from 'vitest';
import { agentsCollection } from '@/lib/state/collections';

describe('agentsCollection', () => {
  it('should insert and query agents', async () => {
    agentsCollection.insert({
      id: 'test-1',
      name: 'Test Agent',
      type: 'task',
      status: 'idle',
    });

    const agents = agentsCollection.query((q) => q.where('type', '==', 'task'));
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('Test Agent');
  });
});
```

### E2E Tests (Agent Browser)

```typescript
// tests/e2e/agent-creation.test.ts
import { test, expect } from 'agent-browser';

test('create a new agent', async ({ page }) => {
  await page.goto('/agents');

  await page.click('button:has-text("New Agent")');
  await page.fill('input[name="name"]', 'Test Agent');
  await page.selectOption('select[name="type"]', 'task');
  await page.click('button:has-text("Create")');

  await expect(page.locator('.agent-card:has-text("Test Agent")')).toBeVisible();
});

test('run agent and see status updates', async ({ page }) => {
  await page.goto('/agents/test-agent-id');

  await page.click('button:has-text("Run")');

  // Status should update in real-time via Durable Streams
  await expect(page.locator('.status-badge')).toHaveText('running');
  await expect(page.locator('.step-list')).toBeVisible();
});
```

---

## Error Handling

### Result Type Pattern

```typescript
// lib/utils/result.ts
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Usage
export async function getAgent(id: string): Promise<Result<Agent, 'not_found' | 'db_error'>> {
  try {
    const agent = await db.query.agents.findFirst({ where: eq(agents.id, id) });
    if (!agent) return err('not_found');
    return ok(agent);
  } catch {
    return err('db_error');
  }
}
```

### Typed Exceptions (Boundaries)

```typescript
// lib/utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AgentError extends AppError {
  constructor(message: string, public readonly agentId: string) {
    super(message, 'AGENT_ERROR', 500);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}
```

---

## GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run typecheck

      - name: Lint & Format
        run: bun run check

      - name: Unit & Integration Tests
        run: bun run test:coverage

      - name: E2E Tests
        run: bun run test:e2e

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-report
          path: coverage/
```

---

## Naming Conventions

| Type             | Convention      | Example              |
| ---------------- | --------------- | -------------------- |
| Files            | kebab-case      | `task-agent.ts`      |
| Classes          | PascalCase      | `TaskAgent`          |
| Functions        | camelCase       | `runAgent`           |
| Constants        | SCREAMING_SNAKE | `MAX_AGENT_TURNS`    |
| Types/Interfaces | PascalCase      | `AgentConfig`        |
| Enums            | PascalCase      | `AgentStatus`        |
| DB Tables        | snake_case      | `agent_sessions`     |
| Routes           | kebab-case      | `/agents/$id`        |

---

## Git Worktrees (Parallel Agents)

Use git worktrees to run multiple agents simultaneously on different features without conflicts.

### Directory Structure

```text
project/
├── .git/                    # Shared git directory
├── main/                    # Main worktree
└── .worktrees/              # Agent worktrees
    ├── feature-auth/        # Agent 1
    └── feature-dashboard/   # Agent 2
```

### Commands

```bash
# Create worktree for a feature branch
git worktree add .worktrees/feature-x -b feature-x

# List active worktrees
git worktree list

# Remove worktree after merge
git worktree remove .worktrees/feature-x

# Cleanup stale worktrees
git worktree prune
```

### Agent Integration

```typescript
// lib/worktrees/manager.ts
import { $ } from 'bun';

export async function createWorktree(branch: string): Promise<string> {
  const path = `.worktrees/${branch}`;
  await $`git worktree add ${path} -b ${branch}`;
  await $`cp .env ${path}/.env`;
  await $`cd ${path} && bun install`;
  return path;
}

export async function removeWorktree(branch: string) {
  await $`git worktree remove .worktrees/${branch} --force`;
}
```

When spawning an agent, set `cwd` to the worktree path so all file operations are isolated.

---

## Quick Commands

```bash
# Development
bun run dev          # Start development server
bun run build        # Build for production
bun run typecheck    # Check types

# Quality
bun run check        # Biome lint + format check
bun run check:fix    # Biome lint + format fix

# Testing
bun run test         # Run unit tests
bun run test:watch   # Watch mode
bun run test:coverage # With coverage
bun run test:e2e     # Agent Browser E2E tests

# Database
bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:studio    # Open Drizzle Studio
```
