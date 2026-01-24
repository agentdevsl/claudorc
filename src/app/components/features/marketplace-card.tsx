import {
  ArrowSquareOut,
  ArrowsClockwise,
  CaretRight,
  Clock,
  GithubLogo,
  Lightning,
  Package,
  SealCheck,
  ShieldCheck,
  Trash,
  Users,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

/**
 * Animated Anthropic wordmark with subtle gradient shimmer
 * Used exclusively for the official marketplace to convey authenticity
 */
function AnthropicBadge(): React.JSX.Element {
  return (
    <a
      href="https://anthropic.com"
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1a1a1a] dark:bg-[#0d0d0d] border border-[#cc785c]/30 hover:border-[#cc785c]/60 transition-all duration-300"
    >
      {/* Anthropic logo mark - simplified 'A' shape */}
      <svg
        className="h-3.5 w-3.5 text-[#cc785c]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0h3.767L16.906 20.48h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 10.593L8.453 7.776l-2.248 6.337h4.496z" />
      </svg>
      {/* Verified text with shimmer */}
      <span className="relative text-[10px] font-medium tracking-wide text-[#e8d5ce] uppercase">
        <span className="relative z-10">Verified</span>
        {/* Shimmer overlay */}
        <span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#cc785c]/40 to-transparent -skew-x-12 opacity-0 group-hover:opacity-100 group-hover:animate-shimmer"
          style={{
            backgroundSize: '200% 100%',
          }}
        />
      </span>
      <SealCheck className="h-3 w-3 text-[#cc785c]" weight="fill" />
    </a>
  );
}

// Plugin tags for filtering
export type PluginTag = 'official' | 'external';

// Cached plugin type from marketplace (matches db/schema/marketplaces.ts)
export interface CachedPlugin {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  category?: string;
  readme?: string;
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
  /** Gradient style for header hover state (matches Kanban column styling) */
  gradientStyle?: React.CSSProperties;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

/** Subtle diagonal gradients matching Kanban column header style (8% opacity) */
const SECTION_HEADER_GRADIENTS = {
  success: { background: 'linear-gradient(135deg, rgba(63,185,80,0.08) 0%, transparent 60%)' },
  accent: { background: 'linear-gradient(135deg, rgba(163,113,247,0.08) 0%, transparent 60%)' },
  muted: { background: 'linear-gradient(135deg, rgba(139,148,158,0.08) 0%, transparent 60%)' },
} as const;

/** Icon badge background colors matching Kanban column style (12% opacity) */
const SECTION_ICON_BADGE_STYLES = {
  success: 'bg-[rgba(63,185,80,0.12)] text-[#3fb950]',
  accent: 'bg-[rgba(163,113,247,0.12)] text-[#a371f7]',
  muted: 'bg-[rgba(139,148,158,0.12)] text-[#8b949e]',
} as const;

function CollapsibleSection({
  title,
  icon,
  count,
  colorClass,
  bgClass,
  gradientStyle,
  children,
  isOpen,
  onToggle,
}: CollapsibleSectionProps): React.JSX.Element | null {
  if (count === 0) return null;

  return (
    <div className="pt-3 first:pt-0 first:border-t-0 border-t border-border-muted/50">
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center gap-2.5 text-left py-1.5 px-2 -mx-2 rounded-md transition-all duration-200 hover:bg-surface-subtle"
        style={gradientStyle}
      >
        <span className={cn('transition-transform duration-200 ease-out', isOpen && 'rotate-90')}>
          <CaretRight className="h-3.5 w-3.5 text-fg-subtle group-hover:text-fg-muted" />
        </span>
        {/* Icon badge - matches Kanban column icon style (24x24px, 6px radius) */}
        <span
          className={cn(
            'w-6 h-6 rounded-[6px] flex items-center justify-center transition-colors',
            bgClass
          )}
        >
          {icon}
        </span>
        <span className="text-[13px] font-medium text-fg tracking-tight">{title}</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center justify-center min-w-[24px] h-5 px-2 rounded-full text-[11px] font-semibold tabular-nums',
            bgClass,
            colorClass
          )}
        >
          {count}
        </span>
      </button>
      <div
        className={cn(
          'grid transition-all duration-200 ease-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-2 pb-1 pl-8 space-y-0.5 max-h-96 overflow-y-auto scrollbar-thin">
            {children}
          </div>
        </div>
      </div>
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
    <div className="group flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-all duration-150 hover:bg-surface-subtle/80 cursor-default">
      <div className="mt-0.5 p-1 rounded bg-accent-subtle group-hover:bg-accent-muted transition-colors">
        <Lightning className="h-3 w-3 text-accent" weight="fill" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-fg leading-tight">{plugin.name}</span>
          {showCategory && (
            <span className="text-[10px] text-fg-subtle bg-surface-muted/80 px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wide">
              {plugin.category}
            </span>
          )}
        </div>
        {plugin.description && (
          <p className="mt-0.5 text-xs text-fg-muted leading-relaxed line-clamp-2">
            {plugin.description}
          </p>
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
  const uncategorizedCount = plugins.filter((p) => !p.tags || p.tags.length === 0).length;

  const isOfficial = marketplace.isDefault;

  // Track which sections are open for controlled expansion
  const [openSections, setOpenSections] = useState({
    official: officialCount > 0,
    community: false,
    available: false,
  });

  const toggleSection = (section: 'official' | 'community' | 'available') => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const cardContent = (
    <div
      className={cn(
        'rounded-xl border bg-surface overflow-hidden transition-all duration-200',
        isOfficial
          ? 'border-transparent shadow-lg shadow-[#cc785c]/5'
          : 'border-border hover:border-fg-subtle hover:shadow-md'
      )}
      data-testid="marketplace-card"
    >
      {/* Header - uses subtle diagonal gradient like Kanban columns */}
      <div
        className="p-5 border-b border-border-muted/50"
        style={
          isOfficial
            ? { background: 'linear-gradient(135deg, rgba(204,120,92,0.08) 0%, transparent 60%)' }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  isOfficial ? 'bg-[#cc785c]/10' : 'bg-accent-muted'
                )}
              >
                {isOfficial ? (
                  <svg
                    className="h-5 w-5 text-[#cc785c]"
                    viewBox="0 0 248 248"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z" />
                  </svg>
                ) : (
                  <Package className="h-5 w-5 text-accent" weight="fill" />
                )}
              </div>
              <div>
                <h3
                  className="text-base font-semibold text-fg tracking-tight"
                  data-testid="marketplace-name"
                >
                  {marketplace.name}
                </h3>
                <p className="text-xs text-fg-muted mt-0.5">
                  {isOfficial
                    ? 'Official Claude plugins from Anthropic'
                    : 'Custom plugin marketplace repository'}
                </p>
              </div>
            </div>
            {isOfficial && (
              <div className="mt-3">
                <AnthropicBadge />
              </div>
            )}
          </div>

          {/* Status badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 h-6 px-2.5 text-xs font-medium rounded-full border shrink-0 transition-colors',
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

        {/* Repository info & sync status */}
        <div className="mt-4 flex items-center gap-4 text-xs">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-fg-muted hover:text-fg transition-colors"
            data-testid="marketplace-repo-link"
          >
            <GithubLogo className="h-4 w-4 shrink-0" weight="fill" />
            <code className="font-mono text-[11px] bg-surface-subtle px-1.5 py-0.5 rounded group-hover:bg-surface-muted transition-colors">
              {marketplace.githubOwner}/{marketplace.githubRepo}
            </code>
            <ArrowSquareOut className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <span className="text-border-default">|</span>
          <div
            className="flex items-center gap-1.5 text-fg-subtle"
            data-testid="marketplace-last-synced"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{formatRelativeTime(marketplace.lastSyncedAt)}</span>
          </div>
        </div>

        {/* Summary counts as badges */}
        {marketplace.pluginCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" data-testid="marketplace-counts">
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-surface-muted text-fg-muted text-xs font-medium">
              <Lightning className="h-3.5 w-3.5" weight="fill" />
              {marketplace.pluginCount} plugin{marketplace.pluginCount !== 1 && 's'}
            </span>
            {officialCount > 0 && (
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-success-muted text-success text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5" weight="fill" />
                {officialCount} official
              </span>
            )}
            {externalCount > 0 && (
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-muted text-accent text-xs font-medium">
                <Users className="h-3.5 w-3.5" weight="fill" />
                {externalCount} community
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expandable plugins section - grouped by tags */}
      {plugins.length > 0 && (
        <div className="px-5 py-4 space-y-1">
          {/* Official plugins */}
          <CollapsibleSection
            title="Official Plugins"
            icon={<ShieldCheck className="h-3.5 w-3.5" weight="fill" />}
            count={officialCount}
            colorClass="text-[#3fb950]"
            bgClass={SECTION_ICON_BADGE_STYLES.success}
            gradientStyle={SECTION_HEADER_GRADIENTS.success}
            isOpen={openSections.official}
            onToggle={() => toggleSection('official')}
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
            icon={<Users className="h-3.5 w-3.5" weight="fill" />}
            count={externalCount}
            colorClass="text-[#a371f7]"
            bgClass={SECTION_ICON_BADGE_STYLES.accent}
            gradientStyle={SECTION_HEADER_GRADIENTS.accent}
            isOpen={openSections.community}
            onToggle={() => toggleSection('community')}
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
            icon={<Lightning className="h-3.5 w-3.5" weight="fill" />}
            count={uncategorizedCount}
            colorClass="text-[#8b949e]"
            bgClass={SECTION_ICON_BADGE_STYLES.muted}
            gradientStyle={SECTION_HEADER_GRADIENTS.muted}
            isOpen={openSections.available}
            onToggle={() => toggleSection('available')}
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
        className="px-5 py-4 bg-surface-subtle/50 border-t border-border-muted/50 flex items-center justify-between gap-4"
        data-testid="marketplace-actions"
      >
        <div className="flex items-center gap-3">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors"
          >
            <GithubLogo className="h-4 w-4" weight="fill" />
            <span className="group-hover:underline">View on GitHub</span>
            <ArrowSquareOut className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>
          {!marketplace.isDefault && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-danger/80 hover:text-danger hover:bg-danger-muted h-7 px-2 text-xs"
              data-testid="marketplace-delete-button"
            >
              <Trash className="h-3.5 w-3.5 mr-1" />
              Remove
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          className={cn('h-8 px-3.5', isSyncing && 'opacity-80')}
          data-testid="marketplace-sync-button"
        >
          <ArrowsClockwise className={cn('h-4 w-4 mr-1.5', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>
    </div>
  );

  // Official marketplace gets a premium animated gradient border wrapper
  if (isOfficial) {
    return (
      <div className="relative rounded-xl p-[1px] overflow-hidden group/card">
        {/* Animated gradient border */}
        <div
          className="absolute inset-0 rounded-xl bg-[conic-gradient(from_var(--gradient-angle),#cc785c_0%,#e8a090_25%,#cc785c_50%,#e8a090_75%,#cc785c_100%)] opacity-50 group-hover/card:opacity-70 transition-opacity duration-500"
          style={
            {
              '--gradient-angle': '0deg',
              animation: 'gradient-rotate 8s linear infinite',
            } as React.CSSProperties
          }
        />
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded-xl bg-[#cc785c]/15 blur-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
        {/* Card content */}
        <div className="relative">{cardContent}</div>
        {/* Keyframes for gradient rotation */}
        <style>{`
          @keyframes gradient-rotate {
            0% { --gradient-angle: 0deg; }
            100% { --gradient-angle: 360deg; }
          }
          @property --gradient-angle {
            syntax: '<angle>';
            initial-value: 0deg;
            inherits: false;
          }
        `}</style>
      </div>
    );
  }

  return cardContent;
}
