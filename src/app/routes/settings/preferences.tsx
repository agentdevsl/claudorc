import type { Icon } from '@phosphor-icons/react';
import {
  Bell,
  Check,
  Gauge,
  GearFine,
  Play,
  Robot,
  SlidersHorizontal,
  SpeakerHigh,
  Stack,
  Timer,
  Users,
} from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { ConfigSection } from '@/app/components/ui/config-section';
import { cn } from '@/lib/utils/cn';

export const Route = createFileRoute('/settings/preferences')({
  component: PreferencesSettingsPage,
});

// ============================================================================
// Enhanced Toggle Setting Component
// ============================================================================

function ToggleSetting({
  icon: IconComponent,
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  icon: Icon;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-surface-subtle/30 p-4 transition-all hover:border-border">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-surface-emphasis/50">
          <IconComponent className="h-4 w-4 text-fg-muted" weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative ml-4 h-7 w-12 flex-shrink-0 rounded-full transition-all duration-200',
          checked
            ? 'bg-gradient-to-r from-accent to-accent/80 shadow-inner'
            : 'bg-surface-emphasis ring-1 ring-border/50'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-200',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </button>
    </div>
  );
}

// ============================================================================
// Number Input Card Component
// ============================================================================

function NumberInputCard({
  icon: IconComponent,
  label,
  description,
  value,
  onChange,
  min,
  max,
  unit,
  testId,
}: {
  icon: Icon;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  unit?: string;
  testId?: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-subtle/30 p-5 transition-all hover:border-border">
      {/* Card header */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-surface-emphasis/50">
          <IconComponent className="h-4 w-4 text-fg-muted" weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-fg">{label}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{description}</p>
        </div>
      </div>

      {/* Input with visual enhancement */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            data-testid={testId}
            className="w-24 rounded-lg border border-border bg-surface px-3 py-2.5 text-center font-mono text-sm font-medium text-fg transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        {unit && (
          <span className="text-xs text-fg-muted">
            {unit} ({min}-{max})
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

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

  // Count active settings for stats
  const activeFeatures = [autoStartAgents, soundEnabled].filter(Boolean).length;

  return (
    <div data-testid="preferences-settings" className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
      {/* Page Header with gradient accent */}
      <header className="relative mb-10">
        {/* Decorative background elements */}
        <div className="absolute -left-4 -top-4 h-24 w-24 rounded-full bg-claude/5 blur-2xl" />
        <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-accent/5 blur-xl" />

        <div className="relative">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-claude-muted to-claude-subtle ring-1 ring-claude/20">
              <SlidersHorizontal className="h-6 w-6 text-claude" weight="duotone" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-fg">Agent Configuration</h1>
              <p className="text-sm text-fg-muted">
                Default settings for agent behavior and execution limits
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-6 flex flex-wrap gap-6 rounded-lg border border-border/50 bg-surface-subtle/50 px-5 py-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-fg-subtle" />
              <span className="text-xs text-fg-muted">
                <span className="font-medium text-fg">{maxTurns}</span> max turns
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-attention-fg" />
              <span className="text-xs text-fg-muted">
                <span className="font-medium text-fg">{maxConcurrentAgents}</span> concurrent agents
              </span>
            </div>
            <div className="flex items-center gap-2">
              <GearFine className="h-4 w-4 text-done-fg" />
              <span className="text-xs text-fg-muted">
                <span className="font-medium text-fg">{activeFeatures}</span> features enabled
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        {/* Agent Execution Limits */}
        <ConfigSection
          icon={Robot}
          title="Execution Limits"
          description="Resource constraints for agent task execution"
          badge="Core"
          badgeColor="claude"
          testId="agent-defaults-section"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInputCard
              icon={Gauge}
              label="Maximum Turns"
              description="API turns per agent execution before automatic stop"
              value={maxTurns}
              onChange={setMaxTurns}
              min={1}
              max={200}
              unit="turns"
              testId="max-turns-input"
            />
            <NumberInputCard
              icon={Stack}
              label="Concurrent Agents"
              description="Agents that can run simultaneously per project"
              value={maxConcurrentAgents}
              onChange={setMaxConcurrentAgents}
              min={1}
              max={10}
              unit="agents"
              testId="max-agents-input"
            />
          </div>
        </ConfigSection>

        {/* Automation & Behavior */}
        <ConfigSection
          icon={Bell}
          title="Automation & Notifications"
          description="Control how AgentPane responds to events"
          badge="Behavior"
          badgeColor="accent"
          testId="behavior-section"
        >
          <div className="space-y-3">
            <ToggleSetting
              icon={Play}
              label="Auto-start agents"
              description="Automatically start agents when tasks are moved to In Progress"
              checked={autoStartAgents}
              onChange={setAutoStartAgents}
              testId="auto-start-toggle"
            />
            <ToggleSetting
              icon={SpeakerHigh}
              label="Sound notifications"
              description="Play sounds when agents complete tasks or need attention"
              checked={soundEnabled}
              onChange={setSoundEnabled}
              testId="sound-toggle"
            />
          </div>
        </ConfigSection>

        {/* Save Button - Sticky footer style */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border border-border bg-surface/95 px-5 py-4 shadow-lg backdrop-blur-sm">
          <p className="text-sm text-fg-muted">
            Settings saved to browser storage.{' '}
            <a href="/settings/model-optimizations" className="text-accent hover:underline">
              Configure models →
            </a>
          </p>
          <Button
            data-testid="save-preferences"
            onClick={handleSave}
            className={cn(
              'min-w-[140px] transition-all',
              saved && 'bg-success-emphasis hover:bg-success-emphasis'
            )}
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" weight="bold" />
                Saved!
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
