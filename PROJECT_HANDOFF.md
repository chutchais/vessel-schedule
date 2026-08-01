# Vessel Schedule — Project Handoff

## ETB Start-Edge Resize Invariant (2026-08-01)

Start-edge drag resize now enforces **ETA ≤ ETB < ETD** on the client canvas and the server already enforces it.

**Changes:**
- `lib/berth-planner/duration-resize.ts`: Added `ResizeInvalidReason` union type and `invalidReason?` field to `ResizeProposal`. `computeResizeProposal` detects `edge === "start" && schedule.etb !== null && newStartTime < schedule.eta` and sets `invalidReason: "etb_before_eta"`, marking `isValid: false`.
- `components/berth-planner/berth-planner-canvas.tsx`: `drawResizePreview` renders red fill/stroke and the label **"ETB cannot be earlier than ETA."** when `invalidReason === "etb_before_eta"`. Other invalid states remain grey.
- Invalid proposals are blocked from saving by the existing `isValid` guard in the pointer-up handler.
- Server-side `validateTime()` in `lib/schedules/schedule-mutations.ts` already rejects `ETB < ETA` for all mutations (create, edit, move, resize, undo) — no server changes needed.
- No database migration required.

**Tests added** (`lib/berth-planner/duration-resize.test.ts`): ETB equal to ETA (valid), ETB before ETA (invalid), ETB after ETA (valid), ETB at/after ETD (invalid), null-ETB resizes ETA without ETB rule, `applyResizeTimes` ETB=ETA round-trip. All 14 tests pass.

## MVP Step 2 database readiness (2026-07-30)

Database readiness is **NO-GO pending an approved staging rehearsal**. No production database was accessed.

The local/disposable evidence is complete: Prisma validation passed; all 20 migrations are unchanged from their introduction commits; `prisma migrate deploy` applied the full history to empty PostgreSQL 17 in about 4.2 seconds; final migration status was current; and `prisma migrate diff` reported an empty migration. The history requires `pgcrypto` before deployment because `20260728193000_add_invitation_token_hash` calls `gen_random_bytes(32)`, but no migration creates the extension.

The requested integrity checks found zero rows on the empty disposable database. This proves the audit queries execute against the resulting schema, not that staging data is clean. A custom-format backup restored into a distinct disposable database; both databases contained 20 successful migrations with the same ordered migration/checksum digest, one default organization, zero application data rows, and matching representative relationship counts.

No approved staging target was available. Therefore staging status/deploy, pre-migration staging backup, real-data integrity counts, lock observation, duration, role/pooling verification, and staging restore evidence remain blockers. Proposed constraint migrations are documented in `MVP_RELEASE_CHECKLIST.md` and require explicit approval before creation.

## Export Vessel Table in Berth Planner (pre-E2E, 2026-08-01)

A configurable vessel-details table is now appended to Berth Planner print and PDF exports.

**Configuration** (Owner/Admin only): Planner Settings → Export Vessel Table — enables/disables the table, configures which of the predefined columns are visible, their order, custom headings, width mode (AUTO/COMPACT/NORMAL/WIDE), and alignment (AUTO/LEFT/CENTER/RIGHT). Settings are persisted in `organizations.exportTableConfig` (new `JSONB` column). A local-only fallback applies if the migration has not yet been run.

**Default 10 columns** (in order): Vessel, Voyage, Service, Berth, Position (`start–end m` composite), ETA, ETB, ETD, Status, Remarks.

**Placeholder reuse**: The export table uses the same `VESSEL_LABEL_PLACEHOLDER_GROUPS` catalog and `resolveVesselLabelLines` token resolver as vessel labels. No second field-resolver was created. The composite `{{position}}` column is the only addition.

**Table data**: Includes only schedules visible after active filters (same berths passed to `renderWeeklyExport`). Sorted by ETA asc → berth order → positionStart. Uses port timezone for ETA/ETB/ETD formatting. Missing values render as `—`.

**Rendering**: Each export-table page is a `2400×1500` canvas with alternating row shading, repeated table header, row count and filter summary. Table pages follow the grid pages. Browser Print and generated PDF receive the same pages. Personal on-screen label scale does not apply.

**Prisma migration**: `20260801120000_add_organization_export_table_config` — adds `exportTableConfig JSONB` to `organizations`. Same P2022 fallback pattern as `vesselLabelConfig`.



Personal vessel-label display scale is now available in the planner UI as local preference controls: `A−`, reset `%`, `A+`, using fixed steps 80%, 90%, 100%, 110%, 125% and 140%. The value is persisted in browser storage under `berth-planner-label-scale-v1`, validated against the allowlisted steps, and falls back safely to 100% for missing/malformed values.

The preference applies only to on-screen vessel-shape labels in Position and Datetime canvases. It does not alter berth/schedule geometry, grid/axes, hit testing, tooltip/details text, Recent Changes behavior, organization label templates, or audit/realtime events. Weekly print/PDF export remains deterministic and print-optimized at 100% by design.

Rendering behavior under constrained space keeps higher-priority configured lines first, ellipsizes long visible lines, clips inside vessel polygons, and removes lower-priority lines when needed. Template substitution is pre-resolved for rendered schedules and reused during pointer interactions to keep drag/resize responsive.

## MVP production audit status (2026-07-29)

Step 1 release-readiness/security audit is complete. RB-1 through RB-3 are technically resolved, and the production build, Prisma validation, TypeScript, lint, and all 131 tests pass. RB-4's PostCSS vulnerabilities remain technically open under an approved exception expiring 2026-08-28. The release recommendation is **GO WITH TIME-LIMITED RB-4 EXCEPTION**.

RB-4 is **ACCEPTED UNDER AN APPROVED TIME-LIMITED EXCEPTION**, not technically resolved. On 2026-07-29, the authorized approver accepted only Next.js 16.2.12's transitive PostCSS 8.4.31 risk for `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, and `GHSA-r28c-9q8g-f849`. The exception expires no later than 2026-08-28. It requires no user-controlled CSS/source-map processing, immutable reviewed builds, Sharp exclusion, audits on lockfile changes and weekly, and upgrade to the first supported stable Next release containing PostCSS >=8.5.18.

RB-4 remediation upgraded `prisma`, `@prisma/client`, and `@prisma/adapter-pg` together from 7.9.0 to exact 7.9.1. Stable Next 16.2.12 still pins PostCSS 8.4.31 and declares optional Sharp `^0.34.5`; Sharp's patch begins at 0.35.0. No override, forced downgrade, preview framework, Sharp 0.35 injection, or ESLint 10 major was accepted.

Clean installation evidence:

- `npm ci --omit=dev`: 189 packages; Next/PostCSS and optional Sharp present; ESLint absent.
- `npm ci --omit=dev --omit=optional`: 49 packages; Next/PostCSS present; Sharp, Prisma CLI and ESLint absent.
- A disposable artifact built with Sharp absent, was pruned using `npm prune --omit=dev --omit=optional`, started successfully, and served the authentication page, protected planner redirect, fonts, CSS, JavaScript and public SVG. Weekly PDF export passes its existing test.
- Production artifact creation must use a clean build stage and run `npm prune --omit=dev --omit=optional` before copying runtime files. Fail the deployment if `npm ls --omit=dev sharp eslint prisma` finds any of them. Do not run the default Turbopack build after omitting every optional package because that also removes Next's native SWC binary.

Incident verification completed read-only on 2026-07-30. The production target contains exactly one successful `20260729213000_add_organization_approval_progress` record; its checksum matches the repository, no later migrations exist, and the enum, four columns, defaults/nullability, and index match the migration. `_prisma_migrations` contains no failure log. No repair or rollback is required, and the incident no longer blocks release.

Recurrence prevention is now fail-closed. `prisma.config.ts` does not load `.env`; Prisma commands require explicit `DATABASE_ENVIRONMENT`, `DATABASE_URL`, and `DIRECT_URL`. `npm run db:migrate:status` and `npm run db:migrate:deploy` validate the target and print only sanitized host/database information. Test, seed, benchmark, and EXPLAIN commands reject production targets. See `MVP_RELEASE_CHECKLIST.md` for exact local/staging/production commands.

RB-4 enforcement lives in `.github/workflows/rb4-exception-controls.yml`. It builds first, prunes dev/optional packages, verifies the exact advisory/version allowlist and expiry, rejects Sharp/Prisma CLI/ESLint or runtime CSS processing, and smoke-tests the pruned server.

## RB-1 invitation concurrency remediation (2026-07-29)

Invitation acceptance, decline, and revoke now share explicit database transaction functions. PENDING is conditionally claimed using invitation/organization identity, null terminal fields, and a future expiry; only the one-row winner can create membership or audit data. Losing requests return HTTP 409 and cannot overwrite a terminal state.

Valid terminal transitions are PENDING → ACCEPTED, DECLINED, REVOKED, or EXPIRED. DECLINED no longer misuses `revokedAt`; replacement atomically revokes the old invitation, reloads it, and creates a new row with a new token.

The real PostgreSQL concurrency suite passed 10/10 RB-1 scenarios, and the complete suite passed 95/95. Prisma validation, TypeScript, lint, and production build also pass. No schema or migration change was made. The isolated test database required `pgcrypto` to be pre-enabled because the existing token-hash migration calls `gen_random_bytes`; that migration-readiness prerequisite remains for Step 2 and was not changed during RB-1 work.

## RB-3 organization approval remediation (2026-07-29)

Organization-request approval now uses a versioned conditional database claim. PENDING, failed retry and abandoned APPROVING recovery paths compare request status, organization linkage, approval version and claim timestamp; only a one-row winner proceeds. Losing administrators receive HTTP 409 without organization, external identity, membership or audit side effects.

Organization creation and request linking commit in one transaction before Supabase is called. Durable claim/progress fields allow a retry to resume the same organization after any failure. Supabase invitation/account behavior is isolated behind an adapter; confirmed or already-existing Auth identities are persisted before the final transaction. Local user, OWNER membership, APPROVED transition and success audit then commit together. Recoverable failures remain APPROVAL_FAILED with safe audit metadata and never reset to PENDING. Rejection also uses an atomic PENDING claim.

Migration `20260729213000_add_organization_approval_progress` adds `approvalClaimId`, `approvalClaimedAt`, `approvalVersion` and `OrganizationApprovalStage`. The disposable PostgreSQL 17 suite passed 16/16 RB-3 cases, including two-admin races, all nine failure boundaries, retries, abandoned claims, provider outcomes, permissions and audit consistency. The complete suite passed 111/111. No real Supabase, SMTP or production service was contacted.

## RB-2 schedule integrity remediation (2026-07-29)

All schedule mutation paths now share one authoritative server transaction domain. Physical occupancy is `[ETB ?? ETA, ETD)` in time and `[position, position + LOA)` in local berth metres. All statuses except CANCELLED participate, strict endpoint touching is allowed, and display origin/heading never change the occupied interval.

Incomplete schedules remain intentional but have no physical occupancy until a berth position and positive vessel LOA are available. A positioned schedule is rejected unless its server-loaded same-organization vessel and berth have positive dimensions, the position is non-negative, and the vessel fits completely.

Physical writes acquire PostgreSQL transaction-scoped advisory locks keyed by active organization and berth. Moves lock old/new berths in deterministic sorted order. Authoritative rows are reloaded after locking; geometry, conflict query, conditional timestamp write and audit then commit together. Every PATCH—including ordinary form/status edits, planner move, resize and undo—requires `expectedUpdatedAt`. Undo claims remain rollback-safe and cannot restore stale or newly conflicting occupancy.

The disposable PostgreSQL 17 suite passed 14/14 RB-2 database scenarios plus the PATCH caller contract test; the complete suite passed 126/126. Prisma validation, TypeScript, lint and production build pass. No schema or migration change was required.

## Berth Planner Performance Benchmark (development only)

Use the isolated, deterministic dataset only on a local database, or explicitly opt in to an approved remote development database:

```bash
npm run seed:planner-performance -- --schedules=100
npm run seed:planner-performance -- --schedules=500
npm run seed:planner-performance -- --schedules=1000
npm run explain:planner-performance
npm run benchmark:planner-performance
npm run seed:planner-performance -- --cleanup
```

`seed:planner-performance` accepts only 100, 500 or 1,000 schedules. It refuses `NODE_ENV=production` and non-local databases unless `PLANNER_PERFORMANCE_ALLOW_REMOTE_DEV=true` is explicitly set. Reseeding removes and recreates only the exact `__berth-planner-performance-test__` generated organization; cleanup has the same scope.

The benchmark uses week `2026-07-27T00:00:00.000Z` through `2026-08-03T00:00:00.000Z`, UTC, eight ordered berths, services, users, normal records, conflicts, incomplete placement/LOA records and week-boundary crossings. It does not create Supabase Auth identities, so browser interaction benchmarks require signing in as a development user who is safely made a member of the generated organization.

Baseline (remote development database; median pure-client timings, query total includes network):

| Schedules | DB plan | Query total | Payload | Transform | Conflict | Filter |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 100 | Index Scan, 0.071 ms | 873.87 ms | 45,904 B | 0.06 ms | 0.59 ms | 0.21 ms |
| 500 | Index Scan, 0.238 ms | 1,222.03 ms | 225,013 B | 0.28 ms | 7.20 ms | 0.64 ms |
| 1,000 | Index Scan, 0.454 ms | 1,482.64 ms | 448,954 B | 0.34 ms | 27.48 ms | 0.94 ms |

Optimized median conflict timings were 0.71 ms (100), 2.50 ms (500), and 5.77 ms (1,000), compared with 0.59 ms, 7.20 ms, and 27.48 ms at baseline. The 100-schedule variation is timer noise; the measured optimization changes conflict detection from all-pairs to a time-window scan while preserving pair ordering, reducing the 1,000-schedule result by 79%. No database index was added: `EXPLAIN ANALYZE` selected an Index Scan at every size and did not report a sequential scan or expensive sort.

In development, browser timings stay in the bounded `window.__berthPlannerPerformance` array (last 200 entries) and dispatch `berth-planner-performance` events. They never log in production or include schedule names/IDs. Open the planner on the generated terminal, clear the array, then load it; switch views; search/filter; drag/resize; wait for an unchanged poll then make a schedule change and wait for the next poll; export PDF. The entries cover API/client transform and response size, initial render, conflict calculation, both canvas draw/geometry paths, hit testing, search/filter, view switching, pointer responsiveness, no-change/changed polling, PDF export and available JS heap usage.

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

## Invitation email delivery

Organization invitation emails use the server-only SMTP abstraction in `lib/email/`. Set `APP_URL` to the trusted canonical origin plus `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `EMAIL_FROM` in production. SMTP variables are never client-exposed. Development with no SMTP configuration deliberately logs only recipient, subject and message type.

Invitations remain valid and their one-time copyable URL is returned once even if email delivery fails. Delivery state is `Pending`, `Sent` or `Failed`, with a safe failure category and attempt timestamp. Resend/Retry always creates a replacement invitation with a newly generated token, invalidating the previous link. Never log or persist the raw token.

New invited accounts use the existing Supabase confirmation email; acceptance requires `email_confirmed_at`. This is the sole account-email verification flow. Existing verified users do not repeat verification.

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
### Berth Planner Tablet, Touch and Keyboard Usability — ✅ complete
### Berth Planner Compact Landscape and Focus Mode — ✅ complete

**Compact landscape and Focus Mode:**
- Short landscape viewports (including 1024×768 and 1366×768) use measured dimensions rather than device names to collapse the shell sidebar into the existing mobile navigation and default planner secondary controls to hidden.
- The always-visible planner toolbar retains terminal, week navigation, domain switch, Show/Hide controls and Focus Mode. Hidden controls preserve filters and show an active-filter count; export, add-schedule and filters remain available through Show controls.
- Focus Mode is application-level (not browser fullscreen): it hides navigation, heading and nonessential panels, keeps an Exit Focus control, restores the same terminal/week/domain/filter/selection state, announces entry, and exits with Escape when no dialog is active.
- Canvas resizing continues to use its ResizeObserver after controls, shell or Focus Mode dimensions change. Remaining device testing: verify rotation and focus-toolbar safe-area spacing on physical tablet browsers.

**Tablet interaction behavior:**
- Verified layout targets: 768×1024, 1024×768, 820×1180 and 1366×768. The seven-day canvas stays visible while controls, filters and the Conflict/Recent Changes panels wrap into reachable columns.
- Mouse, pen and touch use Pointer Events with capture. Drag/resize retains the existing activation threshold and safely releases capture on completion or cancellation; page scroll and text selection are not disabled outside an active canvas gesture.
- Touch and pen use expanded vessel hit targets and 22 px resize edges without changing berth geometry. A touch grid tap creates only when the explicit **Add schedule** mode is active; vessel taps select and open details.
- The canvas exposes a screen-reader schedule list/details alternative. Controls, filters, dialogs and panel actions have visible focus treatment and 44 px touch targets where applicable.
- Remaining device testing: confirm physical iPad/Android browser pointer-capture behavior and safe-area appearance before production rollout.

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
