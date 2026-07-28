Implement interactive schedule editing in the position-domain Berth Planner.

Before editing, read PROJECT_HANDOFF.md and CHANGELOG.md and inspect the existing planner and Vessel Schedule form.

Requirements:

- Clicking a vessel shape selects it and opens its details panel.
- Add an Edit action that opens the existing Vessel Schedule form with current values pre-filled.
- Reuse the existing form, validation, authorization and API; do not create a duplicate edit form.
- Do not implement drag-and-drop or resizing yet.
- Verify organization ownership and permissions server-side.
- Validate dates, berth position, vessel fit and schedule conflicts before saving.
- Show clear validation and conflict messages.
- On successful update, close the form and refresh the planner without a full page reload.
- Preserve the selected terminal, visible week and planner filters.
- Add a link to the schedule’s object-specific audit log.
- Handle schedules changed or deleted by another user gracefully.

Add focused tests for selection, form prefill, authorization, validation, refresh after saving and stale/deleted schedules.

Run type-check, lint and relevant tests. Update CHANGELOG.md and PROJECT_HANDOFF.md. Do not commit or push.