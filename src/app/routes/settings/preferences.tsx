import { Check, Gear } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';

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
          Defaults
        </h1>
        <p className="mt-2 text-fg-muted">
          Configure default settings for agents and projects. For model selection, see{' '}
          <a href="/settings/model-optimizations" className="text-accent hover:underline">
            Model Optimizations
          </a>
          .
        </p>
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
