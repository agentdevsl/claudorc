/**
 * Browser-side API client for fetching data from server endpoints.
 * Used by route loaders and components to access data via REST API.
 */

import type { PlanSession } from '@/lib/plan-mode/types';
import type { GitHubOrg, GitHubRepo, TokenInfo } from '@/services/github-token.service';
import type { ApiResponse } from './response';
import { API_ERROR_CODES } from './types';

// API server base URL (separate Bun server for database access)
const API_BASE = 'http://localhost:3001';

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
};

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    // Network-level errors (connection refused, DNS failure, etc.)
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        error: { code: API_ERROR_CODES.REQUEST_ABORTED, message: 'Request was aborted' },
      };
    }
    // TypeError is thrown by fetch for network failures (CORS, connection refused, DNS)
    if (error instanceof TypeError) {
      return {
        ok: false,
        error: {
          code: API_ERROR_CODES.NETWORK_ERROR,
          message: error.message || 'Network request failed',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: API_ERROR_CODES.FETCH_ERROR,
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }

  try {
    const json = await response.json();
    return json as ApiResponse<T>;
  } catch (parseError) {
    // JSON parsing failed - include original error for debugging
    return {
      ok: false,
      error: {
        code: API_ERROR_CODES.PARSE_ERROR,
        message: `Invalid JSON response (HTTP ${response.status}): ${parseError instanceof Error ? parseError.message : 'unknown parse error'}`,
      },
    };
  }
}

// Fetch from API server (port 3001)
async function apiServerFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    // Network-level errors (connection refused, DNS failure, etc.)
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        error: { code: API_ERROR_CODES.REQUEST_ABORTED, message: 'Request was aborted' },
      };
    }
    // TypeError is thrown by fetch for network failures (CORS, connection refused, DNS)
    if (error instanceof TypeError) {
      return {
        ok: false,
        error: {
          code: API_ERROR_CODES.NETWORK_ERROR,
          message: error.message || 'Network request failed',
        },
      };
    }
    return {
      ok: false,
      error: {
        code: API_ERROR_CODES.FETCH_ERROR,
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }

  try {
    const json = await response.json();
    return json as ApiResponse<T>;
  } catch (parseError) {
    // JSON parsing failed - include original error for debugging
    return {
      ok: false,
      error: {
        code: API_ERROR_CODES.PARSE_ERROR,
        message: `Invalid JSON response (HTTP ${response.status}): ${parseError instanceof Error ? parseError.message : 'unknown parse error'}`,
      },
    };
  }
}

// Re-export shared types for convenience
export type { TaskCreationStatus, TaskSuggestion } from './types';
export { API_ERROR_CODES } from './types';

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

    /**
     * Create a new task directly (manual mode)
     */
    create: (data: {
      projectId: string;
      title: string;
      description?: string;
      labels?: string[];
      priority?: 'high' | 'medium' | 'low';
    }) =>
      apiServerFetch<{
        taskId: string;
        title: string;
        projectId: string;
      }>('/api/tasks', { method: 'POST', body: data }),
  },

  sessions: {
    list: (params?: {
      projectId?: string;
      limit?: number;
      offset?: number;
      status?: string[];
      agentId?: string;
      taskId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.projectId) searchParams.set('projectId', params.projectId);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      if (params?.status?.length) searchParams.set('status', params.status.join(','));
      if (params?.agentId) searchParams.set('agentId', params.agentId);
      if (params?.taskId) searchParams.set('taskId', params.taskId);
      if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
      if (params?.search) searchParams.set('search', params.search);
      const query = searchParams.toString();
      // Use apiServerFetch to hit the Bun API server directly
      return apiServerFetch<{ data: unknown[]; pagination: unknown }>(
        `/api/sessions${query ? `?${query}` : ''}`
      );
    },

    get: (id: string) => apiServerFetch<unknown>(`/api/sessions/${id}`),

    getEvents: (id: string, params?: { limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      const query = searchParams.toString();
      // Use apiServerFetch to hit the Bun API server directly
      return apiServerFetch<{
        data: Array<{ id: string; type: string; timestamp: number; data: unknown }>;
        pagination: { total: number; limit: number; offset: number };
      }>(`/api/sessions/${encodeURIComponent(id)}/events${query ? `?${query}` : ''}`);
    },

    getSummary: (id: string) =>
      // Use apiServerFetch to hit the Bun API server directly
      apiServerFetch<{
        sessionId: string;
        durationMs: number | null;
        turnsCount: number;
        tokensUsed: number;
        filesModified: number;
        linesAdded: number;
        linesRemoved: number;
        finalStatus: 'success' | 'failed' | 'cancelled' | null;
        session: { id: string; status: string; title: string | null };
      }>(`/api/sessions/${encodeURIComponent(id)}/summary`),

    export: (id: string, format: 'json' | 'markdown' | 'csv') =>
      apiFetch<{
        content: string;
        contentType: string;
        filename: string;
      }>(`/api/sessions/${encodeURIComponent(id)}/export`, {
        method: 'POST',
        body: { format },
      }),
  },

  worktrees: {
    list: (params?: { projectId?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.projectId) searchParams.set('projectId', params.projectId);
      const query = searchParams.toString();
      return apiServerFetch<{
        items: Array<{
          id: string;
          branch: string;
          path: string;
          baseBranch: string;
          status: string;
          taskId: string | null;
          taskTitle?: string;
          agentId?: string;
          agentName?: string;
          createdAt: string;
          updatedAt: string | null;
          hasUncommittedChanges?: boolean;
          aheadBehind?: { ahead: number; behind: number };
        }>;
        totalCount: number;
      }>(`/api/worktrees${query ? `?${query}` : ''}`);
    },

    get: (id: string) =>
      apiServerFetch<{
        id: string;
        branch: string;
        path: string;
        baseBranch: string;
        status: string;
        taskId: string | null;
        createdAt: string;
        updatedAt: string | null;
        hasUncommittedChanges: boolean;
        aheadBehind?: { ahead: number; behind: number };
      }>(`/api/worktrees/${encodeURIComponent(id)}`),

    create: (data: { projectId: string; taskId: string; baseBranch?: string }) =>
      apiServerFetch<{
        id: string;
        branch: string;
        path: string;
        status: string;
      }>('/api/worktrees', { method: 'POST', body: data }),

    remove: (id: string, force?: boolean) =>
      apiServerFetch<{ success: boolean }>(
        `/api/worktrees/${encodeURIComponent(id)}${force ? '?force=true' : ''}`,
        { method: 'DELETE' }
      ),

    commit: (id: string, message: string) =>
      apiServerFetch<{ sha: string }>(`/api/worktrees/${encodeURIComponent(id)}/commit`, {
        method: 'POST',
        body: { message },
      }),

    merge: (
      id: string,
      options: {
        targetBranch?: string;
        deleteAfterMerge?: boolean;
        squash?: boolean;
        commitMessage?: string;
      }
    ) =>
      apiServerFetch<{
        merged: boolean;
        conflicts?: string[];
        cleanupFailed?: boolean;
        cleanupError?: string;
      }>(`/api/worktrees/${encodeURIComponent(id)}/merge`, { method: 'POST', body: options }),

    getDiff: (id: string) =>
      apiServerFetch<{
        files: Array<{
          path: string;
          status: 'added' | 'modified' | 'deleted' | 'renamed';
          additions: number;
          deletions: number;
        }>;
        stats: { filesChanged: number; additions: number; deletions: number };
      }>(`/api/worktrees/${encodeURIComponent(id)}/diff`),

    prune: (projectId: string) =>
      apiServerFetch<{
        pruned: number;
        failed: Array<{ worktreeId: string; branch: string; error: string }>;
      }>(`/api/worktrees/prune`, { method: 'POST', body: { projectId } }),
  },

  git: {
    status: (projectId: string) =>
      apiServerFetch<{
        repoName: string;
        currentBranch: string;
        status: 'clean' | 'dirty';
        staged: number;
        unstaged: number;
        untracked: number;
        ahead: number;
        behind: number;
      }>(`/api/git/status?projectId=${encodeURIComponent(projectId)}`),

    branches: (projectId: string) =>
      apiServerFetch<{
        items: Array<{
          name: string;
          commitHash: string;
          shortHash: string;
          commitCount: number;
          isHead: boolean;
          status: 'ahead' | 'behind' | 'diverged' | 'up-to-date' | 'no-upstream';
        }>;
      }>(`/api/git/branches?projectId=${encodeURIComponent(projectId)}`),

    commits: (projectId: string, branch?: string, limit?: number) => {
      const params = new URLSearchParams({ projectId });
      if (branch) params.set('branch', branch);
      if (limit) params.set('limit', String(limit));
      return apiServerFetch<{
        items: Array<{
          hash: string;
          shortHash: string;
          message: string;
          author: string;
          date: string;
          additions?: number;
          deletions?: number;
          filesChanged?: number;
        }>;
      }>(`/api/git/commits?${params.toString()}`);
    },

    remoteBranches: (projectId: string) =>
      apiServerFetch<{
        items: Array<{
          name: string;
          fullName: string;
          commitHash: string;
          shortHash: string;
          commitCount: number;
        }>;
      }>(`/api/git/remote-branches?projectId=${encodeURIComponent(projectId)}`),
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

  plans: {
    /**
     * Get plan session for a task
     */
    get: (taskId: string) =>
      apiFetch<{ session: PlanSession | null }>(`/api/plans/${encodeURIComponent(taskId)}`),

    /**
     * Start a new plan session for a task
     */
    start: (taskId: string, data: { projectId: string; initialPrompt: string }) =>
      apiFetch<{ session: PlanSession }>(`/api/plans/${encodeURIComponent(taskId)}/start`, {
        method: 'POST',
        body: data,
      }),

    /**
     * Answer an interaction question in a plan session
     */
    answerInteraction: (
      taskId: string,
      data: { interactionId: string; answers: Record<string, string> }
    ) =>
      apiFetch<{ session: PlanSession }>(`/api/plans/${encodeURIComponent(taskId)}/answer`, {
        method: 'POST',
        body: data,
      }),

    /**
     * Cancel a plan session
     */
    cancel: (taskId: string) =>
      apiFetch<{ session: PlanSession }>(`/api/plans/${encodeURIComponent(taskId)}/cancel`, {
        method: 'POST',
      }),

    /**
     * Get the SSE stream URL for a plan session
     */
    getStreamUrl: (taskId: string) => `/api/plans/${encodeURIComponent(taskId)}/stream`,
  },

  taskCreation: {
    /**
     * Start a new AI task creation conversation
     */
    start: (projectId: string) =>
      apiServerFetch<{
        sessionId: string;
        projectId: string;
        status: string;
        createdAt: string;
      }>('/api/tasks/create-with-ai/start', {
        method: 'POST',
        body: { projectId },
      }),

    /**
     * Send a message in the conversation
     */
    sendMessage: (sessionId: string, message: string) =>
      apiServerFetch<{
        sessionId: string;
        status: string;
        messageCount: number;
        hasSuggestion: boolean;
        suggestion: {
          title: string;
          description: string;
          labels: string[];
          priority: 'high' | 'medium' | 'low';
        } | null;
      }>('/api/tasks/create-with-ai/message', {
        method: 'POST',
        body: { sessionId, message },
      }),

    /**
     * Accept the suggestion and create a task
     */
    accept: (
      sessionId: string,
      overrides?: Partial<{
        title: string;
        description: string;
        labels: string[];
        priority: 'high' | 'medium' | 'low';
      }>
    ) =>
      apiServerFetch<{
        taskId: string;
        sessionId: string;
        status: string;
      }>('/api/tasks/create-with-ai/accept', {
        method: 'POST',
        body: { sessionId, overrides },
      }),

    /**
     * Cancel a task creation session
     */
    cancel: (sessionId: string) =>
      apiServerFetch<{
        sessionId: string;
        status: string;
      }>('/api/tasks/create-with-ai/cancel', {
        method: 'POST',
        body: { sessionId },
      }),

    /**
     * Get the SSE stream URL for a task creation session
     */
    getStreamUrl: (sessionId: string) =>
      `${API_BASE}/api/tasks/create-with-ai/stream?sessionId=${encodeURIComponent(sessionId)}`,
  },
};
