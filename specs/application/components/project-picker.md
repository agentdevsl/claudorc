# ProjectPicker Component Specification

## Overview

The ProjectPicker is a modal component for browsing, searching, and switching between projects. It provides a command-palette-style interface with keyboard navigation, project search, and quick access to recent projects.

**Related Wireframes:**

- [Project Picker Modal](../wireframes/github-project-picker.html) - Primary design reference
- [New Project Dialog](../wireframes/new-project-dialog.html) - Linked via "New Project" button

---

## Interface Definition

```typescript
// app/components/features/project-picker/types.ts
import type { Result } from '@/lib/utils/result';
import type { Project } from '@/db/schema';

/**
 * Result type for operations that may fail
 */
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Project item displayed in the picker list
 */
export interface ProjectPickerItem {
  id: string;
  name: string;
  path: string;
  icon: ProjectIcon;
  isActive: boolean;
  stats: ProjectStats;
  lastAccessedAt: Date;
}

/**
 * Project icon configuration
 */
export interface ProjectIcon {
  type: 'emoji' | 'initials';
  value: string;
  color: ProjectIconColor;
}

export type ProjectIconColor = 'blue' | 'green' | 'purple' | 'orange' | 'red';

/**
 * Project statistics for display
 */
export interface ProjectStats {
  activeAgents: number;
  totalTasks: number;
}

/**
 * Props for the ProjectPicker component
 */
export interface ProjectPickerProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Currently selected project ID */
  selectedProjectId?: string;
  /** Callback when a project is selected */
  onProjectSelect: (project: ProjectPickerItem) => void;
  /** Callback when "New Project" button is clicked */
  onNewProjectClick: () => void;
  /** Recent projects (shown in "Recent Projects" section) */
  recentProjects: ProjectPickerItem[];
  /** All available projects */
  allProjects: ProjectPickerItem[];
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: Error;
}

/**
 * Internal state for the ProjectPicker component
 */
export interface ProjectPickerState {
  searchQuery: string;
  selectedIndex: number;
  filteredRecent: ProjectPickerItem[];
  filteredAll: ProjectPickerItem[];
}
```

---

## Component Specifications

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `open` | `boolean` | Yes | - | Controls modal visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | - | Called when modal should open/close |
| `selectedProjectId` | `string` | No | - | Currently active project ID |
| `onProjectSelect` | `(project: ProjectPickerItem) => void` | Yes | - | Called when user selects a project |
| `onNewProjectClick` | `() => void` | Yes | - | Called when "New Project" button is clicked |
| `recentProjects` | `ProjectPickerItem[]` | Yes | - | Projects shown in "Recent Projects" section |
| `allProjects` | `ProjectPickerItem[]` | Yes | - | All available projects |
| `isLoading` | `boolean` | No | `false` | Shows loading skeleton when true |
| `error` | `Error` | No | - | Error to display |

### State

| State | Type | Initial Value | Description |
|-------|------|---------------|-------------|
| `searchQuery` | `string` | `''` | Current search input value |
| `selectedIndex` | `number` | `0` | Currently highlighted item index |
| `filteredRecent` | `ProjectPickerItem[]` | `recentProjects` | Filtered recent projects based on search |
| `filteredAll` | `ProjectPickerItem[]` | `allProjects` | Filtered all projects based on search |

### Events

| Event | Trigger | Payload | Description |
|-------|---------|---------|-------------|
| `onOpenChange(false)` | Escape key, backdrop click, close button | `boolean` | Close the modal |
| `onProjectSelect` | Enter key, project click | `ProjectPickerItem` | Select highlighted/clicked project |
| `onNewProjectClick` | "New Project" button click | - | Open new project dialog |

---

## Visual Specifications

### Layout

```
+----------------------------------------------------------+
|  [Modal: max-width 680px, centered]                       |
|                                                           |
|  +------------------------------------------------------+ |
|  | Open Project                              [X] 32x32  | | <- Header
|  +------------------------------------------------------+ |
|  | [Search Icon] Search projects...         [Cmd] [P]   | | <- Search (h:40px)
|  +------------------------------------------------------+ |
|  |                                                      | |
|  | RECENT PROJECTS                                      | | <- Section Header (12px uppercase)
|  |                                                      | |
|  | +--------------------------------------------------+ | |
|  | | [Icon 40x40] AgentPane        [Active] 3 agents  | | | <- Project Item
|  | |              ~/git/claudorc            12 tasks  | | |
|  | +--------------------------------------------------+ | |
|  | | [Icon 40x40] Web App Dashboard                   | | |
|  | |              ~/projects/webapp-dashboard 8 tasks | | |
|  | +--------------------------------------------------+ | |
|  |                                                      | |
|  | ALL PROJECTS                                         | |
|  | ...                                                  | | <- max-height 400px, scrollable
|  +------------------------------------------------------+ |
|  | [Arrow hints] Navigate  Enter Open  Esc Cancel       | | <- Footer
|  |                                     [+ New Project]  | |
|  +------------------------------------------------------+ |
+----------------------------------------------------------+
```

### Dimensions

| Element | Dimension | Value |
|---------|-----------|-------|
| Modal | max-width | `680px` |
| Modal | border-radius | `12px` (radius-lg) |
| Header | padding | `16px 20px` |
| Close button | size | `32px x 32px` |
| Search input | height | `40px` |
| Search input | padding-left | `40px` (for icon) |
| Search icon | size | `16px x 16px` |
| Keyboard hint | font-size | `11px` |
| Project list | max-height | `400px` |
| Project list | overflow-y | `auto` |
| Section header | font-size | `12px` |
| Section header | text-transform | `uppercase` |
| Section header | letter-spacing | `0.02em` |
| Project item | padding | `10px 20px` |
| Project item | gap | `12px` |
| Project icon | size | `40px x 40px` |
| Project icon | border-radius | `6px` |
| Project icon | font-size | `18px` |
| Footer | padding | `12px 20px` |
| New Project button | height | `32px` |

### Colors

| Element | Property | Token |
|---------|----------|-------|
| Modal background | background | `--bg-default` (#161b22) |
| Modal border | border-color | `--border-default` (#30363d) |
| Overlay | background | `rgba(1, 4, 9, 0.8)` |
| Overlay | backdrop-filter | `blur(4px)` |
| Search input background | background | `--bg-canvas` (#0d1117) |
| Search input focus | border-color | `--accent-fg` (#58a6ff) |
| Search input focus | box-shadow | `0 0 0 3px var(--accent-muted)` |
| Project item hover | background | `--bg-subtle` (#1c2128) |
| Project item selected | background | `--accent-muted` (rgba(56, 139, 253, 0.15)) |
| Section header | color | `--fg-muted` (#8b949e) |
| Project name | color | `--fg-default` (#e6edf3) |
| Project path | color | `--fg-subtle` (#6e7681) |
| Project path | font-family | `--font-mono` |
| Active badge | background | `--success-muted` |
| Active badge | color | `--success-fg` (#3fb950) |
| Active badge | border-color | `rgba(46, 160, 67, 0.4)` |
| Status dot | background | `--success-fg` (#3fb950) |
| Footer background | background | `--bg-subtle` (#1c2128) |
| Footer hints | color | `--fg-muted` (#8b949e) |
| New Project button | background | `--success-emphasis` (#238636) |

### Icon Colors

| Color | Background | Foreground |
|-------|------------|------------|
| blue | `--accent-muted` | `--accent-fg` |
| green | `--success-muted` | `--success-fg` |
| purple | `rgba(163, 113, 247, 0.15)` | `--done-fg` (#a371f7) |
| orange | `--attention-muted` | `--attention-fg` |
| red | `--danger-muted` | `--danger-fg` |

### Animations

| Animation | Property | Value |
|-----------|----------|-------|
| Status dot pulse | animation | `pulse 2s ease-in-out infinite` |
| Modal enter | animation | `scale-in 200ms ease-out` |
| Overlay enter | animation | `fade-in 200ms ease-out` |
| Item hover | transition | `background 0.12s` |

```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + P` | Open project picker (global hotkey) |
| `Arrow Up` | Move selection up |
| `Arrow Down` | Move selection down |
| `Enter` | Open selected project |
| `Escape` | Close modal |
| `Tab` | Move focus to "New Project" button |

### Focus Management

1. When modal opens, focus moves to search input (autofocus)
2. Arrow keys navigate within the project list
3. Search input remains focused during keyboard navigation
4. Escape closes modal and returns focus to trigger element
5. Tab moves focus between search input and "New Project" button

---

## Business Rules

### Search Behavior

1. Search is case-insensitive
2. Search matches against project `name` and `path`
3. Search filters both "Recent Projects" and "All Projects" sections
4. Empty search shows all projects
5. Search debounce: 150ms

### Section Display

1. "Recent Projects" section shows projects sorted by `lastAccessedAt` (descending)
2. "Recent Projects" limited to 5 most recent
3. "All Projects" section shows remaining projects sorted alphabetically by name
4. Empty sections are hidden (not shown with "No projects" message)
5. If no projects match search, show "No projects found" message

### Active Project Indicator

1. Only one project can be "active" at a time
2. Active project shows "Active" badge
3. Active project shows pulsing status dot with agent count
4. Active project is always pre-selected when modal opens

### Selection Behavior

1. Clicking a project item selects and closes modal
2. Pressing Enter on highlighted item selects and closes modal
3. Selection triggers `onProjectSelect` callback
4. Selection should close modal after callback completes

---

## Implementation Outline

```typescript
// app/components/features/project-picker/project-picker.tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { useHotkeys } from '@/lib/hooks/use-hotkeys';
import type { ProjectPickerProps, ProjectPickerItem } from './types';

export function ProjectPicker({
  open,
  onOpenChange,
  selectedProjectId,
  onProjectSelect,
  onNewProjectClick,
  recentProjects,
  allProjects,
  isLoading = false,
  error,
}: ProjectPickerProps) {
  // State
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Derived state: filtered projects
  const filteredRecent = React.useMemo(() => {
    if (!searchQuery.trim()) return recentProjects;
    const query = searchQuery.toLowerCase();
    return recentProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query)
    );
  }, [recentProjects, searchQuery]);

  const filteredAll = React.useMemo(() => {
    if (!searchQuery.trim()) return allProjects;
    const query = searchQuery.toLowerCase();
    return allProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query)
    );
  }, [allProjects, searchQuery]);

  // Combined list for keyboard navigation
  const allItems = React.useMemo(
    () => [...filteredRecent, ...filteredAll],
    [filteredRecent, filteredAll]
  );

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setSearchQuery('');
      // Pre-select active project
      const activeIndex = allItems.findIndex((p) => p.id === selectedProjectId);
      setSelectedIndex(activeIndex >= 0 ? activeIndex : 0);
      // Focus search input
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open, selectedProjectId, allItems]);

  // Keyboard navigation
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          event.preventDefault();
          const selected = allItems[selectedIndex];
          if (selected) {
            onProjectSelect(selected);
            onOpenChange(false);
          }
          break;
        case 'Escape':
          event.preventDefault();
          onOpenChange(false);
          break;
      }
    },
    [allItems, selectedIndex, onProjectSelect, onOpenChange]
  );

  // Handle project click
  const handleProjectClick = React.useCallback(
    (project: ProjectPickerItem) => {
      onProjectSelect(project);
      onOpenChange(false);
    },
    [onProjectSelect, onOpenChange]
  );

  // Handle new project click
  const handleNewProjectClick = React.useCallback(() => {
    onOpenChange(false);
    onNewProjectClick();
  }, [onOpenChange, onNewProjectClick]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50',
            'bg-[rgba(1,4,9,0.8)] backdrop-blur-[4px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 w-full max-w-[680px]',
            'translate-x-[-50%] translate-y-[-50%]',
            'bg-[#161b22] border border-[#30363d] rounded-[12px]',
            'shadow-[0_12px_48px_rgba(1,4,9,0.5)]',
            'overflow-hidden',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200'
          )}
          onKeyDown={handleKeyDown}
        >
          {/* Header */}
          <ProjectPickerHeader onClose={() => onOpenChange(false)} />

          {/* Search */}
          <ProjectPickerSearch
            ref={searchInputRef}
            value={searchQuery}
            onChange={setSearchQuery}
          />

          {/* Project List */}
          <ProjectPickerList
            recentProjects={filteredRecent}
            allProjects={filteredAll}
            selectedIndex={selectedIndex}
            onProjectClick={handleProjectClick}
            isLoading={isLoading}
            error={error}
          />

          {/* Footer */}
          <ProjectPickerFooter onNewProjectClick={handleNewProjectClick} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

### Sub-components

```typescript
// app/components/features/project-picker/project-picker-header.tsx
export function ProjectPickerHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#30363d]">
      <DialogPrimitive.Title className="text-base font-semibold text-[#e6edf3]">
        Open Project
      </DialogPrimitive.Title>
      <button
        onClick={onClose}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-[6px]',
          'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]',
          'transition-all duration-[0.12s]'
        )}
      >
        <XIcon className="w-5 h-5" />
      </button>
    </div>
  );
}

// app/components/features/project-picker/project-picker-search.tsx
export const ProjectPickerSearch = React.forwardRef<
  HTMLInputElement,
  { value: string; onChange: (value: string) => void }
>(({ value, onChange }, ref) => {
  return (
    <div className="px-5 py-3 border-b border-[#21262d]">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7681]" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search projects..."
          className={cn(
            'w-full h-10 pl-10 pr-16',
            'bg-[#0d1117] border border-[#30363d] rounded-[6px]',
            'text-sm text-[#e6edf3] placeholder:text-[#6e7681]',
            'outline-none transition-all duration-[0.12s]',
            'focus:border-[#58a6ff] focus:shadow-[0_0_0_3px_rgba(56,139,253,0.15)]'
          )}
          autoFocus
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
          <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[11px] font-mono text-[#6e7681]">
            Cmd
          </kbd>
          <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[11px] font-mono text-[#6e7681]">
            P
          </kbd>
        </div>
      </div>
    </div>
  );
});

// app/components/features/project-picker/project-picker-item.tsx
export function ProjectPickerItem({
  project,
  isSelected,
  onClick,
}: {
  project: ProjectPickerItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const iconColorClasses: Record<ProjectIconColor, string> = {
    blue: 'bg-[rgba(56,139,253,0.15)] text-[#58a6ff]',
    green: 'bg-[rgba(46,160,67,0.15)] text-[#3fb950]',
    purple: 'bg-[rgba(163,113,247,0.15)] text-[#a371f7]',
    orange: 'bg-[rgba(187,128,9,0.15)] text-[#d29922]',
    red: 'bg-[rgba(248,81,73,0.15)] text-[#f85149]',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-5 py-2.5 cursor-pointer',
        'transition-[background] duration-[0.12s]',
        isSelected ? 'bg-[rgba(56,139,253,0.15)]' : 'hover:bg-[#1c2128]'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-[6px]',
          'text-lg font-semibold flex-shrink-0',
          iconColorClasses[project.icon.color]
        )}
      >
        {project.icon.value}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-medium text-[#e6edf3]">
          {project.name}
          {project.isActive && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-[10px] bg-[rgba(46,160,67,0.15)] text-[#3fb950] border border-[rgba(46,160,67,0.4)]">
              Active
            </span>
          )}
        </div>
        <div className="text-xs font-mono text-[#6e7681] truncate">
          {project.path}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {project.isActive && project.stats.activeAgents > 0 && (
          <div className="flex items-center gap-1 text-xs text-[#3fb950]">
            <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
            <span>{project.stats.activeAgents} agents</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-[#8b949e]">
          <ClipboardIcon className="w-3.5 h-3.5" />
          <span>{project.stats.totalTasks} tasks</span>
        </div>
      </div>
    </div>
  );
}

// app/components/features/project-picker/project-picker-footer.tsx
export function ProjectPickerFooter({
  onNewProjectClick,
}: {
  onNewProjectClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-[#30363d] bg-[#1c2128]">
      <div className="flex items-center gap-4 text-xs text-[#8b949e]">
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[11px] font-mono">
            Arrow Up/Down
          </kbd>
          <span>Navigate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[11px] font-mono">
            Enter
          </kbd>
          <span>Open</span>
        </div>
        <div className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[11px] font-mono">
            esc
          </kbd>
          <span>Cancel</span>
        </div>
      </div>
      <button
        onClick={onNewProjectClick}
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-3',
          'text-xs font-medium text-white',
          'bg-[#238636] border border-[rgba(240,246,252,0.1)] rounded-[6px]',
          'hover:bg-[#2ea043] transition-all duration-[0.12s]'
        )}
      >
        <PlusIcon className="w-3.5 h-3.5" />
        New Project
      </button>
    </div>
  );
}
```

---

## Hook: useProjectPicker

```typescript
// app/lib/hooks/use-project-picker.ts
import * as React from 'react';
import { useHotkeys } from '@/lib/hooks/use-hotkeys';
import { projectService } from '@/lib/services/project-service';
import type { ProjectPickerItem } from '@/components/features/project-picker/types';

export function useProjectPicker() {
  const [open, setOpen] = React.useState(false);
  const [recentProjects, setRecentProjects] = React.useState<ProjectPickerItem[]>([]);
  const [allProjects, setAllProjects] = React.useState<ProjectPickerItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | undefined>();

  // Global hotkey: Cmd+P
  useHotkeys('mod+p', (e) => {
    e.preventDefault();
    setOpen(true);
  });

  // Load projects
  React.useEffect(() => {
    async function loadProjects() {
      setIsLoading(true);
      const result = await projectService.list({ orderBy: 'updatedAt', orderDirection: 'desc' });

      if (result.ok) {
        const projects = result.value.map(mapProjectToPickerItem);
        setRecentProjects(projects.slice(0, 5));
        setAllProjects(projects.slice(5));
        setError(undefined);
      } else {
        setError(result.error);
      }

      setIsLoading(false);
    }

    if (open) {
      loadProjects();
    }
  }, [open]);

  return {
    open,
    setOpen,
    recentProjects,
    allProjects,
    isLoading,
    error,
  };
}

function mapProjectToPickerItem(project: Project): ProjectPickerItem {
  return {
    id: project.id,
    name: project.name,
    path: project.path,
    icon: {
      type: 'initials',
      value: project.name.slice(0, 2).toUpperCase(),
      color: 'green', // Could be stored in project.config
    },
    isActive: false, // Determined by active session context
    stats: {
      activeAgents: 0, // Fetched from agent service
      totalTasks: 0, // Fetched from task service
    },
    lastAccessedAt: project.updatedAt,
  };
}
```

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Focus trap | Modal traps focus within when open |
| Keyboard navigation | Arrow keys, Enter, Escape supported |
| Screen reader | Radix Dialog provides ARIA labels |
| Focus visible | Focus ring on interactive elements |
| Close on backdrop | Click outside closes modal |
| Return focus | Focus returns to trigger on close |

---

## Error States

| State | Display |
|-------|---------|
| Loading | Skeleton placeholders in list |
| No projects | "No projects yet. Create your first project." |
| No search results | "No projects found matching '[query]'" |
| Error loading | Error message with retry button |

---

## Testing Considerations

### Unit Tests

```typescript
describe('ProjectPicker', () => {
  it('should open when Cmd+P is pressed');
  it('should close when Escape is pressed');
  it('should filter projects based on search query');
  it('should navigate with arrow keys');
  it('should select project on Enter');
  it('should call onProjectSelect when clicking a project');
  it('should show Active badge for active project');
  it('should pre-select active project when opening');
  it('should focus search input on open');
});
```

### Integration Tests

```typescript
describe('ProjectPicker Integration', () => {
  it('should load projects from service on open');
  it('should switch active project on selection');
  it('should open New Project dialog when button clicked');
  it('should maintain keyboard navigation with filtered results');
});
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Project Service](../services/project-service.md) | Data source for project list |
| [Database Schema](../database/schema.md) | Project table structure |
| [Component Patterns](../implementation/component-patterns.md) | Dialog and button patterns |
| [Animation System](../implementation/animation-system.md) | Pulse and transition animations |
| [New Project Dialog](./new-project-dialog.md) | Linked component (not yet created) |
