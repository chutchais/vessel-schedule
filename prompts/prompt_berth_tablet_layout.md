Improve the Berth Planner layout for tablet landscape with collapsible controls and Planner Focus Mode.

First read AGENTS.md if present, PROJECT_HANDOFF.md and CHANGELOG.md. Inspect the application sidebar, planner toolbar, filters, conflict panel, Recent Changes and responsive layout. Briefly report the plan before editing.

Problem:

The planner works well in tablet portrait, but in tablet landscape the schedule grid becomes too short because the page heading, controls and panels consume too much vertical space.

Requirements:

1. Tablet-landscape compact layout
   - Detect compact layout using available viewport dimensions/media queries, not device names.
   - Automatically collapse the application sidebar to icons or its existing compact state.
   - Reduce planner controls to one compact toolbar row where practical.
   - Keep immediately available:
     - Terminal selector
     - Previous week
     - Current week
     - Next week
     - Position/Datetime switch
     - Expand controls
     - Enter Focus Mode
   - Move secondary filters, export, conflicts and Recent Changes into accessible drawers, popovers or collapsible panels.
   - Do not remove any existing functionality.

2. Collapsible planner controls
   - Add a clear Show/Hide Controls action.
   - Collapsing controls must increase the grid’s available height.
   - Preserve active filters when their controls are hidden.
   - Show a compact active-filter count when filters are collapsed.
   - Keep the main week/view controls available.
   - Remember the user’s preference locally.

3. Planner Focus Mode
   - Add Enter/Exit Focus Mode.
   - In Focus Mode, hide the application sidebar, page heading and nonessential panels.
   - Let the planner use nearly the full viewport.
   - Keep a compact floating or fixed planner toolbar.
   - Provide an obvious Exit action.
   - Escape exits Focus Mode unless another modal interaction should handle Escape first.
   - Preserve terminal, week, view, filters, zoom and selected schedule.
   - Do not use browser fullscreen APIs unless there is a clear benefit; implement an application-level focus layout first.
   - Remember the preference locally when appropriate, but do not trap the user in Focus Mode.

4. Responsive behavior
   - Optimize especially for 1024×768 landscape and similar short viewports.
   - Keep portrait behavior working at 768×1024 and 820×1180.
   - Use ResizeObserver or existing layout measurement so the canvas recalculates after sidebar, controls or Focus Mode changes.
   - Prevent clipped dialogs, overlapping toolbar actions and horizontal page scrolling.
   - Use minimum 44×44 touch targets.
   - Respect safe-area insets and prefers-reduced-motion.

5. Accessibility
   - All actions must have accessible names and visible focus states.
   - Support keyboard and touch.
   - Announce Focus Mode state changes where appropriate.
   - Do not hide focused content without moving focus safely.
   - Drawers/popovers must support Escape and return focus to their trigger.

Avoid unrelated visual redesign, planner business-rule changes or duplicated toolbar state.

Add focused tests for compact landscape layout, control collapsing, sidebar behavior, Focus Mode enter/exit, Escape handling, state preservation, rotation/resize and canvas resizing.

Verify Position and Datetime views, filters, conflicts, Recent Changes, drag, resize and export in normal and Focus Mode layouts at the listed viewport sizes.

Run type-check, lint, relevant tests and production build. Update PROJECT_HANDOFF.md and CHANGELOG.md. Report changed files, tested viewport results and remaining device-testing needs. Do not commit or push.