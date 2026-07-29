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

## Environment

Set `APP_URL` to the trusted canonical application origin. Invitation links are derived only from this value, never from request headers.

Organization Settings → Members lists active invitations by default. Active means no acceptance/revocation timestamp and an expiration in the future; history shows accepted, revoked, and expired links.

Invitation acceptance pre-validates the hashed token without logging it. Guests can create an account only with the server-validated invited email or sign in; a mismatched signed-in account must sign out before acceptance is enabled.

Public registration remains disabled. `/invitations/register?token=…` is the only registration route and validates a live invitation before rendering a locked invited-email form; successful sign-up returns to token acceptance.

`proxy.ts` must keep `/invitations/accept`, `/invitations/register`, and `/api/invitations/accept` public. When redirecting other protected URLs to login, preserve both pathname and query string.

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
### Berth Planner Datetime Domain — ✅ complete
### Berth Planner Conflict Panel — ✅ complete
### Berth Planner Drag-and-Drop Rescheduling — ✅ complete
### Berth Planner Duration Resizing — ✅ complete
### Berth Planner Operational Filters — ✅ complete
### Berth Planner Undo Recent Change — ✅ complete
### Berth Planner Realtime Changes — ✅ complete
### Berth Planner In-place Mutation Refresh — ✅ complete
### Berth Planner Weekly Print/PDF Export — ✅ complete

**Weekly export behavior:**
- Print and Export PDF generate dedicated high-resolution landscape planner pages from filtered domain data, never a clipped screen capture.
- Position pages split only between berths for wide terminals; Datetime pages repeat the complete seven-day time overview while splitting tall berth sets.
- Output repeats terminal/week/timezone/filter metadata, date/grid/berth context, conflict legend and generated timestamp on every page. Browser print provides the PDF save destination.
- Export uses the existing organization-scoped, terminal-authorized planner payload and is disabled during loading, drawers, confirmations and active canvas gestures.

**Mutation refresh behavior:**
- Planner create, edit, drag move, resize and undo continue to use their existing APIs and server-side authorization/validation/audit checks, then refresh only the current terminal/week without changing `isLoading`, so the canvas, terminal/week/domain/filter/selection context and panels remain mounted.
- Planner fetches are versioned in the client; late responses cannot overwrite a newer terminal/week request. Failed saves keep their drawers/dialogs open and stale-version responses refresh current planner data with an explanatory error.

**Realtime behavior:**
- `GET /api/berth-planner/changes` uses the authenticated active organization, verifies the terminal, bounds the visible date range and returns only minimal schedule audit events after a server-issued cursor.
- The planner polls every 25 seconds without overlapping requests, pauses while planner forms, confirmations, saves and undo are active, then retrieves missed events when interaction ends.
- Recent Changes shows the latest 50 relevant events in port time, supports schedule history links and explains unavailable focus actions; canvas feedback uses green for creates, amber for updates and red for conflicts, with static reduced-motion feedback.

**Undo behavior:**
- A completed planner drag move or duration resize returns a server-issued opaque undo token and shows a single Undo action for 15 seconds in both Position and Datetime views.
- The browser never supplies pre-operation schedule values. `planner_undos` stores the snapshot, original audit-log ID, expected post-operation `updatedAt`, expiry and one-time `usedAt` state.
- `PATCH /api/schedules/[id]` with `plannerAction: "undo"` enforces the normal schedule-management permission and active-organization scope, rejects expired/used/stale tokens, rechecks berth conflicts, restores in a transaction and writes a separate `Berth Planner undo` audit event.
- Move operations now pass `expectedUpdatedAt`, matching resize optimistic concurrency. Successful undo refreshes the loaded terminal/week/view/filter/selection context without a full reload; network failure leaves the planner unchanged and retains the action until expiry.

**Operational filter behavior:**
- Search covers vessel name, voyage number and the schedule UUID/reference with a 300 ms debounce
- Service, status, berth, conflicts-only and incomplete/invalid placement filters share one state/result across Position and Datetime views
- Filters operate client-side because the complete organization-scoped terminal/week dataset is already safely loaded and expected weekly volume is suitable; conflict calculation still runs on the complete dataset before filtering
- Placement filtering reuses `classifySchedules`; conflict filtering reuses `buildConflictGroups`/`detectConflicts`
- URL parameters preserve terminal, week, view and active filters across refreshes and planner create/edit/drag/resize refreshes
- Service and berth option values are derived only from the selected terminal's loaded planner payload; unknown URL option values are discarded after the payload loads
- The responsive filter bar includes active chips, clear-all, visible/total counts and clear loading/error/filtered-empty states
- Filtering keeps every berth lane in the seven-day canvas and clears a selected schedule with a brief explanation if it becomes hidden
- `GET /api/berth-planner` continues to derive organization scope from the authenticated session, verifies terminal ownership, validates ISO dates/order and now rejects ranges longer than eight days

New files:
- `lib/berth-planner/operational-filters.ts`
- `lib/berth-planner/operational-filters.test.ts`
- `lib/berth-planner/planner-query.ts`
- `lib/berth-planner/planner-query.test.ts`
- `components/berth-planner/operational-filter-bar.tsx`

**Duration resize behavior:**
- Position domain: top edge resizes start and bottom edge resizes end
- Datetime domain: left edge resizes start and right edge resizes end
- Edge hit testing is a fixed 8 CSS pixels; vessel interiors continue to drag/move
- Pointer/touch capture, 5 px activation threshold, Escape/pointer cancellation, 30-minute snapping and the existing conflict engine are reused
- Preview retains the original as a translucent ghost and shows proposed times, duration, invalid state or conflict state
- Start resize updates ETB when present, otherwise ETA; ETA is never shifted when ETB exists
- End resize updates ETD only; berth, terminal, berth position, vessel and LOA remain unchanged
- Confirmation is required before PATCH; successful saves refresh planner data without a page reload or planner-context reset
- Planner payload includes schedule `updatedAt`; PATCH checks it before and inside the transaction to reject stale updates
- Server resize validation rechecks role, active organization ownership, cancelled state, minimum 30-minute duration, immutable geometry and conflicts
- Audit metadata records `context: "Berth Planner resize"`, resize edge and changed time fields

New files:
- `lib/berth-planner/duration-resize.ts`
- `lib/berth-planner/duration-resize.test.ts`
- `components/berth-planner/resize-confirm-dialog.tsx`

**Weekly viewport with switchable planner domain**

Phase 2 redesign:
- Position view: X-axis = all berths concatenated left-to-right (each occupies `berthLength` metres), Y-axis = time
- Datetime view: X-axis = time (selected week), Y-axis = berth lanes with position in metres
- 7-day week fits in viewport height — no vertical scrolling
- Week navigation: Prev / This Week / Next (buttons) + week label + timezone badge
- View switch: Position / Datetime, preferred view persisted in local storage
- Datetime grid: six time points per day (00:00/04:00/08:00/12:00/16:00/20:00), bold day boundaries, bold 50 m position lines
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
  click-create.ts — pure click conversion helpers (position+datetime inverse mapping), 5m/30min snapping
  click-edit.ts   — pure helper buildEditFormValues; converts fetched schedule to ScheduleFormValues
  datetime-domain.ts — datetime berth-lane layout + metres↔lane-Y conversion helpers
  view-preference.ts — local preference persistence for planner domain
  conflict-panel.ts  — buildConflictGroups, flattenConflicts, getConflictedScheduleIds (pure, unit-tested); overlap time+position ranges in domain values

components/berth-planner/
  berth-planner-view.tsx          — page orchestrator; weekStart state, week navigation handlers,
                                    click-to-create drawer flow, planner refresh after creation, domain switch state,
                                    conflict panel state (selectedConflictId, highlightedScheduleIds, onlyConflicts)
  berth-planner-controls.tsx      — terminal selector + Prev/This Week/Next + week label + tz badge + Position/Datetime toggle
  berth-planner-canvas.tsx        — HTML Canvas renderer for both domains with shared conflicts/selection/tooltip,
                                    empty-grid click emits creation draft; accepts highlightedIds for conflict-panel selection
  conflict-panel.tsx              — Conflict Panel: grouped by berth, sorted by overlap time, Prev/Next navigation,
                                    "Only conflicts" filter, vessel names + service/voyage + time+metre overlap ranges
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

**Datetime-domain implementation notes:**
- Domain-specific coordinate mapping and hit-testing are isolated to their view paths in the canvas + click-create helpers
- Shared business logic remains reused: API data, schedule validation, conflict detection, selection, tooltip, details drawer, create/edit form and timezone helpers
- Switching domain keeps selected terminal, week and existing planner context; no server-state reload is required

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

**Conflict Panel:**
- `ConflictPanel` component shown below canvas when a terminal is loaded
- Groups conflicts by berth, sorted by earliest overlap start within each group; groups sorted by earliest conflict time
- Shows vessel names, service/voyage, overlapping time range and overlapping metre range for each pair
- All values computed from domain units (metres, UTC dates) via `buildConflictGroups` — never canvas pixels
- Clicking a conflict item highlights both schedules on the canvas via `highlightedIds` prop
- Prev/Next buttons navigate through all conflicts with a counter (`N / total`); wrap-around at ends
- "Only conflicts" checkbox filters the canvas to show only conflicting schedules (state preserved on domain switch)
- selectedConflictId, highlightedScheduleIds and onlyConflicts state live in the view and survive Position/Datetime switches
- Organization and terminal isolation enforced server-side; `buildConflictGroups` only groups within same berth

**Click-to-create behavior (Phase 3 partial):**
- Clicking empty planner grid opens the existing schedule form drawer (not direct create)
- Click point converts to berth + berthPositionMeters + planned start time using pure helper functions
- Time snaps to 30 minutes and berth position snaps to 5 metres
- `zeroOriginSide` LEFT/RIGHT is respected in both position and datetime conversions
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
