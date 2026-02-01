import { useTerraform } from './terraform-context';

export function TerraformSyncBar(): React.JSX.Element | null {
  const { syncStatus, registries } = useTerraform();

  if (registries.length === 0) return null;

  const formatLastSynced = (iso: string | null) => {
    if (!iso) return 'Never synced';
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

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
        {syncStatus.lastSynced && ` · Last sync: ${formatLastSynced(syncStatus.lastSynced)}`}
      </span>
      {isSyncing && <span className="text-attention">Syncing...</span>}
      {hasError && <span className="text-danger">Sync error</span>}
    </div>
  );
}
