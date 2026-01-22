export type MarketplaceStatus = 'active' | 'syncing' | 'error';

export interface CachedPlugin {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  category?: string;
  readme?: string;
}

export interface MarketplaceListItem {
  id: string;
  name: string;
  githubOwner: string;
  githubRepo: string;
  branch: string;
  pluginsPath: string;
  isDefault: boolean;
  isEnabled: boolean;
  status: MarketplaceStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  pluginCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PluginListItem {
  id: string;
  name: string;
  description?: string;
  author?: string;
  version?: string;
  category?: string;
  marketplaceId: string;
  marketplaceName: string;
  isEnabled: boolean;
}

export interface CreateMarketplaceInput {
  name: string;
  githubOwner: string;
  githubRepo: string;
  branch?: string;
  pluginsPath?: string;
}
