# Archived Phase 1 K8s Provider

These files are from the Phase 1 custom Kubernetes sandbox provider implementation
that used raw `@kubernetes/client-node` API calls (~4,300 LOC).

Phase 2 replaced this with the Agent Sandbox CRD-based approach using:

- `@agentpane/agent-sandbox-sdk` — Standalone SDK for the Agent Sandbox CRD
- `agent-sandbox-provider.ts` — New provider implementing EventEmittingSandboxProvider
- `agent-sandbox-instance.ts` — New sandbox instance implementing Sandbox interface

These files are kept for reference but are no longer used in production.

## Archived Files

- `k8s-provider.ts` — Custom K8s sandbox provider
- `k8s-sandbox.ts` — K8s sandbox instance (exec, tmux)
- `k8s-config.ts` — KubeConfig discovery
- `k8s-network-policy.ts` — Network policy management
- `k8s-rbac.ts` — RBAC setup
- `k8s-security.ts` — Pod security validation
- `k8s-audit.ts` — Audit logging
- `k8s-warm-pool.ts` — Warm pool controller
