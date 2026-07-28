Implement the first version of the Berth Planner using the position-domain view.

Before making changes

1. Read PROJECT_HANDOFF.md and CHANGELOG.md completely.
2. Inspect the current Prisma schema, authentication, organization scoping, API patterns, application layout and Vessel Schedule implementation.
3. Inspect the previous implementation for reference:
   https://github.com/chutchais/vessel-schedule-v1
   especially:
   - app/schedule-grid/schedule-grid-client.tsx
   - lib/schedule-conflicts.ts
4. Preserve the previous planner’s visual concept and business rules, but do not copy its large monolithic component architecture.
5. Briefly report the implementation plan before editing files.

Goal

Create a weekly Berth Planner where:

- X-axis represents berth position in meters.
- Y-axis represents date and time.
- Each schedule is displayed as a vessel-shaped polygon.
- Polygon width represents the vessel LOA.
- Polygon height represents the schedule duration.
- Berth position is based on schedule.berthPositionMeters.
- Time range uses ETB when available, otherwise ETA, through ETD.
- Berth zeroOriginSide is respected.
- The full seven-day week must fit within the available screen height so users can see the overall weekly schedule without vertical scrolling inside the planner.
- The architecture must allow a datetime-domain view to be added later through a separate coordinate renderer.

Phase 1 scope

Implement a read-only planner first.

Do not implement:

- Drag-and-drop
- Resizing
- Schedule creation from the canvas
- Realtime updates
- Public sharing
- Image export

Page and navigation

1. Add a Berth Planner page using the existing authenticated application layout and sidebar.
2. Add a sidebar navigation item if one does not already exist.
3. Keep the page inside the normal application shell.
4. Match the current design system and theme.
5. Do not copy styling directly from the previous application.

Weekly date range

The planner must display exactly one calendar week by default.

1. Determine the current week using the selected port’s timezone.
2. Use the application’s existing week convention if one exists.
3. Otherwise, use Monday 00:00 as the start of the week and the next Monday 00:00 as the exclusive end.
4. Display all seven days in one viewport.
5. Do not calculate the current week using only the browser timezone.
6. Clearly display the start date, end date and port timezone in the planner header.

Provide these navigation controls:

- Previous week
- Current week / Today
- Next week

Each navigation action must move by exactly seven calendar days in the port timezone.

Time-axis grid

The Y-axis represents the seven-day time range.

Grid requirements:

1. Divide each day into six equal four-hour intervals.
2. Draw grid lines at:
   - 00:00
   - 04:00
   - 08:00
   - 12:00
   - 16:00
   - 20:00
3. Draw the 00:00 boundary of every day as a visually stronger/bolder horizontal line.
4. Draw the four-hour interval lines as lighter horizontal lines.
5. Draw the start and end boundaries of the week clearly.
6. Show readable day/date labels at daily boundaries.
7. Show time labels for the four-hour intervals without overcrowding the axis.
8. Draw the current-time indicator when the current time falls inside the displayed week.
9. The current-time indicator must be visually different from normal grid lines.

Weekly viewport sizing

The complete seven-day range must fit in the visible planner area.

Requirements:

1. The planner must show all seven days without internal vertical scrolling.
2. Calculate canvas height from the available viewport after accounting for:
   - Application header
   - Planner heading
   - Filter controls
   - Any warning summary
3. Use a sensible minimum height so the planner remains usable on smaller screens.
4. Use ResizeObserver or the project’s existing equivalent to resize the canvas responsively.
5. Recalculate the time scale whenever the canvas size changes.
6. Do not assign fixed pixel height to each hour.
7. Map the entire week proportionally into the available plot height:

   y = plotTop +
       ((time - weekStart) / (weekEnd - weekStart)) *
       plotHeight

8. Avoid page-level vertical scrolling where practical, but do not hide essential controls or validation messages on unusually small screens.
9. Horizontal scrolling may be used only when the complete physical berth range cannot remain readable at the available screen width.
10. Initially scale the complete berth range to fit the available width so users see an overall weekly overview.

Berth-position axis

The X-axis represents berth position in meters.

Requirements:

1. Display the complete selected terminal berth range in the available planner width by default.
2. Draw a light vertical grid line at smaller useful meter intervals if needed.
3. Draw a visually stronger/bolder vertical line every 50 metres.
4. Label the bold 50-metre lines.
5. Draw berth boundaries more prominently than ordinary meter lines.
6. Display berth names clearly.
7. Keep labels readable and avoid duplicate overlapping labels.
8. Respect each berth’s zeroOriginSide.
9. Do not store pixel coordinates in the database.

If a berth length is not an exact multiple of 50 metres, still draw and label the actual berth endpoint.

Filters

Add:

- Terminal selector
- Previous week button
- Current week / Today button
- Next week button
- Optional service/status filters if they fit the existing filter pattern

Organization security

- Scope terminals, berths, vessels, services and schedules to the authenticated user’s active organization.
- Do not accept organizationId from the browser as authorization.
- Derive organization context on the server.
- Verify that the selected terminal belongs to the active organization.
- Follow the project’s existing authorization and API response conventions.

Planner data

Return only the fields required by the planner:

- Port and port timezone
- Terminal
- Ordered berths
- berth.id
- berth.name
- berth.berthLength
- berth.zeroOriginSide
- berth.order
- Schedules intersecting the selected week
- Vessel name, LOA and color
- Service name and color where available
- Schedule status
- ETA, ETB and ETD
- berthPositionMeters
- Heading/bow direction if currently supported

Use interval-overlap filtering so schedules beginning before the week but ending during or after it are included.

Architecture

Do not create one large planner component.

Use a structure similar to:

components/berth-planner/
  berth-planner-canvas.tsx
  berth-planner-controls.tsx
  schedule-tooltip.tsx
  schedule-details-drawer.tsx

lib/berth-planner/
  types.ts
  scales.ts
  layout.ts
  geometry.ts
  conflicts.ts
  timezone.ts

Adapt names to repository conventions where necessary.

Keep these responsibilities separate:

- React state and controls
- Data fetching
- Domain validation
- Time scale
- Berth-position scale
- Meter-origin conversion
- Vessel polygon generation
- Canvas drawing
- Hit testing
- Conflict detection

Future datetime-domain support

Define the domain type now:

type PlannerDomain = "position" | "datetime";

Only the "position" view needs to be available in the UI during this phase.

Do not scatter X/Y calculations throughout React components. Create reusable scale and viewport functions such as:

- timeToPixel()
- pixelToTime()
- positionToPixel()
- pixelToPosition()
- getVesselPolygon()
- isPointInsidePolygon()

The future datetime-domain renderer must reuse the same API data, validation, conflict detection, selection state, colors and schedule details.

Berth layout and origin

1. Sort berths using berth.order.
2. Display clear berth boundaries and labels.
3. Draw bold meter lines every 50 metres.
4. Respect zeroOriginSide:
   - "left": meter zero begins at the berth’s left edge.
   - "right": meter zero begins at the berth’s right edge.
5. Keep domain coordinates separate from screen coordinates.
6. Do not persist screen or pixel positions.

Vessel geometry

For a valid schedule:

- Start time = ETB when present, otherwise ETA.
- End time = ETD.
- Vessel length = the vessel’s stored LOA.
- Position = berthPositionMeters.

Draw the vessel as a pentagon or equivalent vessel silhouette:

- Horizontal size represents LOA.
- Vertical size represents the start-to-end time interval.
- The pointed end represents the bow when heading information is available.

Important:

zeroOriginSide identifies the berth measurement origin. It does not identify vessel heading.

Inspect whether the current schema already contains headingReverse or another bow-direction field. If no heading field exists:

- Do not guess the bow direction.
- Use a neutral vessel shape in this phase.
- Report the missing field and recommend a small follow-up migration.
- Do not change the Prisma schema without first explaining the proposed migration.

Invalid and incomplete data

Do not silently replace missing LOA with an arbitrary default.

Do not silently clamp invalid berth positions into the berth.

Handle these conditions explicitly:

- Missing vessel LOA
- Missing berthPositionMeters
- Missing start or end time
- ETD earlier than or equal to the start time
- Position below zero
- Vessel extending beyond berth length
- Schedule referring to unavailable planner data

Display incomplete records in a compact warning/list area outside the canvas with the reason. Invalid records must not appear as normal valid vessel shapes.

Date and timezone handling

- Render grid labels using the selected port’s timezone.
- Calculate weekly boundaries using the port timezone.
- Do not use the browser timezone as the planner’s business timezone.
- Clearly label the timezone in the planner header.
- Ensure query boundaries and displayed boundaries are consistent.
- Keep timezone calculations in the dedicated timezone module.
- Correctly handle timezone offsets and daylight-saving transitions, even if the initial data primarily uses Asia/Bangkok.
- Treat weekEnd as an exclusive boundary.

Conflict detection

A conflict exists when two active schedules on the same berth overlap in both time and occupied meter intervals.

Use strict overlap rules:

timeStartA < timeEndB &&
timeStartB < timeEndA

positionStartA < positionEndB &&
positionStartB < positionEndA

Vessels that only touch at an endpoint are not conflicting.

Exclude cancelled schedules according to the exact status enum used by this repository.

Conflict behavior:

- Draw conflicting vessel outlines in red.
- Show a conflict indicator.
- Explain the conflicting schedule in the tooltip or detail panel.
- Keep conflict detection as pure, unit-testable functions.
- Never use pixel rectangles as the source of truth for conflicts.

Canvas behavior

- Support high-DPI rendering.
- Resize responsively.
- Fit the entire week into the available height.
- Fit the complete terminal berth range into the available width initially.
- Draw light four-hour time lines.
- Draw bold daily boundary lines.
- Draw bold 50-metre position lines.
- Draw prominent berth boundaries.
- Draw the current-time indicator when applicable.
- Clip vessel shapes only at the visible week boundaries.
- Do not hide physically invalid positions through clipping.
- Provide an accessible non-canvas schedule summary or detail panel.

Interaction

For this read-only phase:

- Hovering a vessel shows a tooltip.
- Clicking a vessel selects it and opens or updates the schedule details drawer/panel.
- Clicking empty grid space does nothing.
- Escape closes selection where appropriate.
- Do not implement editing directly on the canvas.

Testing

Add focused tests for:

- Current-week boundaries in port timezone
- Previous and next week calculations
- Seven-day viewport mapping
- Four-hour grid generation
- Daily boundary detection
- 50-metre grid generation
- zeroOriginSide left conversion
- zeroOriginSide right conversion
- time-to-pixel and inverse conversion
- position-to-pixel and inverse conversion
- vessel polygon bounds
- time overlap
- position overlap
- endpoint-touching non-conflict
- cancelled-schedule exclusion
- missing and invalid geometry
- organization-scoped planner authorization where supported

Verification

Run:

- Prisma validation if Prisma files are touched
- TypeScript checking
- Lint
- Relevant unit/integration tests
- Production build if practical

Fix problems introduced by this implementation.

After implementation

1. Summarize all changed files.
2. Explain how the seven-day viewport fits the available screen.
3. Explain the four-hour and daily time-grid lines.
4. Explain the 50-metre position grid.
5. Explain the position and time coordinate transformations.
6. Explain how zeroOriginSide is handled.
7. Explain how invalid schedules are presented.
8. Explain how organization isolation is enforced.
9. Explain how the architecture supports a future datetime-domain renderer.
10. List any follow-up schema migration needed for vessel heading.
11. Update CHANGELOG.md and PROJECT_HANDOFF.md.
12. Do not commit or push unless explicitly instructed.