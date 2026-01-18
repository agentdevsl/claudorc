import { Check, CircleNotch, Eye, EyeSlash, GithubLogo, Key, Trash, Warning } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { apiClient } from '@/lib/api/client';
import { encryptToken, isValidPATFormat, maskToken } from '@/lib/crypto/token-encryption';

export const Route = createFileRoute('/settings/api-keys')({
  component: ApiKeysSettingsPage,
});

function ApiKeysSettingsPage(): React.JSX.Element {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [savedAnthropicKey, setSavedAnthropicKey] = useState<string | null>(null);
  const [isSavingAnthropic, setIsSavingAnthropic] = useState(false);
  const [anthropicError, setAnthropicError] = useState<string | null>(null);

  const [githubPat, setGithubPat] = useState('');
  const [showGithubPat, setShowGithubPat] = useState(false);
  const [savedGithubPat, setSavedGithubPat] = useState<string | null>(null);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [isSavingGithub, setIsSavingGithub] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  // Load saved keys on mount
  useEffect(() => {
    // Anthropic key from localStorage (for now)
    setSavedAnthropicKey(localStorage.getItem('anthropic_api_key_masked'));

    // GitHub token from API (SQLite database)
    const loadGitHubToken = async () => {
      const result = await apiClient.github.getTokenInfo();
      if (result.ok && result.data.tokenInfo) {
        setSavedGithubPat(result.data.tokenInfo.maskedToken);
        setGithubLogin(result.data.tokenInfo.githubLogin);
      }
    };
    loadGitHubToken();
  }, []);

  const handleSaveAnthropicKey = async () => {
    if (!anthropicKey.trim()) return;

    // Validate format
    if (!anthropicKey.startsWith('sk-ant-')) {
      setAnthropicError('Invalid key format. Must start with sk-ant-');
      return;
    }

    setAnthropicError(null);
    setIsSavingAnthropic(true);

    try {
      const encrypted = await encryptToken(anthropicKey);
      localStorage.setItem('anthropic_api_key', encrypted);
      localStorage.setItem('anthropic_api_key_masked', maskToken(anthropicKey));
      setSavedAnthropicKey(maskToken(anthropicKey));
      setAnthropicKey('');
    } catch (error) {
      setAnthropicError('Failed to save key');
      console.error('Failed to save Anthropic API key:', error);
    } finally {
      setIsSavingAnthropic(false);
    }
  };

  const handleClearAnthropicKey = () => {
    localStorage.removeItem('anthropic_api_key');
    localStorage.removeItem('anthropic_api_key_masked');
    setSavedAnthropicKey(null);
  };

  const handleSaveGithubPat = async () => {
    if (!githubPat.trim()) return;

    if (!isValidPATFormat(githubPat)) {
      setGithubError('Invalid PAT format. Must start with ghp_ or github_pat_');
      return;
    }

    setGithubError(null);
    setIsSavingGithub(true);

    try {
      // Save to SQLite via API (validates with GitHub first)
      const result = await apiClient.github.saveToken(githubPat);

      if (!result.ok) {
        setGithubError(result.error.message);
        return;
      }

      setSavedGithubPat(result.data.tokenInfo.maskedToken);
      setGithubLogin(result.data.tokenInfo.githubLogin);
      setGithubPat('');
    } catch (error) {
      setGithubError('Failed to save PAT');
      console.error('Failed to save GitHub PAT:', error);
    } finally {
      setIsSavingGithub(false);
    }
  };

  const handleClearGithubPat = async () => {
    try {
      await apiClient.github.deleteToken();
      setSavedGithubPat(null);
      setGithubLogin(null);
    } catch (error) {
      console.error('Failed to delete GitHub PAT:', error);
    }
  };

  return (
    <div data-testid="api-keys-settings" className="mx-auto max-w-4xl px-8 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-fg">
          <Key className="h-7 w-7 text-fg-muted" />
          API Keys
        </h1>
        <p className="mt-2 text-fg-muted">
          Configure API keys for external services. Keys are encrypted and stored locally.
        </p>
      </header>

      <div className="space-y-6">
        {/* Anthropic API Key */}
        <div
          data-testid="anthropic-key-section"
          className="rounded-lg border border-border bg-surface"
        >
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-muted">
              <Key className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-fg">Anthropic API Key</h2>
              <p className="text-xs text-fg-muted">Required for running Claude agents</p>
            </div>
            {savedAnthropicKey && (
              <span
                data-testid="anthropic-key-configured"
                className="flex items-center gap-1.5 rounded-full bg-success-muted px-2.5 py-1 text-xs font-medium text-success"
              >
                <Check className="h-3.5 w-3.5" weight="bold" />
                Configured
              </span>
            )}
          </div>

          <div className="p-5">
            {savedAnthropicKey ? (
              <div className="flex items-center gap-3">
                <code className="flex-1 rounded-md bg-surface-subtle px-3 py-2 font-mono text-sm text-fg-muted">
                  {savedAnthropicKey}
                </code>
                <Button
                  data-testid="remove-anthropic-key"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAnthropicKey}
                >
                  <Trash className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-sm text-fg-muted">
                    Get your API key from{' '}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      console.anthropic.com
                    </a>{' '}
                    or use{' '}
                    <code className="rounded bg-surface-subtle px-1.5 py-0.5 text-xs font-mono">
                      claude setup-token
                    </code>{' '}
                    from the terminal.
                  </p>
                  <div className="relative">
                    <input
                      data-testid="anthropic-key-input"
                      type={showAnthropicKey ? 'text' : 'password'}
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 pr-10 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      data-testid="anthropic-key-toggle"
                      type="button"
                      onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                    >
                      {showAnthropicKey ? (
                        <EyeSlash className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {anthropicError && (
                    <p
                      data-testid="anthropic-key-error"
                      className="mt-2 flex items-center gap-1.5 text-xs text-danger"
                    >
                      <Warning className="h-3.5 w-3.5" />
                      {anthropicError}
                    </p>
                  )}
                </div>
                <Button
                  data-testid="save-anthropic-key"
                  onClick={handleSaveAnthropicKey}
                  disabled={isSavingAnthropic || !anthropicKey.trim()}
                >
                  {isSavingAnthropic ? (
                    <>
                      <CircleNotch className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Key'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* GitHub PAT */}
        <div
          data-testid="github-pat-section"
          className="rounded-lg border border-border bg-surface"
        >
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-muted">
              <Key className="h-4 w-4 text-fg-muted" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-fg">GitHub Personal Access Token</h2>
              <p className="text-xs text-fg-muted">
                Optional. Used for accessing private repos and organization data
              </p>
            </div>
            {savedGithubPat && (
              <span className="flex items-center gap-1.5 rounded-full bg-success-muted px-2.5 py-1 text-xs font-medium text-success">
                <Check className="h-3.5 w-3.5" weight="bold" />
                Configured
              </span>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Required permissions - always shown */}
            <div className="rounded-md border border-border bg-surface-subtle p-3">
              <p className="mb-2 text-xs font-medium text-fg">Required Permissions:</p>
              <ul className="space-y-1 text-xs text-fg-muted">
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-fg-subtle" />
                  <strong>Repository access:</strong> All repositories (or select specific ones)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-fg-subtle" />
                  <strong>Contents:</strong> Read-only (for cloning and reading files)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-fg-subtle" />
                  <strong>Metadata:</strong> Read-only (for listing repositories)
                </li>
              </ul>
              <p className="mt-2 text-xs text-fg-subtle">
                For organization repos, also enable access to those organizations.
              </p>
            </div>

            {savedGithubPat ? (
              <div className="space-y-3">
                {githubLogin && (
                  <div className="flex items-center gap-2 text-sm text-fg-muted">
                    <GithubLogo className="h-4 w-4" />
                    Authenticated as <span className="font-medium text-fg">{githubLogin}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <code className="flex-1 rounded-md bg-surface-subtle px-3 py-2 font-mono text-sm text-fg-muted">
                    {savedGithubPat}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleClearGithubPat}>
                    <Trash className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-sm text-fg-muted">
                    Generate a{' '}
                    <a
                      href="https://github.com/settings/tokens?type=beta"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      fine-grained PAT
                    </a>{' '}
                    with the permissions listed above.
                  </p>
                  <div className="relative">
                    <input
                      type={showGithubPat ? 'text' : 'password'}
                      value={githubPat}
                      onChange={(e) => setGithubPat(e.target.value)}
                      placeholder="ghp_... or github_pat_..."
                      className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 pr-10 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGithubPat(!showGithubPat)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                    >
                      {showGithubPat ? (
                        <EyeSlash className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {githubError && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                      <Warning className="h-3.5 w-3.5" />
                      {githubError}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleSaveGithubPat}
                  disabled={isSavingGithub || !githubPat.trim()}
                >
                  {isSavingGithub ? (
                    <>
                      <CircleNotch className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Token'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Security Note */}
        <div
          data-testid="security-notice"
          className="rounded-md border border-accent/30 bg-accent-muted/30 p-4"
        >
          <p className="text-sm text-fg-muted">
            <strong className="text-accent">Security:</strong> All keys are encrypted using AES-256
            before storage. Keys never leave your browser and are not sent to any external servers.
          </p>
        </div>
      </div>
    </div>
  );
}
