import { Check, CircleNotch, GithubLogo, Key } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';

export const Route = createFileRoute('/settings/github')({
  component: GitHubSettingsPage,
});

function GitHubSettingsPage(): React.JSX.Element {
  const [hasGitHubToken, setHasGitHubToken] = useState<boolean | null>(null);

  // Check if GitHub PAT is configured
  useEffect(() => {
    const checkToken = async () => {
      try {
        // Check localStorage for saved GitHub PAT
        const savedToken = localStorage.getItem('github_pat');
        setHasGitHubToken(!!savedToken);
      } catch {
        setHasGitHubToken(false);
      }
    };
    checkToken();
  }, []);

  // Loading state
  if (hasGitHubToken === null) {
    return (
      <div data-testid="github-settings" className="mx-auto max-w-4xl px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <CircleNotch className="h-8 w-8 animate-spin text-fg-muted" />
        </div>
      </div>
    );
  }

  // No token configured - show message to configure one
  if (!hasGitHubToken) {
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

        <div data-testid="github-not-connected">
          <div data-testid="github-connection-status" />
          <div className="rounded-lg border border-border bg-surface">
            <div className="px-6 py-12 text-center">
              {/* Icon */}
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-attention bg-attention-muted">
                <Key className="h-10 w-10 text-attention" weight="fill" />
              </div>

              {/* Title & Description */}
              <h3 className="text-xl font-semibold text-fg">GitHub Token Required</h3>
              <p className="mx-auto mt-3 max-w-md text-fg-muted">
                To use GitHub integration, you need to configure a GitHub Personal Access Token
                (PAT) in your API Keys settings first.
              </p>

              {/* Configure Button */}
              <Link to="/settings/api-keys">
                <Button className="mt-6">
                  <Key className="h-4 w-4" />
                  Configure API Keys
                </Button>
              </Link>

              {/* Help text */}
              <p className="mt-6 text-xs text-fg-subtle">
                Need help?{' '}
                <a
                  href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Learn how to create a GitHub PAT
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Token is configured - show connected state
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

      <div data-testid="github-connected">
        <div data-testid="github-connection-status" />
        {/* Connection Status Banner */}
        <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success-muted p-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-success">
            <Check className="h-5 w-5 text-white" weight="bold" />
          </div>
          <div className="flex-1">
            <strong className="text-success">GitHub PAT Configured</strong>
            <p className="text-xs text-fg-muted">
              Your GitHub Personal Access Token is configured and ready to use
            </p>
          </div>
          <Link to="/settings/api-keys">
            <Button variant="outline" size="sm">
              Manage Token
            </Button>
          </Link>
        </div>

        {/* Features info */}
        <div className="mt-6 rounded-lg border border-border bg-surface p-6">
          <h3 className="font-semibold text-fg">Available Features</h3>
          <p className="mt-2 text-sm text-fg-muted">With your GitHub token configured, you can:</p>
          <ul className="mt-4 space-y-2 text-sm text-fg-muted">
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              Clone private repositories
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              Create and manage pull requests
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              Sync configuration from repositories
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
