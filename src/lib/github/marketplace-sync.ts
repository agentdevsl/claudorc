import type { Octokit } from 'octokit';
import type { Result } from '../utils/result.js';
import { err, ok } from '../utils/result.js';

/**
 * Cached plugin metadata from marketplace repository
 */
export interface CachedPlugin {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  category?: string;
  readme?: string;
}

export interface MarketplaceSyncOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
  pluginsPath?: string;
  ref?: string;
}

export interface MarketplaceSyncResult {
  plugins: CachedPlugin[];
  sha: string;
}

/**
 * Fetch plugins from a marketplace GitHub repository
 * Looks for plugin directories and extracts metadata from each
 */
export async function syncMarketplaceFromGitHub(
  options: MarketplaceSyncOptions
): Promise<Result<MarketplaceSyncResult, { message: string }>> {
  const { octokit, owner, repo, pluginsPath = 'plugins', ref = 'main' } = options;

  try {
    // Get the latest commit SHA
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${ref}`,
    });
    const sha = refData.object.sha;

    // Get the tree to find plugin directories
    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: sha,
      recursive: 'true',
    });

    // Find plugin directories (directories directly under pluginsPath)
    const pluginDirs = new Set<string>();
    const pluginsPrefix = pluginsPath.endsWith('/') ? pluginsPath : `${pluginsPath}/`;

    for (const item of tree.tree) {
      if (item.path?.startsWith(pluginsPrefix) && item.type === 'tree') {
        // Get the first directory segment after pluginsPath
        const relativePath = item.path.slice(pluginsPrefix.length);
        const pluginName = relativePath.split('/')[0];
        if (pluginName && !pluginName.includes('/')) {
          pluginDirs.add(pluginName);
        }
      }
    }

    // Fetch metadata for each plugin
    const plugins: CachedPlugin[] = [];

    for (const pluginId of pluginDirs) {
      const plugin = await fetchPluginMetadata(octokit, owner, repo, pluginsPath, pluginId, ref);
      if (plugin) {
        plugins.push(plugin);
      }
    }

    return ok({ plugins, sha });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({ message: `Failed to sync marketplace: ${message}` });
  }
}

async function fetchPluginMetadata(
  octokit: Octokit,
  owner: string,
  repo: string,
  pluginsPath: string,
  pluginId: string,
  ref: string
): Promise<CachedPlugin | null> {
  const basePath = `${pluginsPath}/${pluginId}`;

  let name = pluginId;
  let description: string | undefined;
  let author: string | undefined;
  let version: string | undefined;
  let category: string | undefined;
  let readme: string | undefined;

  // Try to fetch SKILL.md for frontmatter metadata
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `${basePath}/SKILL.md`,
      ref,
    });

    if ('content' in data && data.content) {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const metadata = parseSkillFrontmatter(content);
      if (metadata.name) name = metadata.name;
      if (metadata.description) description = metadata.description;
      if (metadata.author) author = metadata.author;
      if (metadata.version) version = metadata.version;
      if (metadata.category) category = metadata.category;
    }
  } catch {
    // SKILL.md not found, continue with defaults
  }

  // Try to fetch README.md
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `${basePath}/README.md`,
      ref,
    });

    if ('content' in data && data.content) {
      readme = Buffer.from(data.content, 'base64').toString('utf-8');
      // Extract description from first paragraph if not set
      if (!description && readme) {
        const firstParagraph = readme.split('\n\n')[1]?.trim();
        if (firstParagraph && !firstParagraph.startsWith('#')) {
          description = firstParagraph.slice(0, 200);
        }
      }
    }
  } catch {
    // README.md not found
  }

  return {
    id: pluginId,
    name,
    description,
    author,
    version,
    category,
    readme,
  };
}

/**
 * Parse YAML frontmatter from SKILL.md file
 * Extracts name, description, author, version, category
 */
function parseSkillFrontmatter(content: string): Partial<CachedPlugin> {
  const result: Partial<CachedPlugin> = {};

  // Check for YAML frontmatter
  if (!content.startsWith('---')) {
    return result;
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return result;
  }

  const frontmatter = content.slice(3, endIndex).trim();
  const lines = frontmatter.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case 'name':
        result.name = value;
        break;
      case 'description':
        result.description = value;
        break;
      case 'author':
        result.author = value;
        break;
      case 'version':
        result.version = value;
        break;
      case 'category':
        result.category = value;
        break;
    }
  }

  return result;
}

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubMarketplaceUrl(
  url: string
): Result<{ owner: string; repo: string }, { message: string }> {
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^([^/]+)\/([^/]+)$/, // simple owner/repo format
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1] && match[2]) {
      return ok({ owner: match[1], repo: match[2] });
    }
  }

  return err({ message: 'Invalid GitHub URL format' });
}
