import type { Icon } from '@phosphor-icons/react';
import { Check, Desktop, Moon, Palette, Sun, Swatches } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

type Theme = 'light' | 'dark' | 'system';

export const Route = createFileRoute('/settings/appearance')({
  component: AppearanceSettingsPage,
});

// ============================================================================
// ConfigSection Component (matching model-optimizations pattern)
// ============================================================================

function ConfigSection({
  icon: IconComponent,
  title,
  description,
  badge,
  badgeColor = 'accent',
  children,
  defaultOpen = true,
  testId,
}: {
  icon: Icon;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: 'accent' | 'success' | 'claude';
  children: React.ReactNode;
  defaultOpen?: boolean;
  testId?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const badgeColors = {
    accent: 'bg-accent-muted text-accent',
    success: 'bg-success-muted text-success',
    claude: 'bg-claude-muted text-claude',
  };

  return (
    <div
      data-testid={testId}
      className="group relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-surface to-surface/50 transition-all duration-300 hover:border-fg-subtle/30"
    >
      {/* Subtle gradient accent line at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />

      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-subtle/50"
      >
        {/* Icon container with gradient background */}
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-surface-emphasis to-surface-muted ring-1 ring-border/50">
          <IconComponent className="h-5 w-5 text-fg-muted" weight="duotone" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
            {badge && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                  badgeColors[badgeColor]
                )}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-fg-muted">{description}</p>
        </div>

        {/* Expand/collapse indicator */}
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200',
            isOpen ? 'rotate-180 bg-accent-muted' : 'bg-surface-emphasis'
          )}
        >
          <svg
            aria-hidden="true"
            className={cn('h-4 w-4 transition-colors', isOpen ? 'text-accent' : 'text-fg-muted')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible content */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/50 px-6 pb-6 pt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Enhanced Theme Option Component
// ============================================================================

function ThemeOption({
  theme,
  label,
  description,
  icon: IconComponent,
  isSelected,
  onSelect,
}: {
  theme: Theme;
  label: string;
  description: string;
  icon: Icon;
  isSelected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      data-testid={`theme-${theme}`}
      data-selected={isSelected}
      type="button"
      onClick={onSelect}
      className={cn(
        'group/theme relative flex flex-col rounded-xl border-2 p-5 text-left transition-all duration-200',
        isSelected
          ? 'border-accent bg-gradient-to-b from-accent-muted/50 to-accent-muted/20 shadow-md'
          : 'border-border bg-surface-subtle/30 hover:border-fg-subtle/50 hover:bg-surface-subtle'
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent shadow-sm">
          <Check className="h-3.5 w-3.5 text-white" weight="bold" />
        </div>
      )}

      {/* Theme preview */}
      <div
        className={cn(
          'mb-4 flex h-20 w-full items-center justify-center rounded-lg transition-transform group-hover/theme:scale-[1.02]',
          theme === 'light' && 'bg-white shadow-inner ring-1 ring-black/5',
          theme === 'dark' && 'bg-[#0d1117] shadow-inner ring-1 ring-white/10',
          theme === 'system' &&
            'bg-gradient-to-r from-white via-gray-300 to-[#0d1117] ring-1 ring-black/10'
        )}
      >
        {theme !== 'system' && (
          <IconComponent
            className={cn(
              'h-8 w-8 transition-transform group-hover/theme:scale-110',
              theme === 'light' ? 'text-amber-500' : 'text-indigo-400'
            )}
            weight="duotone"
          />
        )}
        {theme === 'system' && (
          <div className="flex items-center gap-1">
            <Sun className="h-6 w-6 text-amber-500" weight="duotone" />
            <span className="text-gray-400">/</span>
            <Moon className="h-6 w-6 text-indigo-400" weight="duotone" />
          </div>
        )}
      </div>

      {/* Label and description */}
      <div className="flex items-center gap-2">
        <IconComponent
          className={cn('h-4 w-4', isSelected ? 'text-accent' : 'text-fg-muted')}
          weight={isSelected ? 'fill' : 'regular'}
        />
        <span className={cn('font-medium', isSelected ? 'text-fg' : 'text-fg-muted')}>{label}</span>
      </div>
      <p className="mt-1 text-xs text-fg-subtle">{description}</p>
    </button>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

function AppearanceSettingsPage(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('theme');
    return (stored as Theme) || 'system';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  const themeLabel = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';

  return (
    <div data-testid="appearance-settings" className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
      {/* Page Header with gradient accent */}
      <header className="relative mb-10">
        {/* Decorative background elements */}
        <div className="absolute -left-4 -top-4 h-24 w-24 rounded-full bg-accent/5 blur-2xl" />
        <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-claude/5 blur-xl" />

        <div className="relative">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent-muted to-accent-subtle ring-1 ring-accent/20">
              <Swatches className="h-6 w-6 text-accent" weight="duotone" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-fg">Appearance</h1>
              <p className="text-sm text-fg-muted">Customize the look and feel of AgentPane</p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-6 flex flex-wrap gap-6 rounded-lg border border-border/50 bg-surface-subtle/50 px-5 py-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-fg-subtle" />
              <span className="text-xs text-fg-muted">
                Current theme: <span className="font-medium text-fg">{themeLabel}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {theme === 'light' ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : theme === 'dark' ? (
                <Moon className="h-4 w-4 text-indigo-400" />
              ) : (
                <Desktop className="h-4 w-4 text-fg-muted" />
              )}
              <span className="text-xs text-fg-muted">
                {theme === 'system' ? 'Follows OS preference' : 'Manual override'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        {/* Theme Selection */}
        <ConfigSection
          icon={Palette}
          title="Color Theme"
          description="Select your preferred color scheme"
          badge="Display"
          badgeColor="accent"
          testId="theme-section"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ThemeOption
              theme="light"
              label="Light"
              description="Bright and clear"
              icon={Sun}
              isSelected={theme === 'light'}
              onSelect={() => handleThemeChange('light')}
            />
            <ThemeOption
              theme="dark"
              label="Dark"
              description="Easy on the eyes"
              icon={Moon}
              isSelected={theme === 'dark'}
              onSelect={() => handleThemeChange('dark')}
            />
            <ThemeOption
              theme="system"
              label="System"
              description="Match OS setting"
              icon={Desktop}
              isSelected={theme === 'system'}
              onSelect={() => handleThemeChange('system')}
            />
          </div>
        </ConfigSection>

        {/* Preview */}
        <ConfigSection
          icon={Swatches}
          title="Live Preview"
          description="See how UI elements look with your theme"
          badge="Preview"
          badgeColor="success"
          testId="theme-preview"
        >
          <div className="space-y-5">
            {/* Sample card */}
            <div className="rounded-lg border border-border/70 bg-surface-subtle/30 p-5 transition-all hover:border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent to-accent/70" />
                <div className="flex-1">
                  <div className="h-4 w-32 rounded bg-fg" />
                  <div className="mt-1.5 h-3 w-48 rounded bg-fg-muted/50" />
                </div>
                <span className="rounded-full bg-success-muted px-2.5 py-1 text-xs font-medium text-success">
                  Active
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-accent/90"
              >
                Primary Button
              </button>
              <button
                type="button"
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg transition-all hover:bg-surface-subtle"
              >
                Secondary
              </button>
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-medium text-fg-muted transition-all hover:bg-surface-subtle hover:text-fg"
              >
                Ghost
              </button>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-success-muted px-2.5 py-1 text-xs font-medium text-success">
                Success
              </span>
              <span className="rounded-full bg-attention-muted px-2.5 py-1 text-xs font-medium text-attention">
                Warning
              </span>
              <span className="rounded-full bg-danger-muted px-2.5 py-1 text-xs font-medium text-danger">
                Error
              </span>
              <span className="rounded-full bg-accent-muted px-2.5 py-1 text-xs font-medium text-accent">
                Info
              </span>
              <span className="rounded-full bg-claude-muted px-2.5 py-1 text-xs font-medium text-claude">
                Claude
              </span>
            </div>

            {/* Code block */}
            <div className="rounded-lg border border-border/50 bg-surface-emphasis p-4">
              <pre className="font-mono text-sm text-fg-muted">
                <code>
                  <span className="text-accent">const</span> agent ={' '}
                  <span className="text-success">new</span> Agent();
                  {'\n'}
                  <span className="text-accent">await</span> agent.
                  <span className="text-attention">execute</span>(task);
                </code>
              </pre>
            </div>
          </div>
        </ConfigSection>

        {/* Info note */}
        <div className="rounded-xl border border-accent/20 bg-accent-muted/20 p-4">
          <p className="text-sm text-fg-muted">
            <strong className="text-accent">Tip:</strong> Theme preference is saved to your browser
            and will persist across sessions.
          </p>
        </div>
      </div>
    </div>
  );
}

function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
