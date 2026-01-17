# Mobile Responsive Specification

AgentPane mobile-first responsive design system. This specification defines how layouts, components, and interactions adapt across device sizes to provide an optimal experience on mobile, tablet, and desktop.

**Reference Documents:**
- [Mobile Responsive Wireframe](../wireframes/mobile-responsive.html) - Visual reference
- [Design Tokens](../wireframes/design-tokens.css) - CSS custom properties
- [Component Patterns](./component-patterns.md) - UI component implementations
- [Animation System](./animation-system.md) - Motion specifications

---

## Table of Contents

1. [Responsive Strategy](#1-responsive-strategy)
2. [Layout Adaptations](#2-layout-adaptations)
3. [Touch Interactions](#3-touch-interactions)
4. [Typography Scaling](#4-typography-scaling)
5. [Component Adaptations](#5-component-adaptations)
6. [Navigation Patterns](#6-navigation-patterns)
7. [Performance Considerations](#7-performance-considerations)
8. [CSS Implementation](#8-css-implementation)
9. [Testing](#9-testing)
10. [Accessibility on Mobile](#10-accessibility-on-mobile)

---

## 1. Responsive Strategy

### Approach: Mobile-First

AgentPane uses a **mobile-first** responsive design strategy. Base styles target mobile devices, with progressive enhancement for larger screens via `min-width` media queries.

```css
/* Mobile-first: Base styles apply to mobile */
.component {
  padding: 16px;
  width: 100%;
}

/* Tablet and up */
@media (min-width: 768px) {
  .component {
    padding: 24px;
    width: auto;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .component {
    padding: 32px;
  }
}
```

### Breakpoint Definitions

| Breakpoint | Width | Tailwind Prefix | Device Type | Viewport Meta |
|------------|-------|-----------------|-------------|---------------|
| `xs` | 0 - 639px | (default) | Mobile phones | `width=device-width, initial-scale=1.0` |
| `sm` | 640px | `sm:` | Large phones, small tablets | |
| `md` | 768px | `md:` | Tablets (portrait) | |
| `lg` | 1024px | `lg:` | Tablets (landscape), laptops | |
| `xl` | 1280px | `xl:` | Desktops | |
| `2xl` | 1536px | `2xl:` | Large desktops | |

### Container Max-Widths

```css
:root {
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1400px;
}
```

| Breakpoint | Container Width | Content Padding |
|------------|-----------------|-----------------|
| Mobile (xs) | 100% | 16px |
| Small (sm) | 100% | 16px |
| Medium (md) | 100% | 24px |
| Large (lg) | 1024px (centered) | 24px |
| X-Large (xl) | 1280px (centered) | 32px |
| 2X-Large (2xl) | 1400px (centered) | 32px |

### Viewport Configuration

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

- `width=device-width`: Match device width
- `initial-scale=1.0`: No initial zoom
- `viewport-fit=cover`: Extend to notch/safe areas on iOS

---

## 2. Layout Adaptations

### 2a. Sidebar Navigation

| Screen Size | Layout | Behavior |
|-------------|--------|----------|
| Mobile (< 768px) | Hidden by default | Hamburger menu toggles slide-in drawer |
| Tablet (768px - 1023px) | Collapsible | Icon-only mode (52px width), expand on hover |
| Desktop (>= 1024px) | Fixed visible | 240px fixed sidebar, always visible |

#### Mobile Sidebar (Drawer)

```typescript
// Sidebar state hook
interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
}

// Mobile: Drawer overlay
<div className={cn(
  "fixed inset-y-0 left-0 z-50 w-[280px]",
  "bg-bg-default border-r border-border-default",
  "transform transition-transform duration-300 ease-out",
  isOpen ? "translate-x-0" : "-translate-x-full",
  "lg:relative lg:translate-x-0"
)}>
```

**Drawer Specifications:**
- Width: 280px
- Background: `--bg-default` (#161b22)
- Border: `1px solid --border-default` (#30363d)
- Animation: 300ms slide with `ease-out`
- Overlay: `rgba(0, 0, 0, 0.5)` backdrop

#### Tablet Sidebar (Collapsed)

```typescript
// Collapsed icon-only mode
<aside className={cn(
  "fixed left-0 h-full border-r border-border-default",
  isCollapsed ? "w-[52px]" : "w-[240px]",
  "transition-width duration-200"
)}>
  <NavItem collapsed={isCollapsed}>
    <Icon className="w-5 h-5" />
    {!isCollapsed && <span>Projects</span>}
  </NavItem>
</aside>
```

**Collapsed Mode Specifications:**
- Width: 52px (icon only)
- Expanded width: 240px
- Icon size: 20px
- Transition: 200ms width animation
- Hover: Expand tooltip with label

#### Desktop Sidebar (Fixed)

```typescript
// Desktop: Always visible
<aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:fixed lg:inset-y-0">
  {/* Full sidebar content */}
</aside>
<main className="lg:pl-[240px]">
  {/* Main content offset by sidebar */}
</main>
```

### 2b. Kanban Board

| Screen Size | Layout | Columns | Interaction |
|-------------|--------|---------|-------------|
| Mobile (< 640px) | Single column stacked | 1 | Vertical scroll, column tabs |
| Tablet (640px - 1023px) | Horizontal scroll | 2-3 visible | Horizontal swipe/scroll |
| Desktop (>= 1024px) | Side-by-side | 4 columns | Drag-and-drop |

#### Mobile Kanban (Single Column)

```typescript
// Mobile: Tab-based column selection
const [activeColumn, setActiveColumn] = useState<TaskColumn>('backlog');

// Column tabs
<div className="flex border-b border-border-default sticky top-0 bg-bg-canvas z-10">
  {COLUMN_ORDER.map((column) => (
    <button
      key={column}
      onClick={() => setActiveColumn(column)}
      className={cn(
        "flex-1 py-3 text-sm font-medium",
        activeColumn === column
          ? "border-b-2 border-accent-fg text-fg-default"
          : "text-fg-muted"
      )}
    >
      {COLUMN_CONFIG[column].title}
      <span className="ml-1 text-xs">({getColumnCount(column)})</span>
    </button>
  ))}
</div>

// Stacked cards for active column
<div className="flex flex-col gap-3 p-4">
  {tasksByColumn[activeColumn].map((task) => (
    <MobileKanbanCard key={task.id} task={task} />
  ))}
</div>
```

**Mobile Card Specifications:**
- Full-width cards
- Min-height: 88px
- Padding: 12px
- Gap between cards: 12px
- Touch target: Entire card tappable

#### Tablet Kanban (Horizontal Scroll)

```typescript
// Tablet: Horizontal scroll with 2-3 visible columns
<div className="flex gap-4 overflow-x-auto snap-x snap-mandatory p-4">
  {COLUMN_ORDER.map((column) => (
    <div
      key={column}
      className="flex-shrink-0 w-[280px] snap-start"
    >
      <KanbanColumn column={column} tasks={tasksByColumn[column]} />
    </div>
  ))}
</div>
```

**Tablet Layout Specifications:**
- Column width: 280px fixed
- Snap scroll: `snap-x snap-mandatory`
- Column snap: `snap-start`
- Gap: 16px between columns
- Padding: 16px container padding

#### Desktop Kanban (Grid)

```typescript
// Desktop: Full 4-column grid
<div className="grid grid-cols-4 gap-4 p-5">
  {COLUMN_ORDER.map((column) => (
    <KanbanColumn key={column} column={column} tasks={tasksByColumn[column]} />
  ))}
</div>
```

### 2c. Task Detail Dialog

| Screen Size | Layout | Entry Animation | Exit Animation |
|-------------|--------|-----------------|----------------|
| Mobile (< 768px) | Full-screen panel | Slide up from bottom | Slide down |
| Tablet (768px - 1023px) | Side panel (480px) | Slide in from right | Slide out right |
| Desktop (>= 1024px) | Centered modal (560px) | Scale + fade in | Scale + fade out |

#### Mobile Task Sheet (Full Screen)

```typescript
// Mobile: Full-screen bottom sheet
<DialogPrimitive.Content
  className={cn(
    // Mobile: Full screen
    "fixed inset-0 z-50",
    "bg-bg-canvas",
    "flex flex-col",
    // Animation
    "data-[state=open]:animate-slide-in-from-bottom",
    "data-[state=closed]:animate-slide-out-to-bottom",
    "duration-300",
    // Tablet+: Restore modal behavior
    "md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
    "md:max-w-[560px] md:max-h-[90vh] md:rounded-xl"
  )}
>
  {/* Header with close button */}
  <div className="flex items-center justify-between p-4 border-b border-border-default">
    <button onClick={onClose} className="p-2 -ml-2">
      <ChevronLeftIcon className="w-6 h-6" />
    </button>
    <span className="font-semibold">Task Details</span>
    <div className="w-10" /> {/* Spacer for centering */}
  </div>

  {/* Scrollable content */}
  <div className="flex-1 overflow-y-auto">
    {/* Task content */}
  </div>

  {/* Fixed action buttons */}
  <div className="sticky bottom-0 p-4 bg-bg-default border-t border-border-default">
    <div className="flex flex-col gap-3">
      {actions.map((action) => (
        <Button key={action.id} className="w-full h-11">
          {action.label}
        </Button>
      ))}
    </div>
  </div>
</DialogPrimitive.Content>
```

**Mobile Sheet Specifications:**
- Full viewport height
- Header: 56px fixed
- Content: Scrollable
- Footer: Sticky action buttons
- Safe area padding: `env(safe-area-inset-bottom)`

#### Animation Keyframes

```css
@keyframes slide-in-from-bottom {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes slide-out-to-bottom {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(100%);
  }
}

@keyframes slide-in-from-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

### 2d. Agent Session View

| Screen Size | Layout | Stream Panel | Activity Panel |
|-------------|--------|--------------|----------------|
| Mobile (< 768px) | Tabbed view | Tab 1: Stream | Tab 2: Activity |
| Tablet (768px - 1023px) | Stacked | Full-width stream | Collapsible activity drawer |
| Desktop (>= 1024px) | Split view | Main panel (flex-1) | Fixed sidebar (320px) |

#### Mobile Session View (Tabbed)

```typescript
// Mobile: Tabbed interface
const [activeTab, setActiveTab] = useState<'stream' | 'activity'>('stream');

<div className="flex flex-col h-full">
  {/* Tab bar */}
  <div className="flex border-b border-border-default">
    <button
      onClick={() => setActiveTab('stream')}
      className={cn(
        "flex-1 py-3 text-sm font-medium",
        activeTab === 'stream' ? "border-b-2 border-accent-fg" : ""
      )}
    >
      Stream
    </button>
    <button
      onClick={() => setActiveTab('activity')}
      className={cn(
        "flex-1 py-3 text-sm font-medium relative",
        activeTab === 'activity' ? "border-b-2 border-accent-fg" : ""
      )}
    >
      Activity
      {unreadCount > 0 && (
        <span className="absolute top-2 right-4 w-2 h-2 bg-danger-fg rounded-full" />
      )}
    </button>
  </div>

  {/* Tab content */}
  <div className="flex-1 overflow-hidden">
    {activeTab === 'stream' ? (
      <AgentStreamPanel lines={streamLines} />
    ) : (
      <ActivitySidebar items={activityItems} />
    )}
  </div>

  {/* Input always visible */}
  <InputArea onSubmit={sendInput} />
</div>
```

#### Desktop Session View (Split)

```typescript
// Desktop: Side-by-side layout
<div className="grid grid-cols-[1fr_320px] h-full">
  <div className="flex flex-col">
    <AgentStreamPanel lines={streamLines} />
    <InputArea onSubmit={sendInput} />
  </div>
  <ActivitySidebar items={activityItems} />
</div>
```

### 2e. Project Picker

| Screen Size | Layout | Animation |
|-------------|--------|-----------|
| Mobile (< 768px) | Full-screen overlay | Slide up from bottom |
| Tablet+ (>= 768px) | Centered modal (680px) | Scale + fade in |

#### Mobile Project Picker

```typescript
<DialogPrimitive.Content
  className={cn(
    // Mobile: Full screen
    "fixed inset-0 z-50 bg-bg-default",
    "flex flex-col",
    // Tablet+: Centered modal
    "md:inset-auto md:left-1/2 md:top-1/2",
    "md:-translate-x-1/2 md:-translate-y-1/2",
    "md:max-w-[680px] md:max-h-[80vh]",
    "md:rounded-xl md:border md:border-border-default"
  )}
>
  {/* Search header */}
  <div className="sticky top-0 bg-bg-default border-b border-border-default p-4">
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        className="w-full h-11 pl-10 pr-4 rounded-md bg-bg-canvas border border-border-default"
        placeholder="Search projects..."
        autoFocus
      />
    </div>
  </div>

  {/* Project list */}
  <div className="flex-1 overflow-y-auto">
    {/* Project items */}
  </div>

  {/* New project button */}
  <div className="sticky bottom-0 p-4 bg-bg-subtle border-t border-border-default">
    <Button className="w-full h-11" variant="success">
      <PlusIcon /> New Project
    </Button>
  </div>
</DialogPrimitive.Content>
```

---

## 3. Touch Interactions

### Minimum Tap Target Size

All interactive elements must meet minimum touch target requirements:

| Element | Minimum Size | Padding/Hit Area |
|---------|--------------|------------------|
| Buttons | 44px x 44px | Include padding in calculation |
| Icon buttons | 40px x 40px | 8px tap margin around icon |
| List items | 44px height | Full-width tappable |
| Form inputs | 44px height | Full touch target |
| Navigation items | 56px height | Full-width tappable |

```css
/* Touch-friendly button */
.btn-touch {
  min-height: 44px;
  padding: 12px 16px;
  touch-action: manipulation; /* Prevent double-tap zoom */
}

/* Touch-friendly icon button */
.icon-btn-touch {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Swipe Gestures

#### Kanban Card Swipe Actions

```typescript
// Swipe actions for mobile kanban cards
interface SwipeAction {
  direction: 'left' | 'right';
  threshold: number; // Percentage of card width
  action: () => void;
  color: string;
  icon: React.ReactNode;
  label: string;
}

const CARD_SWIPE_ACTIONS: SwipeAction[] = [
  {
    direction: 'right',
    threshold: 0.3, // 30% of card width
    action: () => moveToNextColumn(),
    color: 'var(--success-fg)',
    icon: <CheckIcon />,
    label: 'Advance',
  },
  {
    direction: 'left',
    threshold: 0.3,
    action: () => openQuickActions(),
    color: 'var(--accent-fg)',
    icon: <MoreIcon />,
    label: 'Actions',
  },
];
```

**Swipe Specifications:**
- Threshold: 30% of card width
- Velocity threshold: 0.5 (pixels/ms)
- Haptic feedback: Light vibration on threshold reach
- Visual feedback: Color reveal behind card

#### Navigation Drawer Gestures

```typescript
// Gesture hook for drawer
function useDrawerGesture(onOpen: () => void, onClose: () => void) {
  const EDGE_THRESHOLD = 20; // px from left edge
  const SWIPE_THRESHOLD = 100; // px to complete swipe

  return {
    onTouchStart: (e: TouchEvent) => {
      if (e.touches[0].clientX < EDGE_THRESHOLD) {
        startEdgeSwipe(e);
      }
    },
    onTouchMove: handleSwipeProgress,
    onTouchEnd: (e: TouchEvent) => {
      if (swipeDistance > SWIPE_THRESHOLD) {
        onOpen();
      } else {
        snapBack();
      }
    },
  };
}
```

### Pull-to-Refresh Pattern

```typescript
// Pull-to-refresh for task lists
function usePullToRefresh(onRefresh: () => Promise<void>) {
  const PULL_THRESHOLD = 80; // px
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchMove = (e: TouchEvent) => {
    if (scrollTop === 0 && e.touches[0].clientY > startY) {
      const distance = Math.min(e.touches[0].clientY - startY, PULL_THRESHOLD * 1.5);
      setPullDistance(distance);
      setIsPulling(distance >= PULL_THRESHOLD);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
    setIsPulling(false);
  };

  return { pullDistance, isPulling, isRefreshing };
}
```

**Pull-to-Refresh Specifications:**
- Pull threshold: 80px
- Max overscroll: 120px
- Spinner appears at: 60px
- Refresh indicator: Loading spinner with subtle bounce

### Long-Press for Context Menus

```typescript
// Long-press hook
function useLongPress(
  onLongPress: () => void,
  options?: { delay?: number; onStart?: () => void; onCancel?: () => void }
) {
  const { delay = 500, onStart, onCancel } = options ?? {};
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    onStart?.();

    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      onLongPress();
    }, delay);
  }, [delay, onLongPress, onStart]);

  const cancel = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (!isLongPressRef.current) {
      onCancel?.();
    }
  }, [onCancel]);

  return {
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel, // Cancel if finger moves
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
  };
}
```

**Long-Press Specifications:**
- Delay: 500ms
- Haptic feedback: 50ms vibration
- Visual feedback: Scale down to 0.98 during press
- Cancel on move: Any finger movement cancels

---

## 4. Typography Scaling

### Responsive Font Sizes

Typography scales smoothly using CSS `clamp()` for fluid sizing:

```css
:root {
  /* Mobile-first base sizes with fluid scaling */
  --font-xs: clamp(11px, 2vw, 12px);
  --font-sm: clamp(12px, 2.5vw, 13px);
  --font-base: clamp(13px, 3vw, 14px);
  --font-lg: clamp(15px, 3.5vw, 16px);
  --font-xl: clamp(18px, 4vw, 20px);
  --font-2xl: clamp(20px, 5vw, 24px);
  --font-3xl: clamp(24px, 6vw, 32px);
}
```

| Size Token | Mobile (360px) | Desktop (1200px) | Use Case |
|------------|----------------|------------------|----------|
| `--font-xs` | 11px | 12px | Labels, badges, metadata |
| `--font-sm` | 12px | 13px | Secondary text, timestamps |
| `--font-base` | 13px | 14px | Body text, cards |
| `--font-lg` | 15px | 16px | Emphasized text, headers |
| `--font-xl` | 18px | 20px | Section titles |
| `--font-2xl` | 20px | 24px | Page titles |
| `--font-3xl` | 24px | 32px | Hero headings |

### Line Height Adjustments

```css
:root {
  --leading-tight: 1.25;   /* Headings */
  --leading-normal: 1.5;   /* Body text */
  --leading-relaxed: 1.625; /* Long-form content */

  /* Mobile-specific adjustments for readability */
  --leading-mobile-body: 1.6;  /* Slightly looser on mobile */
}

@media (max-width: 768px) {
  body {
    line-height: var(--leading-mobile-body);
  }
}
```

### Heading Scale for Mobile

```typescript
// Tailwind classes for responsive headings
const headingClasses = {
  h1: "text-2xl md:text-3xl font-semibold leading-tight",
  h2: "text-xl md:text-2xl font-semibold leading-tight",
  h3: "text-lg md:text-xl font-medium leading-snug",
  h4: "text-base md:text-lg font-medium leading-normal",
};
```

### Input Font Size

**Critical:** Input fields must use 16px+ font size on iOS to prevent zoom:

```css
input,
textarea,
select {
  font-size: 16px; /* Prevents iOS zoom on focus */
}

@media (min-width: 768px) {
  input,
  textarea,
  select {
    font-size: 14px; /* Can reduce on tablet+ */
  }
}
```

---

## 5. Component Adaptations

### Button Sizes

| Screen Size | Height | Padding | Font Size |
|-------------|--------|---------|-----------|
| Mobile | 44px | 12px 16px | 14px |
| Tablet | 40px | 10px 16px | 14px |
| Desktop | 36px | 8px 16px | 14px |

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 text-sm md:h-10 lg:h-9",
        lg: "h-11 px-6 text-base",
        touch: "h-11 px-4 text-sm", // Always 44px
      },
    },
  }
);
```

### Form Inputs

```typescript
// Mobile: Full-width inputs with larger touch targets
<div className={cn(
  "space-y-4",
  "sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0"
)}>
  <Input
    className={cn(
      "h-11 text-base", // Mobile: 44px, 16px text
      "md:h-10 md:text-sm" // Tablet+: Smaller
    )}
    placeholder="Enter value..."
  />
</div>
```

**Mobile Input Specifications:**
- Height: 44px minimum
- Font size: 16px (prevents iOS zoom)
- Full width on mobile
- Grid layout on tablet+

### Dropdowns (Bottom Sheet on Mobile)

```typescript
// Select component that becomes bottom sheet on mobile
export function ResponsiveSelect({ children, ...props }: SelectProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return (
      <BottomSheet trigger={<SelectTrigger {...props} />}>
        <div className="py-2">
          {React.Children.map(children, (child) => (
            <div className="px-4 py-3 active:bg-bg-subtle">
              {child}
            </div>
          ))}
        </div>
      </BottomSheet>
    );
  }

  return (
    <Select {...props}>
      {children}
    </Select>
  );
}
```

**Bottom Sheet Specifications:**
- Max height: 60vh
- Border radius (top): 12px
- Handle: 36px x 4px centered, `--fg-muted`
- Animation: Slide up 300ms

### Modals (Full-Screen on Mobile)

```typescript
// Responsive modal hook
function useResponsiveModal() {
  const isMobile = useMediaQuery("(max-width: 767px)");

  return {
    contentClassName: cn(
      // Mobile: Full screen
      isMobile && "fixed inset-0 rounded-none",
      // Tablet+: Centered modal
      !isMobile && "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-lg rounded-xl"
    ),
    overlayClassName: cn(
      isMobile ? "bg-bg-canvas" : "bg-black/50 backdrop-blur-sm"
    ),
    animationClass: cn(
      isMobile
        ? "data-[state=open]:animate-slide-in-from-bottom data-[state=closed]:animate-slide-out-to-bottom"
        : "data-[state=open]:animate-scale-in data-[state=closed]:animate-scale-out"
    ),
  };
}
```

### Tables (Card View on Mobile)

```typescript
// Responsive table that becomes cards on mobile
export function ResponsiveTable<T>({
  data,
  columns
}: {
  data: T[];
  columns: Column<T>[]
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile) {
    return (
      <div className="space-y-3">
        {data.map((row, i) => (
          <div key={i} className="p-4 rounded-md border border-border-default bg-bg-default">
            {columns.map((col) => (
              <div key={col.id} className="flex justify-between py-2 border-b border-border-muted last:border-0">
                <span className="text-sm text-fg-muted">{col.header}</span>
                <span className="text-sm font-medium">{col.accessor(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.id}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.id}>{col.accessor(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 6. Navigation Patterns

### Mobile Navigation Component

```typescript
// Bottom tab navigation for mobile
interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
}

const NAV_ITEMS: BottomNavItem[] = [
  { id: 'projects', label: 'Projects', icon: FolderIcon, href: '/projects' },
  { id: 'agents', label: 'Agents', icon: CpuIcon, href: '/agents' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquareIcon, href: '/tasks' },
  { id: 'queue', label: 'Queue', icon: ClockIcon, href: '/queue' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={cn(
      "fixed bottom-0 inset-x-0 z-50",
      "h-[56px] bg-bg-default border-t border-border-default",
      "flex items-stretch",
      "lg:hidden", // Hide on desktop
      "safe-area-inset-bottom" // iOS safe area
    )}>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1",
              "transition-colors duration-150",
              isActive ? "text-accent-fg" : "text-fg-muted"
            )}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-xs bg-danger-fg text-white rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

**Bottom Nav Specifications:**
- Height: 56px + safe area
- Background: `--bg-default`
- Border: 1px top `--border-default`
- Icon size: 20px
- Label: 12px font-medium
- Active state: `--accent-fg` color

### Back Button Behavior

```typescript
// Smart back button that respects navigation history
function useBackNavigation() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  const goBack = useCallback(() => {
    if (canGoBack) {
      router.back();
    } else {
      // Fallback to parent route
      router.push(getParentRoute());
    }
  }, [canGoBack, router]);

  return { canGoBack, goBack };
}

// Mobile header with back button
<header className="flex items-center h-14 px-4 border-b border-border-default lg:hidden">
  <button onClick={goBack} className="p-2 -ml-2 text-fg-muted">
    <ChevronLeftIcon className="w-6 h-6" />
  </button>
  <h1 className="ml-2 text-lg font-semibold truncate">{title}</h1>
</header>
```

### Breadcrumb Collapse

```typescript
// Collapsible breadcrumbs for mobile
function ResponsiveBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (isMobile && items.length > 2) {
    // Show only first and last with ellipsis
    return (
      <nav className="flex items-center gap-2 text-sm">
        <BreadcrumbLink item={items[0]} />
        <span className="text-fg-muted">/</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="text-fg-muted">...</DropdownMenuTrigger>
          <DropdownMenuContent>
            {items.slice(1, -1).map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href}>{item.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-fg-muted">/</span>
        <span className="text-fg-default font-medium">{items[items.length - 1].label}</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-2 text-sm">
      {items.map((item, i) => (
        <React.Fragment key={item.href}>
          {i > 0 && <span className="text-fg-muted">/</span>}
          {i === items.length - 1 ? (
            <span className="text-fg-default font-medium">{item.label}</span>
          ) : (
            <BreadcrumbLink item={item} />
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
```

### Primary Navigation Tab Bar

```typescript
// Tab bar for primary section navigation
interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function TabBar({
  items,
  activeId,
  onSelect
}: {
  items: TabItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={cn(
      "flex border-b border-border-default",
      "overflow-x-auto scrollbar-hide",
      "-mx-4 px-4", // Extend to edges on mobile
      "md:mx-0 md:px-0"
    )}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap",
            "border-b-2 -mb-px transition-colors",
            item.id === activeId
              ? "border-accent-fg text-fg-default"
              : "border-transparent text-fg-muted hover:text-fg-default"
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={cn(
              "px-1.5 py-0.5 text-xs rounded-full",
              item.id === activeId
                ? "bg-accent-muted text-accent-fg"
                : "bg-bg-muted text-fg-muted"
            )}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

---

## 7. Performance Considerations

### Lazy Loading for Off-Screen Content

```typescript
// Intersection Observer hook for lazy loading
function useLazyLoad<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Load 100px before entering viewport
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// Usage in Kanban columns
function LazyKanbanColumn({ column, tasks }: KanbanColumnProps) {
  const { ref, isVisible } = useLazyLoad<HTMLDivElement>();

  return (
    <div ref={ref} className="min-h-[200px]">
      {isVisible ? (
        <KanbanColumn column={column} tasks={tasks} />
      ) : (
        <ColumnSkeleton />
      )}
    </div>
  );
}
```

### Reduced Animations on Mobile

```css
/* Respect user's motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Reduce animations on mobile for performance */
@media (max-width: 768px) {
  /* Disable staggered animations */
  .stagger-animation > * {
    animation-delay: 0ms !important;
  }

  /* Simplify transitions */
  .complex-transition {
    transition: opacity 150ms ease-out;
    /* Remove transform transitions on mobile */
  }
}
```

```typescript
// Hook to detect reduced motion preference
function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}
```

### Image Optimization

```typescript
// Responsive image component
interface ResponsiveImageProps {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
}

export function ResponsiveImage({ src, alt, sizes, priority }: ResponsiveImageProps) {
  return (
    <picture>
      {/* WebP for modern browsers */}
      <source
        type="image/webp"
        srcSet={`
          ${src}?w=320&f=webp 320w,
          ${src}?w=640&f=webp 640w,
          ${src}?w=1024&f=webp 1024w
        `}
        sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
      />
      {/* Fallback */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="w-full h-auto"
      />
    </picture>
  );
}
```

### Touch Event Optimization

```typescript
// Passive event listeners for scroll performance
useEffect(() => {
  const handleScroll = (e: Event) => {
    // Scroll handling logic
  };

  // Use passive listener for better scroll performance
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: true });

  return () => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('touchmove', handleTouchMove);
  };
}, []);
```

### Virtual Scrolling for Long Lists

```typescript
// Virtual list for large datasets
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualTaskList({ tasks }: { tasks: Task[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88, // Estimated row height
    overscan: 5, // Render 5 extra items above/below viewport
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TaskCard task={tasks[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. CSS Implementation

### Tailwind Responsive Utilities

```typescript
// Common responsive patterns
const responsivePatterns = {
  // Padding that adapts
  contentPadding: "px-4 md:px-6 lg:px-8",

  // Grid that collapses
  grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",

  // Flexbox direction change
  flexStack: "flex flex-col md:flex-row",

  // Show/hide based on breakpoint
  mobileOnly: "md:hidden",
  desktopOnly: "hidden md:block",
  tabletUp: "hidden sm:block",

  // Text size adaptation
  heading: "text-xl md:text-2xl lg:text-3xl",
  body: "text-sm md:text-base",

  // Container centering
  container: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
};
```

### Custom Responsive Hooks

```typescript
// useMediaQuery hook
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// useBreakpoint hook
type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

function useBreakpoint(): Breakpoint {
  const isXl = useMediaQuery('(min-width: 1280px)');
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isMd = useMediaQuery('(min-width: 768px)');
  const isSm = useMediaQuery('(min-width: 640px)');

  if (isXl) return 'xl';
  if (isLg) return 'lg';
  if (isMd) return 'md';
  if (isSm) return 'sm';
  return 'xs';
}

// useIsMobile hook
function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

// useIsTouch hook (detects touch device)
function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  return isTouch;
}
```

### CSS-in-JS Patterns

```typescript
// Responsive style object pattern
const responsiveStyles = {
  container: {
    padding: {
      base: '16px',
      md: '24px',
      lg: '32px',
    },
    maxWidth: {
      base: '100%',
      lg: '1024px',
      xl: '1280px',
    },
  },
};

// CVA with responsive variants
const cardVariants = cva(
  "rounded-md border border-border-default bg-bg-default",
  {
    variants: {
      size: {
        sm: "p-3",
        default: "p-4",
        lg: "p-6",
      },
      responsive: {
        true: "p-3 md:p-4 lg:p-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);
```

### Safe Area Handling (iOS)

```css
/* Safe area insets for notched devices */
.safe-area-inset-top {
  padding-top: env(safe-area-inset-top);
}

.safe-area-inset-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.safe-area-inset-left {
  padding-left: env(safe-area-inset-left);
}

.safe-area-inset-right {
  padding-right: env(safe-area-inset-right);
}

/* Bottom navigation with safe area */
.bottom-nav {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}

/* Full-screen modal with safe areas */
.fullscreen-modal {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## 9. Testing

### Device Testing Matrix

| Device Category | Devices | Screen Sizes | Test Priority |
|-----------------|---------|--------------|---------------|
| iPhone | iPhone 14 Pro, iPhone SE | 390x844, 375x667 | High |
| Android | Pixel 7, Samsung S23 | 412x915, 360x780 | High |
| iPad | iPad Pro 12.9", iPad Mini | 1024x1366, 744x1133 | Medium |
| Android Tablet | Samsung Tab S8 | 800x1280 | Medium |
| Desktop | MacBook Pro, Windows | 1440x900, 1920x1080 | High |

### Viewport Testing in Agent Browser

```typescript
// Agent Browser viewport test configuration
const viewportTests = [
  { name: 'iPhone SE', width: 375, height: 667, deviceScaleFactor: 2 },
  { name: 'iPhone 14 Pro', width: 393, height: 852, deviceScaleFactor: 3 },
  { name: 'iPad', width: 768, height: 1024, deviceScaleFactor: 2 },
  { name: 'Desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
];

// Test example
describe('Responsive Layout', () => {
  for (const viewport of viewportTests) {
    it(`renders correctly on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });

      await page.goto('/tasks');

      if (viewport.width < 768) {
        // Mobile: Bottom nav visible
        await expect(page.locator('[data-testid="bottom-nav"]')).toBeVisible();
        // Mobile: Sidebar hidden
        await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
      } else {
        // Desktop: Sidebar visible
        await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
      }
    });
  }
});
```

### Touch Simulation

```typescript
// Touch event simulation for testing
describe('Touch Interactions', () => {
  it('opens drawer on swipe from edge', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tasks');

    // Simulate edge swipe
    await page.touchscreen.tap(10, 400); // Start near left edge
    await page.mouse.down();
    await page.mouse.move(150, 400, { steps: 10 }); // Swipe right
    await page.mouse.up();

    await expect(page.locator('[data-testid="sidebar-drawer"]')).toBeVisible();
  });

  it('supports long-press on task card', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tasks');

    const card = page.locator('[data-testid="task-card"]').first();

    // Long press simulation
    await card.dispatchEvent('touchstart');
    await page.waitForTimeout(600); // Wait for long-press threshold

    await expect(page.locator('[data-testid="context-menu"]')).toBeVisible();
  });
});
```

### Responsive Component Tests

```typescript
// Component-level responsive tests
describe('KanbanBoard Responsive', () => {
  it('shows tab navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tasks');

    // Tabs visible
    await expect(page.locator('[data-testid="column-tabs"]')).toBeVisible();

    // Only one column visible at a time
    const columns = page.locator('[data-testid="kanban-column"]');
    await expect(columns).toHaveCount(1);
  });

  it('shows all columns side-by-side on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tasks');

    // All 4 columns visible
    const columns = page.locator('[data-testid="kanban-column"]');
    await expect(columns).toHaveCount(4);
  });
});
```

---

## 10. Accessibility on Mobile

### Screen Reader Support

```typescript
// VoiceOver (iOS) and TalkBack (Android) support
const accessibilityLabels = {
  // Navigation
  sidebar: "Main navigation menu",
  bottomNav: "Primary navigation",
  backButton: "Go back to previous page",

  // Actions
  menuButton: "Open menu",
  closeButton: "Close dialog",

  // Status
  loading: "Loading content",
  error: "Error occurred",

  // Dynamic content
  taskCard: (task: Task) => `Task: ${task.title}. Status: ${task.column}. Priority: ${task.priority}`,
  agentStatus: (agent: Agent) => `Agent ${agent.name} is ${agent.status}`,
};

// ARIA live regions for dynamic updates
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>

// Focus management on route change
useEffect(() => {
  const heading = document.querySelector('h1');
  heading?.focus();
}, [pathname]);
```

### Zoom Support

```css
/* Ensure content remains accessible at 200% zoom */
html {
  /* Allow user to zoom */
  touch-action: manipulation;
}

/* Prevent horizontal scroll at zoom levels */
body {
  overflow-x: hidden;
}

/* Flexible containers that adapt to zoom */
.container {
  max-width: 100%;
  padding-inline: clamp(1rem, 5vw, 2rem);
}

/* Text that remains readable at zoom */
.body-text {
  font-size: clamp(14px, 1rem, 18px);
  line-height: 1.5;
}
```

### Landscape Orientation Handling

```typescript
// Orientation-aware components
function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return isLandscape;
}

// Landscape-optimized layout
function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  const isLandscape = useOrientation();
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      "min-h-screen",
      // Landscape on mobile: adjust for keyboard
      isMobile && isLandscape && "landscape:flex landscape:flex-row"
    )}>
      {children}
    </div>
  );
}
```

```css
/* Landscape mode adjustments */
@media (orientation: landscape) and (max-height: 500px) {
  /* Reduce header height on landscape mobile */
  .mobile-header {
    height: 48px;
  }

  /* Reduce bottom nav height */
  .bottom-nav {
    height: 48px;
  }

  /* Optimize input areas for keyboard visible */
  .input-area {
    padding-block: 8px;
  }
}
```

### Focus Indicators

```css
/* Visible focus indicators for all interactive elements */
:focus-visible {
  outline: 2px solid var(--accent-fg);
  outline-offset: 2px;
}

/* Enhanced focus for touch targets */
button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 3px solid var(--accent-fg);
  outline-offset: 2px;
  box-shadow: 0 0 0 6px var(--accent-muted);
}

/* Prevent outline on touch */
@media (hover: none) and (pointer: coarse) {
  :focus:not(:focus-visible) {
    outline: none;
  }
}
```

### Color Contrast Requirements

All text must meet WCAG 2.1 AA standards:

| Element | Foreground | Background | Contrast Ratio |
|---------|------------|------------|----------------|
| Primary text | `--fg-default` (#e6edf3) | `--bg-canvas` (#0d1117) | 13.5:1 |
| Secondary text | `--fg-muted` (#8b949e) | `--bg-canvas` (#0d1117) | 5.8:1 |
| Links | `--accent-fg` (#58a6ff) | `--bg-canvas` (#0d1117) | 7.2:1 |
| Errors | `--danger-fg` (#f85149) | `--bg-canvas` (#0d1117) | 6.1:1 |
| Success | `--success-fg` (#3fb950) | `--bg-canvas` (#0d1117) | 6.5:1 |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Mobile Responsive Wireframe](../wireframes/mobile-responsive.html) | Visual reference implementation |
| [Design Tokens](../wireframes/design-tokens.css) | CSS custom properties |
| [Component Patterns](./component-patterns.md) | Base component implementations |
| [Animation System](./animation-system.md) | Motion specifications |
| [Kanban Board](../components/kanban-board.md) | Kanban responsive behavior |
| [Task Detail Dialog](../components/task-detail-dialog.md) | Dialog responsive modes |
| [Agent Session View](../components/agent-session-view.md) | Session view layouts |
| [Project Picker](../components/project-picker.md) | Picker responsive modes |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-17 | 1.0.0 | Initial specification |
