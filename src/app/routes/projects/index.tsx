import { MagnifyingGlass, Plus, SortAscending } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { NewProjectDialog } from '@/app/components/features/new-project-dialog';
import {
  AddProjectCard,
  ProjectCard,
  type ProjectStatus,
  type TaskCounts,
} from '@/app/components/features/project-card';
import { Button } from '@/app/components/ui/button';
import { apiClient, type ProjectListItem } from '@/lib/api/client';
import type { Result } from '@/lib/utils/result';
import type { GitHubOrg, GitHubRepo } from '@/services/github-token.service';

/**
 * Animated AgentPane logo icon for the welcome screen
 * A larger version of the sidebar logo with animated nodes
 */
function AgentPaneLogo(): React.JSX.Element {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-surface-subtle shadow-[0_2px_4px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_-1px_0_0_rgba(0,0,0,0.3)_inset,0_4px_24px_-2px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-radial from-done/10 to-transparent dark:from-done/15" />
      <svg
        className="relative z-10 h-16 w-16 drop-shadow-[0_0_12px_rgba(163,113,247,0.4)]"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="projectsCoreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="50%" stopColor="#3fb950" />
            <stop offset="100%" stopColor="#3fb950" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Connection lines */}
        <line x1="14" y1="14" x2="6" y2="8" stroke="#58a6ff" strokeOpacity="0.4" strokeWidth="1" />
        <line x1="14" y1="14" x2="22" y2="6" stroke="#a371f7" strokeOpacity="0.4" strokeWidth="1" />
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
        <line x1="14" y1="14" x2="6" y2="22" stroke="#d29922" strokeOpacity="0.4" strokeWidth="1" />
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
        <circle cx="14" cy="14" r="5" fill="url(#projectsCoreGrad)" />
        <circle cx="14" cy="14" r="2" fill="#fff" />
      </svg>
    </div>
  );
}

// Simplified project summary for client-side rendering
type ClientProjectSummary = {
  project: ProjectListItem;
  status: ProjectStatus;
  taskCounts: TaskCounts;
  runningAgents: { id: string; name: string; currentTaskId?: string; currentTaskTitle?: string }[];
  lastActivityAt?: Date | null;
};

export const Route = createFileRoute('/projects/')({
  component: ProjectsPage,
});

type SortOption = 'recent' | 'name' | 'created';

function ProjectsPage(): React.JSX.Element {
  const [projectSummaries, setProjectSummaries] = useState<ClientProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [isSettingsConfigured, setIsSettingsConfigured] = useState(false);
  const [isGitHubConfigured, setIsGitHubConfigured] = useState(false);
  const [localRepos, setLocalRepos] = useState<{ name: string; path: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...projectSummaries];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.project.name.toLowerCase().includes(query) ||
          s.project.path.toLowerCase().includes(query) ||
          s.project.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.project.name.localeCompare(b.project.name);
        case 'created':
          return (
            new Date(b.project.createdAt ?? 0).getTime() -
            new Date(a.project.createdAt ?? 0).getTime()
          );
        default:
          return (
            new Date(b.project.updatedAt ?? 0).getTime() -
            new Date(a.project.updatedAt ?? 0).getTime()
          );
      }
    });

    return result;
  }, [projectSummaries, searchQuery, sortBy]);

  // Check if global settings are configured (API key is required, GitHub PAT is optional)
  useEffect(() => {
    // Check Anthropic key via API (stored in SQLite)
    const checkAnthropicKey = async () => {
      const result = await apiClient.apiKeys.get('anthropic');
      setIsSettingsConfigured(result.ok && result.data.keyInfo !== null);
    };
    checkAnthropicKey();

    // Check GitHub token via API (stored in SQLite)
    const checkGitHub = async () => {
      const result = await apiClient.github.getTokenInfo();
      setIsGitHubConfigured(result.ok && result.data.tokenInfo?.isValid === true);
    };
    checkGitHub();

    // Discover local git repos
    const discoverLocalRepos = async () => {
      const result = await apiClient.filesystem.discoverRepos();
      if (result.ok) {
        setLocalRepos(result.data.repos.map((r) => ({ name: r.name, path: r.path })));
      }
    };
    discoverLocalRepos();
  }, []);

  // Fetch projects from API on mount
  useEffect(() => {
    const fetchProjects = async () => {
      const result = await apiClient.projects.list({ limit: 24 });
      if (result.ok) {
        const summaries: ClientProjectSummary[] = result.data.items.map((project) => ({
          project,
          status: 'idle' as const,
          taskCounts: {
            backlog: 0,
            queued: 0,
            inProgress: 0,
            waitingApproval: 0,
            verified: 0,
            total: 0,
          },
          runningAgents: [],
          lastActivityAt: project.updatedAt,
        }));
        setProjectSummaries(summaries);
      }
      setIsLoading(false);
    };
    fetchProjects();
  }, []);

  const handleCreateProject = async (data: {
    name: string;
    path: string;
    description?: string;
  }): Promise<Result<void, { code: string; message: string }>> => {
    const result = await apiClient.projects.create({
      name: data.name,
      path: data.path,
      description: data.description,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      };
    }

    const listResult = await apiClient.projects.list({ limit: 24 });
    if (listResult.ok) {
      const summaries: ClientProjectSummary[] = listResult.data.items.map((project) => ({
        project,
        status: 'idle' as const,
        taskCounts: {
          backlog: 0,
          queued: 0,
          inProgress: 0,
          waitingApproval: 0,
          verified: 0,
          total: 0,
        },
        runningAgents: [],
        lastActivityAt: project.updatedAt,
      }));
      setProjectSummaries(summaries);
    }

    return { ok: true, value: undefined };
  };

  const handleValidatePath = async (
    pathToValidate: string
  ): Promise<
    Result<
      {
        name: string;
        path: string;
        defaultBranch: string;
        hasClaudeConfig: boolean;
        remoteUrl?: string;
      },
      unknown
    >
  > => {
    // TODO: Add API endpoint for path validation
    // For now, return a basic validation result
    const pathParts = pathToValidate.split('/');
    const name = pathParts[pathParts.length - 1] || 'unknown';
    return {
      ok: true,
      value: { name, path: pathToValidate, defaultBranch: 'main', hasClaudeConfig: false },
    };
  };

  const handleClone = async (
    url: string,
    destination: string
  ): Promise<Result<{ path: string }, unknown>> => {
    const result = await apiClient.github.clone(url, destination);
    if (result.ok) {
      return { ok: true, value: { path: result.data.path } };
    }
    return {
      ok: false,
      error: result.error,
    };
  };

  const handleCreateFromTemplate = async (params: {
    templateOwner: string;
    templateRepo: string;
    name: string;
    owner?: string;
    description?: string;
    isPrivate?: boolean;
    clonePath: string;
  }): Promise<Result<{ path: string }, unknown>> => {
    const result = await apiClient.github.createFromTemplate(params);
    if (result.ok) {
      return { ok: true, value: { path: result.data.path } };
    }
    return {
      ok: false,
      error: result.error,
    };
  };

  const handleFetchOrgs = async (): Promise<GitHubOrg[]> => {
    // Fetch orgs via API (uses token from SQLite)
    const result = await apiClient.github.listOrgs();
    if (result.ok) {
      return result.data.orgs;
    }
    console.error('Failed to fetch GitHub orgs:', result.error);
    return [];
  };

  const handleFetchReposForOwner = async (owner: string): Promise<GitHubRepo[]> => {
    // Fetch repos for a specific owner via API
    const result = await apiClient.github.listReposForOwner(owner);
    if (result.ok) {
      return result.data.repos;
    }
    console.error('Failed to fetch repos for owner:', result.error);
    return [];
  };

  if (isLoading) {
    return (
      <LayoutShell breadcrumbs={[{ label: 'Projects' }]}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Loading projects...</div>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'Projects' }]}
      actions={
        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-48 rounded-md border border-border bg-surface py-1.5 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="project-search"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="project-sort"
            >
              <option value="recent">Recently Updated</option>
              <option value="name">Name (A-Z)</option>
              <option value="created">Date Created</option>
            </select>
            <SortAscending className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          </div>

          <Button data-testid="create-project-button" onClick={() => setShowNewProject(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      }
    >
      <div data-testid="projects-page" className="p-6">
        {projectSummaries.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <EmptyState
              preset="first-run"
              size="lg"
              customIcon={<AgentPaneLogo />}
              title="Welcome to AgentPane!"
              subtitle="Let's get you started with your first project"
              steps={[
                { label: 'Install AgentPane', completed: true },
                { label: 'Configure Global Settings', completed: isSettingsConfigured },
                { label: 'Create your first project', completed: false },
                { label: 'Run your first agent', completed: false },
              ]}
              primaryAction={
                isSettingsConfigured
                  ? {
                      label: 'Create Project',
                      onClick: () => setShowNewProject(true),
                    }
                  : {
                      label: 'Configure Settings',
                      onClick: () => {
                        window.location.href = '/settings';
                      },
                    }
              }
              secondaryAction={
                isSettingsConfigured
                  ? undefined
                  : {
                      label: 'Skip for now',
                      onClick: () => setShowNewProject(true),
                    }
              }
            />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <MagnifyingGlass className="h-12 w-12 text-fg-subtle mb-4" />
            <p className="text-fg-muted">No projects match "{searchQuery}"</p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-accent hover:text-accent/80"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div
            className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            data-testid="project-list"
          >
            {filteredProjects.map((summary) => (
              <ProjectCard
                key={summary.project.id}
                project={summary.project}
                status={summary.status}
                taskCounts={summary.taskCounts}
                activeAgents={summary.runningAgents.map((agent) => ({
                  id: agent.id,
                  name: agent.name,
                  taskId: agent.currentTaskId ?? '',
                  taskTitle: agent.currentTaskTitle ?? '',
                  type: 'runner' as const,
                }))}
                lastRunAt={summary.lastActivityAt}
              />
            ))}
            <AddProjectCard onClick={() => setShowNewProject(true)} />
          </div>
        )}
      </div>

      <NewProjectDialog
        open={showNewProject}
        onOpenChange={setShowNewProject}
        onSubmit={handleCreateProject}
        onValidatePath={handleValidatePath}
        onClone={handleClone}
        onCreateFromTemplate={handleCreateFromTemplate}
        onFetchOrgs={handleFetchOrgs}
        onFetchReposForOwner={handleFetchReposForOwner}
        isGitHubConfigured={isGitHubConfigured}
        recentRepos={localRepos}
      />
    </LayoutShell>
  );
}
