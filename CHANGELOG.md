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
