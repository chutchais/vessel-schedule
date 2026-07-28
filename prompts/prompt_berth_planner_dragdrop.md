Implement drag-and-drop rescheduling in both Berth Planner views.

Before editing, read PROJECT_HANDOFF.md and CHANGELOG.md and inspect the existing planner scales, geometry, conflict engine and Schedule update API.

Requirements:

- Allow authorized users to drag a vessel to change its planned time, berth and berthPositionMeters.
- Support both Position and Datetime views using each view’s existing inverse coordinate mapping.
- Preserve the vessel’s schedule duration and LOA while moving.
- Snap time to 30-minute intervals and berth position to 5-metre intervals.
- Respect berth.zeroOriginSide.
- Show a translucent live preview at the proposed location; do not update the database during movement.
- Display proposed berth, position, ETB/ETA and ETD while dragging.
- Clearly mark valid, invalid and conflicting drop locations.
- Reject drops outside a berth, outside the visible planner area, or where the vessel does not fit.
- Check conflicts using domain values, not canvas pixels.
- Do not allow conflicts according to the project’s existing conflict policy.
- On drop, open a confirmation dialog showing old and new values.
- Save only after confirmation through the existing schedule update API and validation.
- Verify organization ownership and edit permission server-side.
- Handle stale schedules and concurrent changes gracefully.
- On success, refresh planner data without a full page reload and record the change in the audit log.
- On failure or cancellation, return the vessel to its original location.
- Preserve the active week, terminal, filters, view and selection.
- Add pointer capture, a small movement threshold and Escape-to-cancel.
- Prevent accidental dragging when clicking controls, labels or the details panel.
- Support mouse and touch/pointer events.
- Do not implement duration resizing in this task.

Keep drag state separate from persisted schedule state. Reuse the existing scale, inverse mapping, snapping, validation and conflict functions; do not duplicate business rules.

Add tests for both views, snapping, zeroOriginSide, cross-berth movement, invalid drops, conflicts, cancellation, confirmation, authorization and stale updates.

Run type-check, lint and relevant tests. Update CHANGELOG.md and PROJECT_HANDOFF.md. Do not commit or push.