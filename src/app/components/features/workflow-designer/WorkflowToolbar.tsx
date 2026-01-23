import {
  ArrowClockwise,
  ArrowCounterClockwise,
  FloppyDisk,
  Sparkle,
  Trash,
} from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { type ToolbarVariants, toolbarGroupVariants, toolbarVariants } from './styles';

export interface WorkflowToolbarProps {
  /** Callback when "Generate with AI" is clicked */
  onGenerateAI: () => void;
  /** Callback when "Save" is clicked */
  onSave: () => void;
  /** Callback when "Clear" is clicked */
  onClear: () => void;
  /** Callback when "Undo" is clicked */
  onUndo?: () => void;
  /** Callback when "Redo" is clicked */
  onRedo?: () => void;
  /** Whether AI generation is in progress */
  isGenerating?: boolean;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Whether undo is available */
  canUndo?: boolean;
  /** Whether redo is available */
  canRedo?: boolean;
  /** Toolbar position variant */
  position?: ToolbarVariants['position'];
  /** Toolbar size variant */
  size?: ToolbarVariants['size'];
  /** Optional className for the container */
  className?: string;
}

/**
 * WorkflowToolbar component provides actions for the workflow designer.
 * Includes AI generation, save, clear, and undo/redo controls.
 */
export function WorkflowToolbar({
  onGenerateAI,
  onSave,
  onClear,
  onUndo,
  onRedo,
  isGenerating = false,
  isSaving = false,
  canUndo = false,
  canRedo = false,
  position = 'top',
  size = 'default',
  className,
}: WorkflowToolbarProps): React.JSX.Element {
  return (
    <div
      className={cn(toolbarVariants({ position, size }), className)}
      role="toolbar"
      aria-label="Workflow actions"
      data-testid="workflow-toolbar"
    >
      {/* Primary action: Generate with AI */}
      <Button
        onClick={onGenerateAI}
        disabled={isGenerating}
        className="gap-2"
        data-testid="workflow-generate-ai"
      >
        <Sparkle
          className={cn('h-4 w-4', isGenerating && 'animate-spin')}
          weight={isGenerating ? 'regular' : 'fill'}
        />
        {isGenerating ? 'Generating...' : 'Generate with AI'}
      </Button>

      {/* Separator */}
      <div className={toolbarGroupVariants({ separated: true })}>
        {/* Save button */}
        <Button
          variant="outline"
          size={size === 'compact' ? 'sm' : 'default'}
          onClick={onSave}
          disabled={isSaving}
          className="gap-2"
          data-testid="workflow-save"
        >
          <FloppyDisk className={cn('h-4 w-4', isSaving && 'animate-pulse')} weight="regular" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>

        {/* Clear button */}
        <Button
          variant="outline"
          size={size === 'compact' ? 'sm' : 'default'}
          onClick={onClear}
          disabled={isGenerating || isSaving}
          className="gap-2"
          data-testid="workflow-clear"
        >
          <Trash className="h-4 w-4" weight="regular" />
          Clear
        </Button>
      </div>

      {/* Undo/Redo group */}
      <div className={toolbarGroupVariants({ separated: true })}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onUndo}
          disabled={!canUndo || isGenerating || isSaving}
          aria-label="Undo"
          data-testid="workflow-undo"
        >
          <ArrowCounterClockwise className="h-4 w-4" weight="regular" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onRedo}
          disabled={!canRedo || isGenerating || isSaving}
          aria-label="Redo"
          data-testid="workflow-redo"
        >
          <ArrowClockwise className="h-4 w-4" weight="regular" />
        </Button>
      </div>
    </div>
  );
}
