import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getShortcutId,
  type Shortcut,
  type ShortcutCategory,
  type ShortcutsContextValue,
  useGlobalKeyboardHandler,
} from '@/app/hooks/use-keyboard-shortcuts';

// Re-export types for convenience
export type { Shortcut, ShortcutCategory, ShortcutsContextValue };

// =============================================================================
// Context
// =============================================================================

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface ShortcutsProviderProps {
  children: ReactNode;
  /** Initial enabled state. Defaults to true. */
  initialEnabled?: boolean;
}

/**
 * Provider component for the keyboard shortcuts system.
 *
 * Wrap your app with this provider to enable keyboard shortcuts.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ShortcutsProvider>
 *       <YourApp />
 *     </ShortcutsProvider>
 *   );
 * }
 * ```
 */
export function ShortcutsProvider({
  children,
  initialEnabled = true,
}: ShortcutsProviderProps): React.JSX.Element {
  // Use a ref to store shortcuts to avoid re-renders when shortcuts change
  const shortcutsRef = useRef<Map<string, Shortcut>>(new Map());
  const [isEnabled, setEnabled] = useState(initialEnabled);
  const [isHelpOpen, setHelpOpen] = useState(false);

  // Register a new shortcut
  const registerShortcut = useCallback((shortcut: Shortcut): (() => void) => {
    const id = getShortcutId(shortcut);
    shortcutsRef.current.set(id, shortcut);

    // Return unregister function
    return () => {
      shortcutsRef.current.delete(id);
    };
  }, []);

  // Unregister a shortcut by ID
  const unregisterShortcut = useCallback((id: string): void => {
    shortcutsRef.current.delete(id);
  }, []);

  // Get all current shortcuts
  const getShortcuts = useCallback((): Shortcut[] => {
    return Array.from(shortcutsRef.current.values());
  }, []);

  // Set up global keyboard handler
  useGlobalKeyboardHandler(getShortcuts, isEnabled);

  // Memoize context value
  const contextValue = useMemo<ShortcutsContextValue>(
    () => ({
      registerShortcut,
      unregisterShortcut,
      getShortcuts,
      isEnabled,
      setEnabled,
      isHelpOpen,
      setHelpOpen,
    }),
    [registerShortcut, unregisterShortcut, getShortcuts, isEnabled, isHelpOpen]
  );

  return <ShortcutsContext.Provider value={contextValue}>{children}</ShortcutsContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access the shortcuts context
 *
 * @throws Error if used outside of ShortcutsProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { registerShortcut, isEnabled, setEnabled } = useShortcutsContext();
 *
 *   useEffect(() => {
 *     const unregister = registerShortcut({
 *       key: 's',
 *       meta: true,
 *       action: () => handleSave(),
 *       description: 'Save changes',
 *     });
 *     return unregister;
 *   }, []);
 *
 *   return <button onClick={() => setEnabled(!isEnabled)}>Toggle Shortcuts</button>;
 * }
 * ```
 */
export function useShortcutsContext(): ShortcutsContextValue {
  const context = useContext(ShortcutsContext);

  if (!context) {
    throw new Error('useShortcutsContext must be used within a ShortcutsProvider');
  }

  return context;
}
