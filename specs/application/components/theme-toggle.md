# ThemeToggle Component Specification

## Overview

The ThemeToggle component provides a segmented control for switching between light, dark, and system themes. It persists user preference to localStorage and respects OS-level color scheme preferences.

**Related Wireframes:**
- [Theme Toggle](../wireframes/theme-toggle.html) - Segmented control design with all theme states

---

## Interface Definition

```typescript
// app/components/ui/theme-toggle/types.ts

// ===== Theme Values =====
export type Theme = 'light' | 'dark' | 'system';

// ===== Component Props =====
export interface ThemeToggleProps {
  /** Current theme value */
  value?: Theme;
  /** Callback when theme changes */
  onChange?: (theme: Theme) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ===== Theme Context =====
export interface ThemeContextValue {
  /** Current theme setting */
  theme: Theme;
  /** Resolved theme (light or dark, never system) */
  resolvedTheme: 'light' | 'dark';
  /** Set theme */
  setTheme: (theme: Theme) => void;
}
```

---

## Component Specifications

### ThemeToggle

```typescript
// app/components/ui/theme-toggle/index.tsx
export interface ThemeToggleProps {
  value?: Theme;
  onChange?: (theme: Theme) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `Theme` | No | From context | Controlled theme value |
| `onChange` | `(theme: Theme) => void` | No | - | Called when theme changes |
| `size` | `'sm' \| 'md' \| 'lg'` | No | `'md'` | Size variant |
| `disabled` | `boolean` | No | `false` | Disables interaction |
| `className` | `string` | No | - | Additional CSS classes |

---

### Visual Design

```
┌─────────────────────────────────────────┐
│  [☀ Light]  [◐ System]  [☾ Dark]       │
└─────────────────────────────────────────┘
      ↑           ↑           ↑
   Active      Default    Inactive
```

#### Size Variants

| Size | Height | Padding | Font Size | Icon Size |
|------|--------|---------|-----------|-----------|
| `sm` | 28px | 8px 12px | 12px | 14px |
| `md` | 32px | 8px 16px | 14px | 16px |
| `lg` | 40px | 12px 20px | 14px | 18px |

#### Colors

| Element | Light Theme | Dark Theme |
|---------|-------------|------------|
| Container background | `#f6f8fa` | `#21262d` |
| Container border | `#d0d7de` | `#30363d` |
| Active segment bg | `#ffffff` | `#30363d` |
| Active segment text | `#24292f` | `#e6edf3` |
| Inactive text | `#656d76` | `#8b949e` |
| Hover background | `#f3f4f6` | `#30363d` |

#### Segment Design

| Property | Value |
|----------|-------|
| Border radius (container) | 6px |
| Border radius (segment) | 4px |
| Gap between segments | 2px |
| Transition | 150ms ease |
| Active shadow | `0 1px 3px rgba(0,0,0,0.1)` |

---

### Icons

```typescript
// Icon components for each theme option
const icons = {
  light: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
};
```

---

### ThemeProvider

```typescript
// app/providers/theme-provider.tsx
export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'agentpane-theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    return (localStorage.getItem(storageKey) as Theme) ?? defaultTheme;
  });

  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return theme;
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    localStorage.setItem(storageKey, theme);
  }, [theme, resolvedTheme, storageKey]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      // Trigger re-render to update resolvedTheme
      setTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

---

### useTheme Hook

```typescript
// app/hooks/use-theme.ts
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

---

## CSS Custom Properties

```css
/* Design tokens that change based on theme */
:root,
[data-theme="light"] {
  --bg-canvas: #ffffff;
  --bg-default: #f6f8fa;
  --bg-subtle: #f0f3f6;
  --bg-muted: #eaeef2;
  --bg-emphasis: #24292f;
  --border-default: #d0d7de;
  --border-muted: #d8dee4;
  --fg-default: #24292f;
  --fg-muted: #656d76;
  --fg-subtle: #6e7781;
  --accent-fg: #0969da;
  --accent-muted: rgba(9, 105, 218, 0.1);
  --success-fg: #1a7f37;
  --danger-fg: #cf222e;
  --attention-fg: #9a6700;
}

[data-theme="dark"] {
  --bg-canvas: #0d1117;
  --bg-default: #161b22;
  --bg-subtle: #1c2128;
  --bg-muted: #21262d;
  --bg-emphasis: #30363d;
  --border-default: #30363d;
  --border-muted: #21262d;
  --fg-default: #e6edf3;
  --fg-muted: #8b949e;
  --fg-subtle: #6e7681;
  --accent-fg: #58a6ff;
  --accent-muted: rgba(56, 139, 253, 0.15);
  --success-fg: #3fb950;
  --danger-fg: #f85149;
  --attention-fg: #d29922;
}
```

---

## Business Rules

| Rule | Description |
|------|-------------|
| **Persistence** | Theme stored in localStorage with key `agentpane-theme` |
| **System detection** | Uses `prefers-color-scheme` media query |
| **SSR safety** | Defaults to system theme during server render |
| **Flash prevention** | Theme applied via inline script in `<head>` |
| **Real-time sync** | System theme changes reflected immediately |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate between options |
| `Enter` / `Space` | Select focused option |
| `L` | Select light theme (global shortcut) |
| `D` | Select dark theme (global shortcut) |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| Role | `role="radiogroup"` on container |
| ARIA | `aria-checked` on each segment |
| Focus | Visible focus ring on keyboard navigation |
| Label | `aria-label="Theme selection"` |
| Announcements | Screen reader announces theme change |

---

## Implementation Example

```typescript
// app/components/ui/theme-toggle/index.tsx
import { cva } from 'class-variance-authority';
import { useTheme } from '@/hooks/use-theme';

const toggleVariants = cva(
  'inline-flex rounded-md border p-1 transition-colors',
  {
    variants: {
      size: {
        sm: 'gap-0.5',
        md: 'gap-1',
        lg: 'gap-1.5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const segmentVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded font-medium transition-all',
  {
    variants: {
      size: {
        sm: 'h-6 px-2 text-xs',
        md: 'h-7 px-3 text-sm',
        lg: 'h-9 px-4 text-sm',
      },
      active: {
        true: 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm',
        false: 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
      },
    },
    defaultVariants: {
      size: 'md',
      active: false,
    },
  }
);

export function ThemeToggle({ size = 'md', disabled, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: icons.light },
    { value: 'system', label: 'System', icon: icons.system },
    { value: 'dark', label: 'Dark', icon: icons.dark },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className={toggleVariants({ size, className })}
    >
      {options.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={theme === option.value}
          disabled={disabled}
          onClick={() => setTheme(option.value)}
          className={segmentVariants({ size, active: theme === option.value })}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Design Tokens](../wireframes/design-tokens.css) | Color variables |
| [Component Patterns](../implementation/component-patterns.md) | CVA variants |
| [Project Settings](./project-settings.md) | Theme toggle placement |
