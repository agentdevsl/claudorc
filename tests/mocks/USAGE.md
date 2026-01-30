# Agent Lifecycle Mock Builders - Usage Guide

This guide demonstrates how to use the agent lifecycle mock builders for testing.

## Quick Start

```typescript
import {
  createMockAgentLifecycleScenario,
  createMockStartAgentInput,
  createMockRunningAgent,
} from '../mocks';

// Create a complete scenario with all entities cross-referenced
const scenario = createMockAgentLifecycleScenario('planning');
// scenario.project, scenario.agent, scenario.task, scenario.session, scenario.worktree
```

## Available Mock Builders

### Individual Entity Builders

#### 1. `createMockStartAgentInput(overrides?)`

Creates input data for starting an agent.

```typescript
const input = createMockStartAgentInput({
  prompt: 'Add unit tests for authentication',
  phase: 'plan',
  maxTurns: 100,
});
// { projectId, taskId, sessionId, prompt, model, maxTurns, phase }
```

#### 2. `createMockRunningAgent(overrides?)`

Creates an in-memory running agent instance.

```typescript
const agent = createMockRunningAgent({
  phase: 'execute',
  worktreeId: 'wt-123',
});
// Includes mock bridge.processLine() and execResult.kill()
```

#### 3. `createMockPendingPlan(overrides?)`

Creates plan data awaiting approval.

```typescript
const plan = createMockPendingPlan({
  plan: '# Custom plan\n\n1. Step one\n2. Step two',
  turnCount: 10,
});
```

#### 4. `createMockAgentConfig(overrides?)`

Creates agent configuration.

```typescript
const config = createMockAgentConfig({
  allowedTools: ['Read', 'Write', 'Bash'],
  maxTurns: 75,
});
```

#### 5. `createMockProject(overrides?)`

Creates a project record.

```typescript
const project = createMockProject({
  name: 'My Project',
  path: '/path/to/project',
  config: createMockProjectConfig(),
});
```

#### 6. `createMockTask(overrides?)`

Creates a task record.

```typescript
const task = createMockTask({
  title: 'Fix bug',
  column: 'in_progress',
  agentId: 'agent-123',
});
```

#### 7. `createMockAgent(overrides?)`

Creates an agent record.

```typescript
const agent = createMockAgent({
  status: 'planning',
  currentTaskId: 'task-123',
});
```

#### 8. `createMockSession(overrides?)`

Creates a session record.

```typescript
const session = createMockSession({
  status: 'active',
  taskId: 'task-123',
});
```

#### 9. `createMockWorktreeRecord(overrides?)`

Creates a worktree database record.

```typescript
const worktree = createMockWorktreeRecord({
  branch: 'agent/task/fix-auth',
  status: 'active',
});
```

## Scenario Builders

### `createMockAgentLifecycleScenario(scenario)`

Creates a complete set of interconnected mocks for common test scenarios.

All IDs are automatically cross-referenced between entities.

#### Scenario: 'idle'

Project + idle agent + backlog task.

```typescript
const { project, agent, task } = createMockAgentLifecycleScenario('idle');

// agent.status === 'idle'
// task.column === 'backlog'
// task.agentId === null
```

#### Scenario: 'planning'

Project + planning agent + in_progress task + active session + active worktree.

```typescript
const { project, agent, task, session, worktree } =
  createMockAgentLifecycleScenario('planning');

// agent.status === 'planning'
// task.column === 'in_progress'
// session.status === 'active'
// worktree.status === 'active'
// All IDs are linked: task.agentId === agent.id
```

#### Scenario: 'executing'

Project + running agent + in_progress task + active session + active worktree + plan.

```typescript
const { project, agent, task, session, worktree, plan } =
  createMockAgentLifecycleScenario('executing');

// agent.status === 'running'
// task.plan !== null
// task.lastAgentStatus === 'planning'
// plan.sdkSessionId !== null
```

#### Scenario: 'waiting_approval'

Project + idle agent + waiting_approval task + closed session + active worktree + plan + diff.

```typescript
const { project, agent, task, session, worktree, plan, diff } =
  createMockAgentLifecycleScenario('waiting_approval');

// task.column === 'waiting_approval'
// task.completedAt !== null
// session.status === 'closed'
// diff.files.length > 0
```

#### Scenario: 'completed'

Project + completed agent + verified task + closed session + merged worktree.

```typescript
const { project, agent, task, session, worktree } =
  createMockAgentLifecycleScenario('completed');

// task.column === 'verified'
// task.approvedAt !== null
// worktree.status === 'merged'
// agent.status === 'completed'
```

## Testing Examples

### Example 1: Test Agent Start Flow

```typescript
import { describe, expect, it } from 'vitest';
import { createMockAgentLifecycleScenario } from '../mocks';

describe('ContainerAgentService', () => {
  it('starts agent for idle task', async () => {
    const { project, task } = createMockAgentLifecycleScenario('idle');

    const service = new ContainerAgentService(db, provider, streams, apiKeys);

    const result = await service.startAgent({
      projectId: project.id,
      taskId: task.id,
      sessionId: createId(),
      prompt: task.title,
      phase: 'plan',
    });

    expect(result.ok).toBe(true);
  });
});
```

### Example 2: Test Plan Approval

```typescript
import { describe, expect, it } from 'vitest';
import { createMockAgentLifecycleScenario } from '../mocks';

describe('Plan Approval', () => {
  it('approves plan and starts execution', async () => {
    const { task, plan } = createMockAgentLifecycleScenario('waiting_approval');

    const service = new ContainerAgentService(db, provider, streams, apiKeys);

    // Simulate plan approval
    const result = await service.approvePlan(task.id);

    expect(result.ok).toBe(true);
    // Agent should now be executing with the plan's SDK session
  });
});
```

### Example 3: Test Full Lifecycle

```typescript
import { describe, expect, it } from 'vitest';
import {
  createMockAgentLifecycleScenario,
  createMockStartAgentInput,
} from '../mocks';

describe('Agent Lifecycle', () => {
  it('completes full task lifecycle', async () => {
    // Start: idle
    const idle = createMockAgentLifecycleScenario('idle');
    expect(idle.task.column).toBe('backlog');

    // Move to in_progress (triggers agent start)
    const planning = createMockAgentLifecycleScenario('planning');
    expect(planning.agent.status).toBe('planning');
    expect(planning.session).toBeDefined();

    // Plan ready (waiting for approval)
    const waiting = createMockAgentLifecycleScenario('waiting_approval');
    expect(waiting.task.column).toBe('waiting_approval');
    expect(waiting.plan).toBeDefined();

    // Execution complete
    const executing = createMockAgentLifecycleScenario('executing');
    expect(executing.agent.status).toBe('running');

    // Final: verified
    const completed = createMockAgentLifecycleScenario('completed');
    expect(completed.task.column).toBe('verified');
    expect(completed.worktree?.status).toBe('merged');
  });
});
```

## Type Safety

All mock builders return fully-typed objects matching the database schema:

```typescript
import type {
  Agent,
  Project,
  Task,
  Session,
  Worktree,
} from '../../src/db/schema';

const project: Project = createMockProject();
const task: Task = createMockTask();
const agent: Agent = createMockAgent();
```

## Best Practices

1. **Use scenario builders for integration tests**
   - Scenarios provide complete, interconnected data
   - All IDs are automatically cross-referenced

2. **Use individual builders for unit tests**
   - Fine-grained control over specific fields
   - Minimal setup for focused tests

3. **Override only what you need**
   - All builders accept partial overrides
   - Defaults are sensible for most cases

4. **Test state transitions**
   - Use different scenarios to test lifecycle phases
   - Verify data consistency across transitions
