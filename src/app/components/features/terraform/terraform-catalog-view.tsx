import { Cube, MagnifyingGlass } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { PROVIDER_COLORS } from '@/lib/terraform/types';
import { useTerraform } from './terraform-context';

export function TerraformCatalogView(): React.JSX.Element {
  const { modules, setSelectedModuleId } = useTerraform();
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState<string | null>(null);

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of modules) {
      counts[m.provider] = (counts[m.provider] ?? 0) + 1;
    }
    return counts;
  }, [modules]);

  const providers = useMemo(() => {
    return Object.keys(providerCounts).sort();
  }, [providerCounts]);

  const filtered = useMemo(() => {
    return modules.filter((m) => {
      if (providerFilter && m.provider !== providerFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.description?.toLowerCase().includes(q) ?? false) ||
          m.provider.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [modules, search, providerFilter]);

  if (modules.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
        <Cube className="h-12 w-12 text-fg-subtle" weight="duotone" />
        <div className="text-center">
          <h3 className="text-base font-semibold text-fg">No modules synced</h3>
          <p className="mt-1 max-w-sm text-sm text-fg-muted">
            Connect a Terraform registry in Settings to sync your private modules.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Title + Search */}
      <div className="border-b border-border px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fg">Private Module Registry</h2>
          <div className="relative w-64">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules..."
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
        {/* Filters */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setProviderFilter(null)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              !providerFilter
                ? 'bg-accent-muted text-accent'
                : 'text-fg-muted hover:bg-surface-subtle'
            }`}
          >
            All ({modules.length})
          </button>
          {providers.map((p) => {
            const colorClass =
              PROVIDER_COLORS[p.toLowerCase()] ?? 'bg-surface-emphasis text-fg-muted';
            return (
              <button
                key={p}
                type="button"
                onClick={() => setProviderFilter(providerFilter === p ? null : p)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  providerFilter === p ? colorClass : 'text-fg-muted hover:bg-surface-subtle'
                }`}
              >
                {p} ({providerCounts[p]})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((mod) => {
            const colorClass =
              PROVIDER_COLORS[mod.provider.toLowerCase()] ?? 'bg-surface-emphasis text-fg-muted';
            const inputCount = (mod.inputs as unknown[] | null)?.length ?? 0;

            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setSelectedModuleId(mod.id)}
                className="cursor-pointer rounded-md border border-border bg-surface p-4 text-left transition-all hover:-translate-y-px hover:border-accent hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-fg">{mod.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colorClass}`}
                  >
                    {mod.provider}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-fg-muted">v{mod.version}</div>
                {mod.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-fg-muted">{mod.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-1">
                    <span className="rounded bg-surface-emphasis px-1.5 py-0.5 text-[11px] text-fg-subtle">
                      {mod.namespace ?? 'module'}
                    </span>
                    <span className="rounded bg-surface-emphasis px-1.5 py-0.5 text-[11px] text-fg-subtle">
                      v{mod.version}
                    </span>
                  </div>
                  <span className="text-[11px] text-fg-subtle">{inputCount} inputs</span>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-sm text-fg-muted">No modules match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
