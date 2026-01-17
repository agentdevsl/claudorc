import { CheckCircle, FolderSimple, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { TextInput } from '@/app/components/ui/text-input';
import { Textarea } from '@/app/components/ui/textarea';
import type { Result } from '@/lib/utils/result';
import type { PathValidation } from '@/services/project.service';

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; path: string; description?: string }) => Promise<void>;
  onValidatePath: (path: string) => Promise<Result<PathValidation, unknown>>;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onSubmit,
  onValidatePath,
}: NewProjectDialogProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  const [pathStatus, setPathStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [pathMessage, setPathMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setPath('');
      setDescription('');
      setPathStatus('idle');
      setPathMessage('');
      setIsValidating(false);
    }
  }, [open]);

  const validatePath = async (): Promise<void> => {
    if (!path.trim()) {
      setPathStatus('idle');
      setPathMessage('');
      return;
    }

    setIsValidating(true);
    const result = await onValidatePath(path.trim());
    setIsValidating(false);

    if (result.ok) {
      setPathStatus('valid');
      setPathMessage(
        result.value.defaultBranch ? `Default branch: ${result.value.defaultBranch}` : ''
      );
      if (!name.trim()) {
        setName(result.value.name ?? '');
      }
    } else {
      setPathStatus('invalid');
      setPathMessage('Path must point to a valid git repository.');
    }
  };

  const handleSubmit = async (): Promise<void> => {
    await onSubmit({
      name: name.trim(),
      path: path.trim(),
      description: description.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Connect a local repository to start using AgentPane.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              className="text-xs font-medium uppercase tracking-wide text-fg-muted"
              htmlFor="project-path"
            >
              Project path
            </label>
            <div className="relative">
              <TextInput
                id="project-path"
                value={path}
                placeholder="/Users/name/workspace/repo"
                onChange={(event) => {
                  setPath(event.target.value);
                  setPathStatus('idle');
                  setPathMessage('');
                }}
                onBlur={() => void validatePath()}
              />
              {pathStatus !== 'idle' && (
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  {pathStatus === 'valid' ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : (
                    <WarningCircle className="h-4 w-4 text-danger" />
                  )}
                </div>
              )}
            </div>
            {isValidating && <p className="text-xs text-fg-muted">Validating...</p>}
            {!isValidating && pathMessage && <p className="text-xs text-fg-muted">{pathMessage}</p>}
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-medium uppercase tracking-wide text-fg-muted"
              htmlFor="project-name"
            >
              Project name
            </label>
            <TextInput
              id="project-name"
              value={name}
              placeholder="AgentPane"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-medium uppercase tracking-wide text-fg-muted"
              htmlFor="project-description"
            >
              Description
            </label>
            <Textarea
              id="project-description"
              value={description}
              placeholder="Short summary or goal."
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || pathStatus !== 'valid'}
          >
            <FolderSimple className="h-4 w-4" />
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
