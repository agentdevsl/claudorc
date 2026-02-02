import type {
  NewTerraformModule,
  TerraformOutput,
  TerraformVariable,
} from '../../db/schema/terraform.js';

export interface RegistryConfig {
  baseUrl: string;
  orgName: string;
  token: string;
}

/** Raw module shape from the HCP Terraform Registry API v2 (JSONAPI) */
interface RawModule {
  id: string;
  type: string;
  attributes: {
    name: string;
    namespace: string;
    provider: string;
    'registry-name'?: string;
    status: string;
    'version-statuses'?: Array<{ version: string; status: string }>;
  };
}

/** Raw module version detail from the API */
interface RawModuleVersion {
  id: string;
  type: string;
  attributes: {
    version: string;
    source: string;
    description?: string;
    readme?: string;
    published_at?: string;
    dependencies?: string[];
  };
  relationships?: {
    'root-module'?: {
      data?: { id: string };
    };
  };
}

/** Root module detail containing inputs/outputs */
interface RawRootModule {
  id: string;
  type: string;
  attributes: {
    inputs?: Array<{
      name: string;
      type: string;
      description?: string;
      default?: unknown;
      required: boolean;
      sensitive?: boolean;
    }>;
    outputs?: Array<{
      name: string;
      description?: string;
    }>;
  };
}

/** JSONAPI response envelope */
interface JsonApiResponse<T> {
  data: T;
  included?: Array<RawModuleVersion | RawRootModule>;
  links?: {
    self?: string;
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
  meta?: {
    pagination?: {
      'current-page': number;
      'total-pages': number;
      'total-count': number;
    };
  };
}

const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make an authenticated request to the HCP Terraform API.
 * Retries on 429 (rate limit) using the Retry-After header with exponential backoff.
 */
async function apiRequest<T>(config: RegistryConfig, path: string): Promise<T> {
  const url = `${config.baseUrl}${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/vnd.api+json',
      },
    });

    if (response.status === 429) {
      if (attempt === MAX_RETRIES) {
        throw new Error(`HCP Terraform API rate limit exceeded after ${MAX_RETRIES} retries`);
      }
      const retryAfter = response.headers.get('retry-after');
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : 1000 * 2 ** attempt;
      console.warn(
        `[RegistryClient] Rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      const safeBody = body.length > 200 ? `${body.slice(0, 200)}...` : body;
      throw new Error(`HCP Terraform API error (${response.status}): ${safeBody}`);
    }

    return response.json() as Promise<T>;
  }

  throw new Error('Unreachable');
}

/**
 * List all registry modules for an organization.
 * Handles JSONAPI pagination to retrieve all pages.
 */
export async function listRegistryModules(config: RegistryConfig): Promise<RawModule[]> {
  const allModules: RawModule[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await apiRequest<JsonApiResponse<RawModule[]>>(
      config,
      `/api/v2/organizations/${encodeURIComponent(config.orgName)}/registry-modules?page[number]=${page}&page[size]=100`
    );

    allModules.push(...response.data);

    if (response.meta?.pagination) {
      totalPages = response.meta.pagination['total-pages'];
    }

    page++;
  } while (page <= totalPages);

  return allModules;
}

/**
 * Get full detail for a specific module version, including inputs and outputs.
 */
export async function getModuleDetail(
  config: RegistryConfig,
  namespace: string,
  name: string,
  provider: string,
  version: string
): Promise<{
  source: string;
  description: string | null;
  readme: string | null;
  inputs: TerraformVariable[];
  outputs: TerraformOutput[];
  dependencies: string[];
  publishedAt: string | null;
}> {
  const response = await apiRequest<JsonApiResponse<RawModuleVersion>>(
    config,
    `/api/v2/organizations/${encodeURIComponent(config.orgName)}/registry-modules/private/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(provider)}/${encodeURIComponent(version)}?include=root-module`
  );

  const versionData = response.data;
  const attributes = versionData.attributes;

  // Extract root module from included resources for inputs/outputs
  let inputs: TerraformVariable[] = [];
  let outputs: TerraformOutput[] = [];

  if (response.included) {
    for (const included of response.included) {
      if (included.type === 'root-modules' || included.type === 'root-module') {
        const rootModule = included as RawRootModule;
        inputs = (rootModule.attributes.inputs ?? []).map((input) => ({
          name: input.name,
          type: input.type,
          description: input.description,
          default: input.default,
          required: input.required,
          sensitive: input.sensitive,
        }));
        outputs = (rootModule.attributes.outputs ?? []).map((output) => ({
          name: output.name,
          description: output.description,
        }));
        break;
      }
    }
  }

  return {
    source: attributes.source ?? '',
    description: attributes.description ?? null,
    readme: attributes.readme ?? null,
    inputs,
    outputs,
    dependencies: attributes.dependencies ?? [],
    publishedAt: attributes.published_at ?? null,
  };
}

/**
 * Sync all modules from a registry.
 * Lists all modules, then fetches details for each in batches of 2
 * with delays between batches to respect HCP Terraform's rate limits (30 req/s).
 */
export async function syncAllModules(config: RegistryConfig): Promise<NewTerraformModule[]> {
  const rawModules = await listRegistryModules(config);
  const results: NewTerraformModule[] = [];

  const batchSize = 2;
  for (let i = 0; i < rawModules.length; i += batchSize) {
    if (i > 0) await sleep(500);
    const batch = rawModules.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (rawModule) => {
        const { name, namespace, provider } = rawModule.attributes;

        // Determine the latest version from version-statuses
        const versionStatuses = rawModule.attributes['version-statuses'] ?? [];
        const latestVersion =
          versionStatuses.find((v) => v.status === 'ok')?.version ?? versionStatuses[0]?.version;

        if (!latestVersion) {
          console.warn(
            `[RegistryClient] No version found for module ${namespace}/${name}/${provider}, skipping`
          );
          return null;
        }

        try {
          const detail = await getModuleDetail(config, namespace, name, provider, latestVersion);

          const module: NewTerraformModule = {
            name,
            namespace,
            provider,
            version: latestVersion,
            source: detail.source || `${namespace}/${name}/${provider}`,
            description: detail.description,
            readme: detail.readme,
            inputs: detail.inputs,
            outputs: detail.outputs,
            dependencies: detail.dependencies,
            publishedAt: detail.publishedAt,
            registryId: '', // Will be set by the service
          };

          return module;
        } catch (error) {
          console.error(
            `[RegistryClient] Failed to fetch details for ${namespace}/${name}/${provider}@${latestVersion}:`,
            error instanceof Error ? error.message : String(error)
          );
          return null;
        }
      })
    );

    results.push(...batchResults.filter((r): r is NewTerraformModule => r !== null));
  }

  return results;
}
