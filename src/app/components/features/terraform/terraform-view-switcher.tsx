import { ChatCircle, Cube } from '@phosphor-icons/react';
import { Link, useMatches } from '@tanstack/react-router';

export function TerraformViewSwitcher(): React.JSX.Element {
  const matches = useMatches();
  const isModulesView = matches.some((m) => m.fullPath === '/terraform/modules');

  return (
    <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
      <Link
        to="/terraform"
        activeOptions={{ exact: true }}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          !isModulesView ? 'bg-accent-muted text-accent' : 'text-fg-muted hover:text-fg'
        }`}
      >
        <ChatCircle className="h-3.5 w-3.5" />
        Compose
      </Link>
      <Link
        to="/terraform/modules"
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          isModulesView ? 'bg-accent-muted text-accent' : 'text-fg-muted hover:text-fg'
        }`}
      >
        <Cube className="h-3.5 w-3.5" />
        Modules
      </Link>
    </div>
  );
}
