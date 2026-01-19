/**
 * Browser-side API client for fetching data from server endpoints.
 * Used by route loaders and components to access data via REST API.
 */
import type { GitHubOrg, GitHubRepo, TokenInfo } from '@/services/github-token.service';
import type { ApiResponse } from './response';

// API server base URL (separate Bun server for database access)
const API_BASE = 'http://localhost:3001';

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

// Fetch from API server (port 3001)
async function apiServerFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
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

export type ProjectSummaryItem = {
  project: ProjectListItem;
  taskCounts: {
    backlog: number;
    queued: number;
    inProgress: number;
    waitingApproval: number;
    verified: number;
    total: number;
  };
  runningAgents: Array<{
    id: string;
    name: string;
    currentTaskId: string | null;
    currentTaskTitle?: string;
  }>;
  status: 'running' | 'idle' | 'needs-approval';
  lastActivityAt: string | null;
};

export type ProjectSummaryResponse = {
  items: ProjectSummaryItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
};

// Template types
export type CreateTemplateInput = {
  name: string;
  description?: string;
  scope: 'org' | 'project';
  githubUrl: string;
  branch?: string;
  configPath?: string;
  /** @deprecated Use projectIds instead */
  projectId?: string;
  /** Project IDs to associate with this template (for project-scoped templates) */
  projectIds?: string[];
};

export type UpdateTemplateInput = {
  name?: string;
  description?: string;
  branch?: string;
  configPath?: string;
  /** Update the project associations (replaces existing) */
  projectIds?: string[];
};

// Sandbox Config types
export type SandboxType = 'docker' | 'devcontainer';

export type SandboxConfigItem = {
  id: string;
  name: string;
  description?: string | null;
  type: SandboxType;
  isDefault: boolean;
  baseImage: string;
  memoryMb: number;
  cpuCores: number;
  maxProcesses: number;
  timeoutMinutes: number;
  /** Volume mount path from local host for docker sandboxes */
  volumeMountPath?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSandboxConfigInput = {
  name: string;
  description?: string;
  type?: SandboxType;
  isDefault?: boolean;
  baseImage?: string;
  memoryMb?: number;
  cpuCores?: number;
  maxProcesses?: number;
  timeoutMinutes?: number;
  /** Volume mount path from local host for docker sandboxes */
  volumeMountPath?: string;
};

export type UpdateSandboxConfigInput = {
  name?: string;
  description?: string;
  type?: SandboxType;
  isDefault?: boolean;
  baseImage?: string;
  memoryMb?: number;
  cpuCores?: number;
  maxProcesses?: number;
  timeoutMinutes?: number;
  /** Volume mount path from local host for docker sandboxes */
  volumeMountPath?: string;
};

// API client methods
export const apiClient = {
  projects: {
    list: (params?: { limit?: number }) =>
      apiServerFetch<ProjectListResponse>(
        `/api/projects${params?.limit ? `?limit=${params.limit}` : ''}`
      ),

    listWithSummaries: (params?: { limit?: number }) =>
      apiServerFetch<ProjectSummaryResponse>(
        `/api/projects/summaries${params?.limit ? `?limit=${params.limit}` : ''}`
      ),

    get: (id: string) => apiServerFetch<ProjectListItem>(`/api/projects/${id}`),

    create: (data: {
      name: string;
      path: string;
      description?: string;
      sandboxConfigId?: string;
    }) => apiServerFetch<ProjectListItem>('/api/projects', { method: 'POST', body: data }),

    update: (
      id: string,
      data: {
        name?: string;
        description?: string;
        maxConcurrentAgents?: number;
        config?: Record<string, unknown>;
      }
    ) =>
      apiServerFetch<ProjectListItem>(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: data,
      }),

    delete: (id: string) =>
      apiServerFetch<{ deleted: boolean }>(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
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
      return apiServerFetch<{ items: unknown[]; totalCount: number }>(
        `/api/tasks?${searchParams.toString()}`
      );
    },

    get: (id: string) => apiServerFetch<unknown>(`/api/tasks/${id}`),
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

  filesystem: {
    discoverRepos: () =>
      apiServerFetch<{ repos: { name: string; path: string; lastModified: string }[] }>(
        '/api/filesystem/discover-repos'
      ),
  },

  github: {
    listOrgs: () => apiServerFetch<{ orgs: GitHubOrg[] }>('/api/github/orgs'),

    listReposForOwner: (owner: string) =>
      apiServerFetch<{ repos: GitHubRepo[] }>(`/api/github/repos/${encodeURIComponent(owner)}`),

    listRepos: () => apiServerFetch<{ repos: GitHubRepo[] }>('/api/github/repos'),

    clone: (url: string, destination: string) =>
      apiServerFetch<{ path: string }>('/api/github/clone', {
        method: 'POST',
        body: { url, destination },
      }),

    getTokenInfo: () => apiServerFetch<{ tokenInfo: TokenInfo | null }>('/api/github/token'),

    saveToken: (token: string) =>
      apiServerFetch<{ tokenInfo: TokenInfo }>('/api/github/token', {
        method: 'POST',
        body: { token },
      }),

    deleteToken: () => apiServerFetch<null>('/api/github/token', { method: 'DELETE' }),

    revalidateToken: () =>
      apiServerFetch<{ isValid: boolean }>('/api/github/revalidate', { method: 'POST' }),

    createFromTemplate: (params: {
      templateOwner: string;
      templateRepo: string;
      name: string;
      owner?: string;
      description?: string;
      isPrivate?: boolean;
      clonePath: string;
    }) =>
      apiServerFetch<{ path: string; repoFullName: string; cloneUrl: string }>(
        '/api/github/create-from-template',
        { method: 'POST', body: params }
      ),
  },

  system: {
    health: () =>
      apiServerFetch<{
        status: 'healthy' | 'degraded';
        timestamp: string;
        uptime: number;
        checks: {
          database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
          github: { status: 'ok' | 'error' | 'not_configured'; login?: string | null };
        };
        responseTimeMs: number;
      }>('/api/health'),
  },

  apiKeys: {
    get: (service: string) =>
      apiServerFetch<{
        keyInfo: {
          id: string;
          service: string;
          maskedKey: string;
          isValid: boolean;
          lastValidatedAt: string | null;
          createdAt: string;
        } | null;
      }>(`/api/keys/${encodeURIComponent(service)}`),

    save: (service: string, key: string) =>
      apiServerFetch<{
        keyInfo: {
          id: string;
          service: string;
          maskedKey: string;
          isValid: boolean;
          lastValidatedAt: string | null;
          createdAt: string;
        };
      }>(`/api/keys/${encodeURIComponent(service)}`, { method: 'POST', body: { key } }),

    delete: (service: string) =>
      apiServerFetch<null>(`/api/keys/${encodeURIComponent(service)}`, { method: 'DELETE' }),
  },

  templates: {
    list: (options?: { scope?: 'org' | 'project'; projectId?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (options?.scope) searchParams.set('scope', options.scope);
      if (options?.projectId) searchParams.set('projectId', options.projectId);
      if (options?.limit) searchParams.set('limit', String(options.limit));
      const query = searchParams.toString();
      return apiServerFetch<{ items: unknown[]; totalCount: number }>(
        `/api/templates${query ? `?${query}` : ''}`
      );
    },

    create: (input: CreateTemplateInput) =>
      apiServerFetch<unknown>('/api/templates', { method: 'POST', body: input }),

    getById: (id: string) => apiServerFetch<unknown>(`/api/templates/${encodeURIComponent(id)}`),

    update: (id: string, input: UpdateTemplateInput) =>
      apiServerFetch<unknown>(`/api/templates/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: input,
      }),

    delete: (id: string) =>
      apiServerFetch<null>(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),

    sync: (id: string) =>
      apiServerFetch<unknown>(`/api/templates/${encodeURIComponent(id)}/sync`, { method: 'POST' }),
  },

  sandboxConfigs: {
    list: (options?: { limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (options?.limit) searchParams.set('limit', String(options.limit));
      if (options?.offset) searchParams.set('offset', String(options.offset));
      const query = searchParams.toString();
      return apiServerFetch<{ items: SandboxConfigItem[]; totalCount: number }>(
        `/api/sandbox-configs${query ? `?${query}` : ''}`
      );
    },

    create: (input: CreateSandboxConfigInput) =>
      apiServerFetch<SandboxConfigItem>('/api/sandbox-configs', { method: 'POST', body: input }),

    getById: (id: string) =>
      apiServerFetch<SandboxConfigItem>(`/api/sandbox-configs/${encodeURIComponent(id)}`),

    update: (id: string, input: UpdateSandboxConfigInput) =>
      apiServerFetch<SandboxConfigItem>(`/api/sandbox-configs/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: input,
      }),

    delete: (id: string) =>
      apiServerFetch<null>(`/api/sandbox-configs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
};
