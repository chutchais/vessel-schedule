Implement Weekly Planner print and PDF export for both Berth Planner views.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect the planner canvas/rendering architecture, filters, timezone handling and existing export utilities. Briefly report the implementation plan before editing.

Requirements:

- Add Print and Export PDF actions.
- Support both Position and Datetime views.
- Export the currently selected terminal and visible seven-day week.
- Include:
  - Organization, port and terminal
  - Week start and end
  - Port timezone
  - Current planner view
  - Active filters
  - Vessel shapes and readable labels
  - Berth boundaries
  - Daily and four-hour grid lines
  - Bold 50-metre grid lines
  - Conflict indicators and legend
  - Generated timestamp
- Use a landscape print layout.
- Remove the application sidebar, controls, tooltips, resize handles, drag previews, highlights and animations from output.
- Keep conflict styling understandable in both color and grayscale.
- Ensure canvas content is included at high resolution.
- Avoid exporting only the currently visible canvas pixels if part of the planner is horizontally clipped.
- Scale the complete seven-day planner overview to the printable area where readable.
- If the terminal is too wide, split it across clearly labeled pages while preserving berth and metre context.
- Repeat necessary headers, date labels and legends on additional pages.
- Use the port timezone for all exported dates.
- Keep export data scoped to the active organization and verify terminal access server-side.
- Do not expose hidden schedules unless the export clearly follows the active filters.
- Disable export while planner data is loading or an edit/drag/resize operation is active.
- Show progress and clear error states.
- Do not trigger a full-page reload.
- Avoid unrelated refactoring.

Prefer a dedicated export renderer using planner domain data and shared geometry rather than taking a low-resolution browser screenshot. Reuse existing scales, colors, vessel geometry and conflict rules.

Add focused tests for both views, filtered export, timezone labels, multi-page layout, hidden UI elements, conflict legend, authorization and empty schedules.

Run type-check, lint and relevant tests; run the production build if practical. Fix issues introduced by this work. Update PROJECT_HANDOFF.md and CHANGELOG.md. Report changed files, export approach, verification results and remaining risks. Do not commit or push.