# Toast/Notification Component Specification

## Overview

The Toast/Notification system provides non-blocking feedback messages to users for operation results, status updates, and system notifications. Toasts appear temporarily and can be dismissed manually or automatically.

**Related Specifications:**

- [Animation System](../implementation/animation-system.md) - Animation tokens and timing
- [Component Patterns](../implementation/component-patterns.md) - Radix UI integration patterns
- [Design Tokens](../wireframes/design-tokens.css) - Color and spacing tokens

---

## Component Distinction

### Toast vs Notification

| Aspect | Toast | Notification |
|--------|-------|--------------|
| **Duration** | Temporary (auto-dismiss) | Persistent until action |
| **Purpose** | Operation feedback | Important alerts requiring attention |
| **Position** | Screen corners | Fixed position or inline |
| **Interaction** | Optional dismiss | Requires acknowledgment |
| **Use Cases** | Success, error, loading states | Permission requests, critical errors |

This specification focuses primarily on **Toast** components, which are the most common feedback mechanism.

---

## Toast Types

### Success Toast

```
Purpose: Operation completed successfully
Duration: 3000ms (3 seconds)
Color: Success green (#3fb950)
Icon: Checkmark circle
```

### Error Toast

```
Purpose: Operation failed
Duration: 5000ms (5 seconds) - longer to allow reading
Color: Danger red (#f85149)
Icon: X circle
```

### Warning Toast

```
Purpose: Attention needed, non-critical issue
Duration: 4000ms (4 seconds)
Color: Attention yellow (#d29922)
Icon: Warning triangle
```

### Info Toast

```
Purpose: Informational message
Duration: 3000ms (3 seconds)
Color: Accent blue (#58a6ff)
Icon: Info circle
```

### Loading Toast

```
Purpose: Async operation in progress
Duration: Indefinite (until resolved)
Color: Foreground muted (#8b949e)
Icon: Animated spinner
```

### Promise Toast

```
Purpose: Track async operation lifecycle
Behavior: Shows loading -> success OR error
Duration: Loading indefinite, result 3-5s based on outcome
```

---

## Interface Definition

### ToastProps

```typescript
// app/components/ui/toast/types.ts
import { z } from 'zod';

export interface ToastProps {
  /** Unique identifier for the toast */
  id: string;
  /** Toast type determining styling and behavior */
  type: ToastType;
  /** Primary message text */
  title: string;
  /** Optional secondary description */
  description?: string;
  /** Auto-dismiss duration in milliseconds (0 for indefinite) */
  duration?: number;
  /** Optional action button */
  action?: ToastAction;
  /** Whether toast can be dismissed manually */
  dismissible?: boolean;
  /** Custom icon override */
  icon?: React.ReactNode;
  /** Callback when toast is dismissed */
  onDismiss?: (id: string) => void;
  /** Callback when action is clicked */
  onAction?: () => void;
  /** Timestamp when toast was created */
  createdAt?: number;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  /** Button label text */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Optional alt text for accessibility */
  altText?: string;
}
```

### ToasterProps

```typescript
// app/components/ui/toast/toaster.tsx
export interface ToasterProps {
  /** Position on screen */
  position?: ToastPosition;
  /** Maximum visible toasts */
  maxVisible?: number;
  /** Gap between stacked toasts */
  gap?: number;
  /** Offset from screen edges */
  offset?: number;
  /** Custom class name */
  className?: string;
  /** Expand toasts on hover */
  expandOnHover?: boolean;
  /** Show close button on hover only */
  closeButtonOnHover?: boolean;
}

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';
```

### Toast Context Types

```typescript
// app/components/ui/toast/context.ts
export interface ToastContextValue {
  /** Currently visible toasts */
  toasts: ToastProps[];
  /** Add a new toast */
  addToast: (toast: Omit<ToastProps, 'id' | 'createdAt'>) => string;
  /** Remove a toast by ID */
  removeToast: (id: string) => void;
  /** Update an existing toast */
  updateToast: (id: string, updates: Partial<ToastProps>) => void;
  /** Remove all toasts */
  clearAll: () => void;
}

export interface ToastOptions {
  /** Override default duration */
  duration?: number;
  /** Add action button */
  action?: ToastAction;
  /** Prevent auto-dismiss */
  dismissible?: boolean;
  /** Custom ID (auto-generated if not provided) */
  id?: string;
}
```

---

## Positioning System

### Position Layout

```
+------------------------------------------------------------------+
|  [top-left]           [top-center]           [top-right]         |
|                                                                   |
|                                                                   |
|                         VIEWPORT                                  |
|                                                                   |
|                                                                   |
|  [bottom-left]       [bottom-center]       [bottom-right]        |
+------------------------------------------------------------------+
```

### Position Configuration

| Position | Stack Direction | Enter Animation | Exit Animation |
|----------|-----------------|-----------------|----------------|
| `top-left` | Down | Slide from left + fade | Slide to left + fade |
| `top-center` | Down | Slide from top + fade | Slide to top + fade |
| `top-right` | Down | Slide from right + fade | Slide to right + fade |
| `bottom-left` | Up | Slide from left + fade | Slide to left + fade |
| `bottom-center` | Up | Slide from bottom + fade | Slide to bottom + fade |
| `bottom-right` | Up | Slide from right + fade | Slide to right + fade |

### Offset Values

```typescript
const positionStyles: Record<ToastPosition, React.CSSProperties> = {
  'top-left': {
    top: 'var(--space-4)',      // 16px
    left: 'var(--space-4)',     // 16px
    alignItems: 'flex-start',
  },
  'top-center': {
    top: 'var(--space-4)',
    left: '50%',
    transform: 'translateX(-50%)',
    alignItems: 'center',
  },
  'top-right': {
    top: 'var(--space-4)',
    right: 'var(--space-4)',
    alignItems: 'flex-end',
  },
  'bottom-left': {
    bottom: 'var(--space-4)',
    left: 'var(--space-4)',
    alignItems: 'flex-start',
    flexDirection: 'column-reverse',
  },
  'bottom-center': {
    bottom: 'var(--space-4)',
    left: '50%',
    transform: 'translateX(-50%)',
    alignItems: 'center',
    flexDirection: 'column-reverse',
  },
  'bottom-right': {
    bottom: 'var(--space-4)',
    right: 'var(--space-4)',
    alignItems: 'flex-end',
    flexDirection: 'column-reverse',
  },
};
```

---

## Animation Specifications

### Timing Tokens

Following the [Animation System](../implementation/animation-system.md):

| Animation | Duration | Easing |
|-----------|----------|--------|
| Enter | `200ms` (`--duration-normal`) | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Exit | `150ms` (`--duration-fast`) | `cubic-bezier(0.25, 1, 0.5, 1)` |
| Stack reflow | `200ms` (`--duration-normal`) | `cubic-bezier(0.25, 1, 0.5, 1)` |

### Enter Animations

```css
/* Slide from right (default for bottom-right) */
@keyframes toast-slide-in-right {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Slide from left (for left positions) */
@keyframes toast-slide-in-left {
  from {
    opacity: 0;
    transform: translateX(-100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Slide from top (for top-center) */
@keyframes toast-slide-in-top {
  from {
    opacity: 0;
    transform: translateY(-100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Slide from bottom (for bottom-center) */
@keyframes toast-slide-in-bottom {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Exit Animations

```css
/* Exit animations mirror enter with reversed transforms */
@keyframes toast-slide-out-right {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

@keyframes toast-slide-out-left {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-100%);
  }
}

@keyframes toast-slide-out-top {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-100%);
  }
}

@keyframes toast-slide-out-bottom {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}
```

### Stack Reflow Animation

```css
/* Smooth repositioning when toasts are added/removed */
.toast-item {
  transition: transform var(--duration-normal) var(--ease-out),
              opacity var(--duration-fast) var(--ease-out);
}
```

### Radix Integration

```typescript
// Animation classes for Radix Toast
const toastAnimationClasses = {
  'top-right': cn(
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:slide-in-from-right-full',
    'data-[state=closed]:slide-out-to-right-full',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'duration-200 ease-out'
  ),
  'top-left': cn(
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:slide-in-from-left-full',
    'data-[state=closed]:slide-out-to-left-full',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'duration-200 ease-out'
  ),
  'top-center': cn(
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:slide-in-from-top-full',
    'data-[state=closed]:slide-out-to-top-full',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'duration-200 ease-out'
  ),
  'bottom-right': cn(
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:slide-in-from-right-full',
    'data-[state=closed]:slide-out-to-right-full',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'duration-200 ease-out'
  ),
  'bottom-left': cn(
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:slide-in-from-left-full',
    'data-[state=closed]:slide-out-to-left-full',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'duration-200 ease-out'
  ),
  'bottom-center': cn(
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=open]:slide-in-from-bottom-full',
    'data-[state=closed]:slide-out-to-bottom-full',
    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
    'duration-200 ease-out'
  ),
};
```

---

## Auto-Dismiss Behavior

### Default Durations by Type

| Type | Duration | Rationale |
|------|----------|-----------|
| `success` | 3000ms | Quick acknowledgment sufficient |
| `error` | 5000ms | Longer to read error details |
| `warning` | 4000ms | Moderate attention required |
| `info` | 3000ms | Informational, not critical |
| `loading` | Indefinite | Until operation completes |

### Pause on Hover

```typescript
// Pause auto-dismiss timer when user hovers over toast
const useToastTimer = (
  duration: number,
  onDismiss: () => void
) => {
  const [isPaused, setIsPaused] = useState(false);
  const [remainingTime, setRemainingTime] = useState(duration);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (duration === 0 || isPaused) return;

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(onDismiss, remainingTime);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, isPaused, remainingTime, onDismiss]);

  const pause = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      setRemainingTime((prev) => Math.max(prev - elapsed, 0));
    }
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  return { pause, resume, isPaused, remainingTime };
};
```

### Progress Indicator Option

```typescript
// Optional progress bar showing remaining time
interface ToastProgressProps {
  duration: number;
  isPaused: boolean;
  remainingTime: number;
}

function ToastProgress({ duration, isPaused, remainingTime }: ToastProgressProps) {
  const progress = (remainingTime / duration) * 100;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#21262d] overflow-hidden rounded-b-[6px]">
      <div
        className={cn(
          'h-full bg-current transition-[width]',
          isPaused ? 'transition-none' : 'duration-100 linear'
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
```

---

## Action Buttons

### Single Action Pattern

```typescript
// Common action patterns
const actionPatterns = {
  // Undo action
  undo: (onUndo: () => void): ToastAction => ({
    label: 'Undo',
    onClick: onUndo,
    altText: 'Undo this action',
  }),

  // View details action
  viewDetails: (onView: () => void): ToastAction => ({
    label: 'View',
    onClick: onView,
    altText: 'View details',
  }),

  // Retry action
  retry: (onRetry: () => void): ToastAction => ({
    label: 'Retry',
    onClick: onRetry,
    altText: 'Retry this operation',
  }),

  // Dismiss action (explicit)
  dismiss: (onDismiss: () => void): ToastAction => ({
    label: 'Dismiss',
    onClick: onDismiss,
    altText: 'Dismiss this notification',
  }),
};
```

### Undo Pattern Example

```typescript
// Usage: Undo deleted item
toast.success('Task deleted', {
  description: 'The task has been moved to trash.',
  action: {
    label: 'Undo',
    onClick: () => {
      restoreTask(taskId);
      toast.success('Task restored');
    },
  },
  duration: 5000, // Longer duration for undo opportunity
});
```

### View Details Link

```typescript
// Usage: Error with details
toast.error('Merge failed', {
  description: 'There are conflicts in 3 files.',
  action: {
    label: 'View Conflicts',
    onClick: () => {
      router.navigate({ to: '/conflicts/$taskId', params: { taskId } });
    },
  },
});
```

---

## Toast Context/Provider

### ToastProvider Component

```typescript
// app/components/ui/toast/toast-provider.tsx
import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { createId } from '@paralleldrive/cuid2';
import { ToastContext } from './toast-context';
import { Toaster } from './toaster';
import type { ToastProps, ToastContextValue, ToasterProps } from './types';

interface ToastProviderProps extends ToasterProps {
  children: React.ReactNode;
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxVisible = 5,
  gap = 8,
  offset = 16,
  ...toasterProps
}: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastProps, 'id' | 'createdAt'>) => {
    const id = toast.id ?? createId();
    const createdAt = Date.now();

    setToasts((prev) => {
      // Remove oldest if exceeding maxVisible
      const newToasts = [...prev, { ...toast, id, createdAt }];
      if (newToasts.length > maxVisible) {
        return newToasts.slice(-maxVisible);
      }
      return newToasts;
    });

    return id;
  }, [maxVisible]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = React.useCallback((id: string, updates: Partial<ToastProps>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const clearAll = React.useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue: ToastContextValue = React.useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
      updateToast,
      clearAll,
    }),
    [toasts, addToast, removeToast, updateToast, clearAll]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      <ToastPrimitive.Provider swipeDirection={getSwipeDirection(position)}>
        {children}
        <Toaster
          position={position}
          gap={gap}
          offset={offset}
          {...toasterProps}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

function getSwipeDirection(
  position: ToastPosition
): 'right' | 'left' | 'up' | 'down' {
  if (position.includes('right')) return 'right';
  if (position.includes('left')) return 'left';
  if (position.includes('top')) return 'up';
  return 'down';
}
```

### useToast Hook

```typescript
// app/components/ui/toast/use-toast.ts
import * as React from 'react';
import { ToastContext } from './toast-context';
import type { ToastProps, ToastOptions, ToastType } from './types';

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
  loading: 0, // Indefinite
};

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { addToast, removeToast, updateToast, clearAll, toasts } = context;

  const createToast = React.useCallback(
    (
      type: ToastType,
      title: string,
      descriptionOrOptions?: string | ToastOptions,
      options?: ToastOptions
    ) => {
      const description =
        typeof descriptionOrOptions === 'string' ? descriptionOrOptions : undefined;
      const opts =
        typeof descriptionOrOptions === 'object' ? descriptionOrOptions : options;

      return addToast({
        type,
        title,
        description,
        duration: opts?.duration ?? DEFAULT_DURATIONS[type],
        action: opts?.action,
        dismissible: opts?.dismissible ?? true,
      });
    },
    [addToast]
  );

  return React.useMemo(
    () => ({
      // Direct toast creation
      toast: createToast,

      // Convenience methods
      success: (title: string, options?: ToastOptions) =>
        createToast('success', title, options),

      error: (title: string, options?: ToastOptions) =>
        createToast('error', title, options),

      warning: (title: string, options?: ToastOptions) =>
        createToast('warning', title, options),

      info: (title: string, options?: ToastOptions) =>
        createToast('info', title, options),

      loading: (title: string, options?: ToastOptions) =>
        createToast('loading', title, options),

      // Promise toast
      promise: async <T,>(
        promise: Promise<T>,
        messages: {
          loading: string;
          success: string | ((data: T) => string);
          error: string | ((error: Error) => string);
        }
      ): Promise<T> => {
        const id = addToast({
          type: 'loading',
          title: messages.loading,
          duration: 0,
          dismissible: false,
        });

        try {
          const result = await promise;
          updateToast(id, {
            type: 'success',
            title:
              typeof messages.success === 'function'
                ? messages.success(result)
                : messages.success,
            duration: DEFAULT_DURATIONS.success,
            dismissible: true,
          });
          return result;
        } catch (error) {
          updateToast(id, {
            type: 'error',
            title:
              typeof messages.error === 'function'
                ? messages.error(error as Error)
                : messages.error,
            duration: DEFAULT_DURATIONS.error,
            dismissible: true,
          });
          throw error;
        }
      },

      // Management methods
      dismiss: removeToast,
      update: updateToast,
      clearAll,

      // State access
      toasts,
    }),
    [createToast, addToast, removeToast, updateToast, clearAll, toasts]
  );
}
```

### Standalone toast() Function

```typescript
// app/components/ui/toast/toast-function.ts
// For use outside of React components

let toastFn: ReturnType<typeof useToast> | null = null;

export function setToastHandler(handler: ReturnType<typeof useToast>) {
  toastFn = handler;
}

export const toast = {
  success: (title: string, options?: ToastOptions) => {
    if (!toastFn) throw new Error('Toast provider not initialized');
    return toastFn.success(title, options);
  },
  error: (title: string, options?: ToastOptions) => {
    if (!toastFn) throw new Error('Toast provider not initialized');
    return toastFn.error(title, options);
  },
  warning: (title: string, options?: ToastOptions) => {
    if (!toastFn) throw new Error('Toast provider not initialized');
    return toastFn.warning(title, options);
  },
  info: (title: string, options?: ToastOptions) => {
    if (!toastFn) throw new Error('Toast provider not initialized');
    return toastFn.info(title, options);
  },
  loading: (title: string, options?: ToastOptions) => {
    if (!toastFn) throw new Error('Toast provider not initialized');
    return toastFn.loading(title, options);
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => {
    if (!toastFn) throw new Error('Toast provider not initialized');
    return toastFn.promise(promise, messages);
  },
  dismiss: (id: string) => {
    if (!toastFn) throw new Error('Toast provider not initialized');
    return toastFn.dismiss(id);
  },
};
```

---

## Accessibility

### ARIA Roles

| Toast Type | Role | aria-live | Rationale |
|------------|------|-----------|-----------|
| `error` | `alert` | `assertive` | Errors require immediate attention |
| `warning` | `alert` | `assertive` | Warnings may require action |
| `success` | `status` | `polite` | Success is informational |
| `info` | `status` | `polite` | Info is non-critical |
| `loading` | `status` | `polite` | Loading is progress indication |

### ARIA Attributes

```typescript
// Accessibility attributes by toast type
const getAriaAttributes = (type: ToastType) => {
  switch (type) {
    case 'error':
    case 'warning':
      return {
        role: 'alert',
        'aria-live': 'assertive' as const,
        'aria-atomic': true,
      };
    default:
      return {
        role: 'status',
        'aria-live': 'polite' as const,
        'aria-atomic': true,
      };
  }
};
```

### Focus Management

```typescript
// Focus management for toasts with actions
const ToastItem = ({ toast, onDismiss }: ToastItemProps) => {
  const actionRef = React.useRef<HTMLButtonElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // Allow keyboard navigation within toast
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onDismiss(toast.id);
        break;
      case 'Tab':
        // Trap focus within toast if it has focusable elements
        if (!e.shiftKey && document.activeElement === closeRef.current) {
          e.preventDefault();
          actionRef.current?.focus();
        } else if (e.shiftKey && document.activeElement === actionRef.current) {
          e.preventDefault();
          closeRef.current?.focus();
        }
        break;
    }
  };

  return (
    <div onKeyDown={handleKeyDown} {...getAriaAttributes(toast.type)}>
      {/* Toast content */}
    </div>
  );
};
```

### Keyboard Interactions

| Key | Action |
|-----|--------|
| `Escape` | Dismiss focused toast |
| `Tab` | Navigate between action and close buttons |
| `Enter/Space` | Activate focused button |

### Screen Reader Announcements

```typescript
// Announce toast to screen readers
const announceToast = (toast: ToastProps) => {
  // Create visually hidden live region
  const announcement = document.createElement('div');
  announcement.setAttribute('role', toast.type === 'error' ? 'alert' : 'status');
  announcement.setAttribute('aria-live', toast.type === 'error' ? 'assertive' : 'polite');
  announcement.className = 'sr-only';
  announcement.textContent = `${toast.type}: ${toast.title}${toast.description ? `. ${toast.description}` : ''}`;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};
```

---

## UI Structure

### Toast Layout

```
+--------------------------------------------------------------+
|  [Icon]  Title text here                         [X Close]   |
|          Description text goes here if provided              |
|                                              [Action Button] |
|  [========= Progress Bar (optional) =========]               |
+--------------------------------------------------------------+
```

### Visual Specifications

| Element | Styling |
|---------|---------|
| Container | `min-width: 320px`, `max-width: 420px`, `padding: 16px`, `bg: #161b22`, `border: 1px solid #30363d`, `border-radius: 6px` |
| Icon | `20px`, positioned left, color varies by type |
| Title | `font-size: 14px`, `font-weight: 500`, `color: #e6edf3` |
| Description | `font-size: 13px`, `font-weight: 400`, `color: #8b949e`, `margin-top: 4px` |
| Close button | `24px` touch target, ghost style, positioned top-right |
| Action button | `height: 28px`, `font-size: 12px`, secondary style |
| Progress bar | `height: 3px`, positioned bottom, color matches type |

### Type-Specific Styling

```typescript
const toastVariants = cva(
  'relative flex items-start gap-3 min-w-[320px] max-w-[420px] p-4 border rounded-[6px] shadow-lg overflow-hidden',
  {
    variants: {
      type: {
        success: [
          'bg-[#161b22] border-[#238636]',
          'text-[#e6edf3]',
          '[&_[data-icon]]:text-[#3fb950]',
          '[&_[data-progress]]:bg-[#3fb950]',
        ],
        error: [
          'bg-[#161b22] border-[#da3633]',
          'text-[#e6edf3]',
          '[&_[data-icon]]:text-[#f85149]',
          '[&_[data-progress]]:bg-[#f85149]',
        ],
        warning: [
          'bg-[#161b22] border-[#9e6a03]',
          'text-[#e6edf3]',
          '[&_[data-icon]]:text-[#d29922]',
          '[&_[data-progress]]:bg-[#d29922]',
        ],
        info: [
          'bg-[#161b22] border-[#1f6feb]',
          'text-[#e6edf3]',
          '[&_[data-icon]]:text-[#58a6ff]',
          '[&_[data-progress]]:bg-[#58a6ff]',
        ],
        loading: [
          'bg-[#161b22] border-[#30363d]',
          'text-[#e6edf3]',
          '[&_[data-icon]]:text-[#8b949e]',
        ],
      },
    },
    defaultVariants: {
      type: 'info',
    },
  }
);
```

### Icons by Type

```typescript
// app/components/ui/toast/toast-icons.tsx
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExclamationTriangleIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons';

const toastIcons: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircledIcon,
  error: CrossCircledIcon,
  warning: ExclamationTriangleIcon,
  info: InfoCircledIcon,
  loading: SpinnerIcon, // Custom animated spinner
};

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
```

---

## Implementation

### Toast Component

```typescript
// app/components/ui/toast/toast.tsx
import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { ToastProps } from './types';
import { toastIcons } from './toast-icons';
import { useToastTimer } from './use-toast-timer';

const toastVariants = cva(
  [
    'group relative flex items-start gap-3',
    'min-w-[320px] max-w-[420px] p-4',
    'bg-[#161b22] border rounded-[6px]',
    'shadow-[0_8px_16px_rgba(0,0,0,0.25)]',
    'pointer-events-auto overflow-hidden',
  ],
  {
    variants: {
      type: {
        success: 'border-[#238636] [&_[data-icon]]:text-[#3fb950]',
        error: 'border-[#da3633] [&_[data-icon]]:text-[#f85149]',
        warning: 'border-[#9e6a03] [&_[data-icon]]:text-[#d29922]',
        info: 'border-[#1f6feb] [&_[data-icon]]:text-[#58a6ff]',
        loading: 'border-[#30363d] [&_[data-icon]]:text-[#8b949e]',
      },
    },
    defaultVariants: {
      type: 'info',
    },
  }
);

interface ToastItemProps extends ToastProps {
  position: ToastPosition;
  onDismiss: (id: string) => void;
  showProgress?: boolean;
}

export function ToastItem({
  id,
  type,
  title,
  description,
  duration = 3000,
  action,
  dismissible = true,
  icon,
  position,
  onDismiss,
  showProgress = false,
}: ToastItemProps) {
  const [isOpen, setIsOpen] = React.useState(true);

  const { pause, resume, isPaused, remainingTime } = useToastTimer(
    duration,
    () => setIsOpen(false)
  );

  const Icon = icon ?? toastIcons[type];
  const ariaAttrs = getAriaAttributes(type);

  return (
    <ToastPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Delay removal to allow exit animation
          setTimeout(() => onDismiss(id), 150);
        }
        setIsOpen(open);
      }}
      duration={duration || Infinity}
      className={cn(
        toastVariants({ type }),
        toastAnimationClasses[position]
      )}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      {...ariaAttrs}
    >
      {/* Icon */}
      <div data-icon className="flex-shrink-0 mt-0.5">
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="text-sm font-medium text-[#e6edf3]">
          {title}
        </ToastPrimitive.Title>

        {description && (
          <ToastPrimitive.Description className="mt-1 text-[13px] text-[#8b949e]">
            {description}
          </ToastPrimitive.Description>
        )}

        {action && (
          <ToastPrimitive.Action
            altText={action.altText ?? action.label}
            asChild
          >
            <button
              onClick={action.onClick}
              className={cn(
                'mt-3 inline-flex items-center justify-center',
                'h-7 px-3 text-xs font-medium',
                'bg-[#21262d] text-[#e6edf3] rounded-[4px]',
                'border border-[#30363d]',
                'hover:bg-[#30363d] hover:border-[#8b949e]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]',
                'transition-colors duration-150'
              )}
            >
              {action.label}
            </button>
          </ToastPrimitive.Action>
        )}
      </div>

      {/* Close Button */}
      {dismissible && (
        <ToastPrimitive.Close
          aria-label="Dismiss notification"
          className={cn(
            'flex-shrink-0 inline-flex items-center justify-center',
            'w-6 h-6 rounded-[4px]',
            'text-[#8b949e] hover:text-[#e6edf3]',
            'hover:bg-[#21262d]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]',
            'transition-colors duration-150',
            'opacity-0 group-hover:opacity-100'
          )}
        >
          <Cross2Icon className="w-4 h-4" />
        </ToastPrimitive.Close>
      )}

      {/* Progress Bar */}
      {showProgress && duration > 0 && (
        <div
          data-progress
          className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#21262d] overflow-hidden"
        >
          <div
            className={cn(
              'h-full transition-[width]',
              isPaused ? 'transition-none' : 'duration-100 linear',
              type === 'success' && 'bg-[#3fb950]',
              type === 'error' && 'bg-[#f85149]',
              type === 'warning' && 'bg-[#d29922]',
              type === 'info' && 'bg-[#58a6ff]',
              type === 'loading' && 'bg-[#8b949e]'
            )}
            style={{ width: `${(remainingTime / duration) * 100}%` }}
          />
        </div>
      )}
    </ToastPrimitive.Root>
  );
}
```

### Toaster Component

```typescript
// app/components/ui/toast/toaster.tsx
import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cn } from '@/lib/utils';
import { ToastContext } from './toast-context';
import { ToastItem } from './toast';
import type { ToasterProps, ToastPosition } from './types';

const viewportPositionClasses: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4 flex-col',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 flex-col items-center',
  'top-right': 'top-4 right-4 flex-col items-end',
  'bottom-left': 'bottom-4 left-4 flex-col-reverse',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 flex-col-reverse items-center',
  'bottom-right': 'bottom-4 right-4 flex-col-reverse items-end',
};

export function Toaster({
  position = 'bottom-right',
  gap = 8,
  className,
}: ToasterProps) {
  const { toasts, removeToast } = React.useContext(ToastContext);

  return (
    <ToastPrimitive.Viewport
      className={cn(
        'fixed z-[100] flex pointer-events-none',
        'max-h-screen w-full p-4',
        'outline-none',
        viewportPositionClasses[position],
        className
      )}
      style={{ gap }}
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          position={position}
          onDismiss={removeToast}
        />
      ))}
    </ToastPrimitive.Viewport>
  );
}
```

### App Root Setup

```typescript
// app/routes/__root.tsx
import { ToastProvider } from '@/components/ui/toast';
import { setToastHandler, useToast } from '@/components/ui/toast';

function RootComponent() {
  return (
    <ToastProvider position="bottom-right" maxVisible={5}>
      <ToastInitializer />
      {/* Rest of app */}
    </ToastProvider>
  );
}

// Initialize standalone toast function
function ToastInitializer() {
  const toast = useToast();

  React.useEffect(() => {
    setToastHandler(toast);
  }, [toast]);

  return null;
}
```

---

## Usage Examples

### Basic Usage

```typescript
import { useToast } from '@/components/ui/toast';

function MyComponent() {
  const toast = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      toast.success('Changes saved');
    } catch (error) {
      toast.error('Failed to save changes', {
        description: error.message,
      });
    }
  };

  return <button onClick={handleSave}>Save</button>;
}
```

### With Action Button

```typescript
const handleDelete = () => {
  const deletedItem = deleteItem(itemId);

  toast.success('Item deleted', {
    description: `"${deletedItem.name}" has been removed.`,
    action: {
      label: 'Undo',
      onClick: () => {
        restoreItem(deletedItem);
        toast.success('Item restored');
      },
    },
    duration: 5000,
  });
};
```

### Promise Toast

```typescript
const handleSubmit = async (data: FormData) => {
  await toast.promise(
    submitForm(data),
    {
      loading: 'Submitting form...',
      success: (result) => `Form submitted! Reference: ${result.id}`,
      error: (err) => `Submission failed: ${err.message}`,
    }
  );
};
```

### Loading with Manual Update

```typescript
const handleUpload = async (file: File) => {
  const toastId = toast.loading('Uploading file...');

  try {
    const result = await uploadFile(file, {
      onProgress: (progress) => {
        toast.update(toastId, {
          title: `Uploading... ${progress}%`,
        });
      },
    });

    toast.update(toastId, {
      type: 'success',
      title: 'Upload complete',
      description: `${file.name} has been uploaded.`,
      duration: 3000,
    });
  } catch (error) {
    toast.update(toastId, {
      type: 'error',
      title: 'Upload failed',
      description: error.message,
      duration: 5000,
    });
  }
};
```

### Outside React Components

```typescript
// In a service or utility file
import { toast } from '@/components/ui/toast';

export async function apiRequest(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      toast.error('Request failed', {
        description: `Status: ${response.status}`,
      });
      throw new Error('Request failed');
    }
    return response.json();
  } catch (error) {
    toast.error('Network error');
    throw error;
  }
}
```

---

## Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  .toast-item {
    animation: none !important;
    transition: opacity 0.01ms !important;
  }
}
```

```typescript
// In component
import { useReducedMotion } from 'motion/react';

function ToastItem(props: ToastItemProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <ToastPrimitive.Root
      className={cn(
        toastVariants({ type: props.type }),
        !shouldReduceMotion && toastAnimationClasses[props.position]
      )}
      // ...
    />
  );
}
```

---

## Testing

### Unit Tests

```typescript
// tests/unit/toast.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '@/components/ui/toast';

function TestComponent() {
  const toast = useToast();

  return (
    <button onClick={() => toast.success('Test toast')}>
      Show Toast
    </button>
  );
}

describe('Toast', () => {
  it('should render toast when triggered', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Toast'));

    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });

  it('should auto-dismiss after duration', async () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Show Toast').click();
    });

    expect(screen.getByText('Test toast')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3500); // 3s duration + 500ms buffer
    });

    expect(screen.queryByText('Test toast')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('should be dismissible via close button', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show Toast'));
    await user.click(screen.getByLabelText('Dismiss notification'));

    expect(screen.queryByText('Test toast')).not.toBeInTheDocument();
  });

  it('should call action callback when action clicked', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    function ActionTest() {
      const toast = useToast();

      return (
        <button
          onClick={() =>
            toast.success('Test', {
              action: { label: 'Undo', onClick: onAction },
            })
          }
        >
          Show
        </button>
      );
    }

    render(
      <ToastProvider>
        <ActionTest />
      </ToastProvider>
    );

    await user.click(screen.getByText('Show'));
    await user.click(screen.getByText('Undo'));

    expect(onAction).toHaveBeenCalled();
  });
});
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Animation System](../implementation/animation-system.md) | Timing tokens and keyframes |
| [Component Patterns](../implementation/component-patterns.md) | Radix integration patterns |
| [Design Tokens](../wireframes/design-tokens.css) | Color and spacing values |
| [Approval Dialog](./approval-dialog.md) | Uses toast for action feedback |
| [Form Inputs](./form-inputs.md) | Validation error toasts |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-17 | Initial specification |
