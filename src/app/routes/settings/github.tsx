import {
  ArrowsClockwise,
  CaretRight,
  Check,
  CircleNotch,
  Eye,
  Folder,
  GithubLogo,
  Plus,
  WarningCircle,
} from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';

type GitHubState = 'disconnected' | 'oauth' | 'install' | 'connected';

type Installation = {
  id: string;
  name: string;
  type: 'personal' | 'organization';
  repoCount: number;
  avatarUrl?: string;
  installedAt?: Date;
};

type Repository = {
  id: string;
  fullName: string;
  configPath?: string;
  syncStatus: 'synced' | 'pending' | 'no-config';
};

export const Route = createFileRoute('/settings/github')({
  component: GitHubSettingsPage,
});

function GitHubSettingsPage(): React.JSX.Element {
  const [state, setState] = useState<GitHubState>('disconnected');
  const [selectedInstallation, setSelectedInstallation] = useState<string | null>(null);

  // Mock data for demonstration
  const installations: Installation[] = [
    {
      id: '1',
      name: 'simon-lynch',
      type: 'personal',
      repoCount: 12,
      installedAt: new Date('2026-01-15'),
    },
    {
      id: '2',
      name: 'acme-corp',
      type: 'organization',
      repoCount: 47,
    },
  ];

  const connectedInstallations: Installation[] = [
    {
      id: '1',
      name: 'simon-lynch',
      type: 'personal',
      repoCount: 12,
      installedAt: new Date('2026-01-15'),
    },
  ];

  const repositories: Repository[] = [
    {
      id: '1',
      fullName: 'simon-lynch/claudorc',
      configPath: '.claude/config.json',
      syncStatus: 'synced',
    },
    {
      id: '2',
      fullName: 'simon-lynch/webapp-dashboard',
      configPath: '.claude/config.json',
      syncStatus: 'synced',
    },
    {
      id: '3',
      fullName: 'simon-lynch/agent-sdk-examples',
      configPath: undefined,
      syncStatus: 'no-config',
    },
  ];

  const handleConnect = () => {
    setState('oauth');
    // In real app: window.open(GITHUB_APP_INSTALL_URL)
    // Then wait for webhook callback
    setTimeout(() => setState('install'), 2000);
  };

  const handleSelectInstallation = () => {
    setState('connected');
  };

  const handleDisconnect = () => {
    setState('disconnected');
    setSelectedInstallation(null);
  };

  return (
    <div data-testid="github-settings" className="mx-auto max-w-4xl px-8 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-fg">
          <GithubLogo className="h-7 w-7 text-fg-muted" weight="fill" />
          GitHub Integration
        </h1>
        <p className="mt-2 text-fg-muted">
          Connect your GitHub account to sync configuration and create pull requests
        </p>
      </header>

      {/* State: Disconnected */}
      {state === 'disconnected' && (
        <div data-testid="github-not-connected">
          <div data-testid="github-connection-status" />
          <DisconnectedState onConnect={handleConnect} />
        </div>
      )}

      {/* State: OAuth Flow */}
      {state === 'oauth' && <OAuthFlowState onCancel={() => setState('disconnected')} />}

      {/* State: Installation Selection */}
      {state === 'install' && (
        <InstallationSelectState
          installations={installations}
          selectedId={selectedInstallation}
          onSelect={setSelectedInstallation}
          onContinue={handleSelectInstallation}
          onCancel={() => setState('disconnected')}
        />
      )}

      {/* State: Connected */}
      {state === 'connected' && (
        <div data-testid="github-connected">
          <div data-testid="github-connection-status" />
          <ConnectedState
            installations={connectedInstallations}
            repositories={repositories}
            onDisconnect={handleDisconnect}
          />
        </div>
      )}
    </div>
  );
}

// State 1: Disconnected
function DisconnectedState({ onConnect }: { onConnect: () => void }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="px-6 py-12 text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-border bg-surface-subtle">
          <GithubLogo className="h-10 w-10 text-fg-subtle" weight="fill" />
        </div>

        {/* Title & Description */}
        <h3 className="text-xl font-semibold text-fg">Connect to GitHub</h3>
        <p className="mx-auto mt-3 max-w-md text-fg-muted">
          Install the AgentPane GitHub App to enable configuration sync, automatic pull requests,
          and repository management.
        </p>

        {/* Connect Button */}
        <Button
          data-testid="connect-github"
          onClick={onConnect}
          className="mt-6 bg-[#24292e] hover:bg-[#30363d]"
        >
          <GithubLogo className="h-4.5 w-4.5" weight="fill" />
          Connect with GitHub
        </Button>

        {/* Features Grid */}
        <div className="mt-10 grid grid-cols-3 gap-4 text-left">
          <FeatureCard
            icon={<ArrowsClockwise className="h-4.5 w-4.5" />}
            title="Config Sync"
            description="Automatically sync agent configuration from your repository"
          />
          <FeatureCard
            icon={<CaretRight className="h-4.5 w-4.5" />}
            title="Pull Requests"
            description="Create PRs automatically when agents complete tasks"
          />
          <FeatureCard
            icon={<Folder className="h-4.5 w-4.5" />}
            title="Webhooks"
            description="Receive push events to auto-update configurations"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-border-muted bg-surface-subtle p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-accent-muted text-accent">
        {icon}
      </div>
      <h4 className="font-medium text-fg">{title}</h4>
      <p className="mt-1 text-xs text-fg-muted">{description}</p>
    </div>
  );
}

// State 2: OAuth Flow
function OAuthFlowState({ onCancel }: { onCancel: () => void }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="px-6 py-8">
        {/* Progress Steps */}
        <div className="mb-10 flex items-center justify-center gap-6">
          <OAuthStep status="completed" label="Clicked Install" step={1} />
          <div className="mt-[-24px] h-0.5 w-16 bg-success" />
          <OAuthStep status="active" label="GitHub Setup" step={2} />
          <div className="mt-[-24px] h-0.5 w-16 bg-border" />
          <OAuthStep status="pending" label="Auto-Sync" step={3} />
        </div>

        {/* Content */}
        <div className="mx-auto max-w-md text-center">
          <h3 className="text-lg font-semibold text-fg">Complete Installation on GitHub</h3>
          <p className="mt-2 text-fg-muted">
            Select the account/organization and repositories in the GitHub window. We'll
            automatically sync via webhook when done.
          </p>

          {/* Loading Spinner */}
          <div className="my-6">
            <CircleNotch className="mx-auto h-12 w-12 animate-spin text-accent" />
          </div>

          {/* Info Box */}
          <div className="mb-6 rounded-md bg-surface-subtle p-4 text-left text-xs text-fg-muted">
            <p className="mb-2 font-medium text-accent">Automated via Octokit:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Webhook receives{' '}
                <code className="rounded bg-surface-muted px-1">installation.created</code> event
              </li>
              <li>Octokit auto-generates installation tokens</li>
              <li>
                Repositories synced via{' '}
                <code className="rounded bg-surface-muted px-1">app.eachRepository</code>
              </li>
              <li>Config files detected and imported</li>
            </ul>
          </div>

          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function OAuthStep({
  status,
  label,
  step,
}: {
  status: 'completed' | 'active' | 'pending';
  label: string;
  step: number;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all ${
          status === 'completed'
            ? 'bg-success text-white'
            : status === 'active'
              ? 'bg-accent text-white shadow-[0_0_0_4px_rgba(56,139,253,0.15)]'
              : 'border-2 border-border bg-surface-muted text-fg-subtle'
        }`}
      >
        {status === 'completed' ? (
          <Check className="h-4 w-4" weight="bold" />
        ) : status === 'active' ? (
          <CircleNotch className="h-4 w-4 animate-spin" />
        ) : (
          step
        )}
      </div>
      <span
        className={`text-xs ${
          status === 'completed'
            ? 'text-success'
            : status === 'active'
              ? 'font-medium text-accent'
              : 'text-fg-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// State 3: Installation Selection
function InstallationSelectState({
  installations,
  selectedId,
  onSelect,
  onContinue,
  onCancel,
}: {
  installations: Installation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <GithubLogo className="h-4.5 w-4.5 text-fg-muted" weight="fill" />
        <h2 className="font-semibold text-fg">Select Installation</h2>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="mb-4 text-fg-muted">
          Choose which GitHub account or organization to connect:
        </p>

        <div className="space-y-3">
          {installations.map((installation) => (
            <button
              key={installation.id}
              type="button"
              onClick={() => onSelect(installation.id)}
              className={`flex w-full items-center gap-4 rounded-md border p-4 text-left transition-colors ${
                selectedId === installation.id
                  ? 'border-accent bg-accent-muted'
                  : 'border-border-muted bg-surface-subtle hover:border-accent hover:bg-accent-muted'
              }`}
            >
              {/* Avatar */}
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <GithubLogo className="h-6 w-6 text-fg-muted" weight="fill" />
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fg">{installation.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      installation.type === 'personal'
                        ? 'bg-accent-muted text-accent'
                        : 'bg-done-muted text-done'
                    }`}
                  >
                    {installation.type === 'personal' ? 'Personal' : 'Organization'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  {installation.repoCount} repositories accessible
                </p>
              </div>

              {/* Check */}
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selectedId === installation.id
                    ? 'border-accent bg-accent'
                    : 'border-border bg-transparent'
                }`}
              >
                {selectedId === installation.id && (
                  <Check className="h-3.5 w-3.5 text-white" weight="bold" />
                )}
              </div>
            </button>
          ))}

          {/* Add Installation */}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-border p-4 text-fg-muted transition-colors hover:border-accent hover:bg-accent-muted hover:text-accent"
          >
            <Plus className="h-4 w-4" />
            Add Another Installation
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border bg-surface-subtle px-5 py-4">
        <p className="text-xs text-fg-muted">You can add more installations later</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onContinue} disabled={!selectedId}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

// State 4: Connected
function ConnectedState({
  installations,
  repositories,
  onDisconnect,
}: {
  installations: Installation[];
  repositories: Repository[];
  onDisconnect: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Connection Status Banner */}
      <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success-muted p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-success">
          <Check className="h-5 w-5 text-white" weight="bold" />
        </div>
        <div className="flex-1">
          <strong className="text-success">GitHub Connected</strong>
          <p className="text-xs text-fg-muted">
            Authenticated as simon-lynch · Last synced 2 minutes ago
          </p>
        </div>
        <Button variant="outline" size="sm">
          <ArrowsClockwise className="h-3.5 w-3.5" />
          Sync Now
        </Button>
      </div>

      {/* Installations Card */}
      <Card title="Installations" icon={<GithubLogo className="h-4.5 w-4.5" weight="fill" />}>
        <div className="space-y-3">
          {installations.map((installation) => (
            <div
              key={installation.id}
              className="flex items-center gap-4 rounded-md border border-border-muted bg-surface-subtle p-4"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface-muted">
                <GithubLogo className="h-6 w-6 text-fg-muted" weight="fill" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fg">{installation.name}</span>
                  <span className="rounded bg-accent-muted px-1.5 py-0.5 text-xs font-medium text-accent">
                    Personal
                  </span>
                </div>
                <p className="mt-1 text-xs text-fg-muted">
                  {installation.repoCount} repositories · Installed{' '}
                  {installation.installedAt?.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Synced Repositories Card */}
      <Card
        title="Synced Repositories"
        icon={<Folder className="h-4.5 w-4.5" />}
        badge={`${repositories.length} repos`}
      >
        <div data-testid="connected-repos" className="space-y-2">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center gap-3 rounded-md border border-border-muted bg-surface-subtle p-3"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-surface-muted">
                <Folder className="h-4 w-4 text-fg-muted" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{repo.fullName}</p>
                <p className="font-mono text-xs text-fg-subtle">
                  {repo.configPath ?? 'No config found'}
                </p>
              </div>
              <SyncBadge status={repo.syncStatus} />
              <div className="flex gap-1">
                {repo.syncStatus === 'synced' && (
                  <>
                    <IconButton icon={<Eye className="h-4 w-4" />} title="View config" />
                    <IconButton icon={<ArrowsClockwise className="h-4 w-4" />} title="Sync now" />
                  </>
                )}
                {repo.syncStatus === 'no-config' && (
                  <IconButton icon={<Plus className="h-4 w-4" />} title="Create config" />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Permissions Card */}
      <Card title="App Permissions" icon={<GithubLogo className="h-4.5 w-4.5" weight="fill" />}>
        <div className="grid grid-cols-2 gap-3">
          <PermissionItem name="Contents" level="Read & Write" type="write" />
          <PermissionItem name="Pull Requests" level="Read & Write" type="write" />
          <PermissionItem name="Metadata" level="Read-only" type="read" />
          <PermissionItem name="Webhooks" level="push, pull_request" type="read" />
        </div>
      </Card>

      {/* Danger Zone */}
      <div className="rounded-lg border border-danger bg-surface">
        <div className="flex items-center gap-3 border-b border-danger-muted px-5 py-4">
          <WarningCircle className="h-4.5 w-4.5 text-danger" weight="fill" />
          <h2 className="font-semibold text-danger">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="font-medium text-fg">Disconnect GitHub</p>
            <p className="text-xs text-fg-muted">
              Remove the GitHub integration and revoke all access tokens
            </p>
          </div>
          <Button
            data-testid="disconnect-github"
            variant="outline"
            onClick={onDisconnect}
            className="border-danger/40 bg-danger-muted text-danger hover:bg-danger/25"
          >
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
}

// Shared Components
function Card({
  title,
  icon,
  badge,
  headerAction,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-fg-muted">{icon}</span>
          <h2 className="font-semibold text-fg">{title}</h2>
          {badge && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
              {badge}
            </span>
          )}
        </div>
        {headerAction}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SyncBadge({ status }: { status: 'synced' | 'pending' | 'no-config' }): React.JSX.Element {
  const config = {
    synced: {
      icon: <Check className="h-3 w-3" weight="bold" />,
      label: 'Synced',
      className: 'bg-success-muted text-success',
    },
    pending: {
      icon: <ArrowsClockwise className="h-3 w-3" />,
      label: 'Pending',
      className: 'bg-attention-muted text-attention',
    },
    'no-config': {
      icon: <WarningCircle className="h-3 w-3" />,
      label: 'No Config',
      className: 'bg-attention-muted text-attention',
    },
  };

  const { icon, label, className } = config[status];

  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

function IconButton({ icon, title }: { icon: React.ReactNode; title: string }): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
    >
      {icon}
    </button>
  );
}

function PermissionItem({
  name,
  level,
  type,
}: {
  name: string;
  level: string;
  type: 'read' | 'write';
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-surface-subtle p-3">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-md ${
          type === 'write' ? 'bg-success-muted text-success' : 'bg-accent-muted text-accent'
        }`}
      >
        <Folder className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-sm font-medium text-fg">{name}</p>
        <p className="text-xs text-fg-muted">{level}</p>
      </div>
    </div>
  );
}
