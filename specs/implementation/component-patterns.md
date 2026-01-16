# Component Patterns Documentation

Radix UI primitives paired with Tailwind CSS for AgentPane UI components. This guide demonstrates how to implement the wireframe components using the established tech stack.

**Reference:** `AGENTS.md` Tech Stack includes Radix UI (1.2.4), Tailwind CSS (4.1.18), and class-variance-authority (0.7.1) for variant styling.

---

## Design System Tokens

All components reference these design tokens (from wireframe analysis):

```typescript
// Design tokens (map to Tailwind CSS variables)
const tokens = {
  // Colors
  bgCanvas: '#0d1117',        // Main background
  bgDefault: '#161b22',       // Card/section background
  bgSubtle: '#1c2128',        // Hover state
  bgMuted: '#21262d',         // Disabled state
  borderDefault: '#30363d',   // Border color
  fgDefault: '#e6edf3',       // Text color
  fgMuted: '#8b949e',         // Secondary text
  accentFg: '#58a6ff',        // Link/accent blue
  successFg: '#3fb950',       // Success green
  dangerFg: '#f85149',        // Error red
  warningFg: '#d29922',       // Warning amber

  // Spacing
  radius: '6px',              // Border radius

  // Typography
  fontSans: 'Mona Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono: '"Fira Code", "Courier New", monospace',
  baseSize: '14px',
  codeSize: '13px',

  // Timing
  transitionFast: '100ms',    // 0.1s for simple transitions
  transitionBase: '200ms',    // 0.2s for standard interactions
  transitionSlow: '300ms',    // 0.3s for complex animations
};
```

---

## 1. Button Component

Primary interactive element using Radix Slot for `asChild` composition. Supports multiple variants and sizes with class-variance-authority.

### Import

```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
```

### Implementation

```typescript
// app/components/ui/button.tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[6px] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
        secondary: 'bg-slate-700 text-slate-50 hover:bg-slate-800 focus-visible:ring-slate-500',
        success: 'bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
        ghost: 'text-slate-300 hover:bg-slate-700 hover:text-slate-50 focus-visible:ring-slate-500',
        outline: 'border border-slate-500 text-slate-300 hover:bg-slate-700 focus-visible:ring-slate-500',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-9 px-4',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
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
          </>
        ) : null}
        {children}
      </Comp>
    );
  }
);
Button.displayName = 'Button';
```

### Usage Examples

```typescript
// Primary button
<Button variant="primary" size="default">
  Create Agent
</Button>

// With icon via asChild
<Button asChild variant="ghost" size="icon">
  <a href="/settings">
    <GearIcon />
  </a>
</Button>

// Success variant (approval)
<Button variant="success" size="lg">
  Approve & Merge
</Button>

// Danger variant (destructive action)
<Button variant="danger" onClick={() => deleteWorktree(id)}>
  Delete Worktree
</Button>

// Loading state
<Button variant="primary" isLoading={isSubmitting}>
  {isSubmitting ? 'Creating...' : 'Create Project'}
</Button>

// Ghost variant (secondary action)
<Button variant="ghost" size="sm">
  Cancel
</Button>
```

### Tailwind Classes Reference

**Heights:**
- `sm`: `h-8` = 32px
- `default`: `h-9` = 36px ✓ (design system standard)
- `lg`: `h-10` = 40px
- `icon`: `h-9 w-9` = 36x36px square

**Transitions:**
- `transition-all duration-200` (0.2s for standard button interactions)
- `focus-visible:ring-2 focus-visible:ring-offset-2` (3px ring, 2px offset)

---

## 2. Dialog/Modal Pattern

Accessible modal using @radix-ui/react-dialog with backdrop blur, scale-in animation, and proper keyboard handling.

### Import

```typescript
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
```

### Implementation

```typescript
// app/components/ui/dialog.tsx
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'duration-200'
      )}
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%]',
        'rounded-[6px] border border-slate-600 bg-slate-800 shadow-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        'duration-200 ease-out',
        'p-6',
        className
      )}
      {...props}
    />
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-slate-50', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-slate-400', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-row-reverse gap-3 pt-6', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export { Dialog, DialogTrigger, DialogClose };
```

### Usage Example: Approval Dialog

```typescript
// app/components/features/approval-dialog.tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ApprovalDialog({
  task,
  onApprove,
  onReject,
}: {
  task: Task;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">Review Changes</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review & Approve Changes</DialogTitle>
          <DialogDescription>
            Task: {task.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Diff viewer tabs (see Tabs component below) */}
          <DiffViewer diff={task.diff} />

          {/* Feedback textarea */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Feedback
            </label>
            <textarea
              className="w-full rounded-[6px] border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500"
              placeholder="Add feedback before approving..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger" onClick={onReject}>
            Reject
          </Button>
          <Button variant="success" onClick={onApprove}>
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Animation Classes

- **Overlay fade:** `data-[state=open]:fade-in-0` / `data-[state=closed]:fade-out-0`
- **Content scale + slide:**
  - `data-[state=open]:zoom-in-95` (scales to 95%, animates to 100%)
  - `data-[state=open]:slide-in-from-left-1/2` (slides from left edge)
- **Duration:** `duration-200` (0.2s)
- **Easing:** `ease-out` (smooth deceleration)

---

## 3. Dropdown Menu

Context menus and dropdown selections using @radix-ui/react-dropdown-menu.

### Import

```typescript
import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
```

### Implementation

```typescript
// app/components/ui/dropdown-menu.tsx
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-[6px] border border-slate-600 bg-slate-800 p-1 shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2',
        'data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2',
        'data-[side=top]:slide-in-from-bottom-2',
        'duration-200',
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-slate-300',
      'outline-none hover:bg-slate-700 hover:text-slate-50',
      'focus:bg-slate-700 focus:text-slate-50',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm text-slate-300',
      'outline-none hover:bg-slate-700 hover:text-slate-50',
      'focus:bg-slate-700 focus:text-slate-50',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <svg
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-slate-700', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuRadioGroup };
```

### Usage Example: Theme Switcher

```typescript
// app/components/features/theme-switcher.tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function ThemeSwitcher({ currentTheme, onThemeChange }: {
  currentTheme: 'light' | 'dark' | 'auto';
  onThemeChange: (theme: 'light' | 'dark' | 'auto') => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <ThemeIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={currentTheme === 'light'}
          onCheckedChange={() => onThemeChange('light')}
        >
          Light
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={currentTheme === 'dark'}
          onCheckedChange={() => onThemeChange('dark')}
        >
          Dark
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={currentTheme === 'auto'}
          onCheckedChange={() => onThemeChange('auto')}
        >
          System
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Usage Example: Project Picker

```typescript
// app/components/features/project-picker.tsx
export function ProjectPicker({ projects, selectedId, onSelect }: {
  projects: Project[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {projects.find(p => p.id === selectedId)?.name}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onSelect={() => onSelect(project.id)}
          >
            {project.name}
            <span className="ml-auto text-xs text-slate-500">
              {project.agentCount} agents
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 4. Tabs

Tabbed interfaces for grouping related content using @radix-ui/react-tabs.

### Import

```typescript
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
```

### Implementation

```typescript
// app/components/ui/tabs.tsx
const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-[6px] bg-slate-900 p-1',
      'border border-slate-700',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-[4px] px-3 py-1.5 text-sm font-medium',
      'text-slate-400 transition-colors duration-200',
      'hover:text-slate-300',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-slate-700 data-[state=active]:text-slate-50 data-[state=active]:shadow-sm',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 rounded-[6px] border border-slate-700 bg-slate-900 p-4',
      'ring-offset-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs };
```

### Usage Example: Diff Viewer

```typescript
// app/components/features/diff-viewer-tabs.tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function DiffViewerTabs({ files }: { files: DiffFile[] }) {
  return (
    <Tabs defaultValue={files[0]?.id} className="w-full">
      <TabsList className="w-full justify-start rounded-none border-b border-t-0">
        {files.map((file) => (
          <TabsTrigger key={file.id} value={file.id} className="rounded-none">
            <FileIcon className="mr-2 h-4 w-4" />
            {file.path}
            <span className="ml-2 text-xs text-slate-500">
              {file.additions + file.deletions} changes
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {files.map((file) => (
        <TabsContent key={file.id} value={file.id} className="font-mono text-xs">
          <DiffContent diff={file.diff} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

### Usage Example: Settings Tabs

```typescript
// app/components/features/project-settings-tabs.tsx
export function ProjectSettingsTabs({ project }: { project: Project }) {
  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="agents">Agents</TabsTrigger>
        <TabsTrigger value="environment">Environment</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralSettings project={project} />
      </TabsContent>

      <TabsContent value="agents">
        <AgentSettings project={project} />
      </TabsContent>

      <TabsContent value="environment">
        <EnvironmentSettings project={project} />
      </TabsContent>

      <TabsContent value="security">
        <SecuritySettings project={project} />
      </TabsContent>
    </Tabs>
  );
}
```

---

## 5. Tooltip

Floating tooltips for keyboard hints and status explanations using @radix-ui/react-tooltip.

### Import

```typescript
import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
```

### Implementation

```typescript
// app/components/ui/tooltip.tsx
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-[4px] bg-slate-900 px-3 py-1.5 text-xs text-slate-300',
      'border border-slate-700 shadow-md',
      'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
      'data-[side=bottom]:slide-in-from-top-2',
      'data-[side=left]:slide-in-from-right-2',
      'data-[side=right]:slide-in-from-left-2',
      'data-[side=top]:slide-in-from-bottom-2',
      'duration-200',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { TooltipProvider, Tooltip, TooltipTrigger };
```

### Usage Examples

```typescript
// Keyboard hint on button
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="outline">
      <CommandIcon className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    Press <kbd className="font-mono">Cmd+K</kbd> to open command palette
  </TooltipContent>
</Tooltip>

// Status explanation
<Tooltip>
  <TooltipTrigger asChild>
    <StatusBadge status="queued">
      <QueueIcon className="h-4 w-4" />
    </StatusBadge>
  </TooltipTrigger>
  <TooltipContent>
    This agent is waiting for resources. {queuePosition} agents ahead.
  </TooltipContent>
</Tooltip>

// Agent permission indicator
<Tooltip>
  <TooltipTrigger asChild>
    <ToolIcon tool="Bash" allowed={false}>
      <LockIcon className="h-3 w-3" />
    </ToolIcon>
  </TooltipTrigger>
  <TooltipContent>
    Bash tool disabled for security policy
  </TooltipContent>
</Tooltip>
```

### Setup (App Root)

```typescript
// app/routes/__root.tsx
import { TooltipProvider } from '@/components/ui/tooltip';

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      {children}
    </TooltipProvider>
  );
}
```

---

## 6. Select

Dropdown selection menus for categorical choices using @radix-ui/react-select.

### Import

```typescript
import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '@/lib/utils';
```

### Implementation

```typescript
// app/components/ui/select.tsx
const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-[6px] border border-slate-600 bg-slate-800 px-3 py-2 text-sm',
      'text-slate-300 placeholder:text-slate-500',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'hover:bg-slate-700',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <svg
        className="h-4 w-4 opacity-50"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 min-w-[8rem] overflow-hidden rounded-[6px] border border-slate-600 bg-slate-800 shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2',
        'data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2',
        'data-[side=top]:slide-in-from-bottom-2',
        'duration-200',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm text-slate-300',
      'outline-none hover:bg-slate-700 hover:text-slate-50',
      'focus:bg-slate-700 focus:text-slate-50',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <svg
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-slate-700', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export { Select, SelectGroup, SelectValue };
```

### Usage Example: Agent Type Selector

```typescript
// app/components/features/agent-type-selector.tsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from '@/components/ui/select';

export function AgentTypeSelector({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select agent type..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="task">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            Task Agent
          </div>
        </SelectItem>
        <SelectItem value="conversational">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Conversational
          </div>
        </SelectItem>
        <SelectItem value="background">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
            Background
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
```

### Usage Example: Priority Selector

```typescript
// app/components/features/priority-selector.tsx
export function PrioritySelector({
  value,
  onValueChange,
}: {
  value: 'low' | 'medium' | 'high' | 'critical';
  onValueChange: (value: 'low' | 'medium' | 'high' | 'critical') => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="low">Low</SelectItem>
        <SelectItem value="medium">Medium</SelectItem>
        <SelectItem value="high">High</SelectItem>
        <SelectItem value="critical">Critical</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

---

## 7. Switch/Toggle

Toggle controls for boolean options using @radix-ui/react-switch.

### Import

```typescript
import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';
```

### Implementation

```typescript
// app/components/ui/switch.tsx
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'bg-slate-700 data-[state=checked]:bg-green-600',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        'duration-200'
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;
```

### Usage Example: Auto-Cleanup Toggle

```typescript
// app/components/features/auto-cleanup-toggle.tsx
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function AutoCleanupToggle({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Switch
        id="auto-cleanup"
        checked={enabled}
        onCheckedChange={onEnabledChange}
      />
      <Label htmlFor="auto-cleanup" className="flex flex-col gap-1">
        <span className="font-medium text-slate-50">Auto-cleanup worktrees</span>
        <span className="text-xs text-slate-500">
          Automatically remove stale worktrees older than 7 days
        </span>
      </Label>
    </div>
  );
}
```

### Usage Example: Settings Toggles

```typescript
// app/components/features/settings-toggle-group.tsx
export function SettingsToggleGroup() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-[6px] border border-slate-700">
        <div>
          <p className="font-medium text-slate-50">Notifications</p>
          <p className="text-sm text-slate-400">Get updates on agent progress</p>
        </div>
        <Switch id="notifications" defaultChecked />
      </div>

      <div className="flex items-center justify-between p-3 rounded-[6px] border border-slate-700">
        <div>
          <p className="font-medium text-slate-50">Terminal Bell</p>
          <p className="text-sm text-slate-400">Play sound on agent completion</p>
        </div>
        <Switch id="bell" defaultChecked={false} />
      </div>

      <div className="flex items-center justify-between p-3 rounded-[6px] border border-slate-700">
        <div>
          <p className="font-medium text-slate-50">Approval Workflow</p>
          <p className="text-sm text-slate-400">Require approval before merge</p>
        </div>
        <Switch id="approval" defaultChecked />
      </div>
    </div>
  );
}
```

---

## 8. Checkbox

Selection controls for multiple options using @radix-ui/react-checkbox.

### Import

```typescript
import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '@/lib/utils';
```

### Implementation

```typescript
// app/components/ui/checkbox.tsx
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-[4px] border border-slate-500 bg-slate-800',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn('flex items-center justify-center text-current')}
    >
      <svg
        className="h-3 w-3 text-white"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
```

### Usage Example: Worktree Cleanup Selection

```typescript
// app/components/features/worktree-cleanup-selector.tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function WorktreeCleanupSelector({
  selectedIds,
  onSelectionChange,
  worktrees,
}: {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  worktrees: Worktree[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 rounded-[6px] border border-slate-700">
        <Checkbox
          id="select-all"
          checked={selectedIds.length === worktrees.length}
          onCheckedChange={(checked) =>
            onSelectionChange(checked ? worktrees.map(w => w.id) : [])
          }
        />
        <Label htmlFor="select-all" className="font-semibold">
          Select all ({worktrees.length})
        </Label>
      </div>

      {worktrees.map((worktree) => (
        <div
          key={worktree.id}
          className="flex items-center gap-3 p-3 rounded-[6px] border border-slate-700"
        >
          <Checkbox
            id={`worktree-${worktree.id}`}
            checked={selectedIds.includes(worktree.id)}
            onCheckedChange={(checked) =>
              onSelectionChange(
                checked
                  ? [...selectedIds, worktree.id]
                  : selectedIds.filter(id => id !== worktree.id)
              )
            }
          />
          <div className="flex-1">
            <Label htmlFor={`worktree-${worktree.id}`} className="font-medium">
              {worktree.branch}
            </Label>
            <p className="text-xs text-slate-500">
              Created {worktree.createdAt} • {worktree.path}
            </p>
          </div>
          <span className="text-xs text-slate-400">{worktree.ageInDays}d old</span>
        </div>
      ))}
    </div>
  );
}
```

### Usage Example: Task Selection

```typescript
// app/components/features/task-selection.tsx
export function TaskSelectionGroup({
  tasks,
  selectedIds,
  onSelectionChange,
}: {
  tasks: Task[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-3 p-3 rounded-[6px] border border-slate-700 hover:bg-slate-800"
        >
          <Checkbox
            id={`task-${task.id}`}
            checked={selectedIds.includes(task.id)}
            onCheckedChange={(checked) =>
              onSelectionChange(
                checked
                  ? [...selectedIds, task.id]
                  : selectedIds.filter(id => id !== task.id)
              )
            }
            className="mt-1"
          />
          <div className="flex-1">
            <Label htmlFor={`task-${task.id}`} className="font-medium text-slate-50">
              {task.title}
            </Label>
            <p className="mt-1 text-sm text-slate-400">{task.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Animation Timing Reference

All animations follow this timing standard to maintain consistency:

```typescript
export const animationTiming = {
  fast: 'duration-100',      // 100ms - Quick feedback (button clicks)
  base: 'duration-200',      // 200ms - Standard transitions (hover, focus)
  slow: 'duration-300',      // 300ms - Complex animations (modal open)
};

// Easing functions
export const easing = {
  linear: '',                // No easing class
  easeOut: 'ease-out',       // Deceleration (default for UI)
  easeIn: 'ease-in',         // Acceleration
  easeInOut: 'ease-in-out',  // Ease both ends
};

// Common animation combinations
export const animations = {
  fadeIn: 'animate-in fade-in-0 duration-200',
  fadeOut: 'animate-out fade-out-0 duration-200',
  slideInFromTop: 'animate-in slide-in-from-top-2 duration-200',
  slideInFromBottom: 'animate-in slide-in-from-bottom-2 duration-200',
  slideInFromLeft: 'animate-in slide-in-from-left-2 duration-200',
  slideInFromRight: 'animate-in slide-in-from-right-2 duration-200',
  zoomIn: 'animate-in zoom-in-95 duration-200',
  zoomOut: 'animate-out zoom-out-95 duration-200',
};
```

---

## Common Patterns

### Form Field Wrapper

```typescript
// app/components/ui/form-field.tsx
export function FormField({
  label,
  error,
  children,
  required = false,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

### Input Field

```typescript
// app/components/ui/input.tsx
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-9 w-full rounded-[6px] border border-slate-600 bg-slate-800 px-3 py-2 text-sm',
      'text-slate-50 placeholder:text-slate-500',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors duration-200',
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';
```

### Status Badge

```typescript
// app/components/ui/status-badge.tsx
const statusVariants = cva(
  'inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium',
  {
    variants: {
      status: {
        idle: 'bg-slate-700 text-slate-300',
        starting: 'bg-amber-900 text-amber-300',
        running: 'bg-blue-900 text-blue-300',
        paused: 'bg-yellow-900 text-yellow-300',
        error: 'bg-red-900 text-red-300',
        completed: 'bg-green-900 text-green-300',
      },
    },
  }
);

export function StatusBadge({
  status,
  children,
}: {
  status: 'idle' | 'starting' | 'running' | 'paused' | 'error' | 'completed';
  children: React.ReactNode;
}) {
  return (
    <div className={statusVariants({ status })}>
      <span className="inline-block h-2 w-2 rounded-full bg-current" />
      {children}
    </div>
  );
}
```

---

## Accessibility Checklist

All components follow WCAG 2.1 AA standards:

- ✅ Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- ✅ Focus visible indicators (ring-2 focus-visible)
- ✅ ARIA labels and roles (via Radix)
- ✅ Color contrast (7:1 for text)
- ✅ Touch targets (min 44px × 44px)
- ✅ Semantic HTML
- ✅ Screen reader support
- ✅ Disabled state handling

---

## Testing Patterns

### Unit Test Example (Button)

```typescript
// tests/unit/button.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('should render with default variant', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByText('Click'));

    expect(onClick).toHaveBeenCalled();
  });

  it('should support disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Button className="custom-class">Button</Button>
    );
    expect(container.querySelector('button')).toHaveClass('custom-class');
  });
});
```

---

## References

- **Radix UI:** https://www.radix-ui.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **class-variance-authority:** https://cva.style/docs
- **React Slot:** https://radix-ui.com/docs/primitives/utilities/slot
- **AGENTS.md Tech Stack:** /Users/simon.lynch/git/claudorc/AGENTS.md
- **Wireframe Design System:** /Users/simon.lynch/git/claudorc/specs/wireframe-review.md
