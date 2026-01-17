# GitHubAppSetup Component Specification

## Overview

The GitHubAppSetup component provides a multi-state interface for connecting, configuring, and managing the GitHub App integration. It handles OAuth flow, installation selection, repository sync, and disconnection.

**Related Wireframes:**

- [GitHub App Setup](../wireframes/github-app-setup.html) - All states: disconnected, OAuth, installation, connected

---

## Interface Definition

```typescript
// app/components/views/github-setup/types.ts
import type { Result } from '@/lib/utils/result';

// ===== Connection States =====
export type GitHubConnectionState =
  | 'disconnected'  // Not connected
  | 'connecting'    // OAuth in progress
  | 'selecting'     // Choosing installation
  | 'connected';    // Fully connected

// ===== Component Props =====
export interface GitHubAppSetupProps {
  /** Callback when connection state changes */
  onConnectionChange?: (state: GitHubConnectionState) => void;
  /** Callback when connection completes */
  onConnected?: (installation: GitHubInstallation) => void;
  /** Callback when disconnected */
  onDisconnected?: () => void;
}

// ===== GitHub Installation =====
export interface GitHubInstallation {
  id: string;
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  avatarUrl?: string;
  repositoryCount: number;
  installedAt: Date;
}

// ===== Repository Info =====
export interface GitHubRepository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  configPath?: string;
  syncStatus: 'synced' | 'pending' | 'no-config' | 'error';
  lastSyncedAt?: Date;
}

// ===== Permissions =====
export interface GitHubPermission {
  name: string;
  level: 'read' | 'write' | 'admin';
  description: string;
}
```

---

## Component Specifications

### GitHubAppSetup (Container)

```typescript
// app/components/views/github-setup/index.tsx
export interface GitHubAppSetupProps {
  onConnectionChange?: (state: GitHubConnectionState) => void;
  onConnected?: (installation: GitHubInstallation) => void;
  onDisconnected?: () => void;
}
```

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onConnectionChange` | `function` | No | - | Called when state changes |
| `onConnected` | `function` | No | - | Called when connected |
| `onDisconnected` | `function` | No | - | Called when disconnected |

---

## State: Disconnected

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                           ┌─────────────────┐                           │
│                           │                 │                           │
│                           │     GitHub      │  ← Dashed circle          │
│                           │      Icon       │                           │
│                           │                 │                           │
│                           └─────────────────┘                           │
│                                                                         │
│                        Connect to GitHub                                │
│                                                                         │
│     Install the AgentPane GitHub App to enable configuration            │
│       sync, automatic pull requests, and repository management.         │
│                                                                         │
│                    [ 🐙 Connect with GitHub ]                           │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │   🔄 Config      │  │   🔀 Pull        │  │   📄 Webhooks    │      │
│  │      Sync        │  │      Requests    │  │                  │      │
│  │  Automatically   │  │  Create PRs      │  │  Receive push    │      │
│  │  sync agent      │  │  automatically   │  │  events to auto  │      │
│  │  configuration   │  │  when agents     │  │  update configs  │      │
│  │  from your repo  │  │  complete tasks  │  │                  │      │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### DisconnectedState Component

```typescript
// app/components/views/github-setup/states/disconnected.tsx
export interface DisconnectedStateProps {
  onConnect: () => void;
}
```

#### Feature Cards

| Feature | Icon | Title | Description |
|---------|------|-------|-------------|
| Config Sync | 🔄 | Config Sync | Automatically sync agent configuration from your repository |
| Pull Requests | 🔀 | Pull Requests | Create PRs automatically when agents complete tasks |
| Webhooks | 📄 | Webhooks | Receive push events to auto-update configurations |

---

## State: Connecting (OAuth Flow)

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│     ┌───────────┐      ─────────      ┌───────────┐      ─────────      │
│     │     ✓     │  ══════════════     │     ◐     │  ──────────────     │
│     └───────────┘                     └───────────┘                     │
│    Clicked Install                   GitHub Setup                       │
│                                                                         │
│                   ┌───────────┐                                         │
│                   │     3     │  (pending)                              │
│                   └───────────┘                                         │
│                     Auto-Sync                                           │
│                                                                         │
│                Complete Installation on GitHub                          │
│                                                                         │
│    Select the account/organization and repositories in the              │
│    GitHub window. We'll automatically sync via webhook when done.       │
│                                                                         │
│    ┌─────────────────────────────────────────────────────────────┐     │
│    │  Automated via Octokit:                                     │     │
│    │  • Webhook receives installation.created event              │     │
│    │  • Octokit auto-generates installation tokens               │     │
│    │  • Repositories synced via app.eachRepository               │     │
│    │  • Config files detected and imported                       │     │
│    └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
│                            [Cancel]                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### OAuthFlowState Component

```typescript
// app/components/views/github-setup/states/oauth-flow.tsx
export interface OAuthFlowStateProps {
  currentStep: 1 | 2 | 3;
  onCancel: () => void;
}
```

#### Step Indicators

| Step | Status | Icon | Label |
|------|--------|------|-------|
| 1 | Completed | ✓ (green) | Clicked Install |
| 2 | Active | Spinner | GitHub Setup |
| 3 | Pending | Number | Auto-Sync |

---

## State: Selecting Installation

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Select Installation                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Choose which GitHub account or organization to connect:                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ┌────┐  simon-lynch                              [Personal]  ○ │   │
│  │  │ 👤 │  12 repositories accessible                             │   │
│  │  └────┘                                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ┌────┐  acme-corp                            [Organization]  ● │   │
│  │  │ 🏢 │  47 repositories accessible                  ← Selected │   │
│  │  └────┘                                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│  │  + Add Another Installation                                     │   │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  You can add more installations later         [Cancel]  [Continue]     │
└─────────────────────────────────────────────────────────────────────────┘
```

### InstallationSelectState Component

```typescript
// app/components/views/github-setup/states/installation-select.tsx
export interface InstallationSelectStateProps {
  installations: GitHubInstallation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onCancel: () => void;
  onContinue: () => void;
}
```

#### Installation Item

| Element | Description |
|---------|-------------|
| Avatar | 48px, rounded circle |
| Name | Account/org login, semibold |
| Type badge | "Personal" or "Organization" |
| Repo count | "N repositories accessible" |
| Selection | Radio button, right side |

---

## State: Connected

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ✓  GitHub Connected                                            │   │
│  │     Authenticated as simon-lynch · Last synced 2 minutes ago    │   │
│  │                                              [Sync Now]         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Installations ──────────────────────────────────── [+ Add] ────┐   │
│  │                                                                 │   │
│  │  ┌────┐  simon-lynch                     [Personal]  [Manage]   │   │
│  │  │ 👤 │  12 repositories · Installed Jan 15, 2025               │   │
│  │  └────┘                                                         │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Synced Repositories ────────────────────────────── 3 repos ────┐   │
│  │                                                                 │   │
│  │  📁 simon-lynch/claudorc           ✓ Synced    [👁] [🔄]       │   │
│  │     .claude/config.json                                         │   │
│  │                                                                 │   │
│  │  📁 simon-lynch/webapp-dashboard   ✓ Synced    [👁] [🔄]       │   │
│  │     .claude/config.json                                         │   │
│  │                                                                 │   │
│  │  📁 simon-lynch/agent-sdk-examples ⚠ No Config [+]              │   │
│  │     No config found                                             │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ App Permissions ───────────────────────────────────────────────┐   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │ 📄 Contents  │  │ 🔀 Pull Reqs │  │ 📁 Metadata  │          │   │
│  │  │ Read & Write │  │ Read & Write │  │ Read-only    │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ Danger Zone ─────────────────────────── (red border) ──────────┐   │
│  │                                                                 │   │
│  │  Disconnect GitHub                                              │   │
│  │  Remove the GitHub integration and revoke all access tokens     │   │
│  │                                              [Disconnect]       │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### ConnectedState Component

```typescript
// app/components/views/github-setup/states/connected.tsx
export interface ConnectedStateProps {
  installations: GitHubInstallation[];
  repositories: GitHubRepository[];
  permissions: GitHubPermission[];
  lastSyncedAt: Date;
  onSyncNow: () => void;
  onManageInstallation: (id: string) => void;
  onAddInstallation: () => void;
  onViewConfig: (repo: GitHubRepository) => void;
  onSyncRepo: (repo: GitHubRepository) => void;
  onCreateConfig: (repo: GitHubRepository) => void;
  onDisconnect: () => void;
}
```

---

### Repository Sync Status

| Status | Icon | Badge Color | Actions |
|--------|------|-------------|---------|
| `synced` | ✓ | Green | View, Sync |
| `pending` | ⏳ | Amber | - |
| `no-config` | ⚠ | Amber | Create |
| `error` | ✗ | Red | Retry |

---

### Permission Display

| Permission | Level | Icon |
|------------|-------|------|
| Contents | Read & Write | 📄 |
| Pull Requests | Read & Write | 🔀 |
| Metadata | Read-only | 📁 |
| Webhooks | push, pull_request | 💬 |

---

## Business Rules

| Rule | Description |
|------|-------------|
| **OAuth popup** | Opens GitHub in new window for OAuth |
| **Webhook sync** | Installation completes via webhook callback |
| **Multi-install** | Can connect multiple accounts/orgs |
| **Config detection** | Scans for `.claude/` directory |
| **Disconnect** | Revokes all tokens, removes installation |

---

## Error Conditions

| Condition | Error Code | UI Behavior |
|-----------|------------|-------------|
| OAuth failed | `GITHUB_AUTH_FAILED` | Show error, return to disconnected |
| Installation failed | `GITHUB_INSTALLATION_NOT_FOUND` | Show error toast |
| Sync failed | `GITHUB_SYNC_FAILED` | Show retry option |
| Rate limited | `GITHUB_RATE_LIMITED` | Show wait time |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| Focus management | Focus first element on state change |
| Step indicators | `aria-current="step"` on active |
| Selection | `role="radiogroup"` for installations |
| Status | `aria-live` for connection status |

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [GitHub App](../integrations/github-app.md) | OAuth and webhook integration |
| [Config Management](../configuration/config-management.md) | Config file sync |
| [Error Catalog](../errors/error-catalog.md) | `GITHUB_*` error codes |
