// Shared types for CLI Monitor views

// Re-export CliSession from the canonical schema module
export type { CliSession } from '@/lib/cli-monitor/schema';
export type {
  CompactionEvent,
  HealthStatus,
  PerformanceMetrics,
  TurnMetrics,
} from '@/services/cli-monitor/types';

export type CliSessionStatus = 'working' | 'waiting_for_approval' | 'waiting_for_input' | 'idle';
export type PageState = 'install' | 'waiting' | 'active';
export type AggregateStatus = 'nominal' | 'attention' | 'idle';

export interface AlertToast {
  id: string;
  type: 'approval' | 'input' | 'complete' | 'error' | 'new-session';
  title: string;
  detail: string;
  sessionId: string;
  autoDismiss: boolean;
  createdAt: number;
}
