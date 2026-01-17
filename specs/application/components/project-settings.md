# ProjectSettings Component Specification

## Overview

The ProjectSettings component provides a tabbed interface for configuring project-level settings including general information, agent configuration, worktree settings, and integrations. It is accessible from the project detail page header.

**Related Wireframes:**
- [Project Settings](../wireframes/project-settings.html) - Complete settings page with all tabs

---

## Interface Definition

```typescript
// app/components/views/project-settings/types.ts
import type { Result } from '@/lib/utils/result';
import type { Project, ProjectConfig } from '@/lib/services/project-service.types';

// ===== Tab Values =====
export type SettingsTab = 'project' | 'agents' | 'configuration';

// ===== Component Props =====
export interface ProjectSettingsProps {
  /** Project ID to configure */
  projectId: string;
  /** Initial tab to display */
  initialTab?: SettingsTab;
  /** Callback when settings are saved */
  onSave?: (project: Project) => void;
  /** Callback when navigating away with unsaved changes */
  onUnsavedChanges?: () => boolean;
}

// ===== Project Config =====
export interface ProjectConfig {
  /** Root directory for worktrees */
  worktreeRoot: string;
  /** Script to run after worktree creation */
  initScript?: string;
  /** Environment file to copy to worktrees */
  envFile?: string;
  /** Default branch for new worktrees */
  defaultBranch: string;
  /** Maximum concurrent agents */
  maxConcurrentAgents: number;
  /** Allowed tools for agents */
  allowedTools: string[];
  /** Maximum turns per agent execution */
  maxTurns: number;
  /** Default model for agents */
  model?: string;
  /** Default system prompt */
  systemPrompt?: string;
  /** Default temperature */
  temperature?: number;
}

// ===== Form State =====
export interface ProjectSettingsState {
  /** Current tab */
  activeTab: SettingsTab;
  /** Form data */
  formData: {
    project: ProjectFormData;
    agents: AgentsFormData;
    configuration: ConfigurationFormData;
  };
  /** Validation errors */
  errors: Record<string, string>;
  /** Whether form has unsaved changes */
  isDirty: boolean;
  /** Save in progress */
  isSaving: boolean;
}
```

---

## Component Specifications

### ProjectSettings (Container)

```typescript
// app/components/views/project-settings/index.tsx
export interface ProjectSettingsProps {
  projectId: string;
  initialTab?: SettingsTab;
  onSave?: (project: Project) => void;
  onUnsavedChanges?: () => boolean;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `projectId` | `string` | Yes | - | Project to configure |
| `initialTab` | `SettingsTab` | No | `'project'` | Initial tab to show |
| `onSave` | `(project: Project) => void` | No | - | Called after successful save |
| `onUnsavedChanges` | `() => boolean` | No | - | Called when navigating with unsaved changes |

---

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Project                                                      │
│                                                                         │
│  Project Settings                                                       │
│  Configure project behavior and agent defaults                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ [Project] ─┬─ [Agents] ─┬─ [Configuration] ─┐                       │
│  │                                               │                       │
│  │  ┌─ General ────────────────────────────────────────────────────┐   │
│  │  │                                                              │   │
│  │  │  Project Name                                                │   │
│  │  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  │ AgentPane                                            │   │   │
│  │  │  └──────────────────────────────────────────────────────┘   │   │
│  │  │                                                              │   │
│  │  │  Description                                                 │   │
│  │  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  │ Multi-agent task management system                   │   │   │
│  │  │  └──────────────────────────────────────────────────────┘   │   │
│  │  │                                                              │   │
│  │  │  Repository Path                                             │   │
│  │  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  │ ~/git/claudorc                              [Browse] │   │   │
│  │  │  └──────────────────────────────────────────────────────┘   │   │
│  │  │                                                              │   │
│  │  └──────────────────────────────────────────────────────────────┘   │
│  │                                                                      │
│  │  ┌─ Danger Zone ────────────────────────────────────────────────┐   │
│  │  │                                                              │   │
│  │  │  Delete this project and all associated tasks and agents     │   │
│  │  │                                             [Delete Project] │   │
│  │  │                                                              │   │
│  │  └──────────────────────────────────────────────────────────────┘   │
│  │                                                                      │
│  └──────────────────────────────────────────────────────────────────────┘
│                                                                         │
│                                              [Cancel]  [Save Changes]   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Tab: Project

#### General Section

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| Name | Text input | Required, 1-100 chars | Project display name |
| Description | Textarea | Optional, max 500 chars | Project description |
| Repository Path | Path input | Required, must exist | Local git repository path |

#### GitHub Section (if connected)

| Field | Type | Description |
|-------|------|-------------|
| Repository | Read-only | `owner/repo` format |
| Sync Status | Badge | Last sync time, sync button |
| Config File | Link | Opens `.claude/config.json` |

#### Danger Zone

| Action | Description | Confirmation |
|--------|-------------|--------------|
| Delete Project | Removes project and all data | Type project name to confirm |

---

### Tab: Agents

#### Concurrency Section

| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| Max Concurrent | Slider | 1-10 | 3 | Maximum parallel agents |

```
Max Concurrent Agents

[===========o===================] 3

1 agent              10 agents
```

#### Default Execution Settings

| Field | Type | Range | Default |
|-------|------|-------|---------|
| Max Turns | Slider | 10-500 | 50 |
| Temperature | Slider | 0-1 | 0.7 |
| Model | Select | haiku/sonnet/opus | sonnet |

#### Tool Permissions

| Category | Tools |
|----------|-------|
| File Operations | Read, Edit, Write, Glob, Grep |
| System | Bash, Task |
| Web | WebFetch, WebSearch |
| MCP | (Dynamic from connected servers) |

---

### Tab: Configuration

#### Worktree Settings

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| Worktree Root | Text input | `.worktrees` | Directory for worktrees |
| Default Branch | Text input | `main` | Base branch for worktrees |
| Init Script | Text input | - | Script to run after creation |
| Env File | Text input | `.env` | File to copy to worktrees |

#### Environment Variables

| Field | Description |
|-------|-------------|
| API Key | Anthropic API key (masked) |
| GitHub Token | GitHub PAT (if not using app) |

#### Custom System Prompt

| Property | Value |
|----------|-------|
| Type | Textarea |
| Height | 150px |
| Font | Monospace |
| Placeholder | "Additional instructions for all agents..." |

---

### Slider Component

```typescript
// Slider design specifications
interface SliderSpec {
  track: {
    height: '8px';
    background: 'var(--bg-muted)'; // #21262d
    borderRadius: '4px';
  };
  fill: {
    background: 'var(--accent-fg)'; // #58a6ff
  };
  thumb: {
    width: '20px';
    height: '20px';
    background: 'white';
    borderRadius: '50%';
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)';
  };
  labels: {
    fontSize: '12px';
    color: 'var(--fg-muted)';
  };
}
```

---

## Form Sections

### ProjectTabSection

```typescript
// app/components/views/project-settings/tabs/project-tab.tsx
export interface ProjectTabSectionProps {
  project: Project;
  onChange: (field: keyof ProjectFormData, value: unknown) => void;
  errors: Record<string, string>;
  onDelete: () => void;
}
```

### AgentsTabSection

```typescript
// app/components/views/project-settings/tabs/agents-tab.tsx
export interface AgentsTabSectionProps {
  config: ProjectConfig;
  onChange: (field: keyof AgentsFormData, value: unknown) => void;
  errors: Record<string, string>;
  availableTools: string[];
}
```

### ConfigurationTabSection

```typescript
// app/components/views/project-settings/tabs/configuration-tab.tsx
export interface ConfigurationTabSectionProps {
  config: ProjectConfig;
  onChange: (field: keyof ConfigurationFormData, value: unknown) => void;
  errors: Record<string, string>;
}
```

---

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `name` | Required, 1-100 chars | "Project name is required" |
| `path` | Must be valid directory | "Path does not exist" |
| `path` | Must be git repository | "Path is not a git repository" |
| `maxConcurrentAgents` | 1-10 | "Must be between 1 and 10" |
| `maxTurns` | 10-500 | "Must be between 10 and 500" |
| `worktreeRoot` | Valid path segment | "Invalid directory name" |
| `defaultBranch` | Valid branch name | "Invalid branch name format" |

---

## Business Rules

| Rule | Description |
|------|-------------|
| **Path immutable** | Repository path cannot be changed after creation |
| **Validation on blur** | Fields validated when focus leaves |
| **Save on Cmd+S** | Keyboard shortcut saves all changes |
| **Unsaved warning** | Prompt when navigating with unsaved changes |
| **Delete confirmation** | Type project name to confirm deletion |
| **Config cascade** | Project config overrides global defaults |

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + S` | Save all changes |
| `Escape` | Cancel and discard changes |
| `Tab` | Navigate between fields |
| `1/2/3` | Switch to tab 1/2/3 |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| Tab navigation | ARIA tabs pattern |
| Focus management | Focus first field on tab change |
| Error association | `aria-describedby` for field errors |
| Delete confirmation | Focus trap in confirmation dialog |

---

## Error Conditions

| Condition | Error Code | UI Behavior |
|-----------|------------|-------------|
| Project not found | `PROJECT_NOT_FOUND` | Redirect to projects list |
| Validation failed | `VALIDATION_ERROR` | Show inline field errors |
| Save failed | `PROJECT_CONFIG_INVALID` | Show toast, keep form open |
| Delete blocked | `PROJECT_HAS_RUNNING_AGENTS` | Show warning, disable button |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Project Service](../services/project-service.md) | Project CRUD, config validation |
| [Config Management](../configuration/config-management.md) | Config hierarchy |
| [Agent Config Dialog](./agent-config-dialog.md) | Similar config UI patterns |
| [Form Inputs](./form-inputs.md) | Input components |
| [Error Catalog](../errors/error-catalog.md) | `PROJECT_*` error codes |
