import {
  ArrowSquareOut,
  ArrowsClockwise,
  CaretRight,
  Clock,
  GithubLogo,
  Lightning,
  Package,
  ShieldCheck,
  Trash,
  Users,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

// Plugin tags for filtering
export type PluginTag = 'official' | 'external';

// Cached plugin type from marketplace
export interface CachedPlugin {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  category?: string;
  tags?: PluginTag[];
}

export interface MarketplaceCardProps {
  marketplace: {
    id: string;
    name: string;
    githubOwner: string;
    githubRepo: string;
    branch: string;
    pluginsPath: string;
    isDefault: boolean;
    isEnabled: boolean;
    status: 'active' | 'syncing' | 'error';
    lastSyncedAt: string | null;
    syncError: string | null;
    pluginCount: number;
  };
  plugins?: CachedPlugin[];
  onSync: () => void;
  onRemove?: () => void;
  isSyncing?: boolean;
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    className: 'bg-success-muted text-success border-success/40',
  },
  syncing: {
    label: 'Syncing',
    className: 'bg-attention-muted text-attention border-attention/40',
  },
  error: {
    label: 'Error',
    className: 'bg-danger-muted text-danger border-danger/40',
  },
} as const;

function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return 'Never';
  const now = Date.now();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const diff = now - dateObj.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (hours > 24) return `${Math.floor(hours / 24)}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

// Collapsible section for plugins
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  colorClass: string;
  bgClass: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  icon,
  count,
  colorClass,
  bgClass,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div className="border-t border-border-muted pt-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 text-left transition-colors duration-150 hover:bg-surface-subtle rounded px-1 -mx-1"
      >
        <span className={cn('transition-transform duration-150', isOpen && 'rotate-90')}>
          <CaretRight className="h-4 w-4 text-fg-muted" />
        </span>
        <span className={cn('p-1 rounded', bgClass)}>{icon}</span>
        <span className="text-xs font-medium text-fg">{title}</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center h-5 px-2 rounded-full text-xs font-medium',
            bgClass,
            colorClass
          )}
        >
          {count}
        </span>
      </button>
      {isOpen && <div className="mt-2 space-y-1 pl-6 max-h-64 overflow-y-auto">{children}</div>}
    </div>
  );
}

// Plugin item row
interface PluginRowProps {
  plugin: CachedPlugin;
}

function PluginRow({ plugin }: PluginRowProps): React.JSX.Element {
  // Only show category if it's set and not a generic placeholder
  const showCategory = plugin.category && plugin.category.toLowerCase() !== 'uncategorized';

  return (
    <div className="group flex items-start gap-2 rounded px-2 py-1.5 transition-colors duration-150 hover:bg-surface-subtle">
      <Lightning className="h-3.5 w-3.5 mt-0.5 text-accent shrink-0" weight="fill" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-fg">{plugin.name}</span>
          {showCategory && (
            <span className="text-[10px] text-fg-muted bg-surface-muted px-1 py-0.5 rounded">
              {plugin.category}
            </span>
          )}
        </div>
        {plugin.description && (
          <div className="text-[11px] text-fg-muted line-clamp-1">{plugin.description}</div>
        )}
      </div>
    </div>
  );
}

export function MarketplaceCard({
  marketplace,
  plugins = [],
  onSync,
  onRemove,
  isSyncing = false,
}: MarketplaceCardProps): React.JSX.Element {
  const effectiveStatus = isSyncing ? 'syncing' : marketplace.status;
  const statusConfig = STATUS_CONFIG[effectiveStatus];
  const githubUrl = `https://github.com/${marketplace.githubOwner}/${marketplace.githubRepo}`;

  // Count plugins by tag
  const officialCount = plugins.filter((p) => p.tags?.includes('official')).length;
  const externalCount = plugins.filter((p) => p.tags?.includes('external')).length;

  return (
    <div
      className="rounded-lg border border-border bg-surface overflow-hidden transition-colors duration-150 hover:border-fg-subtle"
      data-testid="marketplace-card"
    >
      {/* Header */}
      <div className="p-4 border-b border-border-muted">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-accent-muted">
                <Package className="h-4 w-4 text-accent" weight="fill" />
              </div>
              <h3 className="text-sm font-semibold text-fg" data-testid="marketplace-name">
                {marketplace.name}
              </h3>
              {marketplace.isDefault && (
                <span className="text-[10px] font-medium text-accent bg-accent-muted px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Official
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-fg-muted">
              {marketplace.isDefault
                ? 'Official Claude plugins from Anthropic'
                : 'Custom plugin marketplace repository'}
            </p>
          </div>

          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 h-5 px-2 text-xs font-medium rounded-full border shrink-0',
              statusConfig.className
            )}
            data-testid="marketplace-status"
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full bg-current',
                effectiveStatus === 'syncing' && 'animate-pulse'
              )}
            />
            {statusConfig.label}
          </span>
        </div>

        {/* Repository info */}
        <div className="mt-3 flex items-center gap-4 text-xs text-fg-muted">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-fg transition-colors group"
            data-testid="marketplace-repo-link"
          >
            <GithubLogo className="h-4 w-4 shrink-0" />
            <span className="font-mono group-hover:underline">
              {marketplace.githubOwner}/{marketplace.githubRepo}
            </span>
            <ArrowSquareOut className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <div className="flex items-center gap-1" data-testid="marketplace-last-synced">
            <Clock className="h-4 w-4" />
            <span>Synced {formatRelativeTime(marketplace.lastSyncedAt)}</span>
          </div>
        </div>

        {/* Summary counts as badges */}
        {marketplace.pluginCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="marketplace-counts">
            <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full bg-surface-muted text-fg-muted text-xs font-medium">
              <Lightning className="h-3 w-3" weight="fill" />
              {marketplace.pluginCount} plugin{marketplace.pluginCount !== 1 && 's'}
            </span>
            {officialCount > 0 && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-success-muted text-success text-xs font-medium">
                <ShieldCheck className="h-3 w-3" weight="fill" />
                {officialCount} official
              </span>
            )}
            {externalCount > 0 && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-muted text-accent text-xs font-medium">
                <Users className="h-3 w-3" weight="fill" />
                {externalCount} community
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expandable plugins section - grouped by tags */}
      {plugins.length > 0 && (
        <div className="p-4 space-y-2">
          {/* Official plugins */}
          <CollapsibleSection
            title="Official Plugins"
            icon={<ShieldCheck className="h-4 w-4 text-success" weight="fill" />}
            count={plugins.filter((p) => p.tags?.includes('official')).length}
            colorClass="text-success"
            bgClass="bg-success-muted"
            defaultOpen
          >
            {plugins
              .filter((p) => p.tags?.includes('official'))
              .map((plugin) => (
                <PluginRow key={plugin.id} plugin={plugin} />
              ))}
          </CollapsibleSection>

          {/* External/Community plugins */}
          <CollapsibleSection
            title="Community Plugins"
            icon={<Users className="h-4 w-4 text-accent" weight="fill" />}
            count={plugins.filter((p) => p.tags?.includes('external')).length}
            colorClass="text-accent"
            bgClass="bg-accent-muted"
          >
            {plugins
              .filter((p) => p.tags?.includes('external'))
              .map((plugin) => (
                <PluginRow key={plugin.id} plugin={plugin} />
              ))}
          </CollapsibleSection>

          {/* Uncategorized plugins (no tags) - fallback for custom marketplaces */}
          <CollapsibleSection
            title="Available Plugins"
            icon={<Lightning className="h-4 w-4 text-fg-muted" weight="fill" />}
            count={plugins.filter((p) => !p.tags || p.tags.length === 0).length}
            colorClass="text-fg-muted"
            bgClass="bg-surface-muted"
          >
            {plugins
              .filter((p) => !p.tags || p.tags.length === 0)
              .map((plugin) => (
                <PluginRow key={plugin.id} plugin={plugin} />
              ))}
          </CollapsibleSection>
        </div>
      )}

      {/* Error message */}
      {marketplace.status === 'error' && marketplace.syncError && (
        <div
          className="mx-4 mb-3 rounded bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger"
          data-testid="marketplace-error"
        >
          <span className="font-medium">Sync failed:</span> {marketplace.syncError}
        </div>
      )}

      {/* Actions footer */}
      <div
        className="px-4 py-3 bg-surface-subtle border-t border-border-muted flex items-center justify-between"
        data-testid="marketplace-actions"
      >
        <div className="flex items-center gap-2">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg transition-colors"
          >
            <GithubLogo className="h-4 w-4" />
            View on GitHub
            <ArrowSquareOut className="h-3 w-3" />
          </a>
          {!marketplace.isDefault && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-danger hover:text-danger hover:bg-danger-muted"
              data-testid="marketplace-delete-button"
            >
              <Trash className="h-4 w-4 mr-1" />
              Remove
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          data-testid="marketplace-sync-button"
        >
          <ArrowsClockwise className={cn('h-4 w-4 mr-1', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>
    </div>
  );
}
