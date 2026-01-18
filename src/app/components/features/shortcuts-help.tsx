import { Keyboard, X } from '@phosphor-icons/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useMemo } from 'react';
import {
  getShortcutParts,
  type Shortcut,
  type ShortcutCategory,
} from '@/app/hooks/use-keyboard-shortcuts';
import { useShortcutsContext } from '@/app/providers/shortcuts-provider';
import { cn } from '@/lib/utils/cn';

// =============================================================================
// Types
// =============================================================================

interface ShortcutGroup {
  category: ShortcutCategory;
  label: string;
  shortcuts: Shortcut[];
}

// =============================================================================
// Category Labels
// =============================================================================

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  views: 'Views',
};

const CATEGORY_ORDER: ShortcutCategory[] = ['navigation', 'views', 'actions'];

// =============================================================================
// Sub-Components
// =============================================================================

interface KeyProps {
  children: React.ReactNode;
}

/**
 * Styled keyboard key indicator
 */
function Key({ children }: KeyProps): React.JSX.Element {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'min-w-[24px] h-6 px-1.5',
        'bg-surface-subtle border border-border rounded',
        'text-xs font-mono font-medium text-fg-muted'
      )}
    >
      {children}
    </kbd>
  );
}

interface ShortcutRowProps {
  shortcut: Shortcut;
}

/**
 * Single shortcut row with keys and description
 */
function ShortcutRow({ shortcut }: ShortcutRowProps): React.JSX.Element {
  const parts = getShortcutParts(shortcut);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-fg">{shortcut.description}</span>
      <div className="flex items-center gap-1">
        {parts.map((part, index) => (
          <Key key={`${shortcut.key}-${index}`}>{part}</Key>
        ))}
      </div>
    </div>
  );
}

interface ShortcutGroupSectionProps {
  group: ShortcutGroup;
}

/**
 * Section for a category of shortcuts
 */
function ShortcutGroupSection({ group }: ShortcutGroupSectionProps): React.JSX.Element {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium uppercase tracking-wide text-fg-muted mb-2">
        {group.label}
      </h3>
      <div className="divide-y divide-border-muted">
        {group.shortcuts.map((shortcut) => (
          <ShortcutRow
            key={`${shortcut.key}-${shortcut.meta ? 'm' : ''}-${shortcut.shift ? 's' : ''}`}
            shortcut={shortcut}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Keyboard shortcuts help modal
 *
 * Displays all registered keyboard shortcuts grouped by category.
 * Opens when the user presses '?'.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ShortcutsProvider>
 *       <YourApp />
 *       <ShortcutsHelp />
 *     </ShortcutsProvider>
 *   );
 * }
 * ```
 */
export function ShortcutsHelp(): React.JSX.Element {
  const { isHelpOpen, setHelpOpen, getShortcuts } = useShortcutsContext();

  // Group shortcuts by category
  const groups = useMemo((): ShortcutGroup[] => {
    const shortcuts = getShortcuts();
    const groupMap = new Map<ShortcutCategory, Shortcut[]>();

    // Initialize all categories
    for (const category of CATEGORY_ORDER) {
      groupMap.set(category, []);
    }

    // Group shortcuts by category
    for (const shortcut of shortcuts) {
      const category = shortcut.category ?? 'actions';
      const existing = groupMap.get(category) ?? [];
      existing.push(shortcut);
      groupMap.set(category, existing);
    }

    // Convert to array and filter empty groups
    return CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      shortcuts: groupMap.get(category) ?? [],
    })).filter((group) => group.shortcuts.length > 0);
  }, [getShortcuts]);

  return (
    <DialogPrimitive.Root open={isHelpOpen} onOpenChange={setHelpOpen}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50',
            'bg-black/60 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-md',
            '-translate-x-1/2 -translate-y-1/2',
            'bg-surface border border-border rounded-xl',
            'shadow-2xl overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-fg-muted" />
              <DialogPrimitive.Title className="text-base font-semibold text-fg">
                Keyboard Shortcuts
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-md',
                  'text-fg-muted hover:text-fg hover:bg-surface-hover',
                  'transition-colors duration-100'
                )}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Shortcuts List */}
          <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-6">
            {groups.length === 0 ? (
              <p className="text-sm text-fg-muted text-center py-4">
                No keyboard shortcuts registered.
              </p>
            ) : (
              groups.map((group) => <ShortcutGroupSection key={group.category} group={group} />)
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border bg-surface-hover">
            <p className="text-xs text-fg-muted text-center">
              Press <Key>Esc</Key> to close
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
