# Spec Updates

- 2026-01-17: Spec uses `createServerFileRoute` from `@tanstack/react-start/server`, but TanStack Start server routes are defined via `createFileRoute` with a `server.handlers` block (no `createServerFileRoute` export). Fix: update specs/examples to use `createFileRoute('/path')({ server: { handlers: { ... } } })` and route paths inferred from file location.
- 2026-01-17: Spec hardcodes `APP_URL`/`http://localhost:5173` for session URL generation; existing config schema uses `DATABASE_URL` and no app URL env var. Fix: define `APP_URL` (or `PUBLIC_URL`) env var in config docs and update SessionService to read env var instead of hardcoded baseUrl.
- 2026-01-17: Phase 4 route examples reference `getProjectService` helpers that are not defined in the codebase. Fix: add a DI factory in specs or update examples to use injected service instances.
- 2026-01-18: Spec/database schema lists `githubInstallationId` and `configPath` on `projects`, but `src/db/schema/projects.ts` omits both; code and API currently only support `githubOwner`/`githubRepo`. Fix: update schema/spec alignment or implement missing columns before GitHub sync.
- 2026-01-18: RESOLVED - Added `githubInstallationId` (FK to `githubInstallations.id`) and `configPath` (default `.claude`) columns to `projects` schema. Schema now aligned with spec.
