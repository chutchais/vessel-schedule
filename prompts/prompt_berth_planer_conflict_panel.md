Implement a conflict panel for the Berth Planner.

Before editing, read PROJECT_HANDOFF.md and CHANGELOG.md and inspect both position and datetime views.

Requirements:

- Add a panel listing all conflicts in the visible terminal and week.
- Group conflicts by berth, then sort by earliest overlap time.
- Show vessel names, service/voyage, overlapping time range and overlapping metre range.
- Calculate conflicts from domain values, never canvas pixels.
- Reuse the planner’s existing conflict engine; do not create duplicate rules.
- Exclude cancelled schedules using the project’s exact status enum.
- Clicking a conflict selects and highlights both schedules in the active view.
- Provide “Previous” and “Next conflict” navigation.
- Add an “Only conflicts” filter.
- Show clear empty, loading and error states.
- Keep selection and filters when switching Position/Datetime views.
- Respect port timezone, organization isolation and server-side authorization.
- Ensure the panel is responsive and does not prevent the seven-day grid overview from fitting the screen.

Add tests for conflict grouping, sorting, selection, navigation, filtering, view switching and organization isolation.

Run type-check, lint and relevant tests. Update CHANGELOG.md and PROJECT_HANDOFF.md. Do not commit or push.