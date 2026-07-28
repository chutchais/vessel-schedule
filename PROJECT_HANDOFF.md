# Vessel Schedule — Project Handoff

## Tech Stack

* Next.js App Router
* TypeScript
* Prisma
* Supabase
* Vercel
* GitHub feature branch workflow

## Coding Preference

Keep the code simple and beginner-friendly.

Preferred approach:

* Direct route handlers
* Simple validation with `if` statements
* No Zod
* No repository or service layer unless truly needed
* Practical step-by-step instructions
* Avoid overengineering

## Prisma

Generated Prisma client:

```text
generated/prisma/
```

Prisma singleton:

```text
lib/db/prisma.ts
```

Import style:

```ts
import { prisma } from "@/lib/db/prisma";
```

After changing the Prisma schema, run:

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name migration_name
npx prisma generate
```

## Completed Modules

### Infrastructure

* Next.js setup
* Prisma setup
* Supabase database
* Vercel deployment
* Health API

### Company — ✅ complete
### Port — ✅ complete
### Terminal — ✅ complete
### Vessel — ✅ complete
### Services — ✅ complete
### Berths — ✅ complete
### Vessel Schedules — ✅ complete

### Berth Planner Phase 1 — ✅ complete
### Berth Planner Phase 2 — ✅ complete
### Berth Planner Phase 3 (part) — ✅ click-to-create and click-to-edit complete

**Weekly viewport — all berths side-by-side (read-only)**

Phase 2 redesign:
- X-axis = all berths concatenated left-to-right (each occupies `berthLength` metres)
- Y-axis = time (top = Monday 00:00, bottom = Sunday 24:00 in port timezone)
- 7-day week fits in viewport height — no vertical scrolling
- Week navigation: Prev / This Week / Next (buttons) + week label + timezone badge
- Grid: 4-hour lines (light) + midnight lines (bold), horizontal; 50 m position marks (bold), vertical
- Vessel shapes: pentagon silhouettes with conflict highlighting
- Canvas height is dynamic (ResizeObserver: `window.innerHeight - containerTop - 24px`)

Architecture (unchanged structure, updated implementations):

```
lib/berth-planner/
  types.ts        — PlannerDomain, ValidatedSchedule, InvalidScheduleRecord, viewport types
  scales.ts       — timeToPixel, pixelToTime, positionToPixel, pixelToPosition, getMeterTickInterval
  geometry.ts     — getVesselPolygon (pentagon silhouette), isPointInsidePolygon, getPolygonBounds
  layout.ts       — validateScheduleGeometry, classifySchedules (returns valid + invalid lists)
  conflicts.ts    — hasTimeOverlap, hasPositionOverlap, detectConflicts (pure, unit-testable)
  timezone.ts     — getWeekStart, getWeekEnd, addWeeks, formatWeekLabel, getMidnightsBetween,
                    get4HourMarks (all timezone-aware via DST-safe noon-UTC anchor)
  click-create.ts — pure click conversion helpers (grid click -> berth/time draft), 5m/30min snapping
  click-edit.ts   — pure helper buildEditFormValues; converts fetched schedule to ScheduleFormValues

components/berth-planner/
  berth-planner-view.tsx          — page orchestrator; weekStart state, week navigation handlers,
                                    click-to-create drawer flow, planner refresh after creation
  berth-planner-controls.tsx      — terminal selector + Prev/This Week/Next + week label + tz badge
  berth-planner-canvas.tsx        — HTML Canvas renderer; all berths on X, time on Y, dynamic height,
                                    empty-grid click emits creation draft
  schedule-tooltip.tsx            — hover tooltip (pure component)
  schedule-details-drawer.tsx     — click-open schedule detail panel; Edit Schedule button + History audit link

**Click-to-edit behavior (Phase 3 partial):**
- Clicking a vessel shape selects it and opens the details drawer (already existed)
- Details drawer footer shows "Edit Schedule" button and (for OWNER/ADMIN) "History" audit log link
- Clicking "Edit" fetches the full schedule from `GET /api/schedules/[id]` and opens the existing form drawer pre-filled
- `buildEditFormValues()` in `click-edit.ts` converts the API response to `ScheduleFormValues` (pure, tested)
- Edit conflict warning excludes the schedule being edited (`excludeScheduleId`)
- On successful PATCH, drawer closes and planner refreshes without full-page reload; selected terminal, week and filters are preserved
- 404 on fetch = schedule deleted: shows error and refreshes planner
- 404/409 on PATCH = stale/conflict: shows clear error message without closing the form

components/schedules/
  schedule-form-fields.tsx        — shared schedule form reused by Schedules page and Planner click-create

lib/schedules/
  form-validation.ts              — shared date conversion, berth-fit validation, and conflict warning helpers

app/api/berth-planner/route.ts    — org-scoped GET endpoint (unchanged)
```

**Coordinate system (Phase 2):**
- `globalMetres = berthOffset + localPosition`; `positionToPixel = LEFT_AXIS_W + (globalMetres / totalLength) * drawWidth`
- For `RIGHT` origin berths: `rightGlobal = berthOffset + berthLength - positionStart`; `leftGlobal = rightGlobal - vesselLoa`
- `timeToPixel` unchanged: `TOP_HEADER_H + ((t - weekStart) / weekDuration) * drawHeight`

**Invalid schedules:**
- Missing LOA, missing berthPositionMeters, invalid dates, out-of-berth positions are classified by `classifySchedules()`
- Invalid records are displayed in a warning list BELOW the canvas, never silently dropped
- Only `ValidatedSchedule` objects are drawn on canvas

**Organization isolation:**
- API reads `organizationId` from the authenticated session (server-side via `requireCurrentUser()`)
- Terminal ownership is verified before loading berths/schedules
- No org ID is accepted from the browser

**Future datetime-domain renderer:**
- `PlannerDomain = "position" | "datetime"` type is defined in `types.ts`
- All coordinate math is in `scales.ts` — X/Y calculations are not scattered in the canvas
- The canvas only depends on `ValidatedSchedule[]` + date range + timezone — a datetime renderer can reuse all the same data, validation, conflict detection, and schedule details drawer

**Schema notes:**
- `headingReverse: Boolean` already exists on `VesselSchedule` — vessel heading IS supported
- No schema migration is required for Phase 1
- `vessel.lengthOverall` (Decimal?) is used as LOA; `null` means the field is unset

**Conflicts:**
- Detected via `detectConflicts()` using strict interval-overlap on both time and position
- Conflicting vessels are drawn with a red outline and ⚠ badge
- Conflict partners shown in tooltip and details drawer
- Cancelled schedules are excluded from conflict detection
- Create drawer shows overlap warning before save; final enforcement remains server-side (`/api/schedules` returns 409 on overlap)

**Click-to-create behavior (Phase 3 partial):**
- Clicking empty planner grid opens the existing schedule form drawer (not direct create)
- Click point converts to berth + berthPositionMeters + planned start time using pure helper functions
- Time snaps to 30 minutes and berth position snaps to 5 metres
- `zeroOriginSide` LEFT/RIGHT is respected in position conversion
- Clicks on vessel polygons, berth labels, axis area, and non-grid areas do not trigger creation
- On successful submit, drawer closes and planner data refreshes without full-page reload

Health endpoint:

```text
GET /api/health
```

### Company

Completed:

* Database model
* GET and POST API
* PATCH API
* List UI
* Search and filter
* Create
* Edit
* Active and inactive status

### Port

Completed:

* Database model
* GET and POST API
* PATCH API
* List UI
* Search and filter
* Create
* Edit
* Active and inactive status

### Terminal

Completed:

* Prisma model
* Port relationship
* GET and POST API
* PATCH API
* Terminal UI
* Port dropdown
* Search and status filter
* Create
* Edit
* Active and inactive status

Relationship:

```text
Port
└── Terminal[]
```

Terminal uniqueness:

```prisma
@@unique([portId, code])
```

This allows the same terminal code at different ports but prevents duplicate terminal codes within the same port.

### Vessel

Completed:

* Database model
* GET and POST API
* PATCH API
* Vessel UI
* Search and status filter
* Create
* Edit
* Active and inactive status

Fields:

* code (unique)
* name
* imo (optional, unique — IMO number)
* callSign (optional)
* flag (optional — 3-letter country code)
* type (CONTAINER_SHIP, BULK_CARRIER, TANKER, GENERAL_CARGO, RO_RO, OTHER)

## Current Branch

```text
feature/terminal
```

Check with:

```bash
git branch --show-current
```

## Next Steps

Run final checks:

```bash
npm run lint
npm run build
```

Then consider:

1. **Berth Planner Phase 3 remaining**: drag-and-drop schedule editing and resize
2. **Datetime-domain view**: swap X/Y coordinate renderers (architecture supports this)

3. **Realtime updates**: subscribe to schedule changes via Supabase Realtime
4. **Image export**: export canvas as PNG

## Current Progress

```text
✅ Infrastructure

✅ Company
   ✅ Database
   ✅ API
   ✅ UI
   ✅ Edit
   ✅ Active/Inactive

✅ Port
   ✅ Database
   ✅ API
   ✅ UI
   ✅ Edit
   ✅ Active/Inactive

✅ Terminal
   ✅ Database
   ✅ API
   ✅ UI
   ✅ Edit
   ✅ Active/Inactive
```

✅ Vessel
   ✅ Database
   ✅ API
   ✅ UI
   ✅ Edit
   ✅ Active/Inactive

## Starting a New Chat

Paste this instruction:

```text
Please read PROJECT_HANDOFF.md and continue the Vessel Schedule project from the current status.

Keep all explanations simple and beginner-friendly. Use direct route handlers and simple validation. Do not introduce Zod, repository layers, or service layers unless necessary.
```
