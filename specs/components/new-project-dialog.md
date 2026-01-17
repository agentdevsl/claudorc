# AddRepositoryDialog Component Specification

## Overview

The AddRepositoryDialog is a modal for adding git repositories to AgentPane as projects. A project is a user's working context for a repository - it holds user-specific configuration, agent settings, worktrees, and session history.

**Key Concept: Project = Working Context for a Repo**
- A project references a git repository (required, not optional)
- Multiple users can have projects referencing the same repository
- Project name is derived from the repository directory name
- The repository is the identity; project is the working context

**Purpose:**
- Select an existing local git repository to work with
- Clone a remote repository and set up as a new project
- Quick access to recently used repositories

**Use Cases:**
1. User wants to add an existing local repository to AgentPane
2. User wants to clone a remote GitHub repository
3. User wants to quickly select from recently accessed repositories

**Related Wireframes:**
- [Add Repository Dialog](../wireframes/new-project-dialog.html) - Primary design reference
- [Project Picker](../wireframes/github-project-picker.html) - Linked via "Add Repository" button

---

## Interface Definition

```typescript
// app/components/features/add-repository-dialog/types.ts
import type { Result } from '@/lib/utils/result';
import type { Project } from '@/db/schema';

/**
 * Props for the AddRepositoryDialog component
 */
export interface AddRepositoryDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when project is successfully created */
  onProjectCreated: (project: Project) => void;
  /** Initial path to pre-populate (optional, from file drop) */
  initialPath?: string;
  /** Initial source type (optional) */
  initialSource?: RepositorySourceType;
}

/**
 * Repository source type selection
 */
export type RepositorySourceType = 'local' | 'clone';

/**
 * Form data for adding a repository as a project
 */
export interface AddRepositoryFormData {
  /** Source type: local directory or clone */
  sourceType: RepositorySourceType;
  /** Local directory path (for 'local' source) */
  localPath: string;
  /** GitHub repository URL (for 'clone' source) */
  cloneUrl: string;
  /** Clone destination path (for 'clone' source) */
  clonePath: string;
}

/**
 * Repository info detected from path
 */
export interface RepositoryInfo {
  /** Directory name (becomes project name) */
  name: string;
  /** Absolute path to repository */
  path: string;
  /** Whether .git directory exists */
  isGitRepo: boolean;
  /** Default branch if git repo */
  defaultBranch?: string;
  /** Remote origin URL if configured */
  remoteUrl?: string;
  /** Whether .claude/ config exists */
  hasClaudeConfig: boolean;
}

/**
 * Validation errors for form fields
 */
export interface AddRepositoryFormErrors {
  localPath?: string;
  cloneUrl?: string;
  clonePath?: string;
  general?: string;
}

/**
 * Internal state for the AddRepositoryDialog
 */
export interface AddRepositoryDialogState {
  /** Form data */
  formData: AddRepositoryFormData;
  /** Validation errors */
  errors: AddRepositoryFormErrors;
  /** Detected repository info (when valid path selected) */
  repoInfo: RepositoryInfo | null;
  /** Recent repositories for quick selection */
  recentRepos: RepositoryInfo[];
  /** Loading states */
  isValidatingPath: boolean;
  isSubmitting: boolean;
}

/**
 * Project creation input for service
 */
export interface CreateProjectInput {
  /** Path to the git repository (required) */
  path: string;
  /** Optional clone URL if cloning */
  cloneUrl?: string;
}

/**
 * Project creation error types
 */
export type CreateProjectError =
  | { code: 'PATH_NOT_FOUND'; message: string }
  | { code: 'NOT_A_DIRECTORY'; message: string }
  | { code: 'NOT_A_GIT_REPO'; message: string }
  | { code: 'CLONE_FAILED'; message: string; details: string }
  | { code: 'INVALID_GIT_URL'; message: string }
  | { code: 'ACCESS_DENIED'; message: string };
```

---

## Component Specifications

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `open` | `boolean` | Yes | - | Controls dialog visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | - | Called when dialog should open/close |
| `onProjectCreated` | `(project: Project) => void` | Yes | - | Called when project is successfully created |
| `initialPath` | `string` | No | `''` | Pre-populated path (e.g., from drag-drop) |
| `initialSource` | `RepositorySourceType` | No | `'local'` | Initial source type selection |

### Internal State

| State | Type | Initial Value | Description |
|-------|------|---------------|-------------|
| `formData` | `AddRepositoryFormData` | (see defaults) | Form field values |
| `errors` | `AddRepositoryFormErrors` | `{}` | Validation error messages |
| `repoInfo` | `RepositoryInfo \| null` | `null` | Detected repository info when valid path selected |
| `recentRepos` | `RepositoryInfo[]` | `[]` | Recently used repositories for quick selection |
| `isValidatingPath` | `boolean` | `false` | Path validation in progress |
| `isSubmitting` | `boolean` | `false` | Project creation in progress |

### Default Form Values

```typescript
const defaultFormData: AddRepositoryFormData = {
  sourceType: 'local',
  localPath: '',
  cloneUrl: '',
  clonePath: '~/git/',
};
```

### Events

| Event | Trigger | Payload | Description |
|-------|---------|---------|-------------|
| `onOpenChange(false)` | Escape key, backdrop, Cancel button | `boolean` | Close the dialog |
| `onProjectCreated` | Successful creation | `Project` | Project created successfully |
| Source tab change | Tab click | `RepositorySourceType` | Switch between local/clone |
| Path change | Browse button, input change | `string` | Update path and validate |
| Recent repo select | Recent item click | `string` | Select a recent repository path |

---

## Visual Specifications

### Layout

```
+------------------------------------------------------------------+
|  [Modal: max-width 560px, centered]                               |
|                                                                   |
|  +--------------------------------------------------------------+ |
|  |  [Folder] Add Repository                              [X]    | | <- Header
|  +--------------------------------------------------------------+ |
|  |                                                              | |
|  |  +------------------------+  +------------------------+      | |
|  |  | [Folder] Local Repo    |  | [GitHub] Clone URL     |      | | <- Source Tabs
|  |  +------------------------+  +------------------------+      | |
|  |                                                              | |
|  |  Repository Path:                                            | |
|  |  [~/git/my-project________________] [Browse...]              | |
|  |                                                              | |
|  |  +----------------------------------------------------------+| |
|  |  | [Repo] my-project                                        || | <- Repo Info
|  |  | ~/git/my-project                                         || |
|  |  | ✓ Git repo • main • origin                               || |
|  |  +----------------------------------------------------------+| |
|  |                                                              | |
|  |  ─────────── or select recent ───────────                    | |
|  |                                                              | |
|  |  [Repo] claude-code          ~/git/claude-code               | |
|  |  [Repo] tanstack-db          ~/git/tanstack-db               | |
|  |  [Repo] my-saas-app          ~/projects/my-saas-app          | |
|  |                                                              | |
|  +--------------------------------------------------------------+ |
|  |                              [Cancel]  [Add Repository ->]   | | <- Footer
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### Dimensions

| Element | Dimension | Value |
|---------|-----------|-------|
| Modal | max-width | `560px` |
| Modal | max-height | `90vh` |
| Modal | border-radius | `12px` (radius-lg) |
| Header | padding | `20px 24px` |
| Header | border-bottom | `1px solid var(--border-default)` |
| Close button | size | `32px x 32px` |
| Source tabs | padding | `4px` |
| Source tabs | background | `var(--bg-subtle)` |
| Source tab | padding | `10px 16px` |
| Body | padding | `24px` |
| Form input | height | `40px` |
| Repo info card | padding | `16px` |
| Repo info card | margin-top | `16px` |
| Recent item | padding | `10px 12px` |
| Recent item icon | size | `32px x 32px` |
| Divider | margin | `20px 0` |
| Footer | padding | `16px 24px` |
| Footer | background | `var(--bg-subtle)` |
| Button | height | `40px` |
| Button | padding | `10px 16px` |

### Colors

| Element | Property | Token |
|---------|----------|-------|
| Modal background | background | `--bg-default` (#161b22) |
| Modal border | border-color | `--border-default` (#30363d) |
| Overlay | background | `rgba(0, 0, 0, 0.6)` |
| Overlay | backdrop-filter | `blur(4px)` |
| Header title | color | `--fg-default` (#e6edf3) |
| Header title | font-weight | `600` |
| Header title | font-size | `18px` |
| Steps background | background | `--bg-subtle` (#1c2128) |
| Step number inactive | background | `--bg-muted` (#21262d) |
| Step number inactive | color | `--fg-subtle` (#6e7681) |
| Step number active | background | `--accent-fg` (#58a6ff) |
| Step number active | color | `--bg-canvas` (#0d1117) |
| Step number completed | background | `--success-emphasis` (#238636) |
| Step number completed | color | `white` |
| Step label inactive | color | `--fg-subtle` (#6e7681) |
| Step label active | color | `--fg-default` (#e6edf3) |
| Step connector | background | `--border-default` (#30363d) |
| Section title | color | `--fg-muted` (#8b949e) |
| Section title | letter-spacing | `0.5px` |
| Source card | background | `--bg-subtle` (#1c2128) |
| Source card hover | border-color | `--fg-subtle` (#6e7681) |
| Source card selected | background | `--accent-muted` |
| Source card selected | border-color | `--accent-fg` (#58a6ff) |
| Source card icon | background | `--bg-muted` (#21262d) |
| Source card icon selected | background | `--accent-fg` (#58a6ff) |
| Form input | background | `--bg-subtle` (#1c2128) |
| Form input focus | border-color | `--accent-fg` (#58a6ff) |
| Form label | color | `--fg-default` (#e6edf3) |
| Form label optional | color | `--fg-subtle` (#6e7681) |
| File tree | background | `--bg-default` (#161b22) |
| File tree folder | color | `--accent-fg` (#58a6ff) |
| File tree file | color | `--fg-muted` (#8b949e) |
| Color green | background | `--success-fg` (#3fb950) |
| Color blue | background | `--accent-fg` (#58a6ff) |
| Color purple | background | `--done-fg` (#a371f7) |
| Color orange | background | `--attention-fg` (#d29922) |
| Color red | background | `--danger-fg` (#f85149) |
| Checkbox checked | background | `--success-emphasis` (#238636) |
| Primary button | background | `--success-emphasis` (#238636) |
| Primary button hover | background | `#2ea043` |
| Secondary button | background | `--bg-muted` (#21262d) |
| Secondary button hover | background | `--bg-emphasis` (#30363d) |
| Error text | color | `--danger-fg` (#f85149) |

### Icon Colors by Selection

| Color | Background Class | Selected Check |
|-------|------------------|----------------|
| green | `bg-[#3fb950]` | White checkmark |
| blue | `bg-[#58a6ff]` | White checkmark |
| purple | `bg-[#a371f7]` | White checkmark |
| orange | `bg-[#d29922]` | White checkmark |
| red | `bg-[#f85149]` | White checkmark |

---

## Form Fields

### Repository Path (Local Source)

| Attribute | Value |
|-----------|-------|
| Type | `text` (with browse button) |
| Required | Yes (when source is 'local') |
| Validation | Valid directory, contains .git |
| File picker | Native directory picker dialog |
| Display | Abbreviated path (e.g., `~/git/my-project`) |

### Clone URL (Clone Source)

| Attribute | Value |
|-----------|-------|
| Type | `url` |
| Required | Yes (when source is 'clone') |
| Validation | Valid git URL format (HTTPS or SSH) |
| Placeholder | `https://github.com/owner/repo` |
| Patterns | `https://github.com/...`, `git@github.com:...` |

### Clone Destination Path

| Attribute | Value |
|-----------|-------|
| Type | `text` (with browse button) |
| Required | Yes (when source is 'clone') |
| Default | `~/git/` |
| Validation | Valid directory, writable |

---

## Validation Rules

### Path Validation (Local Source)

```typescript
async function validateLocalPath(path: string): Promise<ValidationResult> {
  // Check path exists
  const exists = await fileSystem.exists(path);
  if (!exists) {
    return { valid: false, error: 'Directory not found' };
  }

  // Check is directory
  const isDir = await fileSystem.isDirectory(path);
  if (!isDir) {
    return { valid: false, error: 'Path is not a directory' };
  }

  // Check is a git repository (required)
  const hasGit = await fileSystem.exists(`${path}/.git`);
  if (!hasGit) {
    return { valid: false, error: 'Not a git repository' };
  }

  // Detect repository info
  const repoInfo = await gitService.getRepoInfo(path);

  return {
    valid: true,
    repoInfo: {
      name: path.split('/').pop(),
      path,
      isGitRepo: true,
      defaultBranch: repoInfo.defaultBranch,
      remoteUrl: repoInfo.remoteUrl,
      hasClaudeConfig: await fileSystem.exists(`${path}/.claude`),
    }
  };
}
```

### Clone URL Validation

```typescript
const cloneUrlSchema = z
  .string()
  .min(1, 'Repository URL is required')
  .regex(
    /^(https:\/\/github\.com\/[\w-]+\/[\w.-]+|git@github\.com:[\w-]+\/[\w.-]+)(\.git)?$/,
    'Invalid GitHub repository URL'
  );
```

---

## Behavior Specifications

### Open/Close Animations

```typescript
// Overlay fade-in
const overlayAnimation = {
  enter: 'fade-in-0 duration-200',
  exit: 'fade-out-0 duration-200',
};

// Modal scale + fade
const modalAnimation = {
  enter: 'zoom-in-95 fade-in-0 duration-200 ease-out',
  exit: 'zoom-out-95 fade-out-0 duration-200',
};
```

### Dialog Flow

```
1. Open Dialog
   - Load recent repositories
   - Default to "Local Repository" tab
   - Focus on path input

2. Select Repository (Local)
   - Browse or enter path
   - Validate path is git repo
   - Show repository info card (name, branch, remote)
   - Enable "Add Repository" button

3. Select Repository (Clone)
   - Enter clone URL
   - Optionally change clone destination
   - Validate URL format

4. Add Repository
   - Clone if needed
   - Create project with repo path
   - Project name derived from directory name
   - Close dialog and navigate to project
```

### Form Submission Flow

```typescript
async function handleSubmit() {
  setState({ isSubmitting: true });

  try {
    const { formData } = state;

    // 1. Clone repository if needed
    let projectPath: string;

    if (formData.sourceType === 'clone') {
      const cloneResult = await gitService.clone(
        formData.cloneUrl,
        formData.clonePath
      );
      if (!cloneResult.ok) {
        setState({
          errors: { general: cloneResult.error.message },
          isSubmitting: false,
        });
        return;
      }
      projectPath = cloneResult.value.path;
    } else {
      projectPath = formData.localPath;
    }

    // 2. Create project (name derived from path)
    const result = await projectService.create({
      path: projectPath,
    });

    if (result.ok) {
      props.onProjectCreated(result.value);
      props.onOpenChange(false);
    } else {
      setState({ errors: { general: result.error.message }, isSubmitting: false });
    }
  } catch (error) {
    setState({
      errors: { general: 'An unexpected error occurred' },
      isSubmitting: false,
    });
  }
}
```

### Error Display

| Error Location | Display Style |
|----------------|---------------|
| Field-level | Red text below input, `--danger-fg` |
| Form-level | Alert banner above footer, `--danger-muted` bg |
| Path not found | Inline error below path input |
| Not a git repo | Inline error below path input |
| Clone failed | Alert banner with details |

### Success Handling

1. Project is created in database with derived name from repo path
2. Dialog closes
3. User is redirected to new project
4. Success toast shown briefly

---

## Sub-components

### PathSelector

```typescript
// app/components/features/new-project-dialog/path-selector.tsx
export interface PathSelectorProps {
  value: string;
  onChange: (path: string) => void;
  onBrowse: () => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  isValidating?: boolean;
}

export function PathSelector({
  value,
  onChange,
  onBrowse,
  placeholder,
  error,
  disabled,
  isValidating,
}: PathSelectorProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'w-full h-9 px-3 pr-8',
              'bg-[#161b22] border rounded-[6px]',
              'font-mono text-sm text-[#e6edf3]',
              'placeholder:text-[#6e7681]',
              'transition-all duration-150',
              'focus:outline-none',
              error
                ? 'border-[#f85149] focus:border-[#f85149]'
                : 'border-[#30363d] focus:border-[#58a6ff] focus:shadow-[0_0_0_3px_rgba(56,139,253,0.15)]',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          />
          {isValidating && (
            <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />
          )}
        </div>
        <button
          type="button"
          onClick={onBrowse}
          disabled={disabled}
          className={cn(
            'h-9 px-3 rounded-[6px]',
            'bg-[#21262d] border border-[#30363d]',
            'text-sm font-medium text-[#e6edf3]',
            'hover:bg-[#30363d] transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-[#58a6ff]',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
        >
          Browse...
        </button>
      </div>
      {error && (
        <p className="text-xs text-[#f85149]">{error}</p>
      )}
    </div>
  );
}
```

### GitHubRepoInput

```typescript
// app/components/features/new-project-dialog/github-repo-input.tsx
export interface GitHubRepoInputProps {
  value: string;
  onChange: (url: string) => void;
  error?: string;
  disabled?: boolean;
}

export function GitHubRepoInput({
  value,
  onChange,
  error,
  disabled,
}: GitHubRepoInputProps) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <GitHubIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7681]" />
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://github.com/owner/repo"
          disabled={disabled}
          className={cn(
            'w-full h-9 pl-10 pr-3',
            'bg-[#161b22] border rounded-[6px]',
            'text-sm text-[#e6edf3]',
            'placeholder:text-[#6e7681]',
            'transition-all duration-150',
            'focus:outline-none',
            error
              ? 'border-[#f85149] focus:border-[#f85149]'
              : 'border-[#30363d] focus:border-[#58a6ff] focus:shadow-[0_0_0_3px_rgba(56,139,253,0.15)]',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
        />
      </div>
      {error && (
        <p className="text-xs text-[#f85149]">{error}</p>
      )}
    </div>
  );
}
```

### RepoInfoCard

```typescript
// app/components/features/add-repository-dialog/repo-info-card.tsx
export interface RepoInfoCardProps {
  repoInfo: RepositoryInfo;
}

export function RepoInfoCard({ repoInfo }: RepoInfoCardProps) {
  return (
    <div className={cn(
      'mt-4 p-4 rounded-[6px] border',
      repoInfo.isGitRepo
        ? 'bg-[rgba(46,160,67,0.15)] border-[rgba(63,185,80,0.4)]'
        : 'bg-[#1c2128] border-[#30363d]'
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'w-10 h-10 rounded-[6px] flex items-center justify-center',
          repoInfo.isGitRepo ? 'bg-[#238636] text-white' : 'bg-[#21262d] text-[#8b949e]'
        )}>
          <RepoIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-[#e6edf3]">{repoInfo.name}</div>
          <div className="text-xs font-mono text-[#8b949e]">{repoInfo.path}</div>
        </div>
      </div>
      <div className="flex gap-4 pt-3 border-t border-[#21262d]">
        {repoInfo.isGitRepo && (
          <div className="flex items-center gap-1.5 text-xs text-[#3fb950]">
            <CheckIcon className="w-3.5 h-3.5" />
            Git repository
          </div>
        )}
        {repoInfo.defaultBranch && (
          <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
            <BranchIcon className="w-3.5 h-3.5" />
            {repoInfo.defaultBranch}
          </div>
        )}
        {repoInfo.remoteUrl && (
          <div className="flex items-center gap-1.5 text-xs text-[#8b949e]">
            <GitHubIcon className="w-3.5 h-3.5" />
            origin
          </div>
        )}
      </div>
    </div>
  );
}
```

### RecentRepoList

```typescript
// app/components/features/add-repository-dialog/recent-repo-list.tsx
export interface RecentRepoListProps {
  repos: RepositoryInfo[];
  onSelect: (path: string) => void;
}

export function RecentRepoList({ repos, onSelect }: RecentRepoListProps) {
  if (repos.length === 0) return null;

  return (
    <div className="space-y-1">
      {repos.map((repo) => (
        <button
          key={repo.path}
          type="button"
          onClick={() => onSelect(repo.path)}
          className={cn(
            'w-full flex items-center gap-3 p-3 rounded-[6px]',
            'border border-transparent',
            'hover:bg-[#1c2128] hover:border-[#30363d]',
            'transition-all duration-150',
            'text-left'
          )}
        >
          <div className="w-8 h-8 rounded-[6px] bg-[#21262d] flex items-center justify-center text-[#8b949e]">
            <RepoIcon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#e6edf3]">{repo.name}</div>
            <div className="text-xs font-mono text-[#6e7681] truncate">{repo.path}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

---

## Keyboard Navigation

| Key | Context | Action |
|-----|---------|--------|
| `Escape` | Any | Close dialog |
| `Tab` | Any | Move focus to next focusable element |
| `Shift+Tab` | Any | Move focus to previous focusable element |
| `Enter` | Path input | Validate and submit if valid |
| `Enter` | Recent repo item | Select repository |

### Tab Order

1. Close button (X)
2. Source tab: Local Repository
3. Source tab: Clone from URL
4. Path input (if local selected)
5. Browse button (if local selected)
6. Clone URL input (if clone selected)
7. Clone destination input (if clone selected)
8. Recent repository items
9. Cancel button
10. Add Repository button

---

## Accessibility

### ARIA Labels and Roles

```typescript
// Dialog
<DialogPrimitive.Root>
  <DialogPrimitive.Content
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-repo-dialog-title"
    aria-describedby="add-repo-dialog-description"
  >
    <DialogPrimitive.Title id="add-repo-dialog-title">
      Add Repository
    </DialogPrimitive.Title>
    <DialogPrimitive.Description id="add-repo-dialog-description" className="sr-only">
      Add a git repository to work with in AgentPane.
    </DialogPrimitive.Description>
  </DialogPrimitive.Content>
</DialogPrimitive.Root>

// Source tabs
<div role="tablist" aria-label="Repository source">
  <button role="tab" aria-selected={sourceType === 'local'}>
    Local Repository
  </button>
  <button role="tab" aria-selected={sourceType === 'clone'}>
    Clone from URL
  </button>
</div>

// Form inputs
<label htmlFor="repo-path">Repository Path</label>
<input id="repo-path" aria-required="true" aria-invalid={!!errors.localPath} />
{errors.localPath && <span role="alert">{errors.localPath}</span>}
```

### Focus Management

1. **On open**: Focus moves to path input
2. **Focus trap**: Focus is trapped within dialog while open
3. **On tab change**: Focus moves to first input of selected tab
4. **On validation error**: Focus moves to invalid field
5. **On close**: Focus returns to trigger element

### Screen Reader Announcements

| Event | Announcement |
|-------|--------------|
| Dialog opens | "Add Repository dialog opened" |
| Tab changes | "Local Repository tab selected" |
| Validation error | "Error: [field] - [error message]" |
| Loading | "Validating repository..." |
| Success | "Repository added successfully" |
| Dialog closes | "Dialog closed" |

---

## Implementation Outline

```typescript
// app/components/features/add-repository-dialog/add-repository-dialog.tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type {
  AddRepositoryDialogProps,
  AddRepositoryDialogState,
  AddRepositoryFormData,
  RepositoryInfo,
} from './types';
import { PathSelector } from './path-selector';
import { CloneUrlInput } from './clone-url-input';
import { RepoInfoCard } from './repo-info-card';
import { RecentRepoList } from './recent-repo-list';
import { useGitService } from '@/lib/hooks/use-git-service';
import { useProjectService } from '@/lib/hooks/use-project-service';
import { useRecentRepos } from '@/lib/hooks/use-recent-repos';

const defaultFormData: AddRepositoryFormData = {
  sourceType: 'local',
  localPath: '',
  cloneUrl: '',
  clonePath: '~/git/',
};

export function AddRepositoryDialog({
  open,
  onOpenChange,
  onProjectCreated,
  initialPath = '',
  initialSource = 'local',
}: AddRepositoryDialogProps) {
  const [state, setState] = React.useState<AddRepositoryDialogState>({
    formData: { ...defaultFormData, localPath: initialPath, sourceType: initialSource },
    errors: {},
    repoInfo: null,
    recentRepos: [],
    isValidatingPath: false,
    isSubmitting: false,
  });

  const gitService = useGitService();
  const projectService = useProjectService();
  const { recentRepos, addRecentRepo } = useRecentRepos();

  // Load recent repos on mount
  React.useEffect(() => {
    setState(prev => ({ ...prev, recentRepos }));
  }, [recentRepos]);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setState({
        formData: { ...defaultFormData, localPath: initialPath, sourceType: initialSource },
        errors: {},
        repoInfo: null,
        recentRepos,
        isValidatingPath: false,
        isSubmitting: false,
      });

      if (initialPath) {
        validateAndLoadRepoInfo(initialPath);
      }
    }
  }, [open, initialPath, initialSource]);

  // Validate path and load repo info
  const validateAndLoadRepoInfo = async (path: string) => {
    setState(prev => ({ ...prev, isValidatingPath: true, errors: {} }));

    const result = await gitService.validateRepository(path);

    if (result.ok) {
      setState(prev => ({
        ...prev,
        isValidatingPath: false,
        repoInfo: result.value,
      }));
    } else {
      setState(prev => ({
        ...prev,
        isValidatingPath: false,
        repoInfo: null,
        errors: { localPath: result.error.message },
      }));
    }
  };

  // Handle path change
  const handlePathChange = (path: string) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, localPath: path },
      errors: { ...prev.errors, localPath: undefined },
      repoInfo: null,
    }));

    if (path.length > 2) {
      validateAndLoadRepoInfo(path);
    }
  };

  // Handle browse button
  const handleBrowse = async () => {
    const path = await gitService.openDirectoryPicker();
    if (path) {
      handlePathChange(path);
    }
  };

  // Handle recent repo selection
  const handleSelectRecent = (path: string) => {
    handlePathChange(path);
  };

  // Handle form submission
  const handleSubmit = async () => {
    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const { formData } = state;
      let projectPath: string;

      if (formData.sourceType === 'clone') {
        const cloneResult = await gitService.clone(formData.cloneUrl, formData.clonePath);
        if (!cloneResult.ok) {
          setState(prev => ({
            ...prev,
            isSubmitting: false,
            errors: { general: cloneResult.error.message },
          }));
          return;
        }
        projectPath = cloneResult.value.path;
      } else {
        projectPath = formData.localPath;
      }

      // Create project (name derived from path)
      const result = await projectService.create({ path: projectPath });

      if (result.ok) {
        addRecentRepo(projectPath);
        onProjectCreated(result.value);
        onOpenChange(false);
      } else {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          errors: { general: result.error.message },
        }));
      }
    } catch {
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        errors: { general: 'An unexpected error occurred' },
      }));
    }
  };

  const { formData, errors, repoInfo, isSubmitting } = state;
  const canSubmit = formData.sourceType === 'local'
    ? !!repoInfo?.isGitRepo
    : !!formData.cloneUrl;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content max-w-[560px]">
          {/* Header */}
          <div className="dialog-header">
            <DialogPrimitive.Title>Add Repository</DialogPrimitive.Title>
            <DialogPrimitive.Close className="close-btn" />
          </div>

          {/* Body */}
          <div className="dialog-body">
            {/* Source Tabs */}
            <Tabs.Root
              value={formData.sourceType}
              onValueChange={(v) => setState(prev => ({
                ...prev,
                formData: { ...prev.formData, sourceType: v as 'local' | 'clone' },
                errors: {},
              }))}
            >
              <Tabs.List className="source-tabs">
                <Tabs.Trigger value="local">Local Repository</Tabs.Trigger>
                <Tabs.Trigger value="clone">Clone from URL</Tabs.Trigger>
              </Tabs.List>

              {/* Local Tab */}
              <Tabs.Content value="local">
                <PathSelector
                  value={formData.localPath}
                  onChange={handlePathChange}
                  onBrowse={handleBrowse}
                  error={errors.localPath}
                  isValidating={state.isValidatingPath}
                />

                {repoInfo && <RepoInfoCard repoInfo={repoInfo} />}

                {state.recentRepos.length > 0 && (
                  <>
                    <div className="divider">or select recent</div>
                    <RecentRepoList
                      repos={state.recentRepos}
                      onSelect={handleSelectRecent}
                    />
                  </>
                )}
              </Tabs.Content>

              {/* Clone Tab */}
              <Tabs.Content value="clone">
                <CloneUrlInput
                  value={formData.cloneUrl}
                  onChange={(url) => setState(prev => ({
                    ...prev,
                    formData: { ...prev.formData, cloneUrl: url },
                    errors: { ...prev.errors, cloneUrl: undefined },
                  }))}
                  error={errors.cloneUrl}
                />
                <PathSelector
                  label="Clone to"
                  value={formData.clonePath}
                  onChange={(path) => setState(prev => ({
                    ...prev,
                    formData: { ...prev.formData, clonePath: path },
                  }))}
                  onBrowse={handleBrowse}
                />
              </Tabs.Content>
            </Tabs.Root>

            {/* Error Banner */}
            {errors.general && (
              <div className="error-banner">{errors.general}</div>
            )}
          </div>

          {/* Footer */}
          <div className="dialog-footer">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              isLoading={isSubmitting}
            >
              Add Repository
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

---

## Hook: useAddRepositoryDialog

```typescript
// app/lib/hooks/use-add-repository-dialog.ts
import * as React from 'react';
import type { Project } from '@/db/schema';

export function useAddRepositoryDialog() {
  const [open, setOpen] = React.useState(false);
  const [initialPath, setInitialPath] = React.useState('');

  const openDialog = React.useCallback((path?: string) => {
    if (path) {
      setInitialPath(path);
    }
    setOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    setOpen(false);
    setInitialPath('');
  }, []);

  const handleProjectCreated = React.useCallback((project: Project) => {
    // Navigate to new project or update context
  }, []);

  return {
    open,
    setOpen,
    initialPath,
    openDialog,
    closeDialog,
    handleProjectCreated,
  };
}
```

---

## Testing Considerations

### Unit Tests

```typescript
describe('AddRepositoryDialog', () => {
  it('should open with default state');
  it('should close on Escape key');
  it('should close on Cancel button click');
  it('should switch between local and clone tabs');
  it('should validate path when local source selected');
  it('should show repo info card for valid git repo');
  it('should show error for non-git directory');
  it('should show error for invalid GitHub URL');
  it('should enable Add button only when valid repo selected');
  it('should submit form and call onProjectCreated');
  it('should show loading state during submission');
  it('should display error message on failure');
  it('should populate recent repos list');
  it('should select repo from recent list');
});
```

### Integration Tests

```typescript
describe('AddRepositoryDialog Integration', () => {
  it('should create project from local repository');
  it('should clone repository and create project');
  it('should add repo to recent list after creation');
  it('should handle permission errors gracefully');
  it('should handle network errors during clone');
});
```

### Accessibility Tests

```typescript
describe('AddRepositoryDialog Accessibility', () => {
  it('should trap focus within dialog');
  it('should have proper ARIA labels');
  it('should announce errors to screen readers');
  it('should support keyboard-only navigation');
  it('should return focus on close');
});
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Project Service](../services/project-service.md) | Data operations for project creation |
| [Git Service](../services/git-service.md) | Repository validation and cloning |
| [Database Schema](../database/schema.md) | Project table structure |
| [Component Patterns](../implementation/component-patterns.md) | Dialog, Button patterns |
| [Animation System](../implementation/animation-system.md) | Modal animation specifications |
| [Project Picker](./project-picker.md) | Linked from "Add Repository" button |
| [Design Tokens](../wireframes/design-tokens.css) | Color and spacing tokens |
