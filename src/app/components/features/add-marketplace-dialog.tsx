import { GithubLogo, Plus, X } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';

export interface AddMarketplaceDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { name: string; githubUrl: string; branch?: string }) => Promise<void>;
  isAdding?: boolean;
}

export function AddMarketplaceDialog({
  open,
  onClose,
  onAdd,
  isAdding = false,
}: AddMarketplaceDialogProps): React.JSX.Element | null {
  const [name, setName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!githubUrl.trim()) {
      setError('GitHub URL is required');
      return;
    }

    // Basic URL validation
    const urlPattern = /^(https?:\/\/github\.com\/[^/]+\/[^/]+|[^/]+\/[^/]+)$/;
    if (!urlPattern.test(githubUrl.trim())) {
      setError('Invalid GitHub URL. Use format: https://github.com/owner/repo or owner/repo');
      return;
    }

    try {
      await onAdd({
        name: name.trim(),
        githubUrl: githubUrl.trim(),
        branch: branch.trim() || 'main',
      });
      setName('');
      setGithubUrl('');
      setBranch('main');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add marketplace');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <GithubLogo className="h-5 w-5 text-fg-muted" />
            <h2 className="text-sm font-semibold text-fg">Add Plugin Marketplace</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-subtle text-fg-muted hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-fg-muted mb-1">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Plugins"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              disabled={isAdding}
            />
          </div>

          <div>
            <label htmlFor="githubUrl" className="block text-xs font-medium text-fg-muted mb-1">
              GitHub Repository
            </label>
            <input
              id="githubUrl"
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              disabled={isAdding}
            />
            <p className="mt-1 text-xs text-fg-subtle">Enter a GitHub URL or owner/repo format</p>
          </div>

          <div>
            <label htmlFor="branch" className="block text-xs font-medium text-fg-muted mb-1">
              Branch (optional)
            </label>
            <input
              id="branch"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              disabled={isAdding}
            />
          </div>

          {error && (
            <div className="text-xs text-danger bg-danger-muted rounded px-3 py-2">{error}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isAdding}>
              Cancel
            </Button>
            <Button type="submit" disabled={isAdding}>
              <Plus className="h-4 w-4 mr-1" />
              {isAdding ? 'Adding...' : 'Add Marketplace'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
