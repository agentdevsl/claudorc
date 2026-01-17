import fs from 'node:fs/promises';
import path from 'node:path';
import { err, ok } from '../utils/result.js';
import type { Result } from '../utils/result.js';
import { deepMerge } from '../utils/deep-merge.js';
import { projectConfigSchema } from './schemas.js';
import { DEFAULT_PROJECT_CONFIG, type ProjectConfig } from './types.js';
import { containsSecrets } from './validate-secrets.js';
import { createError } from '../errors/base.js';

export type ProjectConfigResult = Result<ProjectConfig, ReturnType<typeof createError>>;

export type LoadedConfig = {
  project: ProjectConfig;
};

export const loadProjectConfigFrom = async ({
  projectPath,
}: {
  projectPath: string;
}): Promise<ProjectConfigResult> => {
  const projectConfigPath = path.join(projectPath, '.claude', 'settings.json');

  try {
    const content = await fs.readFile(projectConfigPath, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const validated = projectConfigSchema.parse(parsed);

    const merged = deepMerge(DEFAULT_PROJECT_CONFIG, validated);

    return ok(merged);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok(DEFAULT_PROJECT_CONFIG);
    }

    return err(
      createError('PROJECT_CONFIG_INVALID', 'Invalid configuration', 400, {
        error: String(error),
      })
    );
  }
};

const parseEnvNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const loadProjectConfig = async ({
  projectPath,
}: {
  projectPath: string;
}): Promise<Result<LoadedConfig, ReturnType<typeof createError>>> => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return err(
      createError('CONFIG_MISSING_API_KEY', 'Missing ANTHROPIC_API_KEY', 400, {
        env: 'ANTHROPIC_API_KEY',
      })
    );
  }

  const baseConfigResult = await loadProjectConfigFrom({ projectPath });
  if (!baseConfigResult.ok) {
    return baseConfigResult;
  }

  const envOverrides: Partial<ProjectConfig> = {
    maxTurns: parseEnvNumber(process.env.AGENTPANE_MAX_TURNS, baseConfigResult.value.maxTurns),
  };

  const merged = deepMerge(baseConfigResult.value, envOverrides);
  const envKeys = Object.keys(envOverrides).reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = envOverrides[key as keyof ProjectConfig];
    return acc;
  }, {});

  const secrets = containsSecrets(envKeys);

  if (secrets.length > 0) {
    return err(
      createError('CONFIG_SECRET_DETECTED', 'Configuration contains secrets', 400, {
        keys: secrets,
      })
    );
  }

  return ok({ project: merged });
};
