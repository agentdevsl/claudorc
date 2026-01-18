import { Funnel, Plus } from '@phosphor-icons/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { NewProjectDialog } from '@/app/components/features/new-project-dialog';
import { AddProjectCard, ProjectCard } from '@/app/components/features/project-card';
import { Button } from '@/app/components/ui/button';
import { apiClient, type ProjectListItem } from '@/lib/api/client';
import type { Result } from '@/lib/utils/result';
import type { GitHubOrg, GitHubRepo } from '@/services/github-token.service';

// Simplified project summary for client-side rendering
type ClientProjectSummary = {
  project: ProjectListItem;
  status: 'active' | 'idle';
  taskCounts: { total: number; completed: number };
  runningAgents: { id: string; name: string; currentTaskId?: string; currentTaskTitle?: string }[];
  lastActivityAt?: Date | null;
};

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
          <radialGradient id="welcomeCoreGrad" cx="50%" cy="50%" r="50%">
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
        <circle cx="14" cy="14" r="5" fill="url(#welcomeCoreGrad)" />
        <circle cx="14" cy="14" r="2" fill="#fff" />
      </svg>
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: Dashboard,
});

function Dashboard(): React.JSX.Element {
  const navigate = useNavigate();
  const [projectSummaries, setProjectSummaries] = useState<ClientProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [isSettingsConfigured, setIsSettingsConfigured] = useState(false);
  const [isGitHubConfigured, setIsGitHubConfigured] = useState(false);
  const [localRepos, setLocalRepos] = useState<{ name: string; path: string }[]>([]);

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
        // Convert API response to client project summaries
        const summaries: ClientProjectSummary[] = result.data.items.map((project) => ({
          project,
          status: 'idle' as const,
          taskCounts: { total: 0, completed: 0 },
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
        taskCounts: { total: 0, completed: 0 },
        runningAgents: [],
        lastActivityAt: project.updatedAt,
      }));
      setProjectSummaries(summaries);
    }

    return { ok: true, value: undefined };
  };

  const handleValidatePath = async (
    _path: string
  ): Promise<
    Result<
      { isValid: boolean; exists: boolean; isGitRepo: boolean; hasClaudeConfig: boolean },
      unknown
    >
  > => {
    // TODO: Add API endpoint for path validation
    return {
      ok: true,
      value: { isValid: true, exists: false, isGitRepo: false, hasClaudeConfig: false },
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
          <Button variant="outline">
            <Funnel className="h-4 w-4" />
            Filter
          </Button>
          <Button onClick={() => setShowNewProject(true)} data-testid="new-project-button">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      }
    >
      <div className="p-6">
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
                        navigate({ to: '/settings' });
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
        ) : (
          <div
            className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            data-testid="project-list"
          >
            {projectSummaries.map((summary) => (
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
