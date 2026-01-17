import fs from 'node:fs';
import path from 'node:path';
import { projectConfigSchema } from './schemas.js';
import type { ProjectConfig } from './types.js';

export const watchConfig = (
  projectPath: string,
  onConfigChange: (config: ProjectConfig) => void
): (() => void) => {
  const configPath = path.join(projectPath, '.claude', 'settings.json');

  const watcher = fs.watch(configPath, async (eventType) => {
    if (eventType === 'change') {
      try {
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        const validated = projectConfigSchema.parse(parsed);
        onConfigChange(validated);
      } catch (error) {
        console.error('Config reload failed:', error);
      }
    }
  });

  return () => watcher.close();
};
