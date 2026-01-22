import { useNavigate, useParams } from '@tanstack/react-router';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type ProjectPickerItem,
  useRecentProjects,
} from '@/app/components/features/project-picker';
import { apiClient, type ProjectSummaryItem } from '@/lib/api/client';

// =============================================================================
// Types
// =============================================================================

interface ProjectContextValue {
  /** Currently selected project (with summary data) */
  currentProject: ProjectSummaryItem | null;
  /** Currently selected project ID from URL */
  currentProjectId: string | undefined;
  /** Whether the project picker modal is open */
  isPickerOpen: boolean;
  /** Open the project picker modal */
  openPicker: () => void;
  /** Close the project picker modal */
  closePicker: () => void;
  /** Whether the new project dialog is open */
  isNewProjectDialogOpen: boolean;
  /** Open the new project dialog */
  openNewProjectDialog: () => void;
  /** Close the new project dialog */
  closeNewProjectDialog: () => void;
  /** Select a project (navigates and updates recent) */
  selectProject: (project: ProjectPickerItem) => void;
  /** All projects for the picker */
  allProjects: ProjectPickerItem[];
  /** Recent projects for the picker */
  recentProjects: ProjectPickerItem[];
  /** Whether projects are loading */
  isLoading: boolean;
  /** Error if project fetch failed */
  error: Error | undefined;
  /** Refresh projects data */
  refreshProjects: () => Promise<void>;
}

// =============================================================================
// Context
// =============================================================================

const ProjectContext = createContext<ProjectContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface ProjectContextProviderProps {
  children: ReactNode;
}

export function ProjectContextProvider({
  children,
}: ProjectContextProviderProps): React.JSX.Element {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const projectId = (params as { projectId?: string }).projectId;

  // Modal states
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

  // Project data states
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Recent projects from localStorage
  const { recentProjectIds, addRecentProject } = useRecentProjects();

  // Fetch all projects
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await apiClient.projects.listWithSummaries({ limit: 100 });
      if (result.ok) {
        setProjectSummaries(result.data.items);
      } else {
        setError(new Error(result.error.message));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch projects'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch projects on mount
  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // Current project from summaries
  const currentProject = useMemo(() => {
    if (!projectId) return null;
    return projectSummaries.find((p) => p.project.id === projectId) ?? null;
  }, [projectId, projectSummaries]);

  // Convert summaries to picker items
  const allProjects = useMemo<ProjectPickerItem[]>(() => {
    const colors = ['blue', 'green', 'purple', 'orange', 'red'] as const;
    return projectSummaries.map((summary) => {
      const { project } = summary;
      // Derive icon color from project name hash for consistency
      const hash = project.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const color = colors[hash % colors.length] ?? 'blue';

      return {
        id: project.id,
        name: project.name,
        path: project.path,
        icon: {
          type: 'initials' as const,
          value: project.name.slice(0, 2).toUpperCase(),
          color,
        },
        isActive: project.id === projectId,
        stats: {
          activeAgents: summary.runningAgents.length,
          totalTasks: summary.taskCounts.total,
          backlogTasks: summary.taskCounts.backlog,
          inProgressTasks: summary.taskCounts.inProgress,
        },
        lastAccessedAt: project.updatedAt ?? new Date(),
      };
    });
  }, [projectSummaries, projectId]);

  // Recent projects filtered from all
  const recentProjects = useMemo<ProjectPickerItem[]>(() => {
    return recentProjectIds
      .map((id) => allProjects.find((p) => p.id === id))
      .filter((p): p is ProjectPickerItem => p !== undefined);
  }, [recentProjectIds, allProjects]);

  // Modal controls
  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);
  const openNewProjectDialog = useCallback(() => {
    setIsPickerOpen(false);
    setIsNewProjectDialogOpen(true);
  }, []);
  const closeNewProjectDialog = useCallback(() => setIsNewProjectDialogOpen(false), []);

  // Select project - navigate and track recent
  const selectProject = useCallback(
    (project: ProjectPickerItem) => {
      addRecentProject(project.id);
      navigate({ to: '/projects/$projectId', params: { projectId: project.id } });
      setIsPickerOpen(false);
    },
    [addRecentProject, navigate]
  );

  // Context value
  const value = useMemo<ProjectContextValue>(
    () => ({
      currentProject,
      currentProjectId: projectId,
      isPickerOpen,
      openPicker,
      closePicker,
      isNewProjectDialogOpen,
      openNewProjectDialog,
      closeNewProjectDialog,
      selectProject,
      allProjects,
      recentProjects,
      isLoading,
      error,
      refreshProjects: fetchProjects,
    }),
    [
      currentProject,
      projectId,
      isPickerOpen,
      openPicker,
      closePicker,
      isNewProjectDialogOpen,
      openNewProjectDialog,
      closeNewProjectDialog,
      selectProject,
      allProjects,
      recentProjects,
      isLoading,
      error,
      fetchProjects,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Access the project context for managing current project, picker, and navigation.
 * Must be used within a ProjectContextProvider.
 */
export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectContextProvider');
  }
  return context;
}
