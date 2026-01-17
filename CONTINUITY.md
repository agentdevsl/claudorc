# Continuity Ledger

- Goal (incl. success criteria): Complete Phase 4 UI per specs with DI-based services, streaming hooks, and component coverage; tests added and specs updated for deviations.
- Constraints/Assumptions: Use bun, TS strict, async/await; follow .design-engineer/system.md; update SPEC_UPDATES.md for spec errors.
- Key decisions: Router context now carries services/bootstrap; routes fetch via loader context + hooks for edits.
- State: Added router context wiring in `src/app/router.tsx` + client provider; added feature components (layout shell, sidebar, breadcrumbs, new project dialog, settings, queue/session/worktree/github/error widgets); routes updated to use layout shell and loader context; agents list no longer uses placeholder project id; Vitest + RTL setup and expanded component tests for sessions/worktrees/queue/settings. Implemented a shared runtime for API routes with Bun-backed command runner and test-safe fallback; API routes now use runtime helper with pglite instance. Tests pass.
- Done: Added ServiceProvider/bootstrap; use-session/use-agent-stream/use-presence/use-services hooks; rewrote kanban + dialogs; wired routes to DI; added `tests/setup.ts` + component tests; cleaned `sidebar.tsx` and routes formatting; installed `jsdom`; updated agent session test expectation; added component tests for session history, queue status, queue waiting state, worktree management, and project settings; implemented command runner in `services.ts` with fallback in tests; added `src/app/services/runtime.ts` + `src/app/routes/api/runtime.ts`; refactored API routes to use shared runtime; adjusted API tests for runtime mock; added invalid project id handling in `projects/$id` route; `bun run test` green.
- Now: Phase 4 readiness verified (typecheck/check/tests passing).
- Next: Confirm Phase 4 complete and proceed to next steps when ready.
- Working set (files/ids/commands): tests/api/session-stream.test.ts; tests/api/runtime.test.ts
