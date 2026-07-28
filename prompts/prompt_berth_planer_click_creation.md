Implement click-to-create in the position-domain Berth Planner.

Before editing, read PROJECT_HANDOFF.md and CHANGELOG.md and inspect the existing planner and Vessel Schedule form.

Requirements:

- Clicking an empty grid position opens the existing Add Vessel Schedule form.
- Convert the click coordinates into:
  - Selected berth
  - berthPositionMeters
  - Planned start time in the port timezone
- Pre-fill the selected terminal and berth.
- Snap time to 30-minute intervals.
- Snap berth position to 5-metre intervals.
- Do not create directly from the canvas; the user must review and submit the form.
- Respect berth.zeroOriginSide when converting the X coordinate.
- Do not respond when clicking an existing vessel, berth label, axis or grid control.
- Validate that the selected position is within the berth.
- Validate whether the vessel fits after the user selects a vessel.
- Show conflict warnings before saving, but follow the project’s existing conflict policy.
- Reuse the existing Schedule form and validation rather than creating a second form.
- On successful creation, close the form and refresh the planner without a full page reload.
- Preserve organization scoping and verify the terminal and berth server-side.
- Keep coordinate-conversion logic in pure planner geometry/scale functions so it can be tested and reused.

Add tests for:

- Click-to-time conversion
- 30-minute snapping
- Click-to-berth/position conversion
- 5-metre snapping
- zeroOriginSide left and right
- Ignoring clicks on vessel shapes and non-grid areas

Run type-check, lint and relevant tests. Update CHANGELOG.md and PROJECT_HANDOFF.md. Do not commit or push.