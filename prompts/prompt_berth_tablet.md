Improve Berth Planner tablet, touch and keyboard usability.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect both planner views, click-to-create, drag-and-drop, duration resizing, filters, conflict panel, Recent Changes and confirmation dialogs. Briefly report the plan before editing.

Requirements:

- Support these viewports:
  - 768×1024 portrait
  - 1024×768 landscape
  - 820×1180 tablet
  - 1366×768 small laptop
- Keep the seven-day overview visible where practical.
- Use responsive/collapsible panels and sidebar behavior.
- Make interactive controls at least 44×44 CSS pixels.
- Enlarge resize and vessel hit areas for touch without changing domain geometry.
- Use Pointer Events consistently for mouse, pen and touch.
- Use pointer capture during drag/resize and release it safely.
- Prevent page scrolling and text selection only during an active planner interaction.
- Do not globally disable normal touch scrolling.
- Add a movement threshold so normal taps do not accidentally drag vessels.
- A tap selects a vessel and opens details; do not depend on hover.
- Preserve mouse hover tooltips on desktop.
- Ensure touch users can create schedules intentionally; prefer long-press or an explicit “Add schedule” mode if a normal tap would be ambiguous.
- Show clear live feedback for drag, resize, snapping, validity and conflicts.
- Provide Escape/Cancel controls and restore original data on cancellation.
- Make dialogs, filters, Recent Changes and conflict panels fit small screens without clipping actions.
- Keep primary actions reachable without horizontal page scrolling.
- Show saving/progress feedback and prevent duplicate submission.
- Preserve terminal, week, view, filters, zoom and selection across responsive layout changes.
- Respect safe-area insets where applicable.
- Respect prefers-reduced-motion.
- Avoid unrelated visual redesign or business-rule changes.

Keyboard accessibility:

- All controls must be reachable with Tab.
- Provide visible focus styles.
- Enter/Space activates buttons.
- Escape closes dialogs and cancels active interactions.
- Do not create keyboard traps.
- Canvas schedules must have an accessible list/details alternative.
- Provide meaningful labels for view switches, navigation, filters and planner actions.

Testing:

- Test mouse, touch and pen/pointer behavior where supported.
- Add focused tests for tap selection, movement threshold, pointer capture, scroll prevention during interaction, touch resize handles, cancellation, responsive panels and keyboard operation.
- Verify Position and Datetime views at all listed viewport sizes.
- Verify create, edit, drag, resize, conflicts, filters, synchronization and export still work.
- Run type-check, lint, relevant tests and production build.
- Update PROJECT_HANDOFF.md and CHANGELOG.md with tested viewport sizes and remaining limitations.
- Report changed files, verification results and any device testing still required.
- Do not commit or push.