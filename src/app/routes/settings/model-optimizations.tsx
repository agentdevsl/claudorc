import { Brain, Check } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ModelSelector } from '@/app/components/ui/model-selector';
import {
  DEFAULT_AGENT_MODEL,
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_TASK_CREATION_MODEL,
  DEFAULT_WORKFLOW_MODEL,
} from '@/lib/constants/models';

export const Route = createFileRoute('/settings/model-optimizations')({
  component: ModelOptimizationsPage,
});

function ModelOptimizationsPage(): React.JSX.Element {
  const [defaultModel, setDefaultModel] = useState<string | null>(() => {
    if (typeof window === 'undefined') return DEFAULT_AGENT_MODEL;
    return localStorage.getItem('default_model') || DEFAULT_AGENT_MODEL;
  });

  const [taskCreationModel, setTaskCreationModel] = useState<string | null>(() => {
    if (typeof window === 'undefined') return DEFAULT_TASK_CREATION_MODEL;
    return localStorage.getItem('task_creation_model') || DEFAULT_TASK_CREATION_MODEL;
  });

  const [workflowModel, setWorkflowModel] = useState<string | null>(() => {
    if (typeof window === 'undefined') return DEFAULT_WORKFLOW_MODEL;
    return localStorage.getItem('workflow_model') || DEFAULT_WORKFLOW_MODEL;
  });

  const [apiEndpoint, setApiEndpoint] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_ANTHROPIC_BASE_URL;
    return localStorage.getItem('anthropic_base_url') || DEFAULT_ANTHROPIC_BASE_URL;
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('default_model', defaultModel ?? DEFAULT_AGENT_MODEL);
    localStorage.setItem('task_creation_model', taskCreationModel ?? DEFAULT_TASK_CREATION_MODEL);
    localStorage.setItem('workflow_model', workflowModel ?? DEFAULT_WORKFLOW_MODEL);
    localStorage.setItem('anthropic_base_url', apiEndpoint);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div data-testid="model-optimizations-settings" className="mx-auto max-w-4xl px-8 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-fg">
          <Brain className="h-7 w-7 text-fg-muted" />
          Model Optimizations
        </h1>
        <p className="mt-2 text-fg-muted">
          Configure AI models for different features. Choose faster models for quick tasks or more
          capable models for complex work.
        </p>
      </header>

      <div className="space-y-6">
        {/* Agent Execution */}
        <div
          data-testid="agent-execution-section"
          className="rounded-lg border border-border bg-surface"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-fg">Agent Execution</h2>
            <p className="text-sm text-fg-muted">
              Model used when agents work on tasks (in-progress column)
            </p>
          </div>

          <div className="p-5">
            <div>
              <label htmlFor="default-model" className="block text-sm font-medium text-fg">
                Default Agent Model
              </label>
              <p className="mb-2 text-xs text-fg-muted">
                The default model for agent execution. Can be overridden per-task.
              </p>
              <ModelSelector
                value={defaultModel}
                onChange={setDefaultModel}
                data-testid="default-model-selector"
              />
            </div>
          </div>
        </div>

        {/* AI Features */}
        <div
          data-testid="ai-features-section"
          className="rounded-lg border border-border bg-surface"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-fg">AI Features</h2>
            <p className="text-sm text-fg-muted">
              Models for AI-powered features like task generation and workflow design
            </p>
          </div>

          <div className="space-y-6 p-5">
            {/* Task Creation Model */}
            <div>
              <label htmlFor="task-creation-model" className="block text-sm font-medium text-fg">
                Task Creation Model
              </label>
              <p className="mb-2 text-xs text-fg-muted">
                Model for the "Generate task with AI" assistant
              </p>
              <ModelSelector
                value={taskCreationModel}
                onChange={setTaskCreationModel}
                data-testid="task-creation-model-selector"
              />
            </div>

            {/* Workflow Designer Model */}
            <div>
              <label htmlFor="workflow-model" className="block text-sm font-medium text-fg">
                Workflow Designer Model
              </label>
              <p className="mb-2 text-xs text-fg-muted">
                Model for generating workflows from skill content
              </p>
              <ModelSelector
                value={workflowModel}
                onChange={setWorkflowModel}
                data-testid="workflow-model-selector"
              />
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div
          data-testid="api-config-section"
          className="rounded-lg border border-border bg-surface"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-fg">API Configuration</h2>
            <p className="text-sm text-fg-muted">Advanced API settings</p>
          </div>

          <div className="p-5">
            <div>
              <label htmlFor="api-endpoint" className="block text-sm font-medium text-fg">
                API Base URL
              </label>
              <p className="mb-2 text-xs text-fg-muted">
                Anthropic API base URL. Can also be set via ANTHROPIC_BASE_URL env var.
              </p>
              <input
                id="api-endpoint"
                data-testid="api-endpoint-input"
                type="url"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder={DEFAULT_ANTHROPIC_BASE_URL}
                className="w-full max-w-md rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <Button data-testid="save-model-settings" onClick={handleSave}>
            {saved ? (
              <>
                <Check className="h-4 w-4" weight="bold" />
                Saved!
              </>
            ) : (
              'Save Model Settings'
            )}
          </Button>
          {saved && (
            <span data-testid="save-success" className="text-sm text-success">
              Model settings saved successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
