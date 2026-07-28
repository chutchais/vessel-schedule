Implement planner synchronization, changed-vessel highlighting and a Recent Changes panel.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Review the old implementation at:
https://github.com/chutchais/vessel-schedule-v1.git

Focus on its schedule-change blinking behavior, but adapt it to the current architecture. Inspect the existing audit log, schedule versioning, planner state and authorization. Briefly report the plan before editing.

Requirements:

- Poll for changes relevant to the selected organization, terminal and visible week every 20–30 seconds.
- Use audit-event IDs, revisions or a server-issued cursor; do not detect changes only by comparing canvas pixels.
- Pause applying updates while creating, editing, dragging, resizing, undoing or confirming.
- Resume afterward and fetch missed changes.
- Never overwrite local in-progress interaction state.
- Preserve terminal, week, domain view, filters, zoom and selection.
- Keep existing server-side stale-version checks.

Changed-vessel feedback:

- Created schedule: green fade-in highlight.
- Updated, moved, resized or undone: amber pulse/highlight for 4–6 seconds.
- Conflict introduced: red pulse, followed by the normal persistent conflict style.
- Changes by another user should be stronger than changes by the current user.
- Avoid continuous flashing.
- Respect prefers-reduced-motion by using a temporary static highlight.
- If a selected schedule changes, show “Updated by another user” and refresh its details safely.
- If deleted or moved outside the visible week, remove it and explain through a notification/recent-change entry.

Recent Changes panel:

- Show the latest 20–50 schedule events for the selected terminal and relevant week.
- Display change time in the port timezone, vessel, voyage, action, user, changed fields and conflict state.
- Recognize created, edited, moved, resized, undone and deleted actions.
- Clicking an entry selects and focuses the vessel when it remains visible.
- If it is filtered out, deleted or outside the week, explain why it cannot be focused.
- Link each entry to the schedule’s full audit history where available.
- Provide loading, empty and error states.
- Keep the panel responsive without preventing the seven-day overview from fitting the screen.

Security and API:

- Derive organization context server-side.
- Verify terminal access and permissions server-side.
- Return only events after the supplied cursor and only data visible to the active organization.
- Validate and limit polling parameters.
- Do not expose sensitive audit metadata.
- Avoid fetching the full audit log on every poll.
- Prevent overlapping polling requests and handle temporary failures with backoff.
- Refresh planner data only when relevant changes are returned.

Add tests for cursor polling, organization isolation, missed-event recovery, polling pause/resume, create/update/delete events, highlights, reduced-motion behavior, selected schedule updates, filtered/out-of-week entries and Recent Changes navigation.

Run type-check, lint and relevant tests; run the production build if practical. Fix issues introduced by this work. Update CHANGELOG.md and PROJECT_HANDOFF.md. Report changed files, verification results and remaining risks. Do not commit or push.