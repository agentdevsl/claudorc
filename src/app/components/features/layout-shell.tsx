import type { ReactNode } from 'react';
import { type BreadcrumbItem, Breadcrumbs } from '@/app/components/features/breadcrumbs';
import { Sidebar } from '@/app/components/features/sidebar';

interface LayoutShellProps {
  breadcrumbs?: BreadcrumbItem[];
  projectName?: string;
  projectPath?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function LayoutShell({
  breadcrumbs,
  projectName,
  projectPath,
  actions,
  children,
}: LayoutShellProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen bg-canvas text-fg">
      <Sidebar projectName={projectName} projectPath={projectPath} />
      <div className="flex flex-1 flex-col">
        {breadcrumbs ? (
          <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
            <Breadcrumbs items={breadcrumbs} />
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          </header>
        ) : null}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
