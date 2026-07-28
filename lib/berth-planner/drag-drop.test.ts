import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDragGrab,
  computeDragProposal,
  isDragThresholdExceeded,
  DRAG_THRESHOLD_PX,
  type DragBerth,
} from "./drag-drop";
import type { ValidatedSchedule } from "./types";
import type { PlannerCanvasFrame } from "./click-create";
import type { DatetimeBerthLane } from "./datetime-domain";

const weekStart = new Date("2026-07-27T00:00:00.000Z");
const weekEnd = new Date("2026-08-03T00:00:00.000Z");

const frame: PlannerCanvasFrame = {
  leftAxisWidth: 60,
  topHeaderHeight: 50,
  drawWidth: 1000,
  drawHeight: 700,
};

// b1 = 200 m, b2 = 300 m, total = 500 m; both LEFT origin
const berths: DragBerth[] = [
  { id: "b1", berthLength: 200, zeroOriginSide: "LEFT", name: "Berth 1" },
  { id: "b2", berthLength: 300, zeroOriginSide: "LEFT", name: "Berth 2" },
];

const berthsRight: DragBerth[] = [
  { id: "b1", berthLength: 200, zeroOriginSide: "RIGHT", name: "Berth R1" },
];

// Base schedule: 07-29T08:00Z start, 24 h duration, positionStart=10, positionEnd=190 (loa=180)
const schedule: ValidatedSchedule = {
  id: "sched-1",
  vesselName: "MSC Vessel",
  vesselLoa: 180,
  vesselColor: "#3B82F6",
  serviceName: null,
  serviceColor: null,
  status: "CONFIRMED",
  eta: new Date("2026-07-29T06:00:00.000Z"),
  etb: new Date("2026-07-29T08:00:00.000Z"),
  etd: new Date("2026-07-30T08:00:00.000Z"),
  berthPositionMeters: 10,
  headingReverse: false,
  berthId: "b1",
  voyageNumber: null,
  startTime: new Date("2026-07-29T08:00:00.000Z"),
  endTime: new Date("2026-07-30T08:00:00.000Z"),
  positionStart: 10,
  positionEnd: 190,
};

// Helper: convert a UTC time to relY (pixels from draw-area top) for position domain
function timeToRelY(t: Date): number {
  const rangeMs = weekEnd.getTime() - weekStart.getTime();
  return ((t.getTime() - weekStart.getTime()) / rangeMs) * frame.drawHeight;
}

// Helper: convert localMeters in b1 (LEFT, 200 m) to relX
function localMetersB1ToRelX(m: number): number {
  return (m / 500) * frame.drawWidth; // global = m, total length = 500
}

// Build a grab with zero offsets (grab point = exact startTime + exact positionStart)
function zeroOffsetGrab() {
  const relY = timeToRelY(schedule.startTime);
  const relX = localMetersB1ToRelX(schedule.positionStart); // = localMetersB1ToRelX(10) = 20
  return computeDragGrab({
    schedule,
    berthId: "b1",
    berthName: "Berth 1",
    pointerX: frame.leftAxisWidth + relX,
    pointerY: frame.topHeaderHeight + relY,
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
  });
}

test("isDragThresholdExceeded: returns false below threshold, true above", () => {
  assert.equal(isDragThresholdExceeded(0, 0, 0, 0), false);
  assert.equal(isDragThresholdExceeded(0, 0, DRAG_THRESHOLD_PX, 0), false); // exactly threshold → NOT exceeded
  assert.equal(isDragThresholdExceeded(0, 0, DRAG_THRESHOLD_PX + 0.01, 0), true);
  assert.equal(isDragThresholdExceeded(0, 0, 3, 3), false);  // √18 ≈ 4.24 < 5
  assert.equal(isDragThresholdExceeded(0, 0, 4, 4), true);   // √32 ≈ 5.66 > 5
});

test("computeDragGrab position domain: grab time/position offsets", () => {
  // Grab at pointer (leftAxisWidth+200, topHeaderHeight+350)
  // relX = 200 → globalMeters = 200/1000*500 = 100 → b1 LEFT → localMeters = 100
  // relY = 350 → pixelToTime = weekStart + 350/700*weekRange = weekStart + 3.5 days = 07-30T12:00Z
  // grabTimeOffset = 07-30T12:00Z - 07-29T08:00Z = 28 h = 100 800 000 ms
  // grabPositionOffset = 100 - 10 = 90

  const grab = computeDragGrab({
    schedule,
    berthId: "b1",
    berthName: "Berth 1",
    pointerX: frame.leftAxisWidth + 200,
    pointerY: frame.topHeaderHeight + 350,
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
  });

  assert.equal(grab.scheduleId, "sched-1");
  assert.equal(grab.vesselName, "MSC Vessel");
  assert.equal(grab.berthId, "b1");
  assert.equal(grab.durationMs, 24 * 60 * 60 * 1000);
  assert.equal(grab.vesselLoa, 180);
  assert.equal(grab.originalPositionStart, 10);

  const midpointTime = new Date(weekStart.getTime() + (350 / 700) * (weekEnd.getTime() - weekStart.getTime()));
  assert.equal(grab.grabTimeOffsetMs, midpointTime.getTime() - schedule.startTime.getTime());
  assert.equal(grab.grabPositionOffsetMeters, 90);
});

test("computeDragGrab datetime domain: grab offsets", () => {
  const lanes: DatetimeBerthLane[] = [
    { id: "b1", berthLength: 200, zeroOriginSide: "LEFT", laneTop: 0, laneHeight: 350 },
    { id: "b2", berthLength: 300, zeroOriginSide: "LEFT", laneTop: 358, laneHeight: 342 },
  ];

  // relX = 500 → pixelToTime = weekStart + 500/1000*weekRange = weekStart + 3.5 days = 07-30T12:00Z
  // relY = 175 → in lane1 (laneTop=0, height=350), fraction = 175/350 = 0.5 → localMeters = 0.5*200 = 100
  // grabTimeOffset = 07-30T12:00Z - startTime (07-29T08:00Z) = 28h = 100800000ms
  // grabPositionOffset = 100 - 10 = 90

  const grab = computeDragGrab({
    schedule,
    berthId: "b1",
    berthName: "Berth 1",
    pointerX: frame.leftAxisWidth + 500,
    pointerY: frame.topHeaderHeight + 175,
    domain: "datetime",
    frame,
    berths,
    datetimeLanes: lanes,
    weekStart,
    weekEnd,
  });

  const midpointTime = new Date(weekStart.getTime() + (500 / 1000) * (weekEnd.getTime() - weekStart.getTime()));
  assert.equal(grab.grabTimeOffsetMs, midpointTime.getTime() - schedule.startTime.getTime());
  assert.equal(grab.grabPositionOffsetMeters, 90);
});

test("computeDragProposal snaps time to 30 min and position to 5 m", () => {
  // Use a simple schedule at weekStart with positionStart=0 so grab offsets are both 0
  const simple: ValidatedSchedule = {
    ...schedule,
    startTime: weekStart,
    endTime: new Date(weekStart.getTime() + 24 * 60 * 60 * 1000),
    positionStart: 0,
    positionEnd: 10,
  };

  // Grab at exact startTime and positionStart → offsets = 0
  const grab = computeDragGrab({
    schedule: simple,
    berthId: "b1",
    berthName: "Berth 1",
    pointerX: frame.leftAxisWidth + 0, // relX=0 → localMeters=0
    pointerY: frame.topHeaderHeight + 0, // relY=0 → pixelToTime=weekStart
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
  });

  assert.equal(grab.grabTimeOffsetMs, 0);
  assert.equal(grab.grabPositionOffsetMeters, 0);

  // Proposal: pointer at 10:14 on 07-29 (should snap to 10:00) and globalMeters=12.3 (snaps to 10)
  const t_10_14 = new Date("2026-07-29T10:14:00.000Z");
  const relY = timeToRelY(t_10_14);
  const relX = (12.3 / 500) * frame.drawWidth; // globalMeters=12.3 → in b1 LEFT

  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + relX,
    pointerY: frame.topHeaderHeight + relY,
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [],
  });

  assert.ok(proposal);
  assert.equal(proposal.newStartTime.toISOString(), "2026-07-29T10:00:00.000Z");
  assert.equal(proposal.newPositionStart, 10); // snapMeters(12.3, 5) = round(2.46)*5 = 10
});

test("computeDragProposal position domain: basic movement", () => {
  const grab = zeroOffsetGrab(); // grabTimeOffset=0, grabPositionOffset=0

  // Move to 07-31T00:00Z at localMeters=10 in b1 → newStartTime=07-31T00, newPositionStart=10
  const targetTime = new Date("2026-07-31T00:00:00.000Z");
  const relY = timeToRelY(targetTime);
  const relX = localMetersB1ToRelX(10); // = 20

  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + relX,
    pointerY: frame.topHeaderHeight + relY,
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [],
  });

  assert.ok(proposal);
  assert.equal(proposal.berthId, "b1");
  assert.equal(proposal.berthName, "Berth 1");
  assert.equal(proposal.newStartTime.toISOString(), "2026-07-31T00:00:00.000Z");
  assert.equal(proposal.newPositionStart, 10);
  assert.equal(proposal.newPositionEnd, 190);
  assert.equal(proposal.isValid, true);
  assert.equal(proposal.hasConflict, false);
});

test("computeDragProposal datetime domain: basic movement", () => {
  const lanes: DatetimeBerthLane[] = [
    { id: "b1", berthLength: 200, zeroOriginSide: "LEFT", laneTop: 0, laneHeight: 350 },
    { id: "b2", berthLength: 300, zeroOriginSide: "LEFT", laneTop: 358, laneHeight: 342 },
  ];

  // Grab with zero time offset: grab X = corresponds to startTime
  const startTimeRelX = (schedule.startTime.getTime() - weekStart.getTime()) / (weekEnd.getTime() - weekStart.getTime()) * frame.drawWidth;
  // Grab with zero position offset: grab Y in lane1 where localMeters=10 → fraction=10/200=0.05 → y=0.05*350=17.5
  const grab = computeDragGrab({
    schedule,
    berthId: "b1",
    berthName: "Berth 1",
    pointerX: frame.leftAxisWidth + startTimeRelX,
    pointerY: frame.topHeaderHeight + 17.5,
    domain: "datetime",
    frame,
    berths,
    datetimeLanes: lanes,
    weekStart,
    weekEnd,
  });

  // Move to 07-31T00:00Z (relX) staying in lane1 at same Y
  const targetTime = new Date("2026-07-31T00:00:00.000Z");
  const relX = (targetTime.getTime() - weekStart.getTime()) / (weekEnd.getTime() - weekStart.getTime()) * frame.drawWidth;

  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + relX,
    pointerY: frame.topHeaderHeight + 17.5,
    domain: "datetime",
    frame,
    berths,
    datetimeLanes: lanes,
    weekStart,
    weekEnd,
    otherSchedules: [],
  });

  assert.ok(proposal);
  assert.equal(proposal.berthId, "b1");
  assert.equal(proposal.newStartTime.toISOString(), "2026-07-31T00:00:00.000Z");
  assert.equal(proposal.isValid, true);
  assert.equal(proposal.hasConflict, false);
});

test("computeDragProposal with zeroOriginSide RIGHT", () => {
  // RIGHT berth: localMeters increases from right → localMeters = berthLength - metresFromLeft
  // Grab at relX=0: globalMeters=0, metresFromLeft=0, localMeters = 200-0 = 200
  // schedule.positionStart = 10 → grabPositionOffset = 200 - 10 = 190
  const grabRight = computeDragGrab({
    schedule,
    berthId: "b1",
    berthName: "Berth R1",
    pointerX: frame.leftAxisWidth + 0,
    pointerY: frame.topHeaderHeight + timeToRelY(schedule.startTime),
    domain: "position",
    frame,
    berths: berthsRight,
    datetimeLanes: [],
    weekStart,
    weekEnd,
  });

  assert.equal(grabRight.grabPositionOffsetMeters, 190);

  // Move to relX=500: globalMeters = 500/1000*200 = 100, localMeters = 200-100 = 100
  // rawPosition = 100 - 190 = -90 → clamped to 0
  // newPositionEnd = 0 + 180 = 180 ≤ 200 → fits
  const proposal = computeDragProposal({
    grab: grabRight,
    pointerX: frame.leftAxisWidth + 500,
    pointerY: frame.topHeaderHeight + timeToRelY(new Date("2026-07-31T00:00:00.000Z")),
    domain: "position",
    frame,
    berths: berthsRight,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [],
  });

  assert.ok(proposal);
  assert.equal(proposal.berthId, "b1");
  assert.equal(proposal.newPositionStart, 0);
  assert.equal(proposal.newPositionEnd, 180);
  assert.equal(proposal.isValid, true);
});

test("computeDragProposal cross-berth movement", () => {
  const grab = zeroOffsetGrab();

  // relX=500: totalLength=500, globalMeters=500/1000*500=250 → in b2 (offset=200), localMeters=250-200=50
  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + 500,
    pointerY: frame.topHeaderHeight + timeToRelY(new Date("2026-07-31T00:00:00.000Z")),
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [],
  });

  assert.ok(proposal);
  assert.equal(proposal.berthId, "b2");
  assert.equal(proposal.berthName, "Berth 2");
  // localMeters at pointer=50, grabPositionOffset=0 → rawPos=50, snapped=50
  // newPositionEnd = 50 + 180 = 230 ≤ 300 → fits
  assert.equal(proposal.newPositionStart, 50);
  assert.equal(proposal.isValid, true);
});

test("computeDragProposal returns null when outside grid", () => {
  const grab = zeroOffsetGrab();

  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth - 10, // relX = -10 → outside
    pointerY: frame.topHeaderHeight + timeToRelY(new Date("2026-07-31T00:00:00.000Z")),
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [],
  });

  assert.equal(proposal, null);
});

test("computeDragProposal isValid=false when vessel doesn't fit in berth", () => {
  // vesselLoa = 180; put newPositionStart = 50 in b1 (200 m) → newPositionEnd = 230 > 200 → not fits
  const grab = zeroOffsetGrab(); // grabPositionOffset = 0

  // localMeters = 50 in b1 LEFT → globalMeters=50 → relX = 50/500*1000 = 100
  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + 100,
    pointerY: frame.topHeaderHeight + timeToRelY(new Date("2026-07-31T00:00:00.000Z")),
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [],
  });

  assert.ok(proposal);
  assert.equal(proposal.newPositionStart, 50);
  assert.equal(proposal.newPositionEnd, 230);
  assert.equal(proposal.isValid, false); // 230 > 200
});

test("computeDragProposal isValid=false when time outside week", () => {
  const grab = zeroOffsetGrab(); // grabTimeOffset = 0

  // relY = drawHeight + 350 → ptrTime = weekStart + 1.5*weekRange = 08-10T12Z → outside weekEnd (08-03)
  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + localMetersB1ToRelX(10),
    pointerY: frame.topHeaderHeight + frame.drawHeight + 350,
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [],
  });

  assert.ok(proposal);
  assert.equal(proposal.isValid, false); // newStartTime > weekEnd
});

test("computeDragProposal hasConflict=true when overlapping schedule", () => {
  const grab = zeroOffsetGrab(); // grabTimeOffset=0, grabPositionOffset=0

  // Other schedule on b1: 07-31T00 to 08-01T00, position 0–50
  const conflictSched: ValidatedSchedule = {
    ...schedule,
    id: "conflict",
    berthId: "b1",
    startTime: new Date("2026-07-31T00:00:00.000Z"),
    endTime: new Date("2026-08-01T00:00:00.000Z"),
    positionStart: 0,
    positionEnd: 50,
    status: "CONFIRMED",
  };

  // Proposal: newStartTime=07-31T00, newPositionStart=10 (relX=20), newPositionEnd=190
  // Time overlap: [07-31T00, 08-01T00] ∩ [07-31T00, 08-01T00] → overlaps
  // Position overlap: [10,190] ∩ [0,50] → 10<50 && 0<190 → overlaps → conflict
  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + localMetersB1ToRelX(10),
    pointerY: frame.topHeaderHeight + timeToRelY(new Date("2026-07-31T00:00:00.000Z")),
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [conflictSched],
  });

  assert.ok(proposal);
  assert.equal(proposal.newStartTime.toISOString(), "2026-07-31T00:00:00.000Z");
  assert.equal(proposal.hasConflict, true);
});

test("computeDragProposal hasConflict=false when no position overlap (different position)", () => {
  const grab = zeroOffsetGrab();

  // Other schedule at position [190, 200] → strict no overlap with [10, 190]
  const otherSched: ValidatedSchedule = {
    ...schedule,
    id: "other",
    berthId: "b1",
    startTime: new Date("2026-07-31T00:00:00.000Z"),
    endTime: new Date("2026-08-01T00:00:00.000Z"),
    positionStart: 190,
    positionEnd: 200,
    status: "CONFIRMED",
  };

  // newPositionStart=10, newPositionEnd=190
  // positionOverlap(10,190, 190,200): 10<200 && 190<190 → false (strict boundary)
  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + localMetersB1ToRelX(10),
    pointerY: frame.topHeaderHeight + timeToRelY(new Date("2026-07-31T00:00:00.000Z")),
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [otherSched],
  });

  assert.ok(proposal);
  assert.equal(proposal.hasConflict, false);
});

test("computeDragProposal cancelled schedules excluded from conflict check", () => {
  const grab = zeroOffsetGrab();

  const cancelledSched: ValidatedSchedule = {
    ...schedule,
    id: "cancelled",
    berthId: "b1",
    startTime: new Date("2026-07-31T00:00:00.000Z"),
    endTime: new Date("2026-08-01T00:00:00.000Z"),
    positionStart: 0,
    positionEnd: 50,
    status: "CANCELLED",
  };

  const proposal = computeDragProposal({
    grab,
    pointerX: frame.leftAxisWidth + localMetersB1ToRelX(10),
    pointerY: frame.topHeaderHeight + timeToRelY(new Date("2026-07-31T00:00:00.000Z")),
    domain: "position",
    frame,
    berths,
    datetimeLanes: [],
    weekStart,
    weekEnd,
    otherSchedules: [cancelledSched],
  });

  assert.ok(proposal);
  assert.equal(proposal.hasConflict, false); // cancelled excluded
});
