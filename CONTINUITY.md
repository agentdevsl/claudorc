# Continuity Ledger

- Goal (incl. success criteria): Fix 400 INVALID_QUESTIONS_ID when answering AI task questions; add regression tests.
- Constraints/Assumptions: Use bun; TS strict; async/await; TDD; Result types; update SPEC_UPDATES.md for spec errors.
- Key decisions: None yet.
- State: Added more visible spinner styling for question submit.
- Done: Updated submit answers button to show visible spinner styling while submitting.
- Now: Confirm spinner visibility in UI.
- Next: Add server-side idempotent handling/logging if 400 persists.
- Open questions (UNCONFIRMED): None.
- Working set (files/ids/commands): `src/app/components/features/new-task-dialog/questions-panel.tsx`.
