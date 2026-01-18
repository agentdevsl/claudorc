import { Funnel, Plus } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { NewProjectDialog } from '@/app/components/features/new-project-dialog';
import { AddProjectCard, ProjectCard } from '@/app/components/features/project-card';
import { Button } from '@/app/components/ui/button';
import type { RouterContext } from '@/app/router';
import { useServices } from '@/app/services/service-context';
import type { Result } from '@/lib/utils/result';
import type { PathValidation, ProjectSummary } from '@/services/project.service';

/**
 * Animated AgentPane logo icon for the welcome screen
 * A larger version of the sidebar logo with animated nodes
 */
function AgentPaneLogo(): React.JSX.Element {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#12161c] to-[#0a0d11] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_-1px_0_0_rgba(0,0,0,0.3)_inset,0_4px_24px_-2px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-radial from-done/15 to-transparent" />
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
  loader: async ({ context }: { context: RouterContext }) => {
    if (!context.services) {
      return { projectSummaries: [], runningAgents: 0 };
    }

    const summariesResult = await context.services.projectService.listWithSummaries({
      limit: 24,
    });
    const runningAgentsResult = await context.services.agentService.getRunningCountAll();

    return {
      projectSummaries: summariesResult.ok ? summariesResult.value : [],
      runningAgents: runningAgentsResult.ok ? runningAgentsResult.value : 0,
    };
  },
  component: Dashboard,
});

function Dashboard(): React.JSX.Element {
  const { projectService } = useServices();
  const loaderData = Route.useLoaderData() as
    | { projectSummaries: ProjectSummary[]; runningAgents: number }
    | undefined;
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>(
    loaderData?.projectSummaries ?? []
  );
  const [showNewProject, setShowNewProject] = useState(false);

  const handleCreateProject = async (data: {
    name: string;
    path: string;
    description?: string;
  }): Promise<void> => {
    const result = await projectService.create({
      name: data.name,
      path: data.path,
      description: data.description,
    });

    if (result.ok) {
      // Refetch summaries to get complete data
      const summariesResult = await projectService.listWithSummaries({ limit: 24 });
      if (summariesResult.ok) {
        setProjectSummaries(summariesResult.value);
      }
    }
  };

  const handleValidatePath = async (path: string): Promise<Result<PathValidation, unknown>> => {
    return projectService.validatePath(path);
  };

  const handleClone = async (
    url: string,
    destination: string
  ): Promise<Result<{ path: string }, unknown>> => {
    return projectService.cloneRepository(url, destination);
  };

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
                { label: 'Configure Global Settings', completed: false },
                { label: 'Create your first project', completed: false },
                { label: 'Run your first agent', completed: false },
              ]}
              primaryAction={{
                label: 'Configure Settings',
                onClick: () => {
                  window.location.href = '/settings';
                },
              }}
              secondaryAction={{
                label: 'Skip for now',
                onClick: () => setShowNewProject(true),
              }}
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
      />
    </LayoutShell>
  );
}
