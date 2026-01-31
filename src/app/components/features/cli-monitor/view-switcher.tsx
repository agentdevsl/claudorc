import { ChartBar, SquaresFour, TerminalWindow } from '@phosphor-icons/react';
import { Link, useMatchRoute } from '@tanstack/react-router';

const views = [
  { to: '/cli-monitor', label: 'Cards', icon: SquaresFour },
  { to: '/cli-monitor/terminal', label: 'Terminal', icon: TerminalWindow },
  { to: '/cli-monitor/timeline', label: 'Timeline', icon: ChartBar },
] as const;

export function ViewSwitcher() {
  const matchRoute = useMatchRoute();

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-emphasis p-0.5">
      {views.map((view) => {
        const Icon = view.icon;
        // For the index route, match exact; for others, fuzzy is fine
        const isActive =
          view.to === '/cli-monitor'
            ? matchRoute({ to: '/cli-monitor', fuzzy: false }) != null
            : matchRoute({ to: view.to, fuzzy: true }) != null;

        return (
          <Link
            key={view.to}
            to={view.to}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              isActive ? 'bg-default text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Icon size={14} weight={isActive ? 'fill' : 'regular'} />
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
