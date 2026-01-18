import { Desktop, Moon, Sun, Swatches } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

export const Route = createFileRoute('/settings/appearance')({
  component: AppearanceSettingsPage,
});

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

  return (
    <div data-testid="appearance-settings" className="mx-auto max-w-4xl px-8 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-fg">
          <Swatches className="h-7 w-7 text-fg-muted" />
          Appearance
        </h1>
        <p className="mt-2 text-fg-muted">Customize the look and feel of AgentPane.</p>
      </header>

      <div className="space-y-6">
        {/* Theme Selection */}
        <div data-testid="theme-section" className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-fg">Theme</h2>
            <p className="text-sm text-fg-muted">Select your preferred color scheme</p>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-3 gap-4">
              <ThemeOption
                theme="light"
                label="Light"
                icon={<Sun className="h-5 w-5" />}
                isSelected={theme === 'light'}
                onSelect={() => handleThemeChange('light')}
              />
              <ThemeOption
                theme="dark"
                label="Dark"
                icon={<Moon className="h-5 w-5" />}
                isSelected={theme === 'dark'}
                onSelect={() => handleThemeChange('dark')}
              />
              <ThemeOption
                theme="system"
                label="System"
                icon={<Desktop className="h-5 w-5" />}
                isSelected={theme === 'system'}
                onSelect={() => handleThemeChange('system')}
              />
            </div>
          </div>
        </div>

        {/* Preview Card */}
        <div data-testid="theme-preview" className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold text-fg">Preview</h2>
            <p className="text-sm text-fg-muted">See how the theme looks</p>
          </div>

          <div className="p-5">
            <div className="space-y-4">
              {/* Sample UI elements */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-accent" />
                <div className="flex-1">
                  <div className="h-4 w-32 rounded bg-fg" />
                  <div className="mt-1 h-3 w-48 rounded bg-fg-muted" />
                </div>
                <span className="rounded-full bg-success-muted px-2 py-0.5 text-xs text-success">
                  Active
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                >
                  Primary Button
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border bg-surface-subtle px-3 py-1.5 text-sm font-medium text-fg"
                >
                  Secondary
                </button>
                <button
                  type="button"
                  className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
                >
                  Ghost
                </button>
              </div>

              <div className="flex gap-2">
                <span className="rounded-full bg-success-muted px-2 py-0.5 text-xs text-success">
                  Success
                </span>
                <span className="rounded-full bg-attention-muted px-2 py-0.5 text-xs text-attention">
                  Warning
                </span>
                <span className="rounded-full bg-danger-muted px-2 py-0.5 text-xs text-danger">
                  Error
                </span>
                <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs text-accent">
                  Info
                </span>
              </div>

              <div className="rounded-md border border-border bg-surface-subtle p-3">
                <p className="font-mono text-sm text-fg-muted">
                  const agent = new Agent();
                  <br />
                  await agent.execute(task);
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeOption({
  theme,
  label,
  icon,
  isSelected,
  onSelect,
}: {
  theme: Theme;
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      data-testid={`theme-${theme}`}
      data-selected={isSelected}
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors ${
        isSelected
          ? 'border-accent bg-accent-muted'
          : 'border-border hover:border-accent/50 hover:bg-surface-subtle'
      }`}
    >
      {/* Theme preview mini */}
      <div
        className={`flex h-16 w-full items-center justify-center rounded-md ${
          theme === 'light'
            ? 'bg-white text-gray-800'
            : theme === 'dark'
              ? 'bg-[#0d1117] text-gray-200'
              : 'bg-gradient-to-r from-white to-[#0d1117]'
        }`}
      >
        <span className={theme === 'system' ? 'text-transparent' : ''}>{icon}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={isSelected ? 'text-accent' : 'text-fg-muted'}>{icon}</span>
        <span className={`font-medium ${isSelected ? 'text-fg' : 'text-fg-muted'}`}>{label}</span>
      </div>
    </button>
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
