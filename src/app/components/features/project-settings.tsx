import { Gear, GitBranch } from '@phosphor-icons/react';
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

interface ProjectSettingsProps {
  project: Project;
  onSave: (input: {
    maxConcurrentAgents?: number;
    config?: Partial<ProjectConfig>;
  }) => Promise<void>;
}

export function ProjectSettings({ project, onSave }: ProjectSettingsProps): React.JSX.Element {
  const [maxConcurrent, setMaxConcurrent] = useState(project.maxConcurrentAgents ?? 3);
  const [config, setConfig] = useState<ProjectConfig>(
    project.config ?? {
      worktreeRoot: '.worktrees',
      defaultBranch: 'main',
      allowedTools: [],
      maxTurns: 50,
    }
  );

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
            defaultValue={project.name}
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
            data-testid="project-path-display"
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

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-success" data-testid="save-success">
            Settings ready
          </div>
          <Button
            onClick={() =>
              onSave({
                maxConcurrentAgents: maxConcurrent,
                config: {
                  ...config,
                  worktreeRoot: config.worktreeRoot,
                  defaultBranch: config.defaultBranch,
                },
              })
            }
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
            <Button variant="destructive" data-testid="delete-project-button">
              Delete project
            </Button>
          </div>
          <div data-testid="delete-confirmation-dialog" className="hidden" />
        </div>
      </div>
    </section>
  );
}
