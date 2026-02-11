import { ChatCircle, Cube } from '@phosphor-icons/react';
import { Link, useMatches } from '@tanstack/react-router';

export function TerraformViewSwitcher(): React.JSX.Element {
  const matches = useMatches();
  const currentPath = matches[matches.length - 1]?.fullPath ?? '';

  const isCompose = currentPath === '/terraform/' || currentPath === '/terraform';
  const isModules = currentPath === '/terraform/modules';

  return (
    <div className="flex items-center gap-1">
      <Link
        to="/terraform"
        activeOptions={{ exact: true }}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
          isCompose
            ? 'bg-surface-muted text-fg'
            : 'text-fg-muted hover:text-fg hover:bg-surface-muted/50'
        }`}
      >
        <ChatCircle className="h-3.5 w-3.5" />
        Compose
      </Link>
      <Link
        to="/terraform/modules"
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
          isModules
            ? 'bg-surface-muted text-fg'
            : 'text-fg-muted hover:text-fg hover:bg-surface-muted/50'
        }`}
      >
        <Cube className="h-3.5 w-3.5" />
        Modules
      </Link>
    </div>
  );
}
