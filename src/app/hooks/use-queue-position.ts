import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '@/app/services/service-context';
import type { QueuePosition } from '@/services/agent.service';

export type QueuePositionState = {
  position: number | null;
  total: number;
  estimatedWait: string | null;
  estimatedWaitMs: number | null;
  isLoading: boolean;
  error: Error | null;
};

const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds

/**
 * Hook for real-time queue position updates.
 *
 * - Polls every 10 seconds when agent is queued
 * - Stops polling when agent starts or errors
 * - Returns null values when not queued
 */
export function useQueuePosition(agentId: string): QueuePositionState {
  const { agentService } = useServices();
  const [position, setPosition] = useState<QueuePosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [shouldPoll, setShouldPoll] = useState(true);

  const fetchQueuePosition = useCallback(async () => {
    try {
      const result = await agentService.getQueuePosition(agentId);
      if (!result.ok) {
        setError(new Error(result.error.message));
        setShouldPoll(false);
        return;
      }

      setPosition(result.value);
      setError(null);

      // Stop polling if agent is no longer queued
      if (result.value === null) {
        setShouldPoll(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch queue position'));
      setShouldPoll(false);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, agentService]);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    setShouldPoll(true);
    void fetchQueuePosition();
  }, [fetchQueuePosition]);

  // Polling
  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchQueuePosition();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [shouldPoll, fetchQueuePosition]);

  return useMemo(
    () => ({
      position: position?.position ?? null,
      total: position?.totalQueued ?? 0,
      estimatedWait: position?.estimatedWaitFormatted ?? null,
      estimatedWaitMs: position?.estimatedWaitMs ?? null,
      isLoading,
      error,
    }),
    [position, isLoading, error]
  );
}

/**
 * Hook for queue statistics across all projects or a specific project.
 */
export function useQueueStats(projectId?: string): {
  totalQueued: number;
  averageWaitMs: number;
  recentCompletions: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { agentService } = useServices();
  const [stats, setStats] = useState<{
    totalQueued: number;
    averageCompletionMs: number;
    recentCompletions: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await agentService.getQueueStats(projectId);
      if (result.ok) {
        setStats(result.value);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch queue stats'));
    } finally {
      setIsLoading(false);
    }
  }, [agentService, projectId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  // Poll stats every 30 seconds
  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchStats();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [fetchStats]);

  return useMemo(
    () => ({
      totalQueued: stats?.totalQueued ?? 0,
      averageWaitMs: stats?.averageCompletionMs ?? 0,
      recentCompletions: stats?.recentCompletions ?? 0,
      isLoading,
      error,
      refetch: fetchStats,
    }),
    [stats, isLoading, error, fetchStats]
  );
}

/**
 * Hook for all queued tasks with real-time updates.
 */
export function useQueuedTasks(projectId?: string): {
  tasks: QueuePosition[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { agentService } = useServices();
  const [tasks, setTasks] = useState<QueuePosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await agentService.getQueuedTasks(projectId);
      if (result.ok) {
        setTasks(result.value);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch queued tasks'));
    } finally {
      setIsLoading(false);
    }
  }, [agentService, projectId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  // Poll every 10 seconds for queue updates
  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchTasks();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [fetchTasks]);

  return useMemo(
    () => ({
      tasks,
      isLoading,
      error,
      refetch: fetchTasks,
    }),
    [tasks, isLoading, error, fetchTasks]
  );
}
