Implement “Undo recent planner change” for the Berth Planner.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect schedule create/edit, drag-and-drop, duration resize, audit logging and stale-update handling. Briefly report the plan before editing.

Requirements:

- After a successful planner move or duration resize, show an Undo toast/action.
- Undo restores the schedule values that existed immediately before that operation.
- Support changes made from both Position and Datetime views.
- Undo must use the existing schedule update API, authorization, validation and organization scoping.
- Do not reverse changes by modifying client state only.
- Revalidate conflicts, permissions and stale data server-side.
- Use optimistic concurrency/version checking so Undo cannot overwrite a newer change.
- If another update occurred, reject Undo and show a clear stale-data message.
- Each Undo action applies only to its own completed operation and can run once.
- Give the action a limited lifetime, such as 15 seconds.
- Expired or already-used Undo actions must do nothing safely.
- On success, refresh planner data without a full reload while preserving terminal, week, view, filters and selection.
- Write Undo as a new audit-log event; never delete or alter the original audit record.
- Record the original operation reference and “Berth Planner undo” context.
- If restoring values creates a forbidden conflict, follow the existing conflict policy.
- Handle network failures without losing the current correct planner state.
- Do not add general multi-level undo/redo or unrelated refactoring.

Prefer a server-issued, single-use undo token or operation ID containing no trusted client-supplied previous values. If the current architecture cannot support that safely, explain the smallest required backend change before implementing.

Add focused tests for successful undo, one-time use, expiration, stale versions, conflicts, permissions, organization isolation, audit history and state preservation.

Run type-check, lint and relevant tests; run the production build if practical. Fix issues introduced by this work. Update CHANGELOG.md and PROJECT_HANDOFF.md. Report changed files, verification results and remaining risks. Do not commit or push.