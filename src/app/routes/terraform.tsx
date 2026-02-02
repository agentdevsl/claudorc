import { createFileRoute, Outlet, useMatches, useNavigate } from '@tanstack/react-router';
import { LayoutShell } from '@/app/components/features/layout-shell';
import {
  TerraformProvider,
  useTerraform,
} from '@/app/components/features/terraform/terraform-context';
import { TerraformSyncBar } from '@/app/components/features/terraform/terraform-sync-bar';
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

  const handleSync = async () => {
    for (const reg of registries) {
      await syncRegistry(reg.id);
    }
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'main.tf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'Terraform', to: '/terraform' }]}
      centerAction={<TerraformViewSwitcher />}
      actions={
        <div className="flex items-center gap-2">
          {isHistoryView && (
            <button
              type="button"
              onClick={() => navigate({ to: '/terraform' })}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
            >
              + New Composition
            </button>
          )}
          {registries.length > 0 && !isHistoryView && (
            <button
              type="button"
              onClick={handleSync}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
            >
              Sync Registry
            </button>
          )}
          {generatedCode && !isHistoryView && (
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
      <TerraformSyncBar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </LayoutShell>
  );
}
