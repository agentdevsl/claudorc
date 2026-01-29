import { eq } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/react-db';
import { useEffect } from 'react';
import {
  refreshSandboxStatus,
  type SandboxStatus,
  sandboxStatusCollection,
  startSandboxStatusSync,
  stopSandboxStatusSync,
} from '@/lib/sandbox-status';

export type { SandboxStatus };

/**
 * Hook to get sandbox mode and container status for a project
 *
 * Uses TanStack DB collection with automatic sync from API.
 */
export function useSandboxStatus(projectId: string): {
  data: SandboxStatus | null;
  isLoading: boolean;
  refetch: () => void;
} {
  // Subscribe to collection changes using TanStack DB live query
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ sandboxStatus: sandboxStatusCollection })
        .where(({ sandboxStatus }) => eq(sandboxStatus.projectId, projectId)),
    [projectId]
  );

  // Start/stop sync when projectId changes
  useEffect(() => {
    if (!projectId) return;

    startSandboxStatusSync(projectId);

    return () => {
      stopSandboxStatusSync(projectId);
    };
  }, [projectId]);

  return {
    data: data?.[0] ?? null,
    isLoading: !sandboxStatusCollection.isReady(),
    refetch: () => refreshSandboxStatus(projectId),
  };
}
