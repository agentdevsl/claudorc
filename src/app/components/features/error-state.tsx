import { WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Try again or check your connection.',
  onRetry,
  className,
}: ErrorStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-6 text-center',
        className
      )}
    >
      <div className="rounded-full border border-border bg-surface-muted p-3">
        <WarningCircle className="h-6 w-6 text-danger" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <p className="text-xs text-fg-muted">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
