import { ArrowsClockwise } from '@phosphor-icons/react';
import { createFileRoute, Link, Outlet, useMatches, useNavigate } from '@tanstack/react-router';
import { LayoutShell } from '@/app/components/features/layout-shell';
import {
  TerraformProvider,
  useTerraform,
} from '@/app/components/features/terraform/terraform-context';
import { TerraformSyncBar } from '@/app/components/features/terraform/terraform-sync-bar';
import { downloadAsFile } from '@/app/components/features/terraform/terraform-utils';
import { TerraformViewSwitcher } from '@/app/components/features/terraform/terraform-view-switcher';

export const Route = createFileRoute('/terraform')({
  component: TerraformLayout,
});

function TerraformLayout(): React.JSX.Element {
  return (
    <TerraformProvider>
      <TerraformLayoutInner />
    </TerraformProvider>
  );
}

function TerraformLayoutInner(): React.JSX.Element {
  const { registries, syncRegistry, generatedCode } = useTerraform();
  const matches = useMatches();
  const navigate = useNavigate();
  const isHistoryView = matches.some((m) => m.fullPath === '/terraform/history');
  const isSettingsView = matches.some((m) => m.fullPath === '/terraform/settings');

  const handleSync = async () => {
    const results = await Promise.allSettled(registries.map((reg) => syncRegistry(reg.id)));
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[Terraform] Registry sync failed:', result.reason);
      }
    }
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    downloadAsFile(generatedCode, 'main.tf');
  };

  return (
    <LayoutShell
      breadcrumbs={[
        { label: 'Terraform No Code (AI assisted)', to: '/terraform' },
        ...(isSettingsView ? [{ label: 'Settings' }] : []),
      ]}
      centerAction={isSettingsView ? undefined : <TerraformViewSwitcher />}
      actions={
        <div className="flex items-center gap-2">
          {isSettingsView && (
            <Link
              to="/terraform"
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
            >
              Back to Composer
            </Link>
          )}
          {isHistoryView && (
            <button
              type="button"
              onClick={() => navigate({ to: '/terraform' })}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
            >
              + New Composition
            </button>
          )}
          {registries.length > 0 && !isHistoryView && !isSettingsView && (
            <button
              type="button"
              onClick={() => void handleSync()}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-surface-emphasis hover:border-fg-subtle"
            >
              <ArrowsClockwise className="h-3.5 w-3.5" />
              Sync Registry
            </button>
          )}
          {generatedCode && !isHistoryView && !isSettingsView && (
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
            >
              Download .tf
            </button>
          )}
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <TerraformSyncBar />
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </LayoutShell>
  );
}
