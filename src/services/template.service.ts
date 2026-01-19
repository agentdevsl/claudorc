import { and, desc, eq } from 'drizzle-orm';
import { githubInstallations, githubTokens } from '../db/schema/github.js';
import type { NewTemplate, Template, TemplateScope } from '../db/schema/templates.js';
import { templates } from '../db/schema/templates.js';
import type { LocalConfig, MergedTemplateConfig } from '../lib/config/template-merge.js';
import { mergeTemplates } from '../lib/config/template-merge.js';
// Note: decryptToken is imported dynamically in sync() to avoid bundling node:path for browser
import type { TemplateError } from '../lib/errors/template-errors.js';
import { TemplateErrors } from '../lib/errors/template-errors.js';
import { createOctokitFromToken, getInstallationOctokit } from '../lib/github/client.js';
import { parseGitHubUrl, syncTemplateFromGitHub } from '../lib/github/template-sync.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Database } from '../types/database.js';

export type CreateTemplateInput = {
  name: string;
  description?: string;
  scope: TemplateScope;
  githubUrl: string;
  branch?: string;
  configPath?: string;
  projectId?: string;
};

export type UpdateTemplateInput = {
  name?: string;
  description?: string;
  branch?: string;
  configPath?: string;
};

export type ListTemplatesOptions = {
  scope?: TemplateScope;
  projectId?: string;
  limit?: number;
  offset?: number;
};

export interface SyncResult {
  templateId: string;
  skillCount: number;
  commandCount: number;
  agentCount: number;
  sha: string;
  syncedAt: string;
}

export interface SyncAllResult {
  successes: SyncResult[];
  failures: Array<{ templateId: string; templateName: string; error: TemplateError }>;
}

export class TemplateService {
  constructor(private db: Database) {}

  private updateTimestamp(): string {
    return new Date().toISOString();
  }

  async create(input: CreateTemplateInput): Promise<Result<Template, TemplateError>> {
    // Parse GitHub URL
    const parsed = parseGitHubUrl(input.githubUrl);
    if (!parsed.ok) {
      return parsed;
    }

    const { owner, repo } = parsed.value;

    // Validate project-scoped templates require projectId
    if (input.scope === 'project' && !input.projectId) {
      return err(TemplateErrors.PROJECT_REQUIRED);
    }

    // Check for duplicate template (same owner/repo in same scope)
    const existing = await this.db.query.templates.findFirst({
      where: and(
        eq(templates.githubOwner, owner),
        eq(templates.githubRepo, repo),
        eq(templates.scope, input.scope),
        input.projectId ? eq(templates.projectId, input.projectId) : undefined
      ),
    });

    if (existing) {
      return err(TemplateErrors.ALREADY_EXISTS);
    }

    const now = this.updateTimestamp();

    const [template] = await this.db
      .insert(templates)
      .values({
        name: input.name,
        description: input.description,
        scope: input.scope,
        githubOwner: owner,
        githubRepo: repo,
        branch: input.branch ?? 'main',
        configPath: input.configPath ?? '.claude',
        projectId: input.projectId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      } satisfies NewTemplate)
      .returning();

    if (!template) {
      return err(TemplateErrors.NOT_FOUND);
    }

    return ok(template);
  }

  async getById(id: string): Promise<Result<Template, TemplateError>> {
    const template = await this.db.query.templates.findFirst({
      where: eq(templates.id, id),
    });

    if (!template) {
      return err(TemplateErrors.NOT_FOUND);
    }

    return ok(template);
  }

  async list(options?: ListTemplatesOptions): Promise<Result<Template[], TemplateError>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [];

    if (options?.scope) {
      conditions.push(eq(templates.scope, options.scope));
    }

    if (options?.projectId) {
      conditions.push(eq(templates.projectId, options.projectId));
    }

    const items = await this.db.query.templates.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(templates.updatedAt)],
      limit,
      offset,
    });

    return ok(items);
  }

  async update(id: string, input: UpdateTemplateInput): Promise<Result<Template, TemplateError>> {
    const updates: Partial<Template> = {
      updatedAt: this.updateTimestamp(),
    };

    if (input.name !== undefined) {
      updates.name = input.name;
    }
    if (input.description !== undefined) {
      updates.description = input.description;
    }
    if (input.branch !== undefined) {
      updates.branch = input.branch;
    }
    if (input.configPath !== undefined) {
      updates.configPath = input.configPath;
    }

    const [updated] = await this.db
      .update(templates)
      .set(updates)
      .where(eq(templates.id, id))
      .returning();

    if (!updated) {
      return err(TemplateErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async delete(id: string): Promise<Result<void, TemplateError>> {
    const template = await this.db.query.templates.findFirst({
      where: eq(templates.id, id),
    });

    if (!template) {
      return err(TemplateErrors.NOT_FOUND);
    }

    await this.db.delete(templates).where(eq(templates.id, id));

    return ok(undefined);
  }

  /**
   * Sync a template from its GitHub repository
   * Fetches skills, commands, and agents and caches them
   */
  async sync(id: string): Promise<Result<SyncResult, TemplateError>> {
    const template = await this.db.query.templates.findFirst({
      where: eq(templates.id, id),
    });

    if (!template) {
      return err(TemplateErrors.NOT_FOUND);
    }

    // Mark as syncing
    await this.db
      .update(templates)
      .set({ status: 'syncing', updatedAt: this.updateTimestamp() })
      .where(eq(templates.id, id));

    try {
      // Try to get an Octokit client - first from GitHub App installation, then fall back to PAT
      let octokit: Awaited<ReturnType<typeof getInstallationOctokit>>;

      // Try GitHub App installation first
      const installation = await this.db.query.githubInstallations.findFirst({
        where: eq(githubInstallations.status, 'active'),
      });

      if (installation) {
        octokit = await getInstallationOctokit(Number(installation.installationId));
      } else {
        // Fall back to PAT
        const tokenRecord = await this.db.query.githubTokens.findFirst({
          where: eq(githubTokens.isValid, true),
        });

        if (!tokenRecord) {
          await this.db
            .update(templates)
            .set({
              status: 'error',
              syncError: 'No GitHub authentication found (need App installation or PAT)',
              updatedAt: this.updateTimestamp(),
            })
            .where(eq(templates.id, id));
          return err(
            TemplateErrors.SYNC_FAILED(
              'No GitHub authentication found (need App installation or PAT)'
            )
          );
        }

        // Dynamic import to avoid bundling node:path for browser
        const { decryptToken } = await import('../server/crypto.js');
        const token = await decryptToken(tokenRecord.encryptedToken);
        octokit = createOctokitFromToken(token);
      }

      const syncResult = await syncTemplateFromGitHub({
        octokit,
        owner: template.githubOwner,
        repo: template.githubRepo,
        configPath: template.configPath ?? '.claude',
        ref: template.branch ?? 'main',
      });

      if (!syncResult.ok) {
        await this.db
          .update(templates)
          .set({
            status: 'error',
            syncError: syncResult.error.message,
            updatedAt: this.updateTimestamp(),
          })
          .where(eq(templates.id, id));
        return syncResult;
      }

      const now = this.updateTimestamp();

      // Update template with synced content
      await this.db
        .update(templates)
        .set({
          status: 'active',
          cachedSkills: syncResult.value.skills,
          cachedCommands: syncResult.value.commands,
          cachedAgents: syncResult.value.agents,
          lastSyncSha: syncResult.value.sha,
          lastSyncedAt: now,
          syncError: null,
          updatedAt: now,
        })
        .where(eq(templates.id, id));

      return ok({
        templateId: id,
        skillCount: syncResult.value.skills.length,
        commandCount: syncResult.value.commands.length,
        agentCount: syncResult.value.agents.length,
        sha: syncResult.value.sha,
        syncedAt: now,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.db
        .update(templates)
        .set({
          status: 'error',
          syncError: errorMessage,
          updatedAt: this.updateTimestamp(),
        })
        .where(eq(templates.id, id));
      return err(TemplateErrors.SYNC_FAILED(errorMessage));
    }
  }

  /**
   * Sync all templates of a given scope in parallel.
   * Returns both successful syncs and failed syncs for visibility.
   *
   * @param scope - The template scope to sync ('org' or 'project')
   * @param projectId - Optional project ID to filter project-scoped templates
   * @returns SyncAllResult with successes and failures arrays
   */
  async syncAll(
    scope: TemplateScope,
    projectId?: string
  ): Promise<Result<SyncAllResult, TemplateError>> {
    const conditions = [eq(templates.scope, scope)];

    if (projectId) {
      conditions.push(eq(templates.projectId, projectId));
    }

    const templateList = await this.db.query.templates.findMany({
      where: and(...conditions),
    });

    // Sync all templates in parallel using Promise.allSettled
    const syncPromises = templateList.map(async (template) => ({
      template,
      result: await this.sync(template.id),
    }));

    const results = await Promise.allSettled(syncPromises);

    const successes: SyncResult[] = [];
    const failures: Array<{ templateId: string; templateName: string; error: TemplateError }> = [];

    for (const settledResult of results) {
      if (settledResult.status === 'fulfilled') {
        const { template, result } = settledResult.value;
        if (result.ok) {
          successes.push(result.value);
        } else {
          console.error(
            `[TemplateService.syncAll] Failed to sync template ${template.id} (${template.name}):`,
            result.error.message
          );
          failures.push({
            templateId: template.id,
            templateName: template.name,
            error: result.error,
          });
        }
      } else {
        // This shouldn't happen since sync() catches its errors, but handle it
        console.error('[TemplateService.syncAll] Unexpected sync error:', settledResult.reason);
      }
    }

    return ok({ successes, failures });
  }

  /**
   * Get merged configuration for a project
   * Combines org templates, project templates, and local config with proper precedence
   */
  async getMergedConfig(
    projectId: string,
    localConfig?: LocalConfig
  ): Promise<Result<MergedTemplateConfig, TemplateError>> {
    // Fetch org templates (no projectId filter, scope = org)
    const orgTemplates = await this.db.query.templates.findMany({
      where: and(eq(templates.scope, 'org'), eq(templates.status, 'active')),
    });

    // Fetch project templates
    const projectTemplates = await this.db.query.templates.findMany({
      where: and(
        eq(templates.scope, 'project'),
        eq(templates.projectId, projectId),
        eq(templates.status, 'active')
      ),
    });

    const merged = mergeTemplates(orgTemplates, projectTemplates, localConfig);

    return ok(merged);
  }

  /**
   * Find templates by GitHub repository
   * Used by webhooks to trigger syncs on push events
   */
  async findByRepo(owner: string, repo: string): Promise<Result<Template[], TemplateError>> {
    const templateList = await this.db.query.templates.findMany({
      where: and(eq(templates.githubOwner, owner), eq(templates.githubRepo, repo)),
    });

    return ok(templateList);
  }
}
