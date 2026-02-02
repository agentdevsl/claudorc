import { and, desc, eq, like, or } from 'drizzle-orm';
import { settings } from '../db/schema/settings.js';
import type {
  NewTerraformRegistry,
  TerraformModule,
  TerraformOutput,
  TerraformRegistry,
  TerraformVariable,
} from '../db/schema/terraform.js';
import { terraformModules, terraformRegistries } from '../db/schema/terraform.js';
import type { TerraformError } from '../lib/errors/terraform-errors.js';
import { TerraformErrors } from '../lib/errors/terraform-errors.js';
import { type RegistryConfig, syncAllModules } from '../lib/terraform/registry-client.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Database } from '../types/database.js';

export interface CreateRegistryInput {
  name: string;
  orgName: string;
  tokenSettingKey: string;
  syncIntervalMinutes?: number | null;
}

export interface UpdateRegistryInput {
  name?: string;
  orgName?: string;
  tokenSettingKey?: string;
  syncIntervalMinutes?: number | null;
}

export interface ListModulesOptions {
  search?: string;
  provider?: string;
  registryId?: string;
  limit?: number;
  offset?: number;
}

export interface SyncResult {
  registryId: string;
  moduleCount: number;
  syncedAt: string;
}

export class TerraformRegistryService {
  constructor(private db: Database) {}

  private updateTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Create a new Terraform registry
   */
  async createRegistry(
    input: CreateRegistryInput
  ): Promise<Result<TerraformRegistry, TerraformError>> {
    console.log('[TerraformRegistryService] Creating registry:', input.name);

    // Check for duplicate by orgName
    const existing = await this.db.query.terraformRegistries.findFirst({
      where: eq(terraformRegistries.orgName, input.orgName),
    });

    if (existing) {
      return err(TerraformErrors.REGISTRY_ALREADY_EXISTS);
    }

    const now = this.updateTimestamp();
    const [created] = await this.db
      .insert(terraformRegistries)
      .values({
        name: input.name,
        orgName: input.orgName,
        tokenSettingKey: input.tokenSettingKey,
        status: 'active',
        syncIntervalMinutes: input.syncIntervalMinutes ?? null,
        nextSyncAt: input.syncIntervalMinutes
          ? new Date(Date.now() + input.syncIntervalMinutes * 60 * 1000).toISOString()
          : null,
        createdAt: now,
        updatedAt: now,
      } satisfies NewTerraformRegistry)
      .returning();

    if (!created) {
      console.error('[TerraformRegistryService] Failed to create registry');
      return err(TerraformErrors.REGISTRY_CREATE_FAILED);
    }

    console.log('[TerraformRegistryService] Created registry:', created.id);
    return ok(created);
  }

  /**
   * Get a registry by ID
   */
  async getRegistryById(id: string): Promise<Result<TerraformRegistry, TerraformError>> {
    const registry = await this.db.query.terraformRegistries.findFirst({
      where: eq(terraformRegistries.id, id),
    });

    if (!registry) {
      return err(TerraformErrors.REGISTRY_NOT_FOUND);
    }

    return ok(registry);
  }

  /**
   * List all registries ordered by most recently updated
   */
  async listRegistries(): Promise<Result<TerraformRegistry[], TerraformError>> {
    const items = await this.db.query.terraformRegistries.findMany({
      orderBy: [desc(terraformRegistries.updatedAt)],
    });

    return ok(items);
  }

  /**
   * Update a registry
   */
  async updateRegistry(
    id: string,
    input: UpdateRegistryInput
  ): Promise<Result<TerraformRegistry, TerraformError>> {
    const updates: Partial<TerraformRegistry> = {
      updatedAt: this.updateTimestamp(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.orgName !== undefined) updates.orgName = input.orgName;
    if (input.tokenSettingKey !== undefined) updates.tokenSettingKey = input.tokenSettingKey;
    if (input.syncIntervalMinutes !== undefined) {
      updates.syncIntervalMinutes = input.syncIntervalMinutes;
      updates.nextSyncAt = input.syncIntervalMinutes
        ? new Date(Date.now() + input.syncIntervalMinutes * 60 * 1000).toISOString()
        : null;
    }

    const [updated] = await this.db
      .update(terraformRegistries)
      .set(updates)
      .where(eq(terraformRegistries.id, id))
      .returning();

    if (!updated) {
      return err(TerraformErrors.REGISTRY_NOT_FOUND);
    }

    return ok(updated);
  }

  /**
   * Delete a registry and all its modules
   */
  async deleteRegistry(id: string): Promise<Result<void, TerraformError>> {
    console.log('[TerraformRegistryService] Deleting registry:', id);

    const registry = await this.db.query.terraformRegistries.findFirst({
      where: eq(terraformRegistries.id, id),
    });

    if (!registry) {
      console.error('[TerraformRegistryService] Registry not found for deletion:', id);
      return err(TerraformErrors.REGISTRY_NOT_FOUND);
    }

    // Delete modules first, then registry
    await this.db.delete(terraformModules).where(eq(terraformModules.registryId, id));
    await this.db.delete(terraformRegistries).where(eq(terraformRegistries.id, id));

    console.log('[TerraformRegistryService] Deleted registry:', id);
    return ok(undefined);
  }

  /**
   * Sync modules from the Terraform registry API
   */
  async sync(id: string): Promise<Result<SyncResult, TerraformError>> {
    console.log('[TerraformRegistryService] Starting sync for registry:', id);

    const registry = await this.db.query.terraformRegistries.findFirst({
      where: eq(terraformRegistries.id, id),
    });

    if (!registry) {
      console.error('[TerraformRegistryService] Registry not found for sync:', id);
      return err(TerraformErrors.REGISTRY_NOT_FOUND);
    }

    // Look up the API token from the settings table
    const tokenSetting = await this.db.query.settings.findFirst({
      where: eq(settings.key, registry.tokenSettingKey),
    });

    if (!tokenSetting) {
      console.error(
        '[TerraformRegistryService] Token setting not found:',
        registry.tokenSettingKey
      );
      await this.db
        .update(terraformRegistries)
        .set({
          status: 'error',
          syncError: 'API token not configured. Set the token in Settings.',
          updatedAt: this.updateTimestamp(),
        })
        .where(eq(terraformRegistries.id, id));
      return err(TerraformErrors.INVALID_TOKEN);
    }

    // Mark as syncing
    await this.db
      .update(terraformRegistries)
      .set({ status: 'syncing', updatedAt: this.updateTimestamp() })
      .where(eq(terraformRegistries.id, id));

    try {
      // Settings values are stored JSON-encoded in the DB; parse to get the raw token string
      let token: string;
      try {
        token = JSON.parse(tokenSetting.value) as string;
      } catch {
        token = tokenSetting.value;
      }

      const config: RegistryConfig = {
        baseUrl: 'https://app.terraform.io',
        orgName: registry.orgName,
        token,
      };

      const modules = await syncAllModules(config);

      if (modules.length === 0) {
        await this.db
          .update(terraformRegistries)
          .set({
            status: 'error',
            syncError: 'No modules found in the registry',
            updatedAt: this.updateTimestamp(),
          })
          .where(eq(terraformRegistries.id, id));
        return err(TerraformErrors.NO_MODULES_SYNCED);
      }

      // Replace all existing modules with fresh data
      await this.db.delete(terraformModules).where(eq(terraformModules.registryId, id));

      const now = this.updateTimestamp();
      // Batch insert all modules at once for performance
      await this.db.insert(terraformModules).values(
        modules.map((module) => ({
          ...module,
          registryId: id,
          createdAt: now,
          updatedAt: now,
        }))
      );

      // Update registry status (nextSyncAt is managed by the sync scheduler)
      await this.db
        .update(terraformRegistries)
        .set({
          status: 'active',
          lastSyncedAt: now,
          syncError: null,
          moduleCount: modules.length,
          updatedAt: now,
        })
        .where(eq(terraformRegistries.id, id));

      console.log(`[TerraformRegistryService] Sync complete for ${id}: ${modules.length} modules`);

      return ok({
        registryId: id,
        moduleCount: modules.length,
        syncedAt: now,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[TerraformRegistryService] Sync error for ${id}:`, errorMessage);

      await this.db
        .update(terraformRegistries)
        .set({
          status: 'error',
          syncError: errorMessage,
          updatedAt: this.updateTimestamp(),
        })
        .where(eq(terraformRegistries.id, id));

      return err(TerraformErrors.SYNC_FAILED(errorMessage));
    }
  }

  /**
   * List modules with optional search, provider filter, and pagination
   */
  async listModules(
    options?: ListModulesOptions
  ): Promise<Result<TerraformModule[], TerraformError>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [];

    if (options?.registryId) {
      conditions.push(eq(terraformModules.registryId, options.registryId));
    }

    if (options?.provider) {
      conditions.push(eq(terraformModules.provider, options.provider));
    }

    if (options?.search) {
      const searchPattern = `%${options.search}%`;
      const searchCondition = or(
        like(terraformModules.name, searchPattern),
        like(terraformModules.description, searchPattern)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    const items = await this.db.query.terraformModules.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(terraformModules.updatedAt)],
      limit,
      offset,
    });

    return ok(items);
  }

  /**
   * Get a single module by ID
   */
  async getModuleById(id: string): Promise<Result<TerraformModule, TerraformError>> {
    const module = await this.db.query.terraformModules.findFirst({
      where: eq(terraformModules.id, id),
    });

    if (!module) {
      return err(TerraformErrors.MODULE_NOT_FOUND);
    }

    return ok(module);
  }

  /**
   * Get module context formatted as structured text for AI prompts.
   * Optionally filter to a specific registry.
   */
  async getModuleContext(registryId?: string): Promise<Result<string, TerraformError>> {
    const conditions = registryId ? eq(terraformModules.registryId, registryId) : undefined;

    const modules = await this.db.query.terraformModules.findMany({
      where: conditions,
      orderBy: [desc(terraformModules.updatedAt)],
    });

    if (modules.length === 0) {
      return ok('No Terraform modules available.');
    }

    const lines: string[] = [`# Available Terraform Modules (${modules.length})`, ''];

    for (const module of modules) {
      lines.push(`## ${module.namespace}/${module.name}/${module.provider} v${module.version}`);
      lines.push(`Source: ${module.source}`);

      if (module.description) {
        lines.push(`Description: ${module.description}`);
      }

      const inputs = module.inputs as TerraformVariable[] | null;
      if (inputs && inputs.length > 0) {
        lines.push('');
        lines.push('### Inputs');
        for (const input of inputs) {
          const requiredTag = input.required ? ' (required)' : '';
          const sensitiveTag = input.sensitive ? ' [sensitive]' : '';
          const defaultTag =
            input.default !== undefined ? ` = ${JSON.stringify(input.default)}` : '';
          lines.push(
            `- **${input.name}** (${input.type})${requiredTag}${sensitiveTag}${defaultTag}${input.description ? `: ${input.description}` : ''}`
          );
        }
      }

      const outputs = module.outputs as TerraformOutput[] | null;
      if (outputs && outputs.length > 0) {
        lines.push('');
        lines.push('### Outputs');
        for (const output of outputs) {
          lines.push(`- **${output.name}**${output.description ? `: ${output.description}` : ''}`);
        }
      }

      const deps = module.dependencies as string[] | null;
      if (deps && deps.length > 0) {
        lines.push('');
        lines.push(`Dependencies: ${deps.join(', ')}`);
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return ok(lines.join('\n'));
  }
}
