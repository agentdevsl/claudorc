import { Funnel, Plus } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { NewProjectDialog } from '@/app/components/features/new-project-dialog';
import { AddProjectCard, ProjectCard } from '@/app/components/features/project-card';
import { Button } from '@/app/components/ui/button';
import { useServices } from '@/app/services/service-context';
import type { Result } from '@/lib/utils/result';
import type { PathValidation, ProjectSummary } from '@/services/project.service';

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
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
  const loaderData = Route.useLoaderData();
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>(
    (loaderData as { projectSummaries?: ProjectSummary[] }).projectSummaries ?? []
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
              title="Welcome to AgentPane!"
              subtitle="Let's get you started with your first project"
              steps={[
                { label: 'Install AgentPane', completed: true },
                { label: 'Create your first project', completed: false },
                { label: 'Run your first agent', completed: false },
              ]}
              primaryAction={{
                label: 'Create Project',
                onClick: () => setShowNewProject(true),
              }}
              secondaryAction={{
                label: 'Import existing project',
                onClick: () => setShowNewProject(true),
              }}
            />
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
