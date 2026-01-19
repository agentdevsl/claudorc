import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSettings } from '@/app/components/features/project-settings';
import type { Project, ProjectConfig } from '@/db/schema/projects';

describe('ProjectSettings', () => {
  it('saves updated settings', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const project: Project = {
      id: 'project-1',
      name: 'AgentPane',
      path: '/repo',
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        worktreeRoot: '.worktrees',
        defaultBranch: 'main',
        allowedTools: ['Read'],
        maxTurns: 50,
        model: 'claude-sonnet-4',
      } satisfies ProjectConfig,
      githubOwner: 'agentpane',
      githubRepo: 'agentpane',
      maxConcurrentAgents: 3,
    };

    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ProjectSettings project={project} onSave={onSave} onDelete={onDelete} />);

    fireEvent.change(screen.getByLabelText('Default branch'), {
      target: { value: 'develop' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(onSave).toHaveBeenCalled();
    const [payload] = onSave.mock.calls[0] ?? [];
    expect(payload).toEqual(
      expect.objectContaining({
        maxConcurrentAgents: 3,
        config: expect.objectContaining({
          defaultBranch: 'develop',
        }),
      })
    );
  });
});
