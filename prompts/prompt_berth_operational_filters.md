Implement operational filters and search for the Berth Planner.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect both planner views, their shared state, URL handling and current data-loading architecture. Briefly report the plan before editing.

Requirements:

- Add search by vessel name, voyage number and schedule reference.
- Add filters for:
  - Service
  - Schedule status
  - Berth
  - Conflicts only
  - Incomplete/invalid placement
- Use the same filter state and results in Position and Datetime views.
- Preserve filters when switching views, changing weeks, creating/editing schedules, dragging or resizing.
- Synchronize filters with URL query parameters so filtered views are bookmarkable and survive refresh.
- Debounce text search.
- Display active filters as removable chips.
- Add “Clear all filters.”
- Show visible schedule count versus total schedule count.
- Use domain data, not canvas geometry, for filtering.
- Reuse the existing conflict and validation results; do not duplicate those rules.
- If the selected schedule becomes hidden, clear the selection and show a brief explanation.
- Filter option values must come only from the active organization and selected terminal.
- Validate all server-side filter parameters and preserve organization isolation.
- Keep the seven-day grid overview fitting the screen.
- Use an accessible responsive filter bar or popover that matches the existing UI.
- Provide clear empty, loading and error states.
- Avoid unrelated refactoring.

Prefer client-side filtering if all schedules for the visible terminal/week are already safely loaded and the expected volume is reasonable. Otherwise use server-side filtering while keeping conflict calculations correct and clearly document the decision.

Add focused tests for search, combined filters, conflicts-only, invalid-only, URL synchronization, clearing filters, view/week preservation, hidden selection and organization isolation.

Run type-check, lint and relevant tests; run the production build if practical. Fix issues introduced by this work. Update CHANGELOG.md and PROJECT_HANDOFF.md. Report changed files, verification results and remaining risks. Do not commit or push.