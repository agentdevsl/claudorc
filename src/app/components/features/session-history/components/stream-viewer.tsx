import { useEffect, useRef } from 'react';
import { Skeleton, SkeletonText } from '@/app/components/ui/skeleton';
import type { StreamViewerProps } from '../types';
import { StreamEntry } from './stream-entry';

export function StreamViewer({
  entries,
  currentEntryId,
  isLoading = false,
}: StreamViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentEntryRef = useRef<HTMLDivElement>(null);

  // Scroll to current entry when it changes
  useEffect(() => {
    if (currentEntryId && currentEntryRef.current) {
      currentEntryRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentEntryId]);

  if (isLoading) {
    return (
      <div
        className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 md:p-4"
        data-testid="stream-viewer-loading"
      >
        {['skeleton-0', 'skeleton-1', 'skeleton-2'].map((id) => (
          <div key={id} className="flex gap-2.5 rounded bg-surface-subtle p-2">
            <Skeleton variant="text" width={40} height={14} />
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" width={70} height={12} />
              <SkeletonText lines={1} lineHeight={14} lastLineWidth={90} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-6"
        data-testid="stream-viewer-empty"
      >
        <p className="text-sm text-fg-muted">No events to display</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 md:p-4"
      data-testid="stream-viewer"
      role="log"
      aria-label="Session event stream"
    >
      {entries.map((entry) => {
        const isCurrent = entry.id === currentEntryId;
        return (
          <div key={entry.id} ref={isCurrent ? currentEntryRef : undefined}>
            <StreamEntry entry={entry} isCurrent={isCurrent} />
          </div>
        );
      })}
    </div>
  );
}
