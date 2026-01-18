import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { WorktreeManagement } from '@/app/components/features/worktree-management';
import type { RouterContext } from '@/app/router';
import type { Project } from '@/db/schema/projects';
import type { WorktreeStatusInfo } from '@/services/worktree.service';

export const Route = createFileRoute('/worktrees/')({
  loader: async ({ context }: { context: RouterContext }) => {
    if (!context.services) {
      return { project: null, worktrees: [] as WorktreeStatusInfo[] };
    }

    const projectsResult = await context.services.projectService.list({
      limit: 1,
    });
    const project = projectsResult.ok ? (projectsResult.value[0] ?? null) : null;

    if (!project) {
      return { project: null, worktrees: [] };
    }

    const worktreesResult = await context.services.worktreeService.list(project.id);
    return {
      project,
      worktrees: worktreesResult.ok ? worktreesResult.value : [],
    };
  },
  component: WorktreesPage,
});

function WorktreesPage(): React.JSX.Element {
  const { worktreeService } = Route.useRouteContext().services ?? {};
  const loaderData = Route.useLoaderData() as
    | { project: Project | null; worktrees: WorktreeStatusInfo[] }
    | undefined;
  const [worktrees, setWorktrees] = useState<WorktreeStatusInfo[]>(loaderData?.worktrees ?? []);

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'Worktrees' }]}
      projectName={loaderData?.project?.name}
      projectPath={loaderData?.project?.path}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        {loaderData?.project ? (
          <WorktreeManagement
            worktrees={worktrees}
            onRemove={async (worktreeId) => {
              if (!worktreeService) return;
              const result = await worktreeService.remove(worktreeId, true);
              if (result.ok) {
                setWorktrees((prev) => prev.filter((worktree) => worktree.id !== worktreeId));
              }
            }}
          />
        ) : (
          <EmptyState
            preset="no-projects"
            title="No project selected"
            subtitle="Add a project to see worktrees."
          />
        )}
      </div>
    </LayoutShell>
  );
}
