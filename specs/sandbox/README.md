# Sandbox Specification

This directory contains comprehensive architecture documentation and implementation specifications for the Docker-based code execution sandbox used by AgentPane.

## Overview

The sandbox provides **defense-in-depth isolation** through 4 security layers, enabling autonomous AI agent execution while protecting the host system and user data.

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Docker Container                                    │
│   - Non-root user (automaker) with configurable UID/GID     │
│   - Named volumes only (no host bind mounts)                │
│   - Multi-stage Dockerfile (base → server → production)     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Path Boundary (ALLOWED_ROOT_DIRECTORY)             │
│   - All file ops validated through secureFs adapter         │
│   - DATA_DIR exception for settings/credentials             │
│   - Path traversal protection via isPathWithinDirectory()   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Environment Isolation                               │
│   - Explicit allowlist: ANTHROPIC_API_KEY, PATH, HOME, etc  │
│   - No leakage of process.env to SDK                        │
│   - Environment sanitization for terminal sessions          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Git Worktree Isolation                              │
│   - Each task gets dedicated worktree                        │
│   - Branch isolation prevents cross-task access             │
│   - Init scripts execute in isolated environment            │
└─────────────────────────────────────────────────────────────┘
```

## Document Tree

### Architecture

| Document | Description |
|----------|-------------|
| [`architecture/overview.md`](./architecture/overview.md) | High-level architecture diagrams and component relationships |
| [`architecture/isolation-layers.md`](./architecture/isolation-layers.md) | Defense-in-depth security model with 4 isolation layers |

### Container

| Document | Description |
|----------|-------------|
| [`container/dockerfile.md`](./container/dockerfile.md) | Multi-stage Dockerfile patterns and build configuration |
| [`container/compose.md`](./container/compose.md) | Docker Compose orchestration and service definitions |
| [`container/entrypoint.md`](./container/entrypoint.md) | Container entrypoint script and permission handling |
| [`container/volumes.md`](./container/volumes.md) | Named volume isolation and persistence strategy |

### SDK Integration

| Document | Description |
|----------|-------------|
| [`sdk-integration/provider.md`](./sdk-integration/provider.md) | ClaudeProvider implementation wrapping Claude Agent SDK |
| [`sdk-integration/streaming.md`](./sdk-integration/streaming.md) | AsyncGenerator patterns for event streaming |
| [`sdk-integration/session-continuity.md`](./sdk-integration/session-continuity.md) | Session management via sdkSessionId and resume |
| [`sdk-integration/tool-execution.md`](./sdk-integration/tool-execution.md) | Tool definitions and execution patterns |

### Security

| Document | Description |
|----------|-------------|
| [`security/path-boundary.md`](./security/path-boundary.md) | ALLOWED_ROOT_DIRECTORY enforcement |
| [`security/secure-fs.md`](./security/secure-fs.md) | Secure file I/O adapter with throttling |
| [`security/environment-variables.md`](./security/environment-variables.md) | Environment variable filtering and allowlists |

### Terminal

| Document | Description |
|----------|-------------|
| [`terminal/terminal-service.md`](./terminal/terminal-service.md) | PTY session management with node-pty |
| [`terminal/session-limits.md`](./terminal/session-limits.md) | Resource constraints and session limiting |

### Worktree

| Document | Description |
|----------|-------------|
| [`worktree/worktree-lifecycle.md`](./worktree/worktree-lifecycle.md) | Git worktree isolation for task execution |

### Implementation

| Document | Description |
|----------|-------------|
| [`tasks.md`](./tasks.md) | Implementation task breakdown with phases |

## End-to-End Workflow

```
User Input (UI)
     │
     ▼
┌─────────────────┐
│ AgentService    │  HTTP POST /api/agent/send (non-blocking)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ClaudeProvider  │  Wraps @anthropic-ai/claude-agent-sdk
│                 │  - permissionMode: 'bypassPermissions'
│                 │  - allowDangerouslySkipPermissions: true
│                 │  - Session continuity via sdkSessionId
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SDK query()     │  AsyncGenerator<ProviderMessage>
│                 │  - stream_event (tokens)
│                 │  - assistant_message (turns)
│                 │  - tool_use / tool_result
│                 │  - result (completion)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tool Execution  │  Read, Write, Edit, Bash, Glob, Grep, etc.
│                 │  All file ops → SecureFS → PathValidator
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ WebSocket       │  Events streamed to frontend
│ Broadcast       │  agent:stream, tool_use, complete, error
└─────────────────┘
```

## Key Implementation Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage container with non-root user |
| `docker-entrypoint.sh` | Permission handling, credential injection |
| `libs/platform/src/security.ts` | ALLOWED_ROOT_DIRECTORY enforcement |
| `libs/platform/src/secure-fs.ts` | Throttled file I/O with path validation |
| `apps/server/src/providers/claude-provider.ts` | SDK integration with env allowlist |
| `apps/server/src/services/terminal-service.ts` | PTY session management |

## Quick Reference

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ALLOWED_ROOT_DIRECTORY` | Main security boundary | `/projects` |
| `DATA_DIR` | Settings/credentials storage | `/data` |
| `ANTHROPIC_API_KEY` | Claude API authentication | - |
| `TERMINAL_MAX_SESSIONS` | Max concurrent terminals | `1000` |

### Allowed Environment Variables (SDK Passthrough)

```typescript
const ALLOWED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'PATH',
  'HOME',
  'SHELL',
  'TERM',
  'USER',
  'LANG',
  'LC_ALL',
];
```

### Docker Compose Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `automaker-data` | `/data` | Session data, settings |
| `automaker-claude-config` | `/home/automaker/.claude` | Claude CLI auth |
| `automaker-cursor-config` | `/home/automaker/.cursor` | Cursor CLI auth |
| `automaker-opencode-*` | `/home/automaker/.local/share/opencode` | OpenCode auth |

## Related Specifications

- [`../application/security/sandbox.md`](../application/security/sandbox.md) - Application-level sandbox spec
- [`../application/integrations/claude-agent-sdk.md`](../application/integrations/claude-agent-sdk.md) - SDK integration spec
- [`../application/integrations/git-worktrees.md`](../application/integrations/git-worktrees.md) - Git worktree spec
