Implement personal vessel-label font-size controls in the Berth Planner.

First read AGENTS.md if present, PROJECT_HANDOFF.md, CHANGELOG.md and the current
configurable vessel-label implementation. Inspect both Canvas renderers, label fitting,
compact toolbar, Focus Mode, responsive controls and PDF export.

Briefly report the plan before editing. Do not change the organization label template
schema unless genuinely necessary.

Requirements:

- Add vessel-label size controls:
  - A−: decrease font size one step
  - Current percentage/reset control
  - A+: increase font size one step
- Use fixed bounded scale steps:
  80%, 90%, 100%, 110%, 125%, 140%
- Default to 100%.
- Disable A− at 80% and A+ at 140%.
- Clicking the percentage resets to 100%, with a clear tooltip.
- Apply the selected scale to all vessel-shape labels in both Position and Datetime views.
- Do not resize vessel shapes, grid geometry, axes, tooltips or other application text.
- This is a personal display preference, not an organization-wide setting.
- Persist it locally using a versioned key such as:
  berth-planner-label-scale-v1
- Validate stored values against the allowlisted steps.
- Fall back safely to 100% for missing, malformed or unsupported stored values.
- Preserve the preference across refreshes, week/terminal changes, domain switching and
  Focus Mode.
- Do not add database persistence or cross-device synchronization in this task.

Rendering:

- Apply the user scale to the configured line’s preferred/base font size.
- Ensure the scale produces a visibly different result.
- Do not allow Auto sizing to shrink every setting back to the same visual size.
- Continue clipping labels inside vessel polygons.
- Never change schedule geometry or hit testing.
- When enlarged text cannot fit:
  1. Keep higher-priority lines first.
  2. Remove lower-priority lines.
  3. Ellipsize long visible lines.
  4. Never render outside the vessel shape.
- Keep complete schedule information available in tooltip/details and the accessible
  schedule list.
- Recalculate label layout when the scale changes without refetching planner data.
- Do not recalculate label templates on every pointer event.
- Keep dragging and resizing responsive.

UI:

- Place the controls in the planner display/compact toolbar where space permits:
  Label size [A−] [100%] [A+]
- In narrow layouts, place them in the existing display/settings popover or drawer.
- Keep controls available in Planner Focus Mode.
- Use at least 44×44 CSS-pixel touch targets.
- Provide accessible labels:
  - Decrease vessel label size
  - Reset vessel label size to 100%
  - Increase vessel label size
- Provide visible focus styles and keyboard operation.
- Announce the updated percentage through an appropriate accessible status.
- Do not rely only on the visual A−/A+ text to identify the controls.
- Avoid unrelated toolbar redesign.

Organization label styles:

- Preserve organization-configured line templates, weight, alignment and color.
- The personal scale multiplies the configured base/Auto size.
- It must not change or save organization settings.
- A user changing scale must not generate an organization audit event or Recent Changes
  schedule event.

PDF export:

- Keep PDF export on its existing deterministic print-optimized label sizing.
- Do not apply the personal screen scale to PDF output in this task.
- Document this distinction in the UI tooltip/help where appropriate.

Testing:

- Every valid scale step
- Minimum and maximum button disabling
- Reset to 100%
- Invalid local-storage value fallback
- Preference persistence
- Position and Datetime views
- Terminal/week/view switching
- Focus Mode and responsive toolbar
- Small vessel shapes
- Higher-priority line preservation
- Ellipsis and polygon clipping
- No geometry/hit-test changes
- PDF output remains unaffected
- Keyboard and accessible-label behavior

Run type-check, lint, all tests and production build. Update PROJECT_HANDOFF.md,
CHANGELOG.md and MVP_RELEASE_CHECKLIST.md with this pre-E2E feature addition.

Report changed files, scale behavior, small-shape behavior and verification results.
Do not commit, push, deploy, access production data or modify the deferred staging status.