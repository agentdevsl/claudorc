import { Clock, Gear, GitBranch, Hourglass, ListChecks, Robot, Stack } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/lib/utils/cn';

interface SidebarProps {
  projectName?: string;
  projectPath?: string;
}

const navItems = [
  { label: 'Projects', to: '/projects', icon: Stack },
  { label: 'Agents', to: '/agents', icon: Robot },
  { label: 'Tasks', to: '/projects/$projectId', icon: ListChecks },
  { label: 'Queue', to: '/queue', icon: Hourglass },
  { label: 'Sessions', to: '/sessions', icon: Clock },
  { label: 'Worktrees', to: '/worktrees', icon: GitBranch },
  { label: 'Settings', to: '/settings', icon: Gear },
] as const;

export function Sidebar({ projectName, projectPath }: SidebarProps): React.JSX.Element {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-surface px-4 py-6">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-muted text-sm font-semibold text-fg">
          AP
        </div>
        <span className="text-sm font-semibold text-fg">AgentPane</span>
      </div>

      <div className="mt-6 rounded-md border border-border bg-surface-subtle p-3">
        <p className="text-xs uppercase tracking-wide text-fg-muted">Project</p>
        <p className="mt-1 text-sm font-semibold text-fg">{projectName ?? 'No project'}</p>
        <p className="text-xs text-fg-muted truncate">{projectPath ?? 'Select a project'}</p>
      </div>

      <nav className="mt-6 flex-1 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-md px-2 py-2 text-sm text-fg-muted transition hover:text-fg',
                isActive && 'bg-surface-muted text-fg'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto text-xs text-fg-muted">Local-first mode</div>
    </aside>
  );
}
