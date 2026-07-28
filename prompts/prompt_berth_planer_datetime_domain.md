Implement the datetime-domain view for the Berth Planner.

Before editing, read PROJECT_HANDOFF.md and CHANGELOG.md and inspect the completed position-domain implementation.

Requirements:

- Add a view switch: Position / Datetime.
- Datetime view:
  - X-axis = datetime for the selected seven-day week.
  - Y-axis = berth lanes with position in metres.
  - Vessel width = schedule duration.
  - Vessel height = vessel LOA.
- Show exactly six time-grid positions per day: 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00.
- Draw daily boundaries and 50-metre berth-position lines in bold.
- Respect each berth’s zeroOriginSide and vessel heading.
- Fit the full seven-day range horizontally, with all berth lanes visible where practical.
- Reuse the existing API data, filters, timezone logic, validation, conflict detection, selection, tooltip, details and edit form.
- Keep coordinate mapping, drawing and hit-testing view-specific; do not duplicate business logic.
- Preserve the selected terminal, week, filters and schedule when switching views.
- Keep click-to-create and interactive editing working in both views.
- Persist the user’s preferred view locally.
- Maintain organization isolation and server-side authorization.

Add focused tests for datetime coordinate conversion, inverse click mapping, berth-lane placement, zeroOriginSide, view switching and state preservation.

Run type-check, lint and relevant tests. Update CHANGELOG.md and PROJECT_HANDOFF.md. Do not commit or push.