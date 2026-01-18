import { Eye, Pencil } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/lib/utils/cn';

interface TaskDescriptionProps {
  description: string;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (description: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function TaskDescription({
  description,
  isEditing,
  onEdit,
  onChange,
  onSave,
  onCancel,
}: TaskDescriptionProps): React.JSX.Element {
  const [previewMode, setPreviewMode] = useState(false);
  const [localValue, setLocalValue] = useState(description);

  // Sync local value when description changes externally
  if (!isEditing && localValue !== description) {
    setLocalValue(description);
  }

  const handleChange = (value: string) => {
    setLocalValue(value);
    onChange(value);
  };

  const handleSave = () => {
    onSave();
    setPreviewMode(false);
  };

  const handleCancel = () => {
    setLocalValue(description);
    onCancel();
    setPreviewMode(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wide text-fg-muted">
          Description
        </label>
        {!isEditing && (
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-6 px-2">
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                !previewMode ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
              )}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                previewMode ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
              )}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>

          {/* Editor or preview */}
          {previewMode ? (
            <div className="min-h-[100px] rounded-md border border-border bg-surface-subtle p-3 text-sm text-fg prose prose-sm prose-invert max-w-none">
              {localValue ? (
                <pre className="whitespace-pre-wrap font-sans">{localValue}</pre>
              ) : (
                <p className="italic text-fg-subtle">No description provided.</p>
              )}
            </div>
          ) : (
            <Textarea
              value={localValue}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Add a description... (Markdown supported)"
              rows={6}
              className="min-h-[120px] resize-y"
              autoFocus
            />
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'min-h-[60px] rounded-md border border-transparent p-3 text-sm',
            'hover:border-border hover:bg-surface-subtle cursor-pointer transition-colors',
            description ? 'text-fg' : 'text-fg-subtle italic'
          )}
          onClick={onEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onEdit();
            }
          }}
        >
          {description ? (
            <pre className="whitespace-pre-wrap font-sans">{description}</pre>
          ) : (
            'Add a description...'
          )}
        </div>
      )}
    </div>
  );
}
