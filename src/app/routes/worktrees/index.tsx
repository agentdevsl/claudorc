import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { WorktreeManagement } from '@/app/components/features/worktree-management';
import { apiClient, type ProjectListItem } from '@/lib/api/client';
import type { WorktreeStatusInfo } from '@/services/worktree.service';

// Alias for the worktree type used by WorktreeManagement
type ClientWorktree = WorktreeStatusInfo;

export const Route = createFileRoute('/worktrees/')({
  component: WorktreesPage,
});

function WorktreesPage(): React.JSX.Element {
  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [worktrees, setWorktrees] = useState<ClientWorktree[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch project and worktrees from API on mount
  useEffect(() => {
    const fetchData = async () => {
      const projectsResult = await apiClient.projects.list({ limit: 1 });
      const firstProject = projectsResult.ok ? (projectsResult.data.items[0] ?? null) : null;
      setProject(firstProject);

      if (firstProject) {
        const worktreesResult = await apiClient.worktrees.list({ projectId: firstProject.id });
        if (worktreesResult.ok) {
          setWorktrees(worktreesResult.data.items as ClientWorktree[]);
        }
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <LayoutShell breadcrumbs={[{ label: 'Worktrees' }]}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Loading worktrees...</div>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'Worktrees' }]}
      projectName={project?.name}
      projectPath={project?.path}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        {project ? (
          <WorktreeManagement
            worktrees={worktrees as Parameters<typeof WorktreeManagement>[0]['worktrees']}
            onRemove={async (worktreeId) => {
              // TODO: Add API endpoint for worktree removal
              setWorktrees((prev) => prev.filter((worktree) => worktree.id !== worktreeId));
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
