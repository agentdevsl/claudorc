import { Button } from '@/app/components/ui/button';
import { STATUS_ACTIONS } from '../constants';
import type { WorktreeActionsProps } from '../types';

export function WorktreeActions({
  worktree,
  onOpen,
  onMerge,
  onCommit,
  onRemove,
  onResolve,
  onAbort,
  onRetry,
  onCancel,
  isLoading = false,
  compact = false,
}: WorktreeActionsProps): React.JSX.Element {
  const actions = STATUS_ACTIONS[worktree.displayStatus];

  if (actions.length === 0) {
    return <span className="text-xs text-fg-muted italic">Processing...</span>;
  }

  const handleAction = (action: string) => {
    switch (action) {
      case 'open':
        onOpen?.();
        break;
      case 'merge':
        onMerge?.();
        break;
      case 'commit':
        onCommit?.();
        break;
      case 'remove':
        onRemove?.();
        break;
      case 'resolve':
        onResolve?.();
        break;
      case 'abort':
        onAbort?.();
        break;
      case 'retry':
        onRetry?.();
        break;
      case 'cancel':
        onCancel?.();
        break;
      case 'force-remove':
        onRemove?.();
        break;
    }
  };

  return (
    <div className="flex items-center gap-1">
      {actions.map((action) => (
        <Button
          key={action.key}
          size="sm"
          variant={action.variant}
          onClick={() => handleAction(action.action)}
          disabled={isLoading}
          className={compact ? 'h-6 px-2 text-[10px]' : undefined}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
