import type { SessionStatus } from '@/db/schema/enums';
import type { SessionEvent, SessionEventType } from '@/services/session.service';

// ===== Session Filter Types =====

export interface SessionFilters {
  /** Filter by session status */
  status?: SessionStatus[];
  /** Filter by agent ID */
  agentId?: string;
  /** Filter by task ID */
  taskId?: string;
  /** Date range start (ISO string) */
  dateFrom?: string;
  /** Date range end (ISO string) */
  dateTo?: string;
  /** Search query */
  search?: string;
}

// ===== Sort Types =====

export type SessionSortField = 'createdAt' | 'closedAt' | 'duration';
export type SortDirection = 'asc' | 'desc';

export interface SessionSort {
  field: SessionSortField;
  direction: SortDirection;
}

// ===== Session List Item =====

export interface SessionListItem {
  id: string;
  title: string | null;
  agentName: string | null;
  agentId: string | null;
  taskId: string | null;
  taskTitle: string | null;
  status: SessionStatus;
  createdAt: string;
  closedAt: string | null;
  /** Duration in milliseconds */
  duration: number | null;
  turnsUsed: number;
  tokensUsed: number;
  /** Project ID this session belongs to */
  projectId: string;
  /** Project name for display */
  projectName: string | null;
}

// ===== Session Detail =====

export interface SessionDetail extends SessionListItem {
  projectId: string;
  url: string;
  events: SessionEvent[];
  /** Files modified during session */
  filesModified: number;
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
  /** Tests run count */
  testsRun: number;
  /** Tests passed count */
  testsPassed: number;
}

// ===== Stream Entry Types =====

export type StreamEntryType = 'system' | 'user' | 'assistant' | 'tool';

export interface StreamEntry {
  id: string;
  type: StreamEntryType;
  timestamp: number;
  /** Formatted time offset from session start (e.g. "1:35") */
  timeOffset: string;
  content: string;
  /** Tool call details if type is 'tool' */
  toolCall?: {
    name: string;
    input: Record<string, unknown>;
    output?: unknown;
    status: 'pending' | 'running' | 'complete' | 'error';
  };
  /** Model used for this message (assistant messages only) */
  model?: string;
  /** Token usage for this message */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Whether this is the current playback position */
  isCurrent?: boolean;
}

// ===== Session Summary Metrics =====

export interface SessionMetrics {
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  testsRun: number;
  testsPassed: number;
  tokensUsed: number;
  turnsUsed: number;
  duration: number | null;
}

// ===== Export Types =====

export type ExportFormat = 'json' | 'markdown' | 'csv';

// ===== Date Group =====

export interface SessionDateGroup {
  /** Date label (e.g. "Today", "Yesterday", "Jan 14, 2026") */
  label: string;
  /** ISO date string for grouping */
  date: string;
  /** Sessions in this group */
  sessions: SessionListItem[];
}

// ===== Component Props =====

export interface SessionHistoryPageProps {
  /** Project ID to show sessions for */
  projectId: string;
  /** Optional task ID to filter sessions */
  taskId?: string;
  /** Initial filters */
  initialFilters?: SessionFilters;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/** Project option for filtering */
export interface ProjectFilterOption {
  id: string;
  name: string;
}

export interface SessionTimelineProps {
  /** Grouped sessions by date */
  groups: SessionDateGroup[];
  /** Currently selected session ID */
  selectedSessionId?: string;
  /** Callback when session is selected */
  onSessionSelect: (sessionId: string) => void;
  /** Total session count */
  totalCount: number;
  /** Total duration (formatted) */
  totalDuration: string;
  /** Loading state */
  isLoading?: boolean;
  /** Available projects for filtering */
  projects?: ProjectFilterOption[];
  /** Currently selected project ID */
  selectedProjectId?: string | null;
  /** Callback when project filter changes */
  onProjectChange?: (projectId: string | null) => void;
}

export interface SessionCardProps {
  /** Session data */
  session: SessionListItem;
  /** Whether this card is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Compact mode */
  compact?: boolean;
}

export interface SessionDetailViewProps {
  /** Session detail data */
  session: SessionDetail | null;
  /** Loading state */
  isLoading?: boolean;
  /** Callback for export */
  onExport?: (format: ExportFormat) => void;
  /** Callback for delete */
  onDelete?: () => void;
  /** Callback for refresh */
  onRefresh?: () => void;
}

export interface StreamViewerProps {
  /** Stream entries to display */
  entries: StreamEntry[];
  /** Current playback position (entry ID) */
  currentEntryId?: string;
  /** Loading state */
  isLoading?: boolean;
}

export interface StreamEntryProps {
  /** Entry data */
  entry: StreamEntry;
  /** Whether this is the current playback position */
  isCurrent?: boolean;
}

export interface SessionSummaryProps {
  /** Session metrics */
  metrics: SessionMetrics;
}

export interface ExportDropdownProps {
  /** Callback when format is selected */
  onExport: (format: ExportFormat) => void;
  /** Disabled state */
  disabled?: boolean;
}

// ===== Status Colors =====

export const SESSION_STATUS_COLORS: Record<
  SessionStatus,
  {
    dot: string;
    badge: string;
    text: string;
  }
> = {
  idle: {
    dot: 'bg-fg-subtle',
    badge: 'bg-fg-subtle/15',
    text: 'text-fg-muted',
  },
  initializing: {
    dot: 'bg-accent',
    badge: 'bg-accent/15',
    text: 'text-accent',
  },
  active: {
    dot: 'bg-success animate-pulse',
    badge: 'bg-success/15',
    text: 'text-success',
  },
  paused: {
    dot: 'bg-warning',
    badge: 'bg-warning/15',
    text: 'text-warning',
  },
  closing: {
    dot: 'bg-fg-subtle',
    badge: 'bg-fg-subtle/15',
    text: 'text-fg-muted',
  },
  closed: {
    dot: 'bg-done',
    badge: 'bg-done/15',
    text: 'text-done',
  },
  error: {
    dot: 'bg-danger',
    badge: 'bg-danger/15',
    text: 'text-danger',
  },
};

// ===== Stream Entry Type Config =====

export const STREAM_ENTRY_TYPE_CONFIG: Record<
  StreamEntryType,
  {
    label: string;
    textClass: string;
  }
> = {
  system: {
    label: 'System',
    textClass: 'text-fg-muted',
  },
  user: {
    label: 'User',
    textClass: 'text-accent',
  },
  assistant: {
    label: 'Assistant',
    textClass: 'text-done',
  },
  tool: {
    label: 'Tool Call',
    textClass: 'text-warning',
  },
};

// Re-export types from session service for convenience
export type { SessionEvent, SessionEventType };
