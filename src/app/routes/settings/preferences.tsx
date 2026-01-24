import { Check, Gear } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ModelSelector } from '@/app/components/ui/model-selector';
import {
  DEFAULT_AGENT_MODEL,
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_WORKFLOW_MODEL,
} from '@/lib/constants/models';

export const Route = createFileRoute('/settings/preferences')({
  component: PreferencesSettingsPage,
});

function PreferencesSettingsPage(): React.JSX.Element {
  const [maxTurns, setMaxTurns] = useState(() => {
    if (typeof window === 'undefined') return '50';
    return localStorage.getItem('default_max_turns') || '50';
  });

  const [maxConcurrentAgents, setMaxConcurrentAgents] = useState(() => {
    if (typeof window === 'undefined') return '3';
    return localStorage.getItem('default_max_concurrent_agents') || '3';
  });

  const [defaultModel, setDefaultModel] = useState<string | null>(() => {
    if (typeof window === 'undefined') return DEFAULT_AGENT_MODEL;
    return localStorage.getItem('default_model') || DEFAULT_AGENT_MODEL;
  });

  const [workflowModel, setWorkflowModel] = useState<string | null>(() => {
    if (typeof window === 'undefined') return DEFAULT_WORKFLOW_MODEL;
    return localStorage.getItem('workflow_model') || DEFAULT_WORKFLOW_MODEL;
  });

  const [apiEndpoint, setApiEndpoint] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_ANTHROPIC_BASE_URL;
    return localStorage.getItem('anthropic_base_url') || DEFAULT_ANTHROPIC_BASE_URL;
  });

  const [autoStartAgents, setAutoStartAgents] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('auto_start_agents') === 'true';
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('sound_enabled') !== 'false';
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('default_max_turns', maxTurns);
    localStorage.setItem('default_max_concurrent_agents', maxConcurrentAgents);
    localStorage.setItem('default_model', defaultModel ?? DEFAULT_AGENT_MODEL);
    localStorage.setItem('workflow_model', workflowModel ?? DEFAULT_WORKFLOW_MODEL);
    localStorage.setItem('anthropic_base_url', apiEndpoint);
    localStorage.setItem('auto_start_agents', String(autoStartAgents));
    localStorage.setItem('sound_enabled', String(soundEnabled));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div data-testid="preferences-settings" className="mx-auto max-w-4xl px-8 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-fg">
          <Gear className="h-7 w-7 text-fg-muted" />
          Preferences
        </h1>
        <p className="mt-2 text-fg-muted">Configure default settings for agents and projects.</p>
      </header>

      <div className="space-y-6">
        {/* Agent Defaults */}
        <div
          data-testid="agent-defaults-section"
          className="rounded-lg border border-border bg-surface"
        >
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-fg">Agent Defaults</h2>
            <p className="text-sm text-fg-muted">
              Default configuration applied to new agent executions
            </p>
          </div>

          <div className="space-y-6 p-5">
            {/* Default Model */}
            <div>
              <label htmlFor="default-model" className="block text-sm font-medium text-fg">
                Default Model
              </label>
              <p className="mb-2 text-xs text-fg-muted">
                Default AI model used for agent execution
              </p>
              <ModelSelector
                value={defaultModel}
                onChange={setDefaultModel}
                data-testid="default-model-selector"
              />
            </div>

            {/* Max Turns */}
            <div>
              <label htmlFor="max-turns" className="block text-sm font-medium text-fg">
                Maximum Turns
              </label>
              <p className="mb-2 text-xs text-fg-muted">
                Maximum API turns per agent execution (1-200)
              </p>
              <input
                id="max-turns"
                data-testid="max-turns-input"
                type="number"
                value={maxTurns}
                onChange={(e) => setMaxTurns(e.target.value)}
                min={1}
                max={200}
                className="w-32 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Max Concurrent Agents */}
            <div>
              <label htmlFor="max-agents" className="block text-sm font-medium text-fg">
                Max Concurrent Agents
              </label>
              <p className="mb-2 text-xs text-fg-muted">
                Maximum agents that can run simultaneously per project (1-10)
              </p>
              <input
                id="max-agents"
                data-testid="max-agents-input"
                type="number"
                value={maxConcurrentAgents}
                onChange={(e) => setMaxConcurrentAgents(e.target.value)}
                min={1}
                max={10}
                className="w-32 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
              Configure AI-powered features like workflow generation
            </p>
          </div>

          <div className="space-y-6 p-5">
            {/* Workflow Designer Model */}
            <div>
              <label htmlFor="workflow-model" className="block text-sm font-medium text-fg">
                Workflow Designer Model
              </label>
              <p className="mb-2 text-xs text-fg-muted">
                AI model used for generating workflows from skill content
              </p>
              <ModelSelector
                value={workflowModel}
                onChange={setWorkflowModel}
                data-testid="workflow-model-selector"
              />
            </div>

            {/* API Base URL */}
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

        {/* Behavior */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-fg">Behavior</h2>
            <p className="text-sm text-fg-muted">Configure how AgentPane behaves</p>
          </div>

          <div className="space-y-4 p-5">
            {/* Auto-start agents toggle */}
            <ToggleSetting
              label="Auto-start agents"
              description="Automatically start agents when tasks are moved to In Progress"
              checked={autoStartAgents}
              onChange={setAutoStartAgents}
            />

            {/* Sound enabled toggle */}
            <ToggleSetting
              label="Sound notifications"
              description="Play sounds when agents complete tasks or need attention"
              checked={soundEnabled}
              onChange={setSoundEnabled}
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <Button data-testid="save-preferences" onClick={handleSave}>
            {saved ? (
              <>
                <Check className="h-4 w-4" weight="bold" />
                Saved!
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
          {saved && (
            <span data-testid="save-success" className="text-sm text-success">
              Preferences saved successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-fg-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-surface-emphasis'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
