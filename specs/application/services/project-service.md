# ProjectService Specification

## Overview

The ProjectService manages CRUD operations for projects, configuration management, and GitHub synchronization. It provides a type-safe interface for managing project entities within AgentPane.

**Key Concept: Project = Working Context for a Repository**

- A project is a user's working context for a git repository
- Every project **must** be linked to a git repository (required, not optional)
- Project name is derived from the repository directory name
- Multiple users can have projects referencing the same repository
- The project holds user-specific: agent config, worktrees, session history, preferences

**Related Wireframes:**

- [Add Repository Dialog](../wireframes/new-project-dialog.html) - Repository selection
- [Project Settings](../wireframes/project-settings.html) - Working context configuration

---

## Interface Definition

```typescript
// lib/services/project-service.ts
import type { Result } from '@/lib/utils/result';
import type { Project, NewProject, ProjectConfig } from '@/db/schema';
import type { ProjectError } from '@/lib/errors/project-errors';

export interface IProjectService {
  // CRUD Operations
  create(input: CreateProjectInput): Promise<Result<Project, ProjectError>>;
  getById(id: string): Promise<Result<Project, ProjectError>>;
  list(options?: ListProjectsOptions): Promise<Result<Project[], ProjectError>>;
  update(id: string, input: UpdateProjectInput): Promise<Result<Project, ProjectError>>;
  delete(id: string): Promise<Result<void, ProjectError>>;

  // Configuration Management
  updateConfig(id: string, config: Partial<ProjectConfig>): Promise<Result<Project, ProjectError>>;
  syncFromGitHub(id: string): Promise<Result<Project, ProjectError>>;

  // Validation
  validatePath(path: string): Promise<Result<PathValidation, ProjectError>>;
  validateConfig(config: Partial<ProjectConfig>): Result<ProjectConfig, ProjectError>;
}
```

---

## Type Definitions

```typescript
// Input Types
export interface CreateProjectInput {
  /** Absolute path to the git repository (required) */
  path: string;
  /** Optional config overrides */
  config?: Partial<ProjectConfig>;
  /** Max concurrent agents (default: 3) */
  maxConcurrentAgents?: number;
}

export interface UpdateProjectInput {
  /** Max concurrent agents (1-10) */
  maxConcurrentAgents?: number;
  /** Config path within repo (default: .claude/) */
  configPath?: string;
}

export interface ListProjectsOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface PathValidation {
  /** Derived project name from directory */
  name: string;
  /** Absolute path to repository */
  path: string;
  /** Whether .claude/ config exists */
  hasClaudeConfig: boolean;
  /** Default branch (e.g., 'main') */
  defaultBranch: string;
  /** Remote origin URL if configured */
  remoteUrl?: string;
}
```

---

## Method Specifications

### create

Creates a new project as a working context for a git repository.

**Signature:**

```typescript
create(input: CreateProjectInput): Promise<Result<Project, ProjectError>>
```

**Preconditions:**

- `path` must be an absolute path to an existing directory
- `path` must contain a `.git` directory (must be a git repository)
- If `config` provided, must pass `validateConfig`
- `maxConcurrentAgents` must be 1-10 (default: 3)

**Business Rules:**

1. Path is normalized using `path.resolve()` before storage
2. **Project name is derived from directory name** (e.g., `/Users/me/git/my-app` → `my-app`)
3. Default config values are merged with provided config
4. Project ID is generated using CUID2
5. `createdAt` and `updatedAt` are set to current timestamp
6. Git remote info is detected and stored if available

**Side Effects:**

- **Database:** Inserts new row into `projects` table
- **Events:** Emits `project:created` event to Durable Streams

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Path doesn't exist or not accessible | `ProjectErrors.PATH_INVALID(path)` |
| Path is not a git repository | `ProjectErrors.NOT_A_GIT_REPO(path)` |
| Config validation failed | `ProjectErrors.CONFIG_INVALID(errors)` |

**Example:**

```typescript
const result = await projectService.create({
  path: '/Users/user/git/agentpane',
  config: {
    worktreeRoot: '.worktrees',
    defaultBranch: 'main',
  },
  maxConcurrentAgents: 6,
});

if (result.ok) {
  console.log('Project created:', result.value.id);
} else {
  console.error('Error:', result.error.message);
}
```

---

### getById

Retrieves a project by its ID.

**Signature:**

```typescript
getById(id: string): Promise<Result<Project, ProjectError>>
```

**Preconditions:**

- `id` must be a valid CUID2 format

**Business Rules:**

1. Returns the complete project record including all configuration

**Side Effects:**

- None

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Project ID not found | `ProjectErrors.NOT_FOUND` |

**Example:**

```typescript
const result = await projectService.getById('clp1234567890abcdef');

if (result.ok) {
  console.log('Project:', result.value.name);
}
```

---

### list

Lists projects with optional filtering and pagination.

**Signature:**

```typescript
list(options?: ListProjectsOptions): Promise<Result<Project[], ProjectError>>
```

**Preconditions:**

- `limit` must be 1-100 (default: 50)
- `offset` must be >= 0 (default: 0)

**Business Rules:**

1. Default ordering is by `updatedAt` descending (most recent first)
2. Returns empty array if no projects exist

**Side Effects:**

- None

**Error Conditions:**

- None (returns empty array if no results)

**Example:**

```typescript
const result = await projectService.list({
  limit: 10,
  orderBy: 'name',
  orderDirection: 'asc',
});

if (result.ok) {
  result.value.forEach(p => console.log(p.name));
}
```

---

### update

Updates an existing project's metadata.

**Signature:**

```typescript
update(id: string, input: UpdateProjectInput): Promise<Result<Project, ProjectError>>
```

**Preconditions:**

- Project with `id` must exist
- `name` (if provided) must be 1-100 characters
- `maxConcurrentAgents` (if provided) must be 1-10

**Business Rules:**

1. Only provided fields are updated
2. `updatedAt` is automatically set to current timestamp
3. Cannot update `path` after creation (use delete and recreate)

**Side Effects:**

- **Database:** Updates row in `projects` table
- **Events:** Emits `project:updated` event to Durable Streams

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Project ID not found | `ProjectErrors.NOT_FOUND` |

**Example:**

```typescript
const result = await projectService.update('clp1234567890abcdef', {
  name: 'AgentPane v2',
  maxConcurrentAgents: 8,
});
```

---

### delete

Deletes a project and all associated data.

**Signature:**

```typescript
delete(id: string): Promise<Result<void, ProjectError>>
```

**Preconditions:**

- Project with `id` must exist
- No agents currently running for this project

**Business Rules:**

1. Cascades delete to: tasks, agents, sessions, worktrees, agent_runs, audit_logs
2. Does not delete actual files on disk
3. Does not delete git branches/worktrees on disk (cleanup is separate)

**Side Effects:**

- **Database:** Deletes project and cascaded records
- **Events:** Emits `project:deleted` event to Durable Streams

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Project ID not found | `ProjectErrors.NOT_FOUND` |
| Has running agents | `ProjectErrors.HAS_RUNNING_AGENTS(count)` |

**Example:**

```typescript
const result = await projectService.delete('clp1234567890abcdef');

if (!result.ok && result.error.code === 'PROJECT_HAS_RUNNING_AGENTS') {
  console.error('Stop all agents before deleting');
}
```

---

### updateConfig

Updates project configuration settings.

**Signature:**

```typescript
updateConfig(id: string, config: Partial<ProjectConfig>): Promise<Result<Project, ProjectError>>
```

**Preconditions:**

- Project with `id` must exist
- Partial config must pass validation

**Business Rules:**

1. Merges provided config with existing config
2. Validates merged config before saving
3. Changes take effect immediately for new agent executions
4. Running agents continue with their existing config until restart

**Side Effects:**

- **Database:** Updates `config` JSONB field in `projects` table
- **Events:** Emits `project:config:updated` event to Durable Streams

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Project ID not found | `ProjectErrors.NOT_FOUND` |
| Config validation failed | `ProjectErrors.CONFIG_INVALID(errors)` |

**Example:**

```typescript
const result = await projectService.updateConfig('clp1234567890abcdef', {
  maxTurns: 100,
  allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch'],
  initScript: 'bun install && bun run db:migrate',
});
```

---

### syncFromGitHub

Syncs project configuration from a GitHub repository.

**Signature:**

```typescript
syncFromGitHub(id: string): Promise<Result<Project, ProjectError>>
```

**Preconditions:**

- Project with `id` must exist
- Project must have `githubOwner`, `githubRepo`, and `githubInstallationId` configured
- GitHub App installation must be active

**Business Rules:**

1. Fetches configuration from `configPath` (default: `.claude/`) in the repository
2. Reads `config.json` or `config.yaml` from that path
3. Validates fetched configuration
4. Merges with existing config (GitHub config takes precedence)
5. Updates `updatedAt` timestamp

**Side Effects:**

- **Database:** Updates `config` field in `projects` table
- **Events:** Emits `project:synced` event to Durable Streams
- **External:** Makes GitHub API calls via GitHub App authentication

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Project ID not found | `ProjectErrors.NOT_FOUND` |
| Config validation failed | `ProjectErrors.CONFIG_INVALID(errors)` |

**Example:**

```typescript
const result = await projectService.syncFromGitHub('clp1234567890abcdef');

if (result.ok) {
  console.log('Synced config:', result.value.config);
}
```

---

### validatePath

Validates a filesystem path for project creation. Returns repository info if valid.

**Signature:**

```typescript
validatePath(path: string): Promise<Result<PathValidation, ProjectError>>
```

**Preconditions:**

- `path` must be an absolute path

**Business Rules:**

1. Checks if path exists and is accessible
2. **Requires** path to be a git repository (contains `.git`)
3. Checks for existing `.claude/` config directory
4. Extracts default branch and remote URL from git config
5. Derives project name from directory name

**Side Effects:**

- **Filesystem:** Reads directory metadata and git config

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Path doesn't exist | `ProjectErrors.PATH_INVALID(path)` |
| Path is not a git repository | `ProjectErrors.NOT_A_GIT_REPO(path)` |

**Example:**

```typescript
const result = await projectService.validatePath('/Users/user/git/myproject');

if (result.ok) {
  console.log('Name:', result.value.name); // 'myproject'
  console.log('Branch:', result.value.defaultBranch); // 'main'
  console.log('Has config:', result.value.hasClaudeConfig);
}
```

---

### validateConfig

Validates a project configuration object.

**Signature:**

```typescript
validateConfig(config: Partial<ProjectConfig>): Result<ProjectConfig, ProjectError>
```

**Preconditions:**

- None (validates the provided config object)

**Business Rules:**

1. Uses Zod schema for validation
2. Returns normalized config with defaults applied
3. Validates:
   - `worktreeRoot`: non-empty string (default: `.worktrees`)
   - `initScript`: optional string
   - `envFile`: optional string, must be valid relative path
   - `defaultBranch`: non-empty string (default: `main`)
   - `allowedTools`: array of valid tool names
   - `maxTurns`: number 1-500 (default: 50)
   - `model`: valid Claude model string

**Side Effects:**

- None (pure function)

**Error Conditions:**

| Condition | Error |
|-----------|-------|
| Validation failed | `ProjectErrors.CONFIG_INVALID(errors)` |

**Example:**

```typescript
const result = projectService.validateConfig({
  maxTurns: 1000, // Invalid: > 500
  allowedTools: ['InvalidTool'], // Invalid tool name
});

if (!result.ok) {
  console.error('Validation errors:', result.error.details.validationErrors);
}
```

---

## Implementation Outline

```typescript
// lib/services/project-service.ts
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { projects, agents } from '@/db/schema';
import { ok, err } from '@/lib/utils/result';
import { ProjectErrors } from '@/lib/errors/project-errors';
import { projectConfigSchema, createProjectSchema } from '@/db/schema/validation';
import { createId } from '@paralleldrive/cuid2';
import { access, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

export class ProjectService implements IProjectService {
  async create(input: CreateProjectInput): Promise<Result<Project, ProjectError>> {
    // 1. Validate input with Zod
    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      return err(ProjectErrors.CONFIG_INVALID(
        parsed.error.errors.map(e => e.message)
      ));
    }

    // 2. Normalize and validate path (also checks git repo requirement)
    const normalizedPath = resolve(input.path);
    const pathResult = await this.validatePath(normalizedPath);
    if (!pathResult.ok) {
      return err(pathResult.error);
    }

    // 3. Validate and merge config
    const configResult = this.validateConfig(input.config ?? {});
    if (!configResult.ok) {
      return err(configResult.error);
    }

    // 4. Derive name from directory and detect git info
    const { name, defaultBranch, remoteUrl, hasClaudeConfig } = pathResult.value;

    // Parse remote URL for GitHub owner/repo if available
    const gitHubInfo = remoteUrl ? parseGitHubRemote(remoteUrl) : null;

    // 5. Insert into database
    const [project] = await db.insert(projects).values({
      id: createId(),
      name, // Derived from directory name
      path: normalizedPath,
      config: configResult.value,
      maxConcurrentAgents: input.maxConcurrentAgents ?? 3,
      githubOwner: gitHubInfo?.owner,
      githubRepo: gitHubInfo?.repo,
      configPath: hasClaudeConfig ? '.claude' : null,
      defaultBranch,
    }).returning();

    // 6. Emit event
    await this.emitEvent('project:created', project);

    return ok(project);
  }

  async getById(id: string): Promise<Result<Project, ProjectError>> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return err(ProjectErrors.NOT_FOUND);
    }

    return ok(project);
  }

  async list(options?: ListProjectsOptions): Promise<Result<Project[], ProjectError>> {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'updatedAt',
      orderDirection = 'desc',
    } = options ?? {};

    const orderFn = orderDirection === 'desc' ? desc : asc;
    const orderColumn = projects[orderBy];

    const results = await db.query.projects.findMany({
      limit,
      offset,
      orderBy: [orderFn(orderColumn)],
    });

    return ok(results);
  }

  async update(id: string, input: UpdateProjectInput): Promise<Result<Project, ProjectError>> {
    // 1. Check project exists
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    // 2. Update fields
    const [updated] = await db.update(projects)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    // 3. Emit event
    await this.emitEvent('project:updated', updated);

    return ok(updated);
  }

  async delete(id: string): Promise<Result<void, ProjectError>> {
    // 1. Check project exists
    const existing = await this.getById(id);
    if (!existing.ok) {
      return err(existing.error);
    }

    // 2. Check for running agents
    const runningAgents = await db.query.agents.findMany({
      where: (a, { and, eq }) => and(
        eq(a.projectId, id),
        eq(a.status, 'running')
      ),
    });

    if (runningAgents.length > 0) {
      return err(ProjectErrors.HAS_RUNNING_AGENTS(runningAgents.length));
    }

    // 3. Delete project (cascade handles related records)
    await db.delete(projects).where(eq(projects.id, id));

    // 4. Emit event
    await this.emitEvent('project:deleted', { id });

    return ok(undefined);
  }

  async updateConfig(
    id: string,
    config: Partial<ProjectConfig>
  ): Promise<Result<Project, ProjectError>> {
    // 1. Get existing project
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    // 2. Merge and validate config
    const mergedConfig = { ...existing.value.config, ...config };
    const validationResult = this.validateConfig(mergedConfig);
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    // 3. Update config
    const [updated] = await db.update(projects)
      .set({
        config: validationResult.value,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    // 4. Emit event
    await this.emitEvent('project:config:updated', updated);

    return ok(updated);
  }

  async syncFromGitHub(id: string): Promise<Result<Project, ProjectError>> {
    // Implementation depends on GitHub service integration
    // See GitHub App integration spec for details
    throw new Error('Not implemented');
  }

  async validatePath(path: string): Promise<Result<PathValidation, ProjectError>> {
    const normalizedPath = resolve(path);

    try {
      // Check path exists and is accessible
      await access(normalizedPath, constants.R_OK);
    } catch {
      return err(ProjectErrors.PATH_INVALID(path));
    }

    // REQUIRED: Check for .git directory (must be a git repository)
    try {
      await access(`${normalizedPath}/.git`, constants.R_OK);
    } catch {
      return err(ProjectErrors.NOT_A_GIT_REPO(path));
    }

    // Derive name from directory
    const name = normalizedPath.split('/').pop() || '';

    // Check for .claude/ config directory
    let hasClaudeConfig = false;
    try {
      await access(`${normalizedPath}/.claude`, constants.R_OK);
      hasClaudeConfig = true;
    } catch {
      // No config dir, that's fine
    }

    // Extract git info (default branch, remote URL)
    const gitInfo = await this.extractGitInfo(normalizedPath);

    return ok({
      name,
      path: normalizedPath,
      hasClaudeConfig,
      defaultBranch: gitInfo.defaultBranch || 'main',
      remoteUrl: gitInfo.remoteUrl,
    });
  }

  private async extractGitInfo(path: string): Promise<{ defaultBranch?: string; remoteUrl?: string }> {
    // Read git config for branch and remote info
    // Implementation uses git commands or config file parsing
    try {
      // Could use: git config --get remote.origin.url
      // Could use: git symbolic-ref --short HEAD
      return {
        defaultBranch: 'main', // Default, detect from git
        remoteUrl: undefined,  // Parse from git remote
      };
    } catch {
      return {};
    }
  }

  validateConfig(config: Partial<ProjectConfig>): Result<ProjectConfig, ProjectError> {
    const parsed = projectConfigSchema.safeParse(config);

    if (!parsed.success) {
      return err(ProjectErrors.CONFIG_INVALID(
        parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      ));
    }

    return ok(parsed.data);
  }

  private async emitEvent(type: string, payload: unknown): Promise<void> {
    // Emit to Durable Streams
    // Implementation depends on session service
  }
}

// Export singleton instance
export const projectService = new ProjectService();
```

---

## State Machine

Projects do not have a state machine as they are primarily configuration entities. However, the project lifecycle can be described as:

```
                 ┌─────────────────────┐
                 │                     │
  create() ───►  │      ACTIVE         │  ◄─── update()
                 │                     │  ◄─── updateConfig()
                 │                     │  ◄─── syncFromGitHub()
                 └──────────┬──────────┘
                            │
                            │ delete()
                            ▼
                 ┌─────────────────────┐
                 │      DELETED        │
                 │   (cascade delete)  │
                 └─────────────────────┘
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](../database/schema.md) | Project table definition |
| [Error Catalog](../errors/error-catalog.md) | ProjectError types |
| [TaskService](./task-service.md) | Tasks belong to projects |
| [API Endpoints](../api/endpoints.md) | HTTP routes for project operations |
| [GitHub App](../integrations/github-app.md) | GitHub sync integration |
