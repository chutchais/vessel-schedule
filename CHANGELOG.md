2026-08-01
- **Authentication E2E Batch 1 infrastructure (local-only)**
  - Added Playwright infrastructure:
    - `playwright.config.ts` (Chromium project, dedicated app port `3201`, `webServer`, trace/screenshot on failure only).
    - Scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:auth`, `test:e2e:preflight`.
  - Added local authentication E2E guardrails and fixtures:
    - `scripts/e2e-auth-preflight.ts` enforces `DATABASE_ENVIRONMENT=test`, local DB target matching across `DATABASE_URL`, `DIRECT_URL`, and `RB*_TEST_DATABASE_URL`, and local-only Supabase/App URLs.
    - `tests/e2e/auth-batch1.spec.ts` and `tests/e2e/support/auth-batch1-fixture.ts` cover protected-route redirect, sign-in/out, request approval, invitation onboarding paths, role boundaries, tenant isolation, forged active-organization rejection, and organization switching.
  - Added setup proposal/reference for missing local Supabase config:
    - `.env.e2e.local.example`
    - `docs/local-supabase-auth-e2e-setup.md`
  - Added artifact ignores:
    - `.gitignore`: `playwright-report`, `test-results`, `.auth`
    - `eslint.config.mjs`: ignore Playwright artifact directories.
  - Validation:
    - RB-1/RB-2/RB-3 PostgreSQL suites pass against `127.0.0.1:55432/vessel_test`.
    - Prisma validate/generate, TypeScript, lint, all current unit/integration tests, and production build pass.
  - Current Batch 1 browser E2E status: **NO-GO (infrastructure)** because local Supabase/Auth E2E environment variables are not configured (`APP_URL`/local Supabase values missing in `.env.e2e.local`). No hosted/production credentials were used.

2026-08-01
- **Berth Planner CSV Export**
  - Added "Export CSV" button to the Berth Planner secondary controls bar (alongside Print / Export PDF).
  - New API route `GET /api/berth-planner/export-csv` — org-scoped, server-side authorization.
    - Accepts: `terminalId`, `startDate`, `endDate`, `q`, `service`, `status`, `berth`, `conflicts`, `invalid`.
    - Validates terminal ownership, ISO date range (max 31 days), and berth-filter membership.
    - Enforces a 5 000-record hard cap with an informative error.
    - Returns `text/csv; charset=utf-8` with UTF-8 BOM and `Content-Disposition: attachment; filename=vessel-schedules_<terminal>_<weekStart>_<weekEnd>.csv`.
    - `Cache-Control: no-store`.
  - New domain library `lib/berth-planner/csv-export.ts`:
    - 20 fixed columns (see contract table in file header).
    - RFC 4180 escaping (commas, double-quotes, CR/LF, multiline remarks).
    - Spreadsheet formula-injection prevention (`=`, `+`, `-`, `@`, `\t`, `\r` prefixes → `'` prefix).
    - Timestamps as ISO 8601 with port UTC offset (DST-aware via `Intl`), e.g. `2026-07-28T14:30:00+07:00`.
    - `berthPositionEndMeters = berthPositionMeters + vesselLoa` (empty when either is null).
    - `hasConflict` derived from the existing `detectConflicts` engine per berth group.
    - Missing values are empty string fields, never `null` or `undefined`.
    - Deterministic sort: effective start time → berth order → position start.
    - Safe ASCII filename: `vessel-schedules_<terminal>_<weekStart>_<weekEnd>.csv`.
  - Client-side `exportCsv` callback in `berth-planner-view.tsx`:
    - Builds URL from current terminal, week, and active filters — preserves all UI state.
    - Fetches CSV via `fetch()` and triggers browser download via a temporary anchor (no page reload).
    - Shows "Preparing CSV…" progress and clear error state.
    - Disabled while planner data is loading or an interaction (drag/resize) is active.
  - 52 unit tests (`lib/berth-planner/csv-export.test.ts`) covering all requirements.

- Fix start-edge duration resize: enforce ETA <= ETB invariant on canvas
  - Added `etb_before_eta` invalid reason to `ResizeProposal` (`invalidReason?: ResizeInvalidReason`).
  - `computeResizeProposal` now detects when a start-edge drag on a schedule with ETB would move ETB before ETA, and marks the proposal invalid with `invalidReason: "etb_before_eta"`.
  - `drawResizePreview` shows a red preview with "ETB cannot be earlier than ETA." text for this case; other invalid states are unchanged (grey "Invalid").
  - Invalid proposals are never passed to `onDurationResizeRequest` (existing guard in pointer-up handler).
  - Server-side `validateTime()` already enforces `ETB >= ETA` for all mutations; no server changes required.
  - Added 6 focused tests: ETB equal to ETA (valid), ETB before ETA (invalid/etb_before_eta), ETB after ETA (valid), ETB at/after ETD (invalid), null-ETB start-edge resizes ETA without triggering the ETB rule, and `applyResizeTimes` ETB-equals-ETA round-trip.
- Berth Planner export vessel-details table (pre-E2E)
  - Added configurable vessel-details table appended after grid pages in print/PDF export.
  - Organization Owner/Admin configures via Planner Settings → Export Vessel Table: enable/disable, 10 predefined default columns (Vessel, Voyage, Service, Berth, Position, ETA, ETB, ETD, Status, Remarks), column visibility, order (Move Up/Down), custom headings, width mode (AUTO/COMPACT/NORMAL/WIDE), alignment (AUTO/LEFT/CENTER/RIGHT).
  - Column values resolved using existing shared placeholder registry and token resolver; composite `{{position}}` column added.
  - Table data uses only schedules visible after active filters, sorted by ETA asc → berth order → position, with port-timezone time formatting and `—` for missing values.
  - Table renders as `2400×1500` canvas pages with repeated header, alternating row shading, row count, and filter summary; appended to existing grid pages in both browser Print and PDF.
  - Personal on-screen label scale does not affect export.
  - New `organizations.exportTableConfig JSONB` column with P2022 graceful fallback identical to `vesselLabelConfig`.
  - Added `export-table-config.ts` with full validation, 30+ unit tests.
- Berth Planner personal vessel-label scale controls (pre-E2E)
  - Added personal, local-only label-size controls in planner toolbar: A−, reset percentage, A+ with fixed bounded steps 80/90/100/110/125/140.
  - Added versioned local preference key `berth-planner-label-scale-v1` with allowlisted-value validation and safe fallback to 100%.
  - Applied personal scale only to on-screen vessel-shape labels in both Position and Datetime views; schedule geometry, hit-testing, grid, axes, tooltip/details text and other UI typography are unchanged.
  - Preserved configured label-line priority; when space is constrained the renderer keeps earlier lines, ellipsizes long visible lines, clips to vessel polygons, and drops lower-priority lines when needed.
  - Kept weekly print/PDF export deterministic and print-optimized by always rendering export labels at 100% (personal screen scale does not apply).
  - Added label-scale preference unit tests and updated planner rendering path to avoid recomputing template substitutions on every pointer move.

2026-07-30
- Completed the local/disposable portion of MVP Step 2 database readiness
  - Reviewed all 20 migrations chronologically and compared each migration to its introduction commit; no historical migration is edited.
  - Prisma validation passed. All migrations deployed to an empty disposable PostgreSQL 17 database in about 4.2 seconds, final status was current, and Prisma schema diff was empty.
  - Confirmed `pgcrypto` is an undeclared database prerequisite because `20260728193000_add_invitation_token_hash` calls `gen_random_bytes(32)`. It was explicitly enabled before the disposable rehearsal; historical migrations were not edited.
  - The requested integrity audit returned zero findings on the empty disposable database. This does not substitute for staging data evidence.
  - A custom-format backup restored into a different disposable database. Source and restore each had 20 successful migrations, the same ordered migration/checksum digest, matching row counts, and matching representative relationship counts.
  - Documented proposed composite tenant foreign keys, organization-scoped vessel-code uniqueness, positive-dimension/placement checks, production migration operations, and compatibility risks. No schema migration was created.
  - Step 2 is **NO-GO** because no explicitly approved staging database or staging backup destination was provided; no staging connection or production data was accessed.

2026-07-30
- Closed the RB-4 verification database connection incident and added fail-closed controls
  - Performed an explicitly approved read-only inspection of the sanitized production target. Migration `20260729213000_add_organization_approval_progress` exists exactly once, completed successfully, matches the repository checksum, has no later migration or stored failure log, and produced the expected enum, columns and index.
  - Determined that no rollback, repair, manual `_prisma_migrations` edit or compensating migration is required. The incident no longer blocks release.
  - Removed implicit `.env` loading from `prisma.config.ts`; Prisma now requires explicit `DATABASE_ENVIRONMENT`, `DATABASE_URL`, and `DIRECT_URL`.
  - Added sanitized target matching/approval guards and guarded migration wrappers. Integration tests, seeds, benchmarks and EXPLAIN reject production targets.
  - Added five target-guard unit tests covering missing variables, matching local targets, mismatches, forbidden production use and exact remote approval.
  - Added weekly/change-triggered RB-4 CI enforcement with an exact three-advisory allowlist, 2026-08-28 expiry, pruned-runtime dependency/source checks and production startup smoke testing.
  - Clarified that PostCSS vulnerabilities remain technically open under accepted risk; they are not marked technically resolved.

2026-07-29
- Approved the temporary RB-4 PostCSS risk exception
  - Approval is limited to Next.js 16.2.12's transitive PostCSS 8.4.31 and `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, and `GHSA-r28c-9q8g-f849`.
  - Required controls are immutable reviewed builds, no user-controlled CSS/source-map processing, Sharp exclusion, dependency audits on every lockfile change and weekly, and upgrade to the first supported stable Next release containing PostCSS >=8.5.18.
  - The exception expires no later than 2026-08-28. The PostCSS vulnerabilities remain technically open under accepted risk.

2026-07-29
- Final RB-4 technical remediation and disposition
  - Upgraded `prisma`, `@prisma/client`, and `@prisma/adapter-pg` together from 7.9.0 to exact 7.9.1; patched `@prisma/dev`, `find-my-way`, and `valibot` transitives resolve the Prisma audit paths.
  - Reduced the full audit from 16 findings (15 high, 1 moderate) to 12 high and the normal production audit from 7 findings (6 high, 1 moderate) to 3 high.
  - Proved a clean 49-package `npm ci --omit=dev --omit=optional` runtime excludes Sharp, Prisma CLI and ESLint. A no-Sharp artifact built, started and served authentication/planner routing, fonts and static assets; weekly PDF export remains covered by the passing suite.
  - Retained stable Next 16.2.12. Rejected forced Next downgrade, unsupported Sharp 0.35 injection, an unapproved override of Next's exact PostCSS 8.4.31 pin, preview Next and ESLint 10.
  - Proposed a 30-day non-exploitable PostCSS exception; it was subsequently approved under the exact scope and controls recorded above.
  - Prisma Client generation/validation, TypeScript, lint, all 126 tests including RB-1/RB-2/RB-3 PostgreSQL suites, production build and no-Sharp production startup pass.
  - Safety note: a verification migration command omitted the `DIRECT_URL` override and applied existing migration `20260729213000_add_organization_approval_progress` to the configured Supabase database. No compensating action was taken; environment-owner verification is required before release.

2026-07-29
- Resolved MVP release blocker RB-2: authoritative schedule geometry and serialized occupancy
  - Centralized schedule create, ordinary edit/status, planner move, resize and undo validation in one server transaction domain.
  - Defined physical occupancy as strict-overlap time `[ETB ?? ETA, ETD)` and local berth metres `[position, position + LOA)`; CANCELLED and explicitly incomplete records do not claim occupancy.
  - Added authoritative same-organization berth/vessel geometry validation for positive dimensions, non-negative positions and complete berth fit.
  - Added organization-and-berth PostgreSQL transaction advisory locks with deterministic old/new berth ordering, bounded lock/transaction timeouts and safe retry responses.
  - Required `expectedUpdatedAt` for every PATCH caller and made schedule writes conditional by ID, organization and timestamp.
  - Made undo conflict/stale checks, token consumption, restoration and audit atomic and rollback-safe.
  - Added 14 real PostgreSQL RB-2 scenarios plus a complete PATCH-caller contract test. The full suite passes 126/126.
  - No schema migration was needed. RB-4 remains BLOCKED/NOT RESOLVED, so the release recommendation remains NO-GO.

2026-07-29
- Resolved MVP release blocker RB-3: atomic, recoverable organization approval
  - Added a versioned PostgreSQL claim and durable approval progress state so only one administrator can start or recover an approval attempt.
  - Made organization creation and request linking transactional and committed them before Supabase invitation/account work.
  - Added retry-safe Supabase adapter behavior for successful, failed and already-existing identities without storing provider responses or sensitive values.
  - Made local owner creation, membership, terminal APPROVED transition and success audit one transaction; recoverable failures retain their organization and write accurate safe audit history.
  - Made rejection conditionally claim only unlinked PENDING requests, preventing approval/rejection overwrite races.
  - Added migration `20260729213000_add_organization_approval_progress` and 16 real PostgreSQL concurrency/failure-recovery tests. The full suite passes 111/111.
  - RB-4 remains BLOCKED/NOT RESOLVED, and the release recommendation remains NO-GO.

2026-07-29
- Resolved MVP release blocker RB-1: invitation terminal-state concurrency
  - Added atomic PostgreSQL transaction claims for acceptance, decline and revoke; losing concurrent requests return 409 without membership or audit side effects.
  - Preserved invited-email, active-organization and Owner/Admin role boundaries; successfully claimed rows are reloaded before audit creation.
  - Corrected acceptance user/foreign-key ordering with rollback on a lost claim, and stopped using `revokedAt` for declined invitations.
  - Hardened replacement lost-race behavior while retaining fresh rows/tokens and one-way invalidation of old invitations.
  - Added real PostgreSQL concurrency coverage for all required races, terminal invariants, tenant isolation, permissions, memberships and audit consistency; RB-1 tests pass 10/10 and the full suite passes 95/95.
  - Prisma validation, TypeScript, lint and production build pass. No schema, migration, dependency, deployment or production-data change was made.

2026-07-29
- Investigated RB-4 dependency vulnerability remediation
  - Reproduced the full audit (15 high, 1 moderate) and npm's production-omit audit (6 high, 1 moderate), then traced every advisory to Next.js, Prisma CLI or ESLint tooling.
  - Identified Prisma 7.9.1 as a compatible patch for `@prisma/dev` findings.
  - Confirmed there is no newer stable Next.js release and that the Sharp fix requires the breaking 0.35 line outside Next.js 16.2.12's declared dependency range; PostCSS is also pinned exactly by Next.js.
  - Stopped before dependency edits as required for a major/transitively unsupported upgrade. RB-4 remains unresolved; package manifests and application behavior are unchanged.

2026-07-29
- MVP production Step 1 release-readiness and security audit
  - Added `MVP_RELEASE_CHECKLIST.md` with a NO-GO recommendation, exact release blockers, important findings, verified controls, command results, remediation order and Step 2 database-readiness items.
  - Prisma validation, TypeScript, lint, all 18 tests and the production build pass.
  - Dependency audit reports 16 known vulnerabilities (15 high, 1 moderate); invitation/approval concurrency and schedule integrity also remain release blockers.
  - Audit changed documentation only; no product, authentication, authorization, schema, migration or deployment behavior was modified.

2026-07-29
- Invitation email delivery and confirmation enforcement
  - Added server-only SMTP invitation delivery with development-safe logging, trusted `APP_URL` links, escaped HTML templates and explicit failed-delivery handling.
  - Pending invitations now show delivery status and allow resend/retry by creating a new invalidating link; delivery metadata retains only safe timestamps/categories.
  - Invitation acceptance now requires Supabase-confirmed control of the invited email; new accounts continue through the existing single confirmation flow.

2026-07-29
- Berth Planner compact landscape controls and Focus Mode
  - Added measured short-landscape layout handling, compact shell navigation, locally remembered Show/Hide controls, active-filter summary and a single-row primary planner toolbar.
  - Added application-level Planner Focus Mode with preserved planner state, accessible Exit Focus action, Escape support and responsive canvas recalculation.

2026-07-29
- Berth Planner tablet, touch and keyboard usability
  - Added intentional touch creation via an explicit Add schedule mode, while preserving desktop grid creation and tap-to-open schedule details.
  - Expanded pen/touch vessel and resize hit targets, retained pointer capture and drag threshold behavior, and prevent scrolling only during an active canvas gesture.
  - Made planner controls, filters, confirmations, conflict navigation and responsive side panels fit tablet viewports with reachable actions and an accessible schedule-list alternative.

2026-07-29
- Berth Planner performance benchmark and measured optimization
  - Added safe, deterministic 100/500/1,000-schedule performance seed, cleanup, EXPLAIN and pure benchmark commands. Generated data is isolated to one clearly named organization and the scripts refuse production and unapproved remote databases.
  - Added development-only bounded browser performance records for planner API/client transform, initial render, conflicts, both canvas/geometry paths, hit testing, filters, view switching, drag/resize updates, polling, PDF export and available heap usage.
  - `EXPLAIN ANALYZE` on the generated dataset selected an Index Scan at 100, 500 and 1,000 schedules, so no database migration/index was added.
  - Replaced measured all-pairs conflict detection with a time-window scan preserving conflict pair order; at 1,000 generated schedules median conflict calculation fell from 27.48 ms to 5.77 ms (79%).

2026-07-29
- Berth Planner weekly print and PDF export
  - Added filtered, high-resolution landscape export pages for Position and Datetime views with timezone-aware week labels, grids, berth context, vessel silhouettes, conflict markers and repeated legends.
  - Wide terminals now paginate at berth boundaries; exports are disabled while loading or editing, and retain server-authorized active-organization/terminal planner scope.

2026-07-28
- Fix invitation public-route access
  - Excluded invitation accept/register pages and status endpoint from proxy authentication redirects; protected-route login redirects now retain query strings.

2026-07-28
- Invitation-only account onboarding
  - Replaced generic registration with a server-validated `/invitations/register` route that locks the email to a live invitation.
  - Invitation guests now see account creation only when no invited user exists; existing users are directed to sign in, while normal guests remain on Request Access.

2026-07-28
- Invitation acceptance account states
  - The acceptance page now distinguishes guest, invited-account, wrong-account, expired, revoked/replaced, accepted and invalid states.
  - Added locked-email registration and token-preserving sign-in/sign-out returns for invite recipients without existing accounts.

2026-07-28
- Pending invitation management
  - Settings → Members now defaults to active organization-scoped invitations, with history, timestamp-derived states, invited-by and created-date details.
  - Revoke and replacement actions now confirm intent and enforce the active invitation definition server-side.

2026-07-28
- Copyable organization invitation links
  - Added seven-day, single-use URLs with server-generated random tokens stored only as SHA-256 hashes.
  - Added copy and replacement-link flows, token acceptance, email matching, transactional membership creation, audits and attempt limits.

2026-07-28
- Berth Planner in-place mutation refresh
  - Successful create, edit, move, resize and undo operations now retain the mounted planner canvas and re-fetch only the active terminal/week in the background, preserving planner context instead of showing a full loading replacement
  - Added current-user change highlights and stale-version background refresh/error handling for planner mutations

2026-07-28
- Berth Planner realtime changes
  - Added authenticated, organization-scoped cursor polling for schedule audit events in the selected terminal and week, with bounded request validation and no audit metadata exposure
  - Added pause-safe 25-second polling, missed-change recovery, temporary created/updated/conflict highlights, reduced-motion treatment and a responsive Recent Changes panel with audit-history links

2026-07-28
- Berth Planner undo recent change
  - Successful drag moves and duration resizes now return a server-issued, single-use undo token and show a 15-second Undo action in both planner domains
  - Undo is processed by the existing schedule PATCH endpoint, restores the server-stored pre-operation snapshot, rechecks organization scope, permissions, version, and berth conflicts, then refreshes the current planner context in place
  - Added persisted `planner_undos` records with expiry, one-time claiming, expected schedule version, and original audit-log reference; undo writes its own `Berth Planner undo` audit event
  - Move updates now use the same optimistic-concurrency protection already used by duration resize

2026-07-28
- Berth Planner operational filters and search
  - Added debounced search across vessel name, voyage number and schedule reference, plus service, status, berth, conflicts-only and incomplete/invalid placement filters
  - Position and Datetime views now share one domain-data filter result; conflict and placement validation reuse the existing domain engines and remain calculated from the complete terminal/week dataset
  - Terminal, week, view and filters synchronize to validated URL query parameters for bookmarks and refresh persistence
  - Added responsive filter controls, removable active-filter chips, clear-all, visible/total counts, filtered empty state and a notice when filtering clears a hidden selection
  - Planner API date ranges are bounded and schedule queries retain active-organization and selected-terminal scoping
  - Added focused tests for search, combined filters, conflicts-only, invalid-only, URL state, clearing, view/week preservation, hidden selection and organization isolation

2026-07-28
- Berth Planner duration resizing
  - Position view supports top/start and bottom/end time-edge resizing; Datetime view supports left/start and right/end resizing with an 8 px zoom-independent hit area
  - Vessel interiors retain drag-to-move behavior; resize uses pointer capture, touch support, Escape/pointer cancellation, 30-minute snapping, translucent validity/conflict previews, proposed times and duration
  - Added a dedicated confirmation dialog showing old/new start, end and duration; planner refreshes in place after confirmation without resetting terminal, week, view, filters or selection state
  - Start resize changes ETB when present and ETA otherwise; end resize changes ETD only, preserving terminal, berth, position and vessel/LOA
  - Schedule PATCH now revalidates resize authorization, organization ownership, cancelled state, minimum duration, immutable geometry, conflicts and `updatedAt` optimistic concurrency
  - Resize audit entries include `Berth Planner resize`, edge and changed time fields in metadata
  - Added focused duration-resize tests for both views, edge detection, snapping, start/end behavior, ETA/ETB selection, minimum duration, conflicts, permissions and stale versions

2026-07-28
- Berth Planner drag-and-drop rescheduling
  - lib/berth-planner/drag-drop.ts — pure helpers: computeDragGrab, computeDragProposal, isDragThresholdExceeded, DragGrab, DragProposal, DragBerth types; 30-min time snap, 5-m position snap, zeroOriginSide support, conflict detection via hasTimeOverlap + hasPositionOverlap, null on out-of-bounds
  - lib/berth-planner/drag-drop.test.ts — 14 unit tests covering both domains, snapping, RIGHT-origin berths, cross-berth movement, fit validation, time-range validation, conflict detection, cancelled schedule exclusion
  - components/berth-planner/drag-confirm-dialog.tsx — modal showing old/new berth, position, ETB/ETA, ETD; Confirm Move / Cancel buttons; error state
  - berth-planner-canvas.tsx — pointer event handlers (onPointerDown/Move/Up/Cancel) with pointer capture, 5 px drag threshold, Escape-to-cancel; ghost (25% opacity) original vessel during drag; live translucent preview (blue = valid, red = conflict, grey = invalid) with label overlay; berthId + bounds added to HitTarget; onClick guard via dragJustCompletedRef
  - berth-planner-view.tsx — handleDragDropRequest opens DragConfirmDialog; handleDragDropConfirm fetches full schedule, shifts ETA/ETB/ETD by time delta, PATCHes /api/schedules/[id], handles 404/409/network errors, refreshes planner on success

2026-07-26
- Finished Company CRUD
- Finished Port CRUD
- Finished Terminal CRUD
- Finished Vessel CRUD

2026-07-28
- Berth Planner Phase 1 (position-domain view, read-only)
  - API: GET /api/berth-planner (org-scoped, interval-overlap filter)
  - lib/berth-planner/types.ts — all domain types, PlannerDomain, ValidatedSchedule
  - lib/berth-planner/scales.ts — timeToPixel/pixelToTime/positionToPixel/pixelToPosition
  - lib/berth-planner/geometry.ts — getVesselPolygon, isPointInsidePolygon
  - lib/berth-planner/layout.ts — validateScheduleGeometry, classifySchedules
  - lib/berth-planner/conflicts.ts — hasTimeOverlap, hasPositionOverlap, detectConflicts
  - lib/berth-planner/timezone.ts — formatTime, formatDate, formatDateTime, timezone helpers
  - components/berth-planner/berth-planner-canvas.tsx — HTML canvas renderer
  - components/berth-planner/berth-planner-controls.tsx — filter bar
  - components/berth-planner/schedule-tooltip.tsx — hover tooltip
  - components/berth-planner/schedule-details-drawer.tsx — click-open details panel
  - components/berth-planner/berth-planner-view.tsx — main orchestrator
  - Terminals API updated to include port.timezone

2026-07-29
- Berth Planner Phase 2: weekly viewport, all berths on X-axis, time on Y-axis
  - lib/berth-planner/timezone.ts — added getWeekStart, getWeekEnd, addWeeks, formatWeekLabel, getMidnightsBetween, get4HourMarks (all timezone-aware via DST-safe noon-UTC anchor)
  - berth-planner-canvas.tsx — redesigned: all berths side-by-side on X, 7-day Y fills viewport height (dynamic ResizeObserver height), 4-hour grid lines, bold midnight lines, bold 50 m position markers, vessel pentagon silhouette, conflict highlighting
  - berth-planner-controls.tsx — replaced date pickers with Prev / This Week / Next week navigation + week label + timezone badge
  - berth-planner-view.tsx — week state management (weekStart/weekEnd), timezone recalculation on terminal change, isLoading set in event handlers (React Compiler compatible)

2026-07-28
- Berth Planner Phase 3: click-to-edit schedule from canvas
  - GET /api/schedules/[id] — new endpoint to fetch a single schedule (org-scoped, returns fields needed by edit form)
  - lib/berth-planner/click-edit.ts — pure helper buildEditFormValues(EditableSchedule) → ScheduleFormValues
  - lib/berth-planner/click-edit.test.ts — 8 unit tests covering field mapping, null coercion, status values, date format
  - schedule-details-drawer.tsx — added onEdit prop, Edit Schedule button in footer, History (audit log) link via HistoryLink + useCanViewAuditLogs
  - berth-planner-canvas.tsx — added onEditRequest prop; vessel click closes details drawer and delegates schedule ID to parent
  - berth-planner-view.tsx — edit drawer with full state (isEditDrawerOpen, editSaving, editDataLoading, editError, editForm, editingScheduleId); handleEditRequest fetches schedule + form data in parallel, handles 404 (stale/deleted) with planner refresh; handleEditSubmit PATCHes API, handles 404/409, closes drawer and refreshes planner without full-page reload; edit conflict warning excludes the edited schedule; reuses existing ScheduleFormFields, validation helpers and PATCH API

2026-07-28
- Berth Planner click-to-create schedule from canvas
  - lib/berth-planner/click-create.ts — pure conversion helpers for click->berth position/time mapping, 5m berth snapping, 30-minute time snapping, and non-grid filtering
  - berth-planner-canvas.tsx — empty-grid click now emits create draft; ignores vessel hits and non-grid click targets
  - berth-planner-view.tsx — opens schedule create drawer from canvas click, pre-fills terminal/berth/time/position, loads existing schedule form data, shows vessel-fit validation and overlap warnings, posts to /api/schedules, and refreshes planner view without page reload
  - components/schedules/schedule-form-fields.tsx — shared schedule form fields reused by both schedule management and berth planner creation flow
  - lib/schedules/form-validation.ts — shared helpers for datetime conversion, vessel-fit validation, and client-side berth conflict warnings
  - lib/berth-planner/click-create.test.ts — tests for click conversion, snapping, zero-origin behavior, and ignored clicks

2026-07-28
- Berth Planner datetime-domain view (Position / Datetime switch)
  - berth-planner-controls.tsx — added view switch toggle and preserved existing terminal/week controls
  - berth-planner-view.tsx — added view domain state, local preference persistence, and non-destructive domain switching
  - berth-planner-canvas.tsx — added domain-specific render + hit-test paths:
    - Position view: existing all-berths-on-X layout retained
    - Datetime view: X=time, Y=berth lanes with metre scale; vessel width=duration, height=LOA
    - Datetime grid: six time positions per day (00:00, 04:00, 08:00, 12:00, 16:00, 20:00), bold day boundaries, bold 50m lines
    - zeroOriginSide + headingReverse respected in both views
  - lib/berth-planner/datetime-domain.ts — berth-lane layout and metre↔Y conversion helpers for datetime domain
  - lib/berth-planner/click-create.ts — added domain-aware inverse click mapping for both position and datetime views
  - lib/berth-planner/view-preference.ts — local storage helpers for preferred view and domain-switch state preservation
  - Tests added:
    - lib/berth-planner/datetime-domain.test.ts
    - lib/berth-planner/view-preference.test.ts
    - lib/berth-planner/click-create.test.ts (datetime inverse mapping case)

2026-07-28
- Fix: berth conflict check now requires both time AND position overlap
  - Previously, the warning "Selected berth has overlapping schedules in this time window." appeared even when two vessels were at non-overlapping berth positions during the same time window
  - lib/schedules/form-validation.ts — getBerthConflictWarning now accepts berthPositionMeters + vesselLoa for existing schedules and newVesselLoa for the new schedule; skips the warning when positions don't overlap; falls back to time-only check when position data is absent (conservative)
  - app/api/schedules/route.ts — hasBerthOverlap queries existing berthPositionMeters + vessel.lengthOverall and returns 409 only when both time AND position overlap
  - app/api/schedules/[id]/route.ts — same position-aware fix applied to the PATCH overlap check
  - components/berth-planner/berth-planner-view.tsx — passes newVesselLoa and mapped vesselLoa per existing schedule to getBerthConflictWarning
  - components/schedules/schedule-manager.tsx — same mapping applied to the schedules-page conflict warning


  - lib/berth-planner/conflict-panel.ts — buildConflictGroups, flattenConflicts, getConflictedScheduleIds (pure helpers reusing classifySchedules + detectConflicts; calculates overlap time + position ranges in domain values, never pixels)
  - lib/berth-planner/conflict-panel.test.ts — 16 unit tests covering conflict grouping, sorting, overlap calculation, cancelled-schedule exclusion, missing-LOA exclusion, cross-berth isolation, navigation helpers, and unique IDs
  - components/berth-planner/conflict-panel.tsx — Conflict Panel UI: conflicts grouped by berth, sorted by earliest overlap, vessel names + service/voyage + overlapping time and metre range; Prev/Next navigation with counter; "Only conflicts" filter checkbox; empty state; scrollable list (max-h-48)
  - berth-planner-canvas.tsx — added highlightedIds?: Set<string> prop; schedules in this set receive the selection highlight in both position and datetime render paths
  - berth-planner-view.tsx — integrated ConflictPanel; computes conflictGroups + conflictedScheduleIds via buildConflictGroups; selectedConflictId / highlightedScheduleIds / onlyConflicts state persisted across Position/Datetime view switches; canvasBerths filters to only conflicting schedules when onlyConflicts is active; conflict panel shown after canvas whenever a terminal is selected and data is loaded

Next:
- Berth Planner Phase 3: drag-and-drop schedule editing and resize
