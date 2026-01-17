import path from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { agents } from '../db/schema/agents.js';
import type { Project, ProjectConfig } from '../db/schema/projects.js';
import { projects } from '../db/schema/projects.js';
import { projectConfigSchema } from '../lib/config/schemas.js';
import { DEFAULT_PROJECT_CONFIG } from '../lib/config/types.js';
import { containsSecrets } from '../lib/config/validate-secrets.js';
import type { ProjectError } from '../lib/errors/project-errors.js';
import { ProjectErrors } from '../lib/errors/project-errors.js';
import { getInstallationOctokit } from '../lib/github/client.js';
import { syncConfigFromGitHub } from '../lib/github/config-sync.js';
import { deepMerge } from '../lib/utils/deep-merge.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Database } from '../types/database.js';

export type CreateProjectInput = {
  path: string;
  name?: string;
  description?: string;
  config?: Partial<ProjectConfig>;
  maxConcurrentAgents?: number;
};

export type UpdateProjectInput = {
  maxConcurrentAgents?: number;
  configPath?: string;
};

export type ListProjectsOptions = {
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
};

export type PathValidation = {
  name: string;
  path: string;
  hasClaudeConfig: boolean;
  hasClaudeConfigError?: string;
  defaultBranch: string;
  remoteUrl?: string;
};

export type CommandRunner = {
  exec: (command: string, cwd: string) => Promise<{ stdout: string; stderr: string }>;
};

export class ProjectService {
  constructor(
    private db: Database,
    private worktreeService: {
      prune: (
        projectId: string
      ) => Promise<
        Result<
          { pruned: number; failed: Array<{ worktreeId: string; branch: string; error: string }> },
          ProjectError
        >
      >;
    },
    private runner: CommandRunner
  ) {}

  private updateTimestamp(): Date {
    return new Date();
  }

  async create(input: CreateProjectInput): Promise<Result<Project, ProjectError>> {
    const resolved = path.resolve(input.path);
    const validation = await this.validatePath(resolved);
    if (!validation.ok) {
      return validation;
    }

    const existing = await this.db.query.projects.findFirst({
      where: eq(projects.path, resolved),
    });
    if (existing) {
      return err(ProjectErrors.PATH_EXISTS);
    }

    const name = validation.value.name;
    const merged = deepMerge(DEFAULT_PROJECT_CONFIG, input.config ?? {});
    const validated = this.validateConfig(merged);
    if (!validated.ok) {
      return validated;
    }

    const [project] = await this.db
      .insert(projects)
      .values({
        name,
        path: resolved,
        config: validated.value,
        maxConcurrentAgents: input.maxConcurrentAgents ?? 3,
        createdAt: this.updateTimestamp(),
        updatedAt: this.updateTimestamp(),
      })
      .returning();

    if (!project) {
      return err(ProjectErrors.NOT_FOUND);
    }

    return ok(project);
  }

  async getById(id: string): Promise<Result<Project, ProjectError>> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return err(ProjectErrors.NOT_FOUND);
    }

    return ok(project);
  }

  async list(options?: ListProjectsOptions): Promise<Result<Project[], ProjectError>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'updatedAt';
    const direction = options?.orderDirection ?? 'desc';

    const orderColumn =
      orderBy === 'name'
        ? projects.name
        : orderBy === 'createdAt'
          ? projects.createdAt
          : projects.updatedAt;

    const items = await this.db.query.projects.findMany({
      orderBy: (direction === 'asc' ? [orderColumn] : [desc(orderColumn)]) as never,
      limit,
      offset,
    });

    return ok(items);
  }

  async update(id: string, input: UpdateProjectInput): Promise<Result<Project, ProjectError>> {
    const updates: Partial<Project> = {};
    if (input.maxConcurrentAgents !== undefined) {
      updates.maxConcurrentAgents = input.maxConcurrentAgents;
    }

    const [updated] = await this.db
      .update(projects)
      .set({ ...updates, updatedAt: this.updateTimestamp() })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return err(ProjectErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async delete(id: string): Promise<Result<void, ProjectError>> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return err(ProjectErrors.NOT_FOUND);
    }

    const running = await this.db.query.agents.findMany({
      where: and(eq(agents.projectId, id), eq(agents.status, 'running')),
    });
    const runningAgents = running;

    if (runningAgents.length > 0) {
      return err(ProjectErrors.HAS_RUNNING_AGENTS(runningAgents.length));
    }

    await this.worktreeService.prune(id);
    await this.db.delete(projects).where(eq(projects.id, id));

    return ok(undefined);
  }

  async updateConfig(
    id: string,
    config: Partial<ProjectConfig>
  ): Promise<Result<Project, ProjectError>> {
    const validation = this.validateConfig(config);
    if (!validation.ok) {
      return validation;
    }

    const [updated] = await this.db
      .update(projects)
      .set({ config: validation.value, updatedAt: this.updateTimestamp() })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return err(ProjectErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async syncFromGitHub(id: string): Promise<Result<Project, ProjectError>> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return err(ProjectErrors.NOT_FOUND);
    }

    if (!project.githubOwner || !project.githubRepo) {
      return err(ProjectErrors.CONFIG_INVALID(['Missing GitHub repository metadata']));
    }

    if (!project.githubInstallationId) {
      return err(ProjectErrors.CONFIG_INVALID(['Missing GitHub App installation ID']));
    }

    try {
      // Get installation-scoped Octokit client
      const { githubInstallations } = await import('../db/schema/github.js');
      const installation = await this.db.query.githubInstallations.findFirst({
        where: eq(githubInstallations.id, project.githubInstallationId),
      });

      if (!installation) {
        return err(ProjectErrors.CONFIG_INVALID(['GitHub App installation not found']));
      }

      const octokit = await getInstallationOctokit(Number(installation.installationId));

      // Fetch config from GitHub
      const configResult = await syncConfigFromGitHub({
        octokit,
        owner: project.githubOwner,
        repo: project.githubRepo,
        configPath: project.configPath ?? '.claude',
      });

      if (!configResult.ok) {
        return err(ProjectErrors.CONFIG_INVALID([configResult.error.message]));
      }

      // Validate the synced config
      const validation = this.validateConfig(configResult.value.config);
      if (!validation.ok) {
        return validation;
      }

      // Merge synced config with existing config
      const mergedConfig = deepMerge(project.config ?? {}, validation.value) as ProjectConfig;

      // Update project with synced config
      const [updated] = await this.db
        .update(projects)
        .set({ config: mergedConfig, updatedAt: this.updateTimestamp() })
        .where(eq(projects.id, id))
        .returning();

      if (!updated) {
        return err(ProjectErrors.NOT_FOUND);
      }

      console.log(
        `[ProjectService] Synced config from GitHub for project ${id}: ${configResult.value.path} (sha: ${configResult.value.sha})`
      );

      return ok(updated);
    } catch (error) {
      console.error(`[ProjectService] GitHub sync failed for project ${id}:`, error);
      return err(
        ProjectErrors.CONFIG_INVALID([
          `GitHub sync failed: ${error instanceof Error ? error.message : String(error)}`,
        ])
      );
    }
  }

  async validatePath(projectPath: string): Promise<Result<PathValidation, ProjectError>> {
    const normalized = path.resolve(projectPath);
    const name = path.basename(normalized);

    try {
      await this.runner.exec('git rev-parse --git-dir', normalized);
    } catch {
      return err(ProjectErrors.NOT_A_GIT_REPO(normalized));
    }

    let remoteUrl: string | undefined;
    try {
      const remote = await this.runner.exec('git remote get-url origin', normalized);
      remoteUrl = remote.stdout.trim() || undefined;
    } catch (error) {
      console.warn(`[ProjectService] Could not detect remote URL for ${normalized}:`, error);
      remoteUrl = undefined;
    }

    let defaultBranch = 'main';
    try {
      const branch = await this.runner.exec('git symbolic-ref --short HEAD', normalized);
      defaultBranch = branch.stdout.trim() || 'main';
    } catch (error) {
      console.warn(`[ProjectService] Could not detect default branch for ${normalized}:`, error);
      defaultBranch = 'main';
    }

    const claudeConfigResult = await this.runner
      .exec('test -d .claude && echo yes || echo no', normalized)
      .then((res) => ({
        detected: res.stdout.trim() === 'yes',
        error: undefined as string | undefined,
      }))
      .catch((error) => {
        console.warn(
          `[ProjectService] Could not detect .claude directory for ${normalized}:`,
          error
        );
        return { detected: false, error: String(error) };
      });

    return ok({
      name,
      path: normalized,
      hasClaudeConfig: claudeConfigResult.detected,
      hasClaudeConfigError: claudeConfigResult.error,
      defaultBranch,
      remoteUrl,
    });
  }

  validateConfig(config: Partial<ProjectConfig>): Result<ProjectConfig, ProjectError> {
    try {
      const validated = projectConfigSchema.parse(config);
      const secrets = containsSecrets(config as Record<string, unknown>);
      if (secrets.length > 0) {
        return err(ProjectErrors.CONFIG_INVALID([`Secrets detected: ${secrets.join(', ')}`]));
      }
      return ok(validated);
    } catch (error) {
      return err(ProjectErrors.CONFIG_INVALID([String(error)]));
    }
  }
}
