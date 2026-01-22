import { PuzzlePiece } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';

// Marketplace syncs with: https://github.com/anthropics/claude-plugins-official
//   - /plugins (internal Anthropic plugins)
//   - /external_plugins (third-party community plugins)

export const Route = createFileRoute('/marketplace/')({
  component: MarketplacePage,
});

function MarketplacePage(): React.JSX.Element {
  return (
    <LayoutShell breadcrumbs={[{ label: 'Content' }, { label: 'Marketplace' }]}>
      <div data-testid="marketplace-page" className="p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <EmptyState
            icon={PuzzlePiece}
            title="Plugin Marketplace"
            subtitle="Browse and install plugins from the official Claude plugins directory (github.com/anthropics/claude-plugins-official). Plugins provide additional skills, commands, and agent configurations."
          />
        </div>
      </div>
    </LayoutShell>
  );
}
