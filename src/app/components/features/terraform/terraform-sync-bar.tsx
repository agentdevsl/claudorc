import { Link } from '@tanstack/react-router';
import { useTerraform } from './terraform-context';
import { formatTimeAgo } from './terraform-utils';

export function TerraformSyncBar(): React.JSX.Element {
  const { syncStatus, registries } = useTerraform();

  if (registries.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b border-border bg-surface-subtle px-4 py-1.5 text-xs text-fg-muted">
        <div className="h-2 w-2 rounded-full bg-fg-subtle" />
        <span>
          Connect a registry to sync modules ·{' '}
          <Link to="/terraform/settings" className="text-accent hover:underline">
            Settings
          </Link>
        </span>
      </div>
    );
  }

  const isSyncing = registries.some((r) => r.status === 'syncing');
  const hasError = registries.some((r) => r.status === 'error');

  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface-subtle px-4 py-1.5 text-xs text-fg-muted">
      <div
        className={`h-2 w-2 rounded-full ${
          isSyncing ? 'animate-pulse bg-attention' : hasError ? 'bg-danger' : 'bg-success'
        }`}
      />
      <span>
        {syncStatus.moduleCount} modules synced
        {syncStatus.lastSynced && ` · Last sync: ${formatTimeAgo(syncStatus.lastSynced)}`}
      </span>
      {isSyncing && <span className="text-attention">Syncing...</span>}
      {hasError && <span className="text-danger">Sync error</span>}
    </div>
  );
}
