import type { Icon } from '@phosphor-icons/react';
import { CheckCircle, Clock, Lightning, Stack, User } from '@phosphor-icons/react';
import type { TaskColumn } from '@/db/schema/tasks';

/**
 * Semantic icons for each Kanban column
 *
 * Icon choices:
 * - Backlog: Stack - represents a stack of items waiting to be processed
 * - Queued: Clock - represents items scheduled/waiting in queue
 * - In Progress: Lightning - represents active energy/work happening
 * - Waiting Approval: User - represents items awaiting human review
 * - Verified: CheckCircle - universally understood completion symbol
 */
export const COLUMN_ICONS: Record<TaskColumn, Icon> = {
  backlog: Stack,
  queued: Clock,
  in_progress: Lightning,
  waiting_approval: User,
  verified: CheckCircle,
};
