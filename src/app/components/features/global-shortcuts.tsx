import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { type Shortcut, useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import { useShortcutsContext } from '@/app/providers/shortcuts-provider';
import { ShortcutsHelp } from './shortcuts-help';

// =============================================================================
// Types
// =============================================================================

interface GlobalShortcutsProps {
  /** Callback when project picker should open */
  onOpenProjectPicker?: () => void;
  /** Callback when new project dialog should open */
  onNewProject?: () => void;
  /** Callback to run the selected agent */
  onRunAgent?: () => void;
  /** Callback to stop the running agent */
  onStopAgent?: () => void;
  /** Callback to create a new task */
  onNewTask?: () => void;
  /** Callback to approve a waiting task */
  onApproveTask?: () => void;
  /** Condition to check if an agent is selected */
  hasSelectedAgent?: () => boolean;
  /** Condition to check if an agent is running */
  hasRunningAgent?: () => boolean;
  /** Condition to check if there's a task waiting for approval */
  hasWaitingTask?: () => boolean;
}

// =============================================================================
// Hook for Global Shortcuts Registration
// =============================================================================

/**
 * Hook to use global keyboard shortcuts
 *
 * This should be called in a component that has access to all the necessary
 * callbacks and state for global actions.
 */
export function useGlobalShortcuts(props: GlobalShortcutsProps = {}): void {
  const {
    onOpenProjectPicker,
    onNewProject,
    onRunAgent,
    onStopAgent,
    onNewTask,
    onApproveTask,
    hasSelectedAgent,
    hasRunningAgent,
    hasWaitingTask,
  } = props;

  const navigate = useNavigate();
  const shortcutsContext = useShortcutsContext();
  const { setHelpOpen } = shortcutsContext;

  // Define all global shortcuts
  const shortcuts = useMemo<Shortcut[]>(() => {
    const result: Shortcut[] = [];

    // Navigation shortcuts
    result.push({
      key: '1',
      meta: true,
      description: 'Go to Agents view',
      category: 'views',
      action: () => {
        navigate({ to: '/agents' });
      },
    });

    result.push({
      key: '2',
      meta: true,
      description: 'Go to Tasks/Kanban',
      category: 'views',
      action: () => {
        // Navigate to the first project's tasks or just /projects
        navigate({ to: '/projects' });
      },
    });

    // Project picker
    if (onOpenProjectPicker) {
      result.push({
        key: 'p',
        meta: true,
        description: 'Open project picker',
        category: 'navigation',
        action: onOpenProjectPicker,
      });
    }

    // New project
    if (onNewProject) {
      result.push({
        key: 'n',
        meta: true,
        shift: true,
        description: 'New project',
        category: 'actions',
        action: onNewProject,
      });
    }

    // Run agent
    if (onRunAgent) {
      result.push({
        key: 'r',
        meta: true,
        description: 'Run selected agent',
        category: 'actions',
        action: onRunAgent,
        when: hasSelectedAgent,
      });
    }

    // Stop agent
    if (onStopAgent) {
      result.push({
        key: '.',
        meta: true,
        description: 'Stop agent',
        category: 'actions',
        action: onStopAgent,
        when: hasRunningAgent,
      });
    }

    // New task
    if (onNewTask) {
      result.push({
        key: 't',
        meta: true,
        description: 'New task',
        category: 'actions',
        action: onNewTask,
      });
    }

    // Approve task
    if (onApproveTask) {
      result.push({
        key: 'Enter',
        meta: true,
        description: 'Approve task',
        category: 'actions',
        action: onApproveTask,
        when: hasWaitingTask,
      });
    }

    // Help modal (Cmd+/)
    result.push({
      key: '/',
      meta: true,
      description: 'Show keyboard shortcuts',
      category: 'navigation',
      action: () => setHelpOpen(true),
    });

    // Escape to close modals (this is handled in the modal components themselves)
    // But we can add it to the help for documentation
    result.push({
      key: 'Escape',
      description: 'Close modal/deselect',
      category: 'navigation',
      action: () => {
        // This is typically handled by individual modals
        // Here we just close the help modal if it's open
        setHelpOpen(false);
      },
    });

    return result;
  }, [
    navigate,
    setHelpOpen,
    onOpenProjectPicker,
    onNewProject,
    onRunAgent,
    onStopAgent,
    onNewTask,
    onApproveTask,
    hasSelectedAgent,
    hasRunningAgent,
    hasWaitingTask,
  ]);

  // Register shortcuts
  useKeyboardShortcuts(shortcuts, shortcutsContext);
}

// =============================================================================
// Component for Basic Global Shortcuts
// =============================================================================

/**
 * Component that registers basic global shortcuts (navigation and help)
 *
 * Place this component inside ShortcutsProvider to enable basic shortcuts.
 * For action shortcuts (run agent, new task, etc.), use the useGlobalShortcuts
 * hook in a component that has access to the necessary state and callbacks.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ShortcutsProvider>
 *       <GlobalShortcuts />
 *       <YourApp />
 *     </ShortcutsProvider>
 *   );
 * }
 * ```
 */
export function GlobalShortcuts(): React.JSX.Element {
  const navigate = useNavigate();
  const shortcutsContext = useShortcutsContext();
  const { setHelpOpen } = shortcutsContext;

  // Basic navigation and help shortcuts
  const shortcuts = useMemo<Shortcut[]>(
    () => [
      {
        key: '1',
        meta: true,
        description: 'Go to Agents view',
        category: 'views',
        action: () => navigate({ to: '/agents' }),
      },
      {
        key: '2',
        meta: true,
        description: 'Go to Tasks/Kanban',
        category: 'views',
        action: () => navigate({ to: '/projects' }),
      },
      {
        key: '/',
        meta: true,
        description: 'Show keyboard shortcuts',
        category: 'navigation',
        action: () => setHelpOpen(true),
      },
      {
        key: 'Escape',
        description: 'Close modal/deselect',
        category: 'navigation',
        action: () => setHelpOpen(false),
      },
    ],
    [navigate, setHelpOpen]
  );

  useKeyboardShortcuts(shortcuts, shortcutsContext);

  return <ShortcutsHelp />;
}
