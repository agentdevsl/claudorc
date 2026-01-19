import { Gear, GitBranch, Key, Plus, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { TextInput } from '@/app/components/ui/text-input';
import { Textarea } from '@/app/components/ui/textarea';
import type { Project, ProjectConfig } from '@/db/schema/projects';
import { DeleteProjectDialog } from './delete-project-dialog';

interface ProjectSettingsProps {
  project: Project;
  onSave: (input: {
    name?: string;
    description?: string;
    maxConcurrentAgents?: number;
    config?: Partial<ProjectConfig>;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ProjectSettings({
  project,
  onSave,
  onDelete,
}: ProjectSettingsProps): React.JSX.Element {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [maxConcurrent, setMaxConcurrent] = useState(project.maxConcurrentAgents ?? 3);
  const [config, setConfig] = useState<ProjectConfig>(
    project.config ?? {
      worktreeRoot: '.worktrees',
      defaultBranch: 'main',
      allowedTools: [],
      maxTurns: 50,
    }
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    Object.entries(project.config?.envVars ?? {}).map(([key, value]) => ({ key, value }))
  );
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  return (
    <section
      className="rounded-lg border border-border bg-surface p-6"
      data-testid="project-settings"
    >
      <div data-testid="github-settings" className="hidden" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-muted">
            <Gear className="h-5 w-5 text-fg-muted" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-fg">Project settings</h2>
            <p className="text-sm text-fg-muted">Control concurrency and default agent behavior.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" data-testid="agent-config-button">
          Agent config
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            htmlFor="project-name"
          >
            Project name
          </label>
          <TextInput
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="project-name-input"
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            htmlFor="project-path"
          >
            Project path
          </label>
          <TextInput
            id="project-path"
            value={project.path}
            readOnly
            className="bg-surface-muted text-fg-muted"
            data-testid="project-path-display"
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            htmlFor="project-description"
          >
            Description
          </label>
          <Textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the project..."
            rows={2}
            data-testid="project-description-input"
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            htmlFor="max-concurrent"
          >
            Max concurrent agents
          </label>
          <div className="flex items-center gap-3">
            <input
              id="max-concurrent"
              type="range"
              min={1}
              max={10}
              value={maxConcurrent}
              onChange={(event) => setMaxConcurrent(Number(event.target.value))}
              className="flex-1"
              data-testid="max-agents-slider"
            />
            <span className="w-8 text-right text-sm font-medium text-fg tabular-nums">
              {maxConcurrent}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            htmlFor="default-branch"
          >
            Default branch
          </label>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-fg-subtle" />
            <TextInput
              id="default-branch"
              value={config.defaultBranch}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  defaultBranch: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            htmlFor="worktree-root"
          >
            Worktree root
          </label>
          <TextInput
            id="worktree-root"
            value={config.worktreeRoot}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                worktreeRoot: event.target.value,
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            htmlFor="model"
          >
            Default model
          </label>
          <Select
            value={config.model ?? 'claude-sonnet-4'}
            onValueChange={(value) => setConfig((prev) => ({ ...prev, model: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-sonnet-4">Claude Sonnet 4</SelectItem>
              <SelectItem value="claude-opus-4">Claude Opus 4</SelectItem>
              <SelectItem value="claude-haiku-3-5">Claude Haiku 3.5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label
            className="text-xs font-medium uppercase tracking-wide text-fg-muted"
            htmlFor="system-prompt"
          >
            System prompt
          </label>
          <Textarea
            id="system-prompt"
            value={config.systemPrompt ?? ''}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                systemPrompt: event.target.value,
              }))
            }
            rows={4}
          />
        </div>
      </div>

      {/* Environment Variables Section */}
      <div className="mt-6 rounded-lg border border-border bg-surface-subtle p-4">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-4 w-4 text-fg-muted" />
          <h3 className="text-sm font-medium text-fg">Environment Variables</h3>
          <span className="text-xs text-fg-muted">(passed to sandbox containers)</span>
        </div>

        {/* Existing env vars */}
        {envVars.length > 0 && (
          <div className="space-y-2 mb-4">
            {envVars.map((env, index) => (
              <div key={`${env.key}-${index}`} className="flex items-center gap-2">
                <TextInput
                  value={env.key}
                  onChange={(e) => {
                    setEnvVars((prev) =>
                      prev.map((item, i) =>
                        i === index ? { key: e.target.value, value: item.value } : item
                      )
                    );
                  }}
                  placeholder="KEY"
                  className="flex-1 font-mono text-sm"
                  data-testid={`env-var-key-${index}`}
                />
                <span className="text-fg-muted">=</span>
                <TextInput
                  type="password"
                  value={env.value}
                  onChange={(e) => {
                    setEnvVars((prev) =>
                      prev.map((item, i) =>
                        i === index ? { key: item.key, value: e.target.value } : item
                      )
                    );
                  }}
                  placeholder="value"
                  className="flex-[2] font-mono text-sm"
                  data-testid={`env-var-value-${index}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEnvVars(envVars.filter((_, i) => i !== index));
                  }}
                  data-testid={`env-var-delete-${index}`}
                >
                  <Trash className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new env var */}
        <div className="flex items-center gap-2">
          <TextInput
            value={newEnvKey}
            onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
            placeholder="NEW_KEY"
            className="flex-1 font-mono text-sm"
            data-testid="env-var-new-key"
          />
          <span className="text-fg-muted">=</span>
          <TextInput
            type="password"
            value={newEnvValue}
            onChange={(e) => setNewEnvValue(e.target.value)}
            placeholder="value"
            className="flex-[2] font-mono text-sm"
            data-testid="env-var-new-value"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (newEnvKey.trim()) {
                setEnvVars([...envVars, { key: newEnvKey.trim(), value: newEnvValue }]);
                setNewEnvKey('');
                setNewEnvValue('');
              }
            }}
            disabled={!newEnvKey.trim()}
            data-testid="env-var-add"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          These environment variables will be securely passed to sandbox containers when running
          agents.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-success" data-testid="save-success">
            Settings ready
          </div>
          <Button
            onClick={() => {
              // Convert envVars array to object for storage
              const envVarsObject = envVars.reduce(
                (acc, { key, value }) => {
                  if (key.trim()) {
                    acc[key.trim()] = value;
                  }
                  return acc;
                },
                {} as Record<string, string>
              );

              onSave({
                name: name !== project.name ? name : undefined,
                description: description !== (project.description ?? '') ? description : undefined,
                maxConcurrentAgents: maxConcurrent,
                config: {
                  ...config,
                  worktreeRoot: config.worktreeRoot,
                  defaultBranch: config.defaultBranch,
                  envVars: Object.keys(envVarsObject).length > 0 ? envVarsObject : undefined,
                },
              });
            }}
            data-testid="save-settings-button"
          >
            Save settings
          </Button>
        </div>

        <div
          className="rounded-md border border-danger/40 bg-danger/10 p-4"
          data-testid="danger-zone"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-fg">Delete project</p>
              <p className="text-xs text-fg-muted">Remove this project and all related data.</p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              data-testid="delete-project-button"
            >
              Delete project
            </Button>
          </div>
        </div>
      </div>

      <DeleteProjectDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        projectName={project.name}
        onConfirm={onDelete}
      />
    </section>
  );
}
