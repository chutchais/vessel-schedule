Implement schedule duration resizing in both Berth Planner views.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect the existing planner geometry, drag-and-drop implementation, conflict engine and schedule update API. Briefly report your plan before editing.

Requirements:

- Position view: resize from the vessel’s top/start and bottom/end edges.
- Datetime view: resize from the left/start and right/end edges.
- Pointer inside the vessel continues to move it; pointer near a time edge resizes it.
- Reuse existing drag preview, snapping, validation, confirmation and stale-update handling.
- Snap resized times to 30-minute intervals.
- Preserve terminal, berth, berthPositionMeters and vessel LOA.
- Start resize updates ETB when ETB exists; otherwise update ETA.
- End resize updates ETD.
- Never automatically modify ETA when ETB exists.
- Show resize handles/cursor, translucent preview, proposed times and duration.
- Use a 6–10 pixel edge hit area, independent of zoom.
- Mark invalid or conflicting previews clearly.
- Reject end <= start, unauthorized/locked schedules, invalid durations and conflicts according to the existing policy.
- Escape or cancellation restores the original schedule.
- On pointer release, show a confirmation dialog with old and new values.
- Save only after confirmation using the existing Schedule update API.
- Revalidate authorization, organization ownership, conflicts and stale data server-side.
- Refresh planner data without a full page reload after saving.
- Record changed fields and “Berth Planner resize” context in the audit log.
- Preserve the active terminal, week, view, filters and selection.
- Support mouse and touch/pointer events.
- Do not add spatial/LOA resizing or unrelated refactoring.

Keep resize state separate from persisted data and reuse existing domain scales and business rules.

Add focused tests for both views, start/end resizing, ETA/ETB selection, snapping, minimum duration, conflicts, cancellation, confirmation, permissions and stale updates.

Run type-check, lint and relevant tests; run the production build if practical. Fix issues introduced by this work. Update CHANGELOG.md and PROJECT_HANDOFF.md. Report changed files, verification results and remaining risks. Do not commit or push.