# AgentPane Security Model Specification

## Overview

The AgentPane Security Model defines the security controls, isolation boundaries, and audit requirements for the multi-agent task management system. As a single-user local application, AgentPane focuses on protecting against agent misbehavior, enforcing execution boundaries, and maintaining comprehensive audit trails rather than traditional multi-tenant authentication concerns.

**Design Philosophy**: Defense in depth through tool whitelisting, filesystem isolation via git worktrees, and comprehensive audit logging. The security model assumes agents are untrusted code executors that must be constrained to their designated workspaces.

---

## Security Principles

### 1. Least Privilege

Agents operate with the minimum set of tools and permissions required for their specific task. Tool access is explicitly whitelisted rather than blacklisted.

### 2. Isolation by Default

Each agent execution occurs in an isolated git worktree with no access to the parent repository's working directory or other agents' worktrees.

### 3. Explicit Trust Boundaries

All cross-boundary operations (worktree merge, tool execution, webhook processing) require explicit validation and are logged for audit.

### 4. Fail-Secure

Security control failures result in denied access rather than degraded security. Missing whitelist configurations default to restrictive settings.

### 5. Auditability

All security-relevant events are logged with sufficient detail for forensic analysis and compliance verification.

---

## Interface Definition

```typescript
// lib/security/types.ts
import type { Result } from '@/lib/utils/result';

// Result type pattern used throughout
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// Tool whitelist configuration
export interface ToolWhitelistConfig {
  projectId: string;
  allowedTools: ToolName[];
  updatedAt: Date;
  updatedBy: 'user' | 'config_sync';
}

export type ToolName =
  | 'Read'
  | 'Edit'
  | 'Write'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'WebFetch'
  | 'TodoWrite'
  | 'NotebookEdit';

export const DEFAULT_ALLOWED_TOOLS: ToolName[] = [
  'Read',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
];

// Bash command sandboxing
export interface BashSandboxConfig {
  worktreePath: string;
  allowedPaths: string[];
  blockedPatterns: string[];
  environmentVariables: Record<string, string>;
  maxExecutionTimeMs: number;
}

export interface BashExecutionContext {
  agentId: string;
  taskId: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
}

// Git worktree isolation
export interface WorktreeSecurityContext {
  worktreeId: string;
  worktreePath: string;
  baseBranch: string;
  agentBranch: string;
  allowedOperations: GitOperation[];
}

export type GitOperation =
  | 'read'
  | 'write'
  | 'commit'
  | 'branch_local'
  | 'diff'
  | 'status';

// Webhook verification
export interface WebhookVerificationResult {
  valid: boolean;
  timestamp: Date;
  deliveryId: string;
  event: string;
  error?: string;
}

// Session security
export interface SessionSecurityContext {
  sessionId: string;
  projectId: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

// Audit events
export interface AuditEvent {
  id: string;
  timestamp: Date;
  agentId: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
}

export type AuditEventType =
  | 'tool_call'
  | 'tool_denied'
  | 'approval'
  | 'rejection'
  | 'worktree_created'
  | 'worktree_merged'
  | 'worktree_removed'
  | 'webhook_received'
  | 'webhook_rejected'
  | 'error';

// Security service interface
export interface ISecurityService {
  // Tool whitelist
  validateToolAccess(agentId: string, tool: ToolName): Promise<Result<boolean, SecurityError>>;
  getToolWhitelist(projectId: string): Promise<Result<ToolName[], SecurityError>>;
  updateToolWhitelist(projectId: string, tools: ToolName[]): Promise<Result<void, SecurityError>>;

  // Bash sandboxing
  validateBashCommand(context: BashExecutionContext): Promise<Result<boolean, SecurityError>>;
  createSandboxedEnv(worktreePath: string): Promise<Result<Record<string, string>, SecurityError>>;

  // Worktree isolation
  validateWorktreeAccess(agentId: string, path: string): Promise<Result<boolean, SecurityError>>;
  getWorktreeSecurityContext(worktreeId: string): Promise<Result<WorktreeSecurityContext, SecurityError>>;

  // Webhook verification
  verifyWebhookSignature(payload: string, signature: string): Promise<Result<WebhookVerificationResult, SecurityError>>;

  // Audit logging
  logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<Result<AuditEvent, SecurityError>>;
  getAuditLog(agentId: string, options?: AuditQueryOptions): Promise<Result<AuditEvent[], SecurityError>>;
}

export interface AuditQueryOptions {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  limit?: number;
  offset?: number;
}
```

---

## Security Controls

### 1. Tool Whitelist Enforcement

Controls which tools an agent can invoke during execution.

#### Default Configuration

```typescript
// lib/security/tool-whitelist.ts
export const DEFAULT_ALLOWED_TOOLS: ToolName[] = [
  'Read',   // File reading - low risk
  'Edit',   // File editing - medium risk, contained to worktree
  'Bash',   // Command execution - high risk, requires sandboxing
  'Glob',   // File pattern matching - low risk
  'Grep',   // Content search - low risk
];

export const ALL_TOOLS: ToolName[] = [
  'Read',
  'Edit',
  'Write',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'TodoWrite',
  'NotebookEdit',
];

export const HIGH_RISK_TOOLS: ToolName[] = [
  'Bash',      // Arbitrary command execution
  'Write',     // Direct file creation
  'WebFetch',  // Network access
];
```

#### Validation Logic

```typescript
// lib/security/tool-whitelist.ts
import { db } from '@/db/client';
import { projects, agents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ok, err, type Result } from '@/lib/utils/result';
import { SecurityErrors } from '@/lib/errors/security-errors';

export async function validateToolAccess(
  agentId: string,
  tool: ToolName
): Promise<Result<boolean, SecurityError>> {
  // 1. Get agent configuration
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    with: { project: true },
  });

  if (!agent) {
    return err(SecurityErrors.AGENT_NOT_FOUND(agentId));
  }

  // 2. Get effective tool whitelist (agent config overrides project config)
  const allowedTools = agent.config.allowedTools ?? agent.project.config.allowedTools ?? DEFAULT_ALLOWED_TOOLS;

  // 3. Check if tool is in whitelist
  if (!allowedTools.includes(tool)) {
    // Log denied access attempt
    await logAuditEvent({
      agentId,
      eventType: 'tool_denied',
      payload: {
        tool,
        allowedTools,
        reason: 'Tool not in whitelist',
      },
    });

    return ok(false);
  }

  return ok(true);
}

export async function getToolWhitelist(
  projectId: string
): Promise<Result<ToolName[], SecurityError>> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return err(SecurityErrors.PROJECT_NOT_FOUND(projectId));
  }

  return ok(project.config.allowedTools ?? DEFAULT_ALLOWED_TOOLS);
}

export async function updateToolWhitelist(
  projectId: string,
  tools: ToolName[]
): Promise<Result<void, SecurityError>> {
  // Validate all tools are known
  const invalidTools = tools.filter(t => !ALL_TOOLS.includes(t));
  if (invalidTools.length > 0) {
    return err(SecurityErrors.INVALID_TOOL(invalidTools.join(', ')));
  }

  // Update project configuration
  await db.update(projects)
    .set({
      config: sql`jsonb_set(config, '{allowedTools}', ${JSON.stringify(tools)}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  // Log configuration change
  await logAuditEvent({
    agentId: 'system',
    eventType: 'tool_call',
    payload: {
      action: 'whitelist_updated',
      projectId,
      tools,
    },
  });

  return ok(undefined);
}
```

#### Pre-Tool-Use Hook Integration

```typescript
// lib/security/hooks.ts
import type { PreToolUseHook } from '@anthropic-ai/claude-agent-sdk';
import { validateToolAccess } from './tool-whitelist';
import { validateBashCommand } from './bash-sandbox';

export function createSecurityHook(agentId: string): PreToolUseHook {
  return async (input) => {
    // 1. Validate tool whitelist
    const toolResult = await validateToolAccess(agentId, input.tool_name as ToolName);
    if (!toolResult.ok || !toolResult.value) {
      return {
        deny: true,
        reason: `Tool "${input.tool_name}" is not allowed for this agent`,
      };
    }

    // 2. Additional validation for Bash commands
    if (input.tool_name === 'Bash') {
      const bashResult = await validateBashCommand({
        agentId,
        taskId: '', // Retrieved from context
        command: input.tool_input.command as string,
        cwd: input.tool_input.cwd as string,
        env: {},
      });

      if (!bashResult.ok || !bashResult.value) {
        return {
          deny: true,
          reason: 'Bash command violates security policy',
        };
      }
    }

    return {};
  };
}
```

---

### 2. Bash Command Sandboxing

Constrains bash command execution to the agent's worktree directory.

#### Sandbox Configuration

```typescript
// lib/security/bash-sandbox.ts
import { $ } from 'bun';
import path from 'path';
import { ok, err, type Result } from '@/lib/utils/result';
import { SecurityErrors } from '@/lib/errors/security-errors';

// Patterns that are always blocked
const BLOCKED_COMMAND_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+[\/~]/,       // Recursive delete outside worktree
  /sudo\s+/,                                 // Privilege escalation
  /chmod\s+[0-7]*[0-7][0-7][0-7]\s+\//,     // System-wide permission changes
  /chown\s+/,                                // Ownership changes
  />\s*\/etc\//,                             // Writing to system directories
  /curl.*\|\s*(ba)?sh/,                      // Pipe to shell
  /wget.*\|\s*(ba)?sh/,                      // Pipe to shell
  /eval\s+/,                                 // Eval commands
  /\.\.\/\.\.\//,                            // Parent directory traversal (multiple levels)
];

// Environment variables that are never passed to sandboxed commands
const BLOCKED_ENV_VARS = [
  'GITHUB_TOKEN',
  'ANTHROPIC_API_KEY',
  'AWS_SECRET_ACCESS_KEY',
  'DATABASE_URL',
  'PRIVATE_KEY',
];

export interface SandboxValidationResult {
  allowed: boolean;
  reason?: string;
  sanitizedCommand?: string;
}

export async function validateBashCommand(
  context: BashExecutionContext
): Promise<Result<boolean, SecurityError>> {
  const { agentId, command, cwd } = context;

  // 1. Check for blocked patterns
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      await logAuditEvent({
        agentId,
        eventType: 'tool_denied',
        payload: {
          tool: 'Bash',
          command,
          reason: 'Command matches blocked pattern',
          pattern: pattern.toString(),
        },
      });
      return ok(false);
    }
  }

  // 2. Validate cwd is within worktree
  const worktreeResult = await getAgentWorktreePath(agentId);
  if (!worktreeResult.ok) {
    return err(worktreeResult.error);
  }

  const normalizedCwd = path.resolve(cwd);
  const normalizedWorktree = path.resolve(worktreeResult.value);

  if (!normalizedCwd.startsWith(normalizedWorktree)) {
    await logAuditEvent({
      agentId,
      eventType: 'tool_denied',
      payload: {
        tool: 'Bash',
        command,
        cwd,
        worktreePath: worktreeResult.value,
        reason: 'Command cwd outside worktree boundary',
      },
    });
    return ok(false);
  }

  // 3. Check for path traversal in command arguments
  if (containsPathTraversal(command, normalizedWorktree)) {
    await logAuditEvent({
      agentId,
      eventType: 'tool_denied',
      payload: {
        tool: 'Bash',
        command,
        reason: 'Command contains path traversal outside worktree',
      },
    });
    return ok(false);
  }

  return ok(true);
}

function containsPathTraversal(command: string, worktreePath: string): boolean {
  // Extract potential file paths from command
  const pathPatterns = [
    /(?:^|\s)(\/[^\s]+)/g,           // Absolute paths
    /(?:^|\s)(\.\.\/[^\s]+)/g,       // Relative parent paths
    /(?:^|\s)(~\/[^\s]+)/g,          // Home directory paths
  ];

  for (const pattern of pathPatterns) {
    const matches = command.matchAll(pattern);
    for (const match of matches) {
      const extractedPath = match[1];
      const resolvedPath = path.resolve(extractedPath);

      // Check if resolved path is outside worktree
      if (!resolvedPath.startsWith(worktreePath) &&
          !resolvedPath.startsWith('/tmp') &&
          !resolvedPath.startsWith('/dev/null')) {
        return true;
      }
    }
  }

  return false;
}

export async function createSandboxedEnv(
  worktreePath: string,
  projectEnv: Record<string, string> = {}
): Promise<Result<Record<string, string>, SecurityError>> {
  // Start with minimal safe environment
  const safeEnv: Record<string, string> = {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: worktreePath,
    TMPDIR: `${worktreePath}/.tmp`,
    LANG: 'en_US.UTF-8',
    TERM: 'xterm-256color',
  };

  // Add project-specific env vars, filtering blocked ones
  for (const [key, value] of Object.entries(projectEnv)) {
    if (!BLOCKED_ENV_VARS.some(blocked => key.toUpperCase().includes(blocked))) {
      safeEnv[key] = value;
    }
  }

  // Ensure temp directory exists
  await $`mkdir -p ${worktreePath}/.tmp`.quiet();

  return ok(safeEnv);
}
```

---

### 3. Git Worktree Isolation

Ensures each agent operates in an isolated filesystem context.

#### Isolation Architecture

```text
project/
├── .git/                              # Shared git database (read-only to agents)
├── main/                              # Main worktree (protected)
└── .worktrees/
    ├── feature-{task-1}-auth/         # Agent 1 worktree (isolated)
    │   ├── .git -> ../../.git         # Symlink to shared git
    │   ├── .env                        # Copied, isolated env
    │   └── [project files]
    └── feature-{task-2}-api/          # Agent 2 worktree (isolated)
        ├── .git -> ../../.git
        ├── .env
        └── [project files]
```

#### Access Control

```typescript
// lib/security/worktree-isolation.ts
import { db } from '@/db/client';
import { agents, worktrees } from '@/db/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import { ok, err, type Result } from '@/lib/utils/result';
import { SecurityErrors } from '@/lib/errors/security-errors';

export async function validateWorktreeAccess(
  agentId: string,
  targetPath: string
): Promise<Result<boolean, SecurityError>> {
  // 1. Get agent's assigned worktree
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent || !agent.currentWorktreeId) {
    return err(SecurityErrors.AGENT_NO_WORKTREE(agentId));
  }

  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, agent.currentWorktreeId),
  });

  if (!worktree) {
    return err(SecurityErrors.WORKTREE_NOT_FOUND(agent.currentWorktreeId));
  }

  // 2. Normalize paths
  const normalizedTarget = path.resolve(targetPath);
  const normalizedWorktree = path.resolve(worktree.path);

  // 3. Validate target is within worktree
  if (!normalizedTarget.startsWith(normalizedWorktree)) {
    await logAuditEvent({
      agentId,
      eventType: 'tool_denied',
      payload: {
        targetPath,
        worktreePath: worktree.path,
        reason: 'Access denied: path outside worktree boundary',
      },
    });
    return ok(false);
  }

  // 4. Block access to .git directory (prevent git manipulation)
  if (normalizedTarget.includes('/.git/') || normalizedTarget.endsWith('/.git')) {
    await logAuditEvent({
      agentId,
      eventType: 'tool_denied',
      payload: {
        targetPath,
        reason: 'Access denied: .git directory is protected',
      },
    });
    return ok(false);
  }

  return ok(true);
}

export function getWorktreeSecurityContext(
  worktreeId: string
): Promise<Result<WorktreeSecurityContext, SecurityError>> {
  return db.query.worktrees.findFirst({
    where: eq(worktrees.id, worktreeId),
  }).then(worktree => {
    if (!worktree) {
      return err(SecurityErrors.WORKTREE_NOT_FOUND(worktreeId));
    }

    return ok({
      worktreeId: worktree.id,
      worktreePath: worktree.path,
      baseBranch: worktree.baseBranch,
      agentBranch: worktree.branch,
      allowedOperations: ['read', 'write', 'commit', 'branch_local', 'diff', 'status'],
    });
  });
}

// Blocked git operations for agents
const BLOCKED_GIT_OPERATIONS = [
  'push',           // No direct push to remote
  'pull',           // No direct pull from remote
  'fetch',          // No fetch from remote
  'merge',          // No direct merge (handled by approval flow)
  'rebase',         // No rebase
  'reset --hard',   // No hard reset
  'checkout main',  // No checkout to main
  'checkout master', // No checkout to master
];

export function validateGitCommand(command: string): boolean {
  const normalizedCommand = command.toLowerCase().trim();

  for (const blocked of BLOCKED_GIT_OPERATIONS) {
    if (normalizedCommand.includes(blocked)) {
      return false;
    }
  }

  return true;
}
```

---

### 4. GitHub Webhook Signature Verification

Validates incoming webhooks from GitHub to prevent spoofing.

#### Verification Implementation

```typescript
// lib/security/webhook-verification.ts
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/db/client';
import { webhookDeliveries } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ok, err, type Result } from '@/lib/utils/result';
import { SecurityErrors } from '@/lib/errors/security-errors';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET!;
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp?: string,
  deliveryId?: string
): Promise<Result<WebhookVerificationResult, SecurityError>> {
  // 1. Validate signature format
  if (!signature || !signature.startsWith('sha256=')) {
    return err(SecurityErrors.WEBHOOK_INVALID_SIGNATURE('Missing or malformed signature'));
  }

  // 2. Compute expected signature using HMAC-SHA256
  const expectedSignature = `sha256=${createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')}`;

  // 3. Timing-safe comparison
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (actualBuffer.length !== expectedBuffer.length) {
    await logWebhookRejection(deliveryId, 'Signature length mismatch');
    return err(SecurityErrors.WEBHOOK_INVALID_SIGNATURE('Signature verification failed'));
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    await logWebhookRejection(deliveryId, 'Signature mismatch');
    return err(SecurityErrors.WEBHOOK_INVALID_SIGNATURE('Signature verification failed'));
  }

  // 4. Validate timestamp if provided (replay attack prevention)
  if (timestamp) {
    const webhookTime = new Date(timestamp).getTime();
    const now = Date.now();

    if (Math.abs(now - webhookTime) > TIMESTAMP_TOLERANCE_MS) {
      await logWebhookRejection(deliveryId, 'Timestamp outside tolerance window');
      return err(SecurityErrors.WEBHOOK_TIMESTAMP_EXPIRED(timestamp));
    }
  }

  // 5. Check for replay attack (duplicate delivery ID)
  if (deliveryId) {
    const existing = await db.query.webhookDeliveries.findFirst({
      where: eq(webhookDeliveries.deliveryId, deliveryId),
    });

    if (existing) {
      await logWebhookRejection(deliveryId, 'Duplicate delivery ID (replay attack)');
      return err(SecurityErrors.WEBHOOK_REPLAY_DETECTED(deliveryId));
    }

    // Record delivery to prevent replay
    await db.insert(webhookDeliveries).values({
      deliveryId,
      receivedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour retention
    });
  }

  // 6. Parse and extract event type
  const parsedPayload = JSON.parse(payload);

  return ok({
    valid: true,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    deliveryId: deliveryId ?? 'unknown',
    event: parsedPayload.action ?? 'unknown',
  });
}

async function logWebhookRejection(deliveryId: string | undefined, reason: string): Promise<void> {
  await logAuditEvent({
    agentId: 'system',
    eventType: 'webhook_rejected',
    payload: {
      deliveryId,
      reason,
      timestamp: new Date().toISOString(),
    },
  });
}
```

---

### 5. Session Security

Manages session isolation for the single-user local application.

#### Session Model

```typescript
// lib/security/session.ts
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { ok, err, type Result } from '@/lib/utils/result';
import { SecurityErrors } from '@/lib/errors/security-errors';

// Session addressing: URL-based (no authentication required)
// Format: /project/{projectId}/session/{sessionId}

export interface SessionInfo {
  id: string;
  projectId: string;
  createdAt: Date;
  lastAccessedAt: Date;
  agentIds: string[];
}

export async function createSession(
  projectId: string
): Promise<Result<SessionInfo, SecurityError>> {
  const sessionId = createId();

  const [session] = await db.insert(sessions).values({
    id: sessionId,
    projectId,
    createdAt: new Date(),
    lastAccessedAt: new Date(),
  }).returning();

  return ok({
    id: session.id,
    projectId: session.projectId,
    createdAt: session.createdAt,
    lastAccessedAt: session.lastAccessedAt,
    agentIds: [],
  });
}

export async function validateSessionAccess(
  sessionId: string,
  projectId: string
): Promise<Result<boolean, SecurityError>> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    return err(SecurityErrors.SESSION_NOT_FOUND(sessionId));
  }

  // Validate session belongs to requested project
  if (session.projectId !== projectId) {
    await logAuditEvent({
      agentId: 'system',
      eventType: 'error',
      payload: {
        type: 'session_project_mismatch',
        sessionId,
        requestedProjectId: projectId,
        actualProjectId: session.projectId,
      },
    });
    return ok(false);
  }

  // Update last accessed time
  await db.update(sessions)
    .set({ lastAccessedAt: new Date() })
    .where(eq(sessions.id, sessionId));

  return ok(true);
}

// Session data isolation: each project has independent session data
export async function getSessionData(
  sessionId: string
): Promise<Result<Record<string, unknown>, SecurityError>> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    with: {
      project: true,
      agents: true,
    },
  });

  if (!session) {
    return err(SecurityErrors.SESSION_NOT_FOUND(sessionId));
  }

  return ok({
    projectId: session.projectId,
    projectName: session.project.name,
    projectPath: session.project.path,
    activeAgents: session.agents.filter(a => a.status === 'running').map(a => a.id),
  });
}
```

---

## Audit Requirements

### Audit Log Schema

```typescript
// lib/security/audit.ts
import { db } from '@/db/client';
import { auditLogs } from '@/db/schema';
import { eq, and, gte, lte, inArray, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { ok, err, type Result } from '@/lib/utils/result';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  agentId: string;
  agentRunId?: string;
  taskId?: string;
  projectId: string;
  eventType: AuditEventType;
  tool?: string;
  status: 'success' | 'denied' | 'error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  turnNumber?: number;
  durationMs?: number;
}

export async function logAuditEvent(
  event: Omit<AuditEvent, 'id' | 'timestamp'>
): Promise<Result<AuditEvent, SecurityError>> {
  const auditEvent: AuditEvent = {
    id: createId(),
    timestamp: new Date(),
    ...event,
  };

  await db.insert(auditLogs).values({
    id: auditEvent.id,
    agentId: auditEvent.agentId,
    eventType: auditEvent.eventType,
    payload: auditEvent.payload,
    createdAt: auditEvent.timestamp,
  });

  return ok(auditEvent);
}

export async function getAuditLog(
  agentId: string,
  options: AuditQueryOptions = {}
): Promise<Result<AuditEvent[], SecurityError>> {
  const { startDate, endDate, eventTypes, limit = 100, offset = 0 } = options;

  const conditions = [eq(auditLogs.agentId, agentId)];

  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  if (eventTypes && eventTypes.length > 0) {
    conditions.push(inArray(auditLogs.eventType, eventTypes));
  }

  const logs = await db.query.auditLogs.findMany({
    where: and(...conditions),
    orderBy: [desc(auditLogs.createdAt)],
    limit,
    offset,
  });

  return ok(logs.map(log => ({
    id: log.id,
    timestamp: log.createdAt,
    agentId: log.agentId,
    eventType: log.eventType as AuditEventType,
    payload: log.payload as Record<string, unknown>,
  })));
}
```

### Required Audit Events

| Event Type | When Logged | Required Fields |
|------------|-------------|-----------------|
| `tool_call` | Before every tool execution | `agentId`, `tool`, `input` |
| `tool_denied` | Tool access blocked | `agentId`, `tool`, `reason`, `allowedTools` |
| `approval` | Task changes approved | `taskId`, `agentId`, `diff` |
| `rejection` | Task changes rejected | `taskId`, `agentId`, `reason` |
| `worktree_created` | New worktree provisioned | `worktreeId`, `agentId`, `branch` |
| `worktree_merged` | Worktree merged to base | `worktreeId`, `agentId`, `branch` |
| `worktree_removed` | Worktree cleaned up | `worktreeId`, `reason` |
| `webhook_received` | GitHub webhook processed | `deliveryId`, `event`, `repository` |
| `webhook_rejected` | Webhook verification failed | `deliveryId`, `reason` |
| `error` | Security-relevant error | `type`, `message`, `context` |

### Retention Policy

```typescript
// lib/security/audit-retention.ts

export const AUDIT_RETENTION_CONFIG = {
  // Local storage limits
  maxEntriesPerProject: 10000,
  maxStorageMb: 100,

  // Time-based retention
  retentionDays: 90,

  // Cleanup schedule
  cleanupIntervalHours: 24,
};

export async function cleanupOldAuditLogs(projectId: string): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - AUDIT_RETENTION_CONFIG.retentionDays);

  // Delete logs older than retention period
  await db.delete(auditLogs)
    .where(and(
      eq(auditLogs.projectId, projectId),
      lte(auditLogs.createdAt, cutoffDate)
    ));

  // Check entry count and delete oldest if over limit
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(eq(auditLogs.projectId, projectId));

  if (count[0]?.count > AUDIT_RETENTION_CONFIG.maxEntriesPerProject) {
    const toDelete = count[0].count - AUDIT_RETENTION_CONFIG.maxEntriesPerProject;

    await db.execute(sql`
      DELETE FROM audit_logs
      WHERE id IN (
        SELECT id FROM audit_logs
        WHERE project_id = ${projectId}
        ORDER BY created_at ASC
        LIMIT ${toDelete}
      )
    `);
  }
}
```

---

## Security Error Definitions

```typescript
// lib/errors/security-errors.ts
import { createError, type AppError } from './base';

export const SecurityErrors = {
  // Tool whitelist errors
  TOOL_NOT_ALLOWED: (tool: string, allowed: string[]) => createError(
    'SECURITY_TOOL_NOT_ALLOWED',
    `Tool "${tool}" is not in the allowed whitelist`,
    403,
    { tool, allowedTools: allowed }
  ),
  INVALID_TOOL: (tool: string) => createError(
    'SECURITY_INVALID_TOOL',
    `Unknown tool: "${tool}"`,
    400,
    { tool }
  ),

  // Bash sandbox errors
  COMMAND_BLOCKED: (command: string, reason: string) => createError(
    'SECURITY_COMMAND_BLOCKED',
    'Command blocked by security policy',
    403,
    { command, reason }
  ),
  PATH_TRAVERSAL: (path: string) => createError(
    'SECURITY_PATH_TRAVERSAL',
    'Path traversal detected outside allowed boundary',
    403,
    { path }
  ),

  // Worktree isolation errors
  AGENT_NO_WORKTREE: (agentId: string) => createError(
    'SECURITY_AGENT_NO_WORKTREE',
    'Agent does not have an assigned worktree',
    400,
    { agentId }
  ),
  WORKTREE_NOT_FOUND: (worktreeId: string) => createError(
    'SECURITY_WORKTREE_NOT_FOUND',
    'Worktree not found',
    404,
    { worktreeId }
  ),
  WORKTREE_ACCESS_DENIED: (path: string) => createError(
    'SECURITY_WORKTREE_ACCESS_DENIED',
    'Access denied: path outside worktree boundary',
    403,
    { path }
  ),

  // Webhook errors
  WEBHOOK_INVALID_SIGNATURE: (reason: string) => createError(
    'SECURITY_WEBHOOK_INVALID_SIGNATURE',
    'Invalid webhook signature',
    401,
    { reason }
  ),
  WEBHOOK_TIMESTAMP_EXPIRED: (timestamp: string) => createError(
    'SECURITY_WEBHOOK_TIMESTAMP_EXPIRED',
    'Webhook timestamp outside acceptable window',
    401,
    { timestamp, toleranceMinutes: 5 }
  ),
  WEBHOOK_REPLAY_DETECTED: (deliveryId: string) => createError(
    'SECURITY_WEBHOOK_REPLAY_DETECTED',
    'Duplicate webhook delivery detected (potential replay attack)',
    401,
    { deliveryId }
  ),

  // Session errors
  SESSION_NOT_FOUND: (sessionId: string) => createError(
    'SECURITY_SESSION_NOT_FOUND',
    'Session not found',
    404,
    { sessionId }
  ),

  // Generic errors
  AGENT_NOT_FOUND: (agentId: string) => createError(
    'SECURITY_AGENT_NOT_FOUND',
    'Agent not found',
    404,
    { agentId }
  ),
  PROJECT_NOT_FOUND: (projectId: string) => createError(
    'SECURITY_PROJECT_NOT_FOUND',
    'Project not found',
    404,
    { projectId }
  ),
} as const;

export type SecurityError =
  | ReturnType<typeof SecurityErrors.TOOL_NOT_ALLOWED>
  | ReturnType<typeof SecurityErrors.INVALID_TOOL>
  | ReturnType<typeof SecurityErrors.COMMAND_BLOCKED>
  | ReturnType<typeof SecurityErrors.PATH_TRAVERSAL>
  | ReturnType<typeof SecurityErrors.AGENT_NO_WORKTREE>
  | ReturnType<typeof SecurityErrors.WORKTREE_NOT_FOUND>
  | ReturnType<typeof SecurityErrors.WORKTREE_ACCESS_DENIED>
  | ReturnType<typeof SecurityErrors.WEBHOOK_INVALID_SIGNATURE>
  | ReturnType<typeof SecurityErrors.WEBHOOK_TIMESTAMP_EXPIRED>
  | ReturnType<typeof SecurityErrors.WEBHOOK_REPLAY_DETECTED>
  | ReturnType<typeof SecurityErrors.SESSION_NOT_FOUND>
  | ReturnType<typeof SecurityErrors.AGENT_NOT_FOUND>
  | ReturnType<typeof SecurityErrors.PROJECT_NOT_FOUND>;
```

---

## Implementation Outline

```typescript
// lib/security/index.ts
import { validateToolAccess, getToolWhitelist, updateToolWhitelist } from './tool-whitelist';
import { validateBashCommand, createSandboxedEnv } from './bash-sandbox';
import { validateWorktreeAccess, getWorktreeSecurityContext } from './worktree-isolation';
import { verifyWebhookSignature } from './webhook-verification';
import { logAuditEvent, getAuditLog } from './audit';
import type { ISecurityService } from './types';

export class SecurityService implements ISecurityService {
  // Tool whitelist
  validateToolAccess = validateToolAccess;
  getToolWhitelist = getToolWhitelist;
  updateToolWhitelist = updateToolWhitelist;

  // Bash sandboxing
  validateBashCommand = validateBashCommand;
  createSandboxedEnv = createSandboxedEnv;

  // Worktree isolation
  validateWorktreeAccess = validateWorktreeAccess;
  getWorktreeSecurityContext = getWorktreeSecurityContext;

  // Webhook verification
  verifyWebhookSignature = verifyWebhookSignature;

  // Audit logging
  logAuditEvent = logAuditEvent;
  getAuditLog = getAuditLog;
}

export const securityService = new SecurityService();

// Re-export types
export * from './types';
export { SecurityErrors } from '@/lib/errors/security-errors';
export { createSecurityHook } from './hooks';
```

---

## Security Checklist

### Pre-Deployment

- [ ] `GITHUB_WEBHOOK_SECRET` is set and sufficiently random (32+ characters)
- [ ] Default tool whitelist excludes high-risk tools unless explicitly needed
- [ ] Audit log retention policy configured
- [ ] Blocked command patterns reviewed for project-specific needs

### Per-Agent Execution

- [ ] Tool whitelist validated before each tool call
- [ ] Bash commands validated against security policy
- [ ] Worktree path containment verified
- [ ] All tool calls logged to audit trail

### Per-Webhook

- [ ] HMAC-SHA256 signature verified
- [ ] Timestamp within 5-minute window
- [ ] Delivery ID checked for replay
- [ ] Event logged regardless of validation result

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Agent Service](../services/agent-service.md) | Security hooks integration, tool whitelist enforcement |
| [Git Worktrees](../integrations/git-worktrees.md) | Worktree isolation, path containment |
| [GitHub App](../integrations/github-app.md) | Webhook signature verification |
| [Error Catalog](../errors/error-catalog.md) | Security error code definitions |
| [Database Schema](../database/schema.md) | Audit log table schema |
| [Session Service](../services/session-service.md) | Session security context |
