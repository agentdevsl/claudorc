import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectPicker } from '@/app/components/features/project-picker';
import type { Project } from '@/db/schema/projects';

const createProject = (overrides: Partial<Project>): Project => ({
  id: overrides.id ?? 'project-1',
  name: overrides.name ?? 'Test Project',
  path: overrides.path ?? '/path/to/project',
  description: overrides.description ?? null,
  config: overrides.config ?? null,
  maxConcurrentAgents: overrides.maxConcurrentAgents ?? 3,
  githubOwner: overrides.githubOwner ?? null,
  githubRepo: overrides.githubRepo ?? null,
  githubInstallationId: overrides.githubInstallationId ?? null,
  configPath: overrides.configPath ?? '.claude',
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

describe('ProjectPicker', () => {
  it('renders selected project name', () => {
    const selectedProject = createProject({ name: 'My Project' });

    render(
      <ProjectPicker
        projects={[selectedProject]}
        selectedProject={selectedProject}
        onSelect={vi.fn()}
        onNewProject={vi.fn()}
      />
    );

    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('renders placeholder when no project selected', () => {
    render(
      <ProjectPicker
        projects={[]}
        selectedProject={null}
        onSelect={vi.fn()}
        onNewProject={vi.fn()}
      />
    );

    expect(screen.getByText('Select project')).toBeInTheDocument();
  });

  it('shows projects in dropdown', async () => {
    const user = userEvent.setup();
    const projects = [
      createProject({ id: 'p1', name: 'Project Alpha', path: '/path/alpha' }),
      createProject({ id: 'p2', name: 'Project Beta', path: '/path/beta' }),
    ];

    render(
      <ProjectPicker
        projects={projects}
        selectedProject={null}
        onSelect={vi.fn()}
        onNewProject={vi.fn()}
      />
    );

    // Open dropdown using userEvent for proper pointer simulation
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('calls onSelect when project clicked', async () => {
    const user = userEvent.setup();
    const projects = [createProject({ id: 'p1', name: 'Project Alpha', path: '/path/alpha' })];
    const onSelect = vi.fn();

    render(
      <ProjectPicker
        projects={projects}
        selectedProject={null}
        onSelect={onSelect}
        onNewProject={vi.fn()}
      />
    );

    // Open dropdown
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    // Click project
    await user.click(screen.getByText('Project Alpha'));

    expect(onSelect).toHaveBeenCalledWith(projects[0]);
  });

  it('calls onNewProject when "New Project" clicked', async () => {
    const user = userEvent.setup();
    const onNewProject = vi.fn();

    render(
      <ProjectPicker
        projects={[]}
        selectedProject={null}
        onSelect={vi.fn()}
        onNewProject={onNewProject}
      />
    );

    // Open dropdown
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    // Click New Project
    await user.click(screen.getByText('New Project'));

    expect(onNewProject).toHaveBeenCalled();
  });

  it('shows check mark next to selected project in dropdown', async () => {
    const user = userEvent.setup();
    const selectedProject = createProject({
      id: 'p1',
      name: 'Selected One',
      path: '/path/selected',
    });
    const otherProject = createProject({ id: 'p2', name: 'Other One', path: '/path/other' });

    render(
      <ProjectPicker
        projects={[selectedProject, otherProject]}
        selectedProject={selectedProject}
        onSelect={vi.fn()}
        onNewProject={vi.fn()}
      />
    );

    // Open dropdown
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      // "Selected One" appears in both the trigger button and the dropdown menu
      expect(screen.getAllByText('Selected One')).toHaveLength(2);
    });

    expect(screen.getByText('Other One')).toBeInTheDocument();
  });
});
