import type { ReactNode } from 'react';
import { type BreadcrumbItem, Breadcrumbs } from '@/app/components/features/breadcrumbs';
import { Sidebar } from '@/app/components/features/sidebar';

interface LayoutShellProps {
  breadcrumbs?: BreadcrumbItem[];
  projectId?: string;
  projectName?: string;
  projectPath?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function LayoutShell({
  breadcrumbs,
  projectId,
  projectName,
  projectPath,
  actions,
  children,
}: LayoutShellProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen bg-canvas text-fg" data-testid="layout-shell">
      <div className="hidden md:block">
        <Sidebar projectId={projectId} projectName={projectName} projectPath={projectPath} />
      </div>
      <div className="flex flex-1 flex-col">
        {breadcrumbs ? (
          <header
            className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4"
            data-testid="layout-header"
          >
            <Breadcrumbs items={breadcrumbs} />
            {actions ? (
              <div className="flex items-center gap-2" data-testid="header-actions">
                {actions}
              </div>
            ) : null}
          </header>
        ) : null}
        <main className="flex-1" data-testid="layout-main">
          {children}
        </main>
      </div>
    </div>
  );
}
