/**
 * Feature components barrel export
 *
 * Re-exports all public feature components for convenient imports.
 *
 * Note: Some components have both flat file and directory-based implementations.
 * This barrel exports from the flat files for backward compatibility.
 * The directory-based modules (e.g., kanban-board/, agent-session-view/) provide
 * enhanced versions that can be imported directly from their index files.
 */

// Agent Config Dialog
export { AgentConfigDialog } from './agent-config-dialog';

// Agent Session View
export { AgentSessionView } from './agent-session-view';

// Approval Dialog
export { ApprovalDialog } from './approval-dialog';

// Breadcrumbs
export { type BreadcrumbItem, Breadcrumbs } from './breadcrumbs';

// Delete Project Dialog
export { DeleteProjectDialog } from './delete-project-dialog';

// Empty State
export { EmptyState } from './empty-state';

// Error State
export { ErrorState } from './error-state';

// GitHub App Setup
export { GitHubAppSetup } from './github-app-setup';

// Kanban Board and related components
export { KanbanBoard } from './kanban-board';
export { KanbanCard } from './kanban-card';
export { KanbanColumn } from './kanban-column';

// Layout Shell
export { LayoutShell } from './layout-shell';

// New Project Dialog
export { NewProjectDialog } from './new-project-dialog';

// Project Card
export { ProjectCard } from './project-card';

// Project Picker (note: uses directory-based module via re-export in flat file)
// The flat project-picker.tsx doesn't exist, so we don't export it here
// Import directly from './project-picker/' for the enhanced version

// Project Settings
export { ProjectSettings } from './project-settings';

// Queue Status
export { QueueStatus } from './queue-status';

// Queue Waiting State
export { QueueWaitingState } from './queue-waiting-state';

// Session History
export { SessionHistory } from './session-history';

// Sidebar
export { Sidebar } from './sidebar';

// Task Detail Dialog - Uses directory-based module with mode toggle support
export { TaskDetailDialog } from './task-detail-dialog/index';

// Theme Toggle
export { ThemeToggle } from './theme-toggle';

// Worktree Management
export { WorktreeManagement } from './worktree-management';
