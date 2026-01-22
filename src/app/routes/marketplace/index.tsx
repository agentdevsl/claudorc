import {
  ArrowsClockwise,
  CaretDown,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  PuzzlePiece,
} from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { AddMarketplaceDialog } from '@/app/components/features/add-marketplace-dialog';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { MarketplaceSourceCard, PluginCard } from '@/app/components/features/marketplace-card';
import { Button } from '@/app/components/ui/button';
import { apiClient } from '@/lib/api/client';

export const Route = createFileRoute('/marketplace/')({
  component: MarketplacePage,
});

type MarketplaceItem = {
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
  createdAt: string;
  updatedAt: string;
};

type PluginItem = {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  category?: string;
  marketplaceId: string;
  marketplaceName: string;
  isEnabled: boolean;
};

function MarketplacePage(): React.JSX.Element {
  const [marketplaces, setMarketplaces] = useState<MarketplaceItem[]>([]);
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // UI state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [isAddingMarketplace, setIsAddingMarketplace] = useState(false);

  // Track if we've already tried auto-syncing to avoid repeated attempts
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First, seed the default marketplace if needed
      await apiClient.marketplaces.seed();

      // Fetch marketplaces, plugins, and categories in parallel
      const [marketplacesRes, pluginsRes, categoriesRes] = await Promise.all([
        apiClient.marketplaces.list(),
        apiClient.marketplaces.listPlugins({
          search: searchQuery || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          marketplaceId: selectedMarketplace !== 'all' ? selectedMarketplace : undefined,
        }),
        apiClient.marketplaces.getCategories(),
      ]);

      if (marketplacesRes.ok) {
        setMarketplaces(marketplacesRes.data.items);

        // Auto-sync marketplaces that have never been synced (first time setup)
        if (!hasAutoSynced) {
          const unsyncedMarketplaces = marketplacesRes.data.items.filter(
            (m) => m.lastSyncedAt === null && m.status !== 'syncing'
          );

          if (unsyncedMarketplaces.length > 0) {
            setHasAutoSynced(true);
            // Sync unsynced marketplaces in the background
            for (const marketplace of unsyncedMarketplaces) {
              setSyncingIds((prev) => new Set(prev).add(marketplace.id));
              apiClient.marketplaces.sync(marketplace.id).then(async (result) => {
                setSyncingIds((prev) => {
                  const next = new Set(prev);
                  next.delete(marketplace.id);
                  return next;
                });
                // Refetch data after successful sync
                if (result.ok) {
                  const [newMarketplaces, newPlugins, newCategories] = await Promise.all([
                    apiClient.marketplaces.list(),
                    apiClient.marketplaces.listPlugins({
                      search: searchQuery || undefined,
                      category: selectedCategory !== 'all' ? selectedCategory : undefined,
                      marketplaceId:
                        selectedMarketplace !== 'all' ? selectedMarketplace : undefined,
                    }),
                    apiClient.marketplaces.getCategories(),
                  ]);
                  if (newMarketplaces.ok) setMarketplaces(newMarketplaces.data.items);
                  if (newPlugins.ok) setPlugins(newPlugins.data.items);
                  if (newCategories.ok) setCategories(newCategories.data.categories);
                }
              });
            }
          }
        }
      }

      if (pluginsRes.ok) {
        setPlugins(pluginsRes.data.items);
      }

      if (categoriesRes.ok) {
        setCategories(categoriesRes.data.categories);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace data');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedMarketplace, hasAutoSynced]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler for syncing a marketplace
  const handleSyncMarketplace = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      const result = await apiClient.marketplaces.sync(id);
      if (result.ok) {
        // Refresh data after sync
        await fetchData();
      }
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Handler for adding a new marketplace
  const handleAddMarketplace = async (data: {
    name: string;
    githubUrl: string;
    branch?: string;
  }) => {
    setIsAddingMarketplace(true);
    try {
      const result = await apiClient.marketplaces.create({
        name: data.name,
        githubUrl: data.githubUrl,
        branch: data.branch,
      });

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      // Sync the newly added marketplace
      await apiClient.marketplaces.sync(result.data.id);

      // Refresh data
      await fetchData();
    } finally {
      setIsAddingMarketplace(false);
    }
  };

  // Handler for removing a marketplace
  const handleRemoveMarketplace = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to remove this marketplace?');
    if (!confirmed) return;

    const result = await apiClient.marketplaces.delete(id);
    if (result.ok) {
      await fetchData();
    }
  };

  // Filter plugins locally for immediate feedback
  const filteredPlugins = plugins.filter((plugin) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = plugin.name.toLowerCase().includes(query);
      const descMatch = plugin.description?.toLowerCase().includes(query);
      if (!nameMatch && !descMatch) return false;
    }

    if (selectedCategory !== 'all' && plugin.category !== selectedCategory) {
      return false;
    }

    if (selectedMarketplace !== 'all' && plugin.marketplaceId !== selectedMarketplace) {
      return false;
    }

    return true;
  });

  return (
    <LayoutShell breadcrumbs={[{ label: 'Content' }, { label: 'Marketplace' }]}>
      <div data-testid="marketplace-page" className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-fg">Plugin Marketplace</h1>
            <p className="text-sm text-fg-muted mt-1">
              Browse and install plugins from connected repositories
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} data-testid="add-marketplace-button">
            <Plus className="h-4 w-4 mr-1" />
            Add Marketplace
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
            <input
              type="text"
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              data-testid="search-input"
            />
          </div>

          {/* Marketplace filter */}
          <div className="relative">
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              data-testid="marketplace-filter"
            >
              <option value="all">All Sources</option>
              {marketplaces.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <CaretDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted pointer-events-none" />
          </div>

          {/* Category filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-accent"
              data-testid="category-filter"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <CaretDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted pointer-events-none" />
          </div>

          {/* Clear filters */}
          {(searchQuery || selectedMarketplace !== 'all' || selectedCategory !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedMarketplace('all');
                setSelectedCategory('all');
              }}
            >
              <FunnelSimple className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Connected Marketplaces */}
        {marketplaces.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-fg-muted mb-3">Connected Sources</h2>
            <div className="flex flex-wrap gap-3">
              {marketplaces.map((marketplace) => (
                <MarketplaceSourceCard
                  key={marketplace.id}
                  marketplace={marketplace}
                  onSync={() => handleSyncMarketplace(marketplace.id)}
                  onRemove={
                    marketplace.isDefault
                      ? undefined
                      : () => handleRemoveMarketplace(marketplace.id)
                  }
                  isSyncing={syncingIds.has(marketplace.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-danger-muted border border-danger/30 text-sm text-danger">
            {error}
            <Button variant="ghost" size="sm" onClick={fetchData} className="ml-2">
              Retry
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <ArrowsClockwise className="h-6 w-6 text-fg-muted animate-spin" />
            <span className="ml-2 text-sm text-fg-muted">Loading plugins...</span>
          </div>
        )}

        {/* Plugin Grid */}
        {!isLoading && filteredPlugins.length > 0 && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPlugins.map((plugin, index) => (
              <div
                key={`${plugin.marketplaceId}-${plugin.id}`}
                className="animate-fadeIn"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <PluginCard
                  plugin={plugin}
                  onToggle={() => {
                    // TODO: Implement toggle functionality
                    console.log('Toggle plugin:', plugin.id);
                  }}
                  onViewDetails={() => {
                    // TODO: Implement view details
                    console.log('View plugin:', plugin.id);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredPlugins.length === 0 && (
          <div className="flex items-center justify-center min-h-[40vh]">
            <EmptyState
              icon={PuzzlePiece}
              title={
                searchQuery || selectedCategory !== 'all' || selectedMarketplace !== 'all'
                  ? 'No plugins match your filters'
                  : 'No plugins available'
              }
              subtitle={
                searchQuery || selectedCategory !== 'all' || selectedMarketplace !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Sync a marketplace to discover plugins, or add a custom marketplace repository.'
              }
              action={
                marketplaces.length > 0 &&
                !searchQuery &&
                selectedCategory === 'all' &&
                selectedMarketplace === 'all'
                  ? {
                      label: 'Sync All',
                      onClick: () =>
                        marketplaces.forEach((m) => {
                          handleSyncMarketplace(m.id);
                        }),
                    }
                  : undefined
              }
            />
          </div>
        )}

        {/* Add Marketplace Dialog */}
        <AddMarketplaceDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onAdd={handleAddMarketplace}
          isAdding={isAddingMarketplace}
        />
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </LayoutShell>
  );
}
