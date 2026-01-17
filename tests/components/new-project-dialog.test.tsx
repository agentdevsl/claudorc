import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewProjectDialog } from '@/app/components/features/new-project-dialog';
import type { Result } from '@/lib/utils/result';
import type { PathValidation } from '@/services/project.service';

const createValidPathResult = (
  overrides: Partial<PathValidation> = {}
): Result<PathValidation, unknown> => ({
  ok: true,
  value: {
    name: overrides.name ?? 'my-project',
    path: overrides.path ?? '/Users/name/workspace/my-project',
    hasClaudeConfig: overrides.hasClaudeConfig ?? false,
    defaultBranch: overrides.defaultBranch ?? 'main',
    remoteUrl: overrides.remoteUrl,
  },
});

const createInvalidPathResult = (): Result<PathValidation, unknown> => ({
  ok: false,
  error: { code: 'NOT_A_GIT_REPO', message: 'Path must point to a valid git repository.' },
});

describe('NewProjectDialog', () => {
  it('renders the dialog with path, name, and description fields', () => {
    render(
      <NewProjectDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} onValidatePath={vi.fn()} />
    );

    expect(screen.getByText('New project')).toBeInTheDocument();
    expect(
      screen.getByText('Connect a local repository to start using AgentPane.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Project path')).toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create project' })).toBeInTheDocument();
  });

  it('validates path on blur and shows check icon for valid path', async () => {
    const user = userEvent.setup();
    const onValidatePath = vi.fn().mockResolvedValue(createValidPathResult());

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/my-project');
    await user.tab();

    await waitFor(() => {
      expect(onValidatePath).toHaveBeenCalledWith('/Users/name/workspace/my-project');
    });

    await waitFor(() => {
      expect(screen.getByText('Default branch: main')).toBeInTheDocument();
    });
  });

  it('validates path on blur and shows warning icon for invalid path', async () => {
    const user = userEvent.setup();
    const onValidatePath = vi.fn().mockResolvedValue(createInvalidPathResult());

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/invalid/path');
    await user.tab();

    await waitFor(() => {
      expect(onValidatePath).toHaveBeenCalledWith('/invalid/path');
    });

    await waitFor(() => {
      expect(screen.getByText('Path must point to a valid git repository.')).toBeInTheDocument();
    });
  });

  it('shows validating message while validating', async () => {
    const user = userEvent.setup();
    let resolveValidation: (value: Result<PathValidation, unknown>) => void;
    const validationPromise = new Promise<Result<PathValidation, unknown>>((resolve) => {
      resolveValidation = resolve;
    });
    const onValidatePath = vi.fn().mockReturnValue(validationPromise);

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/repo');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Validating...')).toBeInTheDocument();
    });

    resolveValidation?.(createValidPathResult());

    await waitFor(() => {
      expect(screen.queryByText('Validating...')).not.toBeInTheDocument();
    });
  });

  it('disables submit when path is not valid', async () => {
    const user = userEvent.setup();
    const onValidatePath = vi.fn().mockResolvedValue(createInvalidPathResult());

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/invalid/path');
    await user.tab();

    await waitFor(() => {
      expect(onValidatePath).toHaveBeenCalled();
    });

    const nameInput = screen.getByLabelText('Project name');
    await user.type(nameInput, 'My Project');

    const submitButton = screen.getByRole('button', { name: 'Create project' });
    expect(submitButton).toBeDisabled();
  });

  it('disables submit when name is empty even if path is valid', async () => {
    const user = userEvent.setup();
    const onValidatePath = vi.fn().mockResolvedValue(createValidPathResult({ name: '' }));

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/repo');
    await user.tab();

    await waitFor(() => {
      expect(onValidatePath).toHaveBeenCalled();
    });

    const submitButton = screen.getByRole('button', { name: 'Create project' });
    expect(submitButton).toBeDisabled();
  });

  it('auto-fills name from path validation result', async () => {
    const user = userEvent.setup();
    const onValidatePath = vi
      .fn()
      .mockResolvedValue(createValidPathResult({ name: 'auto-filled-name' }));

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/auto-filled-name');
    await user.tab();

    await waitFor(() => {
      expect(onValidatePath).toHaveBeenCalled();
    });

    const nameInput = screen.getByLabelText('Project name');
    await waitFor(() => {
      expect(nameInput).toHaveValue('auto-filled-name');
    });
  });

  it('does not auto-fill name if user already entered a name', async () => {
    const user = userEvent.setup();
    const onValidatePath = vi
      .fn()
      .mockResolvedValue(createValidPathResult({ name: 'auto-filled-name' }));

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const nameInput = screen.getByLabelText('Project name');
    await user.type(nameInput, 'My Custom Name');

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/repo');
    await user.tab();

    await waitFor(() => {
      expect(onValidatePath).toHaveBeenCalled();
    });

    expect(nameInput).toHaveValue('My Custom Name');
  });

  it('calls onSubmit with project data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const onValidatePath = vi
      .fn()
      .mockResolvedValue(createValidPathResult({ name: 'my-project', defaultBranch: 'main' }));

    render(
      <NewProjectDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/my-project');
    await user.tab();

    await waitFor(() => {
      expect(onValidatePath).toHaveBeenCalled();
    });

    const descriptionInput = screen.getByLabelText('Description');
    await user.type(descriptionInput, 'A test project description');

    const submitButton = screen.getByRole('button', { name: 'Create project' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'my-project',
        path: '/Users/name/workspace/my-project',
        description: 'A test project description',
      });
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('calls onSubmit without description when description is empty', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onValidatePath = vi.fn().mockResolvedValue(createValidPathResult({ name: 'my-project' }));

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/my-project');
    await user.tab();

    await waitFor(() => {
      expect(onValidatePath).toHaveBeenCalled();
    });

    const submitButton = screen.getByRole('button', { name: 'Create project' });
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'my-project',
        path: '/Users/name/workspace/my-project',
        description: undefined,
      });
    });
  });

  it('closes dialog when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <NewProjectDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
        onValidatePath={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('resets form state when dialog closes', async () => {
    const onValidatePath = vi.fn().mockResolvedValue(createValidPathResult());
    const { rerender } = render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const user = userEvent.setup();
    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/repo');

    rerender(
      <NewProjectDialog
        open={false}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    rerender(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const newPathInput = screen.getByLabelText('Project path');
    expect(newPathInput).toHaveValue('');
  });

  it('does not validate empty path on blur', async () => {
    const user = userEvent.setup();
    const onValidatePath = vi.fn();

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.click(pathInput);
    await user.tab();

    expect(onValidatePath).not.toHaveBeenCalled();
  });

  it('clears path status when user types in path field', async () => {
    const user = userEvent.setup();
    const onValidatePath = vi.fn().mockResolvedValue(createValidPathResult());

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        onValidatePath={onValidatePath}
      />
    );

    const pathInput = screen.getByLabelText('Project path');
    await user.type(pathInput, '/Users/name/workspace/repo');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Default branch: main')).toBeInTheDocument();
    });

    await user.type(pathInput, '/new');

    await waitFor(() => {
      expect(screen.queryByText('Default branch: main')).not.toBeInTheDocument();
    });
  });
});
