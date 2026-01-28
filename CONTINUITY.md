# Continuity Ledger

- Goal (incl. success criteria): Diagnose why UI appears stuck (log spam; task creation/agent status loops) and fix root cause so UI progresses normally.
- Constraints/Assumptions: Use bun; TS strict; async/await; TDD; Result types; use apply_patch for edits; update SPEC_UPDATES.md for spec errors.
- Key decisions: None yet.
- State: User reports UI stuck; console shows repeated subscription/start sync cycles in task creation and container agent status hooks.
- Done: Review existing logs from user.
- Now: Inspect relevant hooks/sync code and reproduce issue.
- Next: Implement fix + tests if needed.
- Open questions (UNCONFIRMED if needed): What UI view is stuck and what action triggers it (task creation dialog or agent run)?
- Working set (files/ids/commands): UNCONFIRMED (need to inspect use-container-agent-statuses.ts, sync.ts, new-task-dialog.tsx, questions-panel.tsx).
