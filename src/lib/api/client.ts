/**
 * Browser-side API client for fetching data from server endpoints.
 * Used by route loaders and components to access data via REST API.
 */
import type { ApiResponse } from './response';

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    const json = await response.json();
    return json as ApiResponse<T>;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
}

// Project types
export type ProjectListItem = {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type ProjectListResponse = {
  items: ProjectListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
};

// API client methods
export const apiClient = {
  projects: {
    list: (params?: { limit?: number }) =>
      apiFetch<ProjectListResponse>(
        `/api/projects${params?.limit ? `?limit=${params.limit}` : ''}`
      ),

    get: (id: string) => apiFetch<ProjectListItem>(`/api/projects/${id}`),

    create: (data: { name: string; path: string; description?: string }) =>
      apiFetch<ProjectListItem>('/api/projects', { method: 'POST', body: data }),
  },

  agents: {
    list: (params?: { projectId?: string; status?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.projectId) searchParams.set('projectId', params.projectId);
      if (params?.status) searchParams.set('status', params.status);
      const query = searchParams.toString();
      return apiFetch<{ items: unknown[]; totalCount: number }>(
        `/api/agents${query ? `?${query}` : ''}`
      );
    },

    getRunningCount: () =>
      apiFetch<{ items: unknown[]; totalCount: number }>('/api/agents?status=running'),
  },

  tasks: {
    list: (projectId: string, params?: { status?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('projectId', projectId);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      return apiFetch<{ items: unknown[]; totalCount: number }>(
        `/api/tasks?${searchParams.toString()}`
      );
    },

    get: (id: string) => apiFetch<unknown>(`/api/tasks/${id}`),
  },

  sessions: {
    list: (params?: { projectId?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.projectId) searchParams.set('projectId', params.projectId);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      const query = searchParams.toString();
      return apiFetch<{ items: unknown[]; totalCount: number }>(
        `/api/sessions${query ? `?${query}` : ''}`
      );
    },

    get: (id: string) => apiFetch<unknown>(`/api/sessions/${id}`),
  },

  worktrees: {
    list: (params?: { projectId?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.projectId) searchParams.set('projectId', params.projectId);
      const query = searchParams.toString();
      return apiFetch<{ items: unknown[]; totalCount: number }>(
        `/api/worktrees${query ? `?${query}` : ''}`
      );
    },
  },
};
