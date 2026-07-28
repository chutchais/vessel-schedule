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

Next:
- Berth Planner Phase 3: drag-and-drop, edit from canvas, realtime updates