# Continuity Ledger

- Goal (incl. success criteria): Complete Phase 4 UI per specs with DI-based services, streaming hooks, and component coverage; tests added and specs updated for deviations.
- Constraints/Assumptions: Use bun, TS strict, async/await; follow .design-engineer/system.md; update SPEC_UPDATES.md for spec errors.
- Key decisions: Router context now carries services/bootstrap; routes fetch via loader context + hooks for edits.
- State: Added router context wiring in `src/app/router.tsx` + client provider; added feature components (layout shell, sidebar, breadcrumbs, new project dialog, settings, queue/session/worktree/github/error widgets); routes updated to use layout shell and loader context; agents list no longer uses placeholder project id; added Vitest + RTL setup and initial component tests. Sidebar file still needs cleanup to ensure consistent quote style.
- Done: Added ServiceProvider/bootstrap; use-session/use-agent-stream/use-presence/use-services hooks; rewrote kanban + dialogs; wired routes to DI; added `tests/setup.ts` + component tests.
- Now: Finalize sidebar file cleanup + add remaining routes (queue, sessions list, worktrees, settings) and ensure router context consistent.
- Next: Address stubbed command runner and expand UI tests coverage.
- Working set (files/ids/commands): src/app/router.tsx; src/app/client.tsx; src/app/components/features/sidebar.tsx; src/app/components/features/layout-shell.tsx; src/app/routes/index.tsx; src/app/routes/projects/_; src/app/routes/agents/_; src/app/routes/sessions/$sessionId.tsx; tests/components/\*.test.tsx; tests/setup.ts; SPEC_UPDATES.md
