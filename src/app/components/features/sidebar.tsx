import { Clock, Gear, GitBranch, Hourglass, Kanban, Plus, Robot } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServices } from '@/app/services/service-context';
import type { ProjectSummary } from '@/services/project.service';

interface SidebarProps {
  projectId?: string;
  projectName?: string;
  projectPath?: string;
}

interface NavItem {
  readonly label: string;
  readonly to: string;
  readonly icon: typeof Robot;
  readonly badge?: number | 'active';
}

// Workspace section nav items
const workspaceNavItems: readonly NavItem[] = [
  { label: 'Agents', to: '/agents', icon: Robot, badge: 'active' },
] as const;

// History section nav items
const historyNavItems: readonly NavItem[] = [
  { label: 'Queue', to: '/queue', icon: Hourglass },
  { label: 'Sessions', to: '/sessions', icon: Clock },
  { label: 'Worktrees', to: '/worktrees', icon: GitBranch },
] as const;

// Project section nav items
const projectNavItems: readonly NavItem[] = [
  { label: 'Settings', to: '/settings', icon: Gear },
] as const;

export function Sidebar({ projectId, projectName, projectPath }: SidebarProps): React.JSX.Element {
  const { projectService } = useServices();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // Fetch projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      const result = await projectService.listWithSummaries({ limit: 10 });
      if (result.ok) {
        setProjects(result.value);
      }
    };
    void loadProjects();
  }, [projectService]);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-surface">
      {/* Header with logo */}
      <Link
        to="/"
        className="flex items-center gap-2.5 border-b border-border px-4 py-4 transition-colors hover:bg-surface-subtle"
      >
        <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#12161c] to-[#0a0d11] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_-1px_0_0_rgba(0,0,0,0.3)_inset,0_4px_16px_-2px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="absolute inset-0 animate-pulse rounded-xl bg-gradient-radial from-done/15 to-transparent" />
          <svg
            className="relative z-10 h-7 w-7 drop-shadow-[0_0_8px_rgba(163,113,247,0.4)]"
            viewBox="0 0 32 32"
            fill="none"
          >
            <defs>
              <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff" />
                <stop offset="50%" stopColor="#3fb950" />
                <stop offset="100%" stopColor="#3fb950" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Connection lines */}
            <line
              x1="14"
              y1="14"
              x2="6"
              y2="8"
              stroke="#58a6ff"
              strokeOpacity="0.4"
              strokeWidth="1"
            />
            <line
              x1="14"
              y1="14"
              x2="22"
              y2="6"
              stroke="#a371f7"
              strokeOpacity="0.4"
              strokeWidth="1"
            />
            <line
              x1="14"
              y1="14"
              x2="26"
              y2="16"
              stroke="#3fb950"
              strokeOpacity="0.4"
              strokeWidth="1"
            />
            <line
              x1="14"
              y1="14"
              x2="20"
              y2="26"
              stroke="#f778ba"
              strokeOpacity="0.4"
              strokeWidth="1"
            />
            <line
              x1="14"
              y1="14"
              x2="6"
              y2="22"
              stroke="#d29922"
              strokeOpacity="0.4"
              strokeWidth="1"
            />
            {/* Outer nodes */}
            <circle
              className="animate-pulse"
              cx="6"
              cy="8"
              r="2"
              fill="#58a6ff"
              style={{ filter: 'drop-shadow(0 0 2px #58a6ff)' }}
            />
            <circle
              className="animate-pulse"
              cx="22"
              cy="6"
              r="2.5"
              fill="#a371f7"
              style={{ filter: 'drop-shadow(0 0 3px #a371f7)', animationDelay: '0.4s' }}
            />
            <circle
              className="animate-pulse"
              cx="26"
              cy="16"
              r="2"
              fill="#3fb950"
              style={{ filter: 'drop-shadow(0 0 2px #3fb950)', animationDelay: '0.8s' }}
            />
            <circle
              className="animate-pulse"
              cx="20"
              cy="26"
              r="3"
              fill="#f778ba"
              style={{ filter: 'drop-shadow(0 0 3px #f778ba)', animationDelay: '1.2s' }}
            />
            <circle
              className="animate-pulse"
              cx="6"
              cy="22"
              r="2"
              fill="#d29922"
              style={{ filter: 'drop-shadow(0 0 2px #d29922)', animationDelay: '1.6s' }}
            />
            {/* Center hub */}
            <circle cx="14" cy="14" r="5" fill="url(#coreGrad)" />
            <circle cx="14" cy="14" r="2" fill="#fff" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold text-fg">AgentPane</span>
      </Link>

      {/* Projects list */}
      <div className="mx-3 mt-3 flex flex-col gap-1.5">
        {projects.length === 0 ? (
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-surface-subtle p-2.5 text-sm text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg"
          >
            <Plus className="h-4 w-4" />
            <span>Create first project</span>
          </Link>
        ) : (
          projects.map((summary) => (
            <Link
              key={summary.project.id}
              to={`/projects/${summary.project.id}`}
              className={`flex items-center gap-2.5 rounded-md border p-2.5 transition-colors ${
                projectId === summary.project.id
                  ? 'border-accent bg-accent-muted'
                  : 'border-border bg-surface-subtle hover:border-fg-subtle'
              }`}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-success to-accent text-[11px] font-semibold text-white">
                {summary.project.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg">{summary.project.name}</div>
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  {summary.runningAgents.length > 0 && (
                    <span className="flex items-center gap-1 text-success">
                      <Robot className="h-3 w-3" />
                      {summary.runningAgents.length}
                    </span>
                  )}
                  <span>{summary.taskCounts.total} tasks</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex-1 overflow-y-auto px-3">
        {/* Workspace section */}
        <NavSection title="Workspace">
          {workspaceNavItems.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
          {/* Tasks - links to selected project's kanban or first project */}
          {(projectId || projects.length > 0) && (
            <Link
              to={projectId ? `/projects/${projectId}` : `/projects/${projects[0]?.project.id}`}
              activeProps={{ className: 'bg-accent-muted text-accent' }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
            >
              <Kanban className="h-4 w-4 opacity-80" />
              Tasks
            </Link>
          )}
        </NavSection>

        {/* History section */}
        <NavSection title="History">
          {historyNavItems.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </NavSection>

        {/* Project section */}
        <NavSection title="Project">
          {projectNavItems.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </NavSection>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-success to-accent text-xs font-medium text-white">
            SL
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-fg">Simon Lynch</div>
            <div className="text-xs text-fg-muted">Local-first mode</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="mb-4">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({ item }: { item: NavItem }): React.JSX.Element {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      activeProps={{ className: 'bg-accent-muted text-accent' }}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg"
    >
      <Icon className="h-4 w-4 opacity-80" />
      {item.label}
      {item.badge !== undefined && (
        <span
          className={`ml-auto flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
            item.badge === 'active'
              ? 'bg-success-muted text-success'
              : 'bg-surface-emphasis text-fg-muted'
          }`}
        >
          {item.badge === 'active' ? '3' : item.badge}
        </span>
      )}
    </Link>
  );
}
