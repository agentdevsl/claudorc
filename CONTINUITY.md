# Continuity Ledger

- Goal (incl. success criteria): Make E2E tests pass by ensuring the dev server starts via bun and aligning UI selectors/data setup with E2E expectations; expand UI test coverage toward 100% per user request across components and links.
- Constraints/Assumptions: Specs are source of truth; use bun; TS strict; async/await; TDD; use Result types; update SPEC_UPDATES.md for spec errors.
- Key decisions: E2E uses CLI-driven agent-browser runner; test:e2e runs bun scripts/e2e-test.ts; E2E_SEED used for test data; in-memory PGlite for E2E.
- State: In progress; full E2E run shows 107 failures/67 skipped. Many errors are missing data-testid selectors and agent-browser navigation conflicts (ERR_ABORTED/daemon failed) likely due to concurrent E2E execution.
- Done: Added E2E seed data in bootstrap; restored workflow test selectors; added testids in dialogs/cards; set PGlite to in-memory when E2E_SEED is true; fixed Vite overlay syntax error; switched agent-browser CLI wrapper to execFile without quoting selectors; ran `bun scripts/e2e-test.ts` full suite and captured failures.
- Now: Update E2E config to run sequentially (avoid concurrent navigation) and align missing data-testid attributes in UI components (sidebar, layout shell, kanban board/columns, theme toggle, settings, empty/error states, etc.).
- Next: Re-run workflow E2E, then full E2E suite; iterate on remaining failures.
- Open questions (UNCONFIRMED if needed): Are E2E seed entities for `/projects/test-project`, `/sessions/test-session` actually created during bootstrap?
- Working set (files/ids/commands): vitest.e2e.config.ts, tests/e2e/setup.ts, app/components/features/*, app/routes/*.
