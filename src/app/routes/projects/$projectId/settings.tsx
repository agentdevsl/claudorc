import { ArrowLeft } from '@phosphor-icons/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { ProjectSettings } from '@/app/components/features/project-settings';
import type { Project, ProjectConfig } from '@/db/schema/projects';
import { apiClient } from '@/lib/api/client';

export const Route = createFileRoute('/projects/$projectId/settings')({
  component: ProjectSettingsPage,
});

function ProjectSettingsPage(): React.JSX.Element {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Fetch project from API on mount
  useEffect(() => {
    const fetchProject = async () => {
      const result = await apiClient.projects.get(projectId);
      if (result.ok) {
        setProject(result.data as unknown as Project);
      }
      setIsLoading(false);
    };
    fetchProject();
  }, [projectId]);

  const handleSave = async (input: {
    name?: string;
    description?: string;
    maxConcurrentAgents?: number;
    config?: Partial<ProjectConfig>;
  }): Promise<void> => {
    setSaveStatus('saving');
    try {
      const result = await apiClient.projects.update(projectId, {
        name: input.name,
        description: input.description,
        maxConcurrentAgents: input.maxConcurrentAgents,
        config: input.config as Record<string, unknown>,
      });

      if (result.ok) {
        setProject(result.data as unknown as Project);
        setSaveStatus('saved');
        // Reset status after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        console.error('Failed to save project settings:', result.error);
      }
    } catch (error) {
      setSaveStatus('error');
      console.error('Error saving project settings:', error);
    }
  };

  const handleDelete = async (): Promise<void> => {
    const result = await apiClient.projects.delete(projectId);
    if (result.ok) {
      navigate({ to: '/projects' });
    } else {
      throw new Error(result.error.message);
    }
  };

  if (isLoading) {
    return (
      <LayoutShell
        breadcrumbs={[
          { label: 'Projects', to: '/projects' },
          { label: 'Loading...' },
          { label: 'Settings' },
        ]}
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Loading project settings...</div>
        </div>
      </LayoutShell>
    );
  }

  if (!project) {
    return (
      <LayoutShell breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Not Found' }]}>
        <div className="p-6 text-sm text-fg-muted">Project not found.</div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell
      projectId={project.id}
      projectName={project.name}
      projectPath={project.path}
      breadcrumbs={[
        { label: 'Projects', to: '/projects' },
        { label: project.name, to: `/projects/${project.id}` },
        { label: 'Settings' },
      ]}
    >
      <div className="p-6 max-w-4xl" data-testid="project-settings-page">
        <Link
          to="/projects/$projectId"
          params={{ projectId: project.id }}
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-fg">Project Settings</h1>
          <p className="text-sm text-fg-muted mt-1">
            Configure project behavior and agent defaults for {project.name}
          </p>
          {saveStatus === 'saved' && (
            <p className="text-sm text-success mt-2">Settings saved successfully</p>
          )}
          {saveStatus === 'error' && (
            <p className="text-sm text-danger mt-2">Failed to save settings</p>
          )}
        </div>

        <ProjectSettings project={project} onSave={handleSave} onDelete={handleDelete} />
      </div>
    </LayoutShell>
  );
}
