import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_RESIZE_DURATION_MS,
  applyResizeTimes,
  computeResizeProposal,
  getResizeEdgeAtPoint,
  isResizeVersionCurrent,
} from "./duration-resize";
import { canManageSchedules } from "../auth/permissions";
import type { ValidatedSchedule } from "./types";

const weekStart = new Date("2026-07-27T00:00:00.000Z");
const weekEnd = new Date("2026-08-03T00:00:00.000Z");
const frame = { leftAxisWidth: 60, topHeaderHeight: 50, drawWidth: 1000, drawHeight: 700 };
const schedule: ValidatedSchedule = {
  id: "s1", vesselName: "One", vesselLoa: 100, vesselColor: "#000000",
  serviceName: null, serviceColor: null, status: "PLANNED",
  eta: new Date("2026-07-29T07:00:00.000Z"), etb: new Date("2026-07-29T08:00:00.000Z"),
  etd: new Date("2026-07-29T12:00:00.000Z"), berthPositionMeters: 10,
  headingReverse: false, berthId: "b1", voyageNumber: null,
  startTime: new Date("2026-07-29T08:00:00.000Z"), endTime: new Date("2026-07-29T12:00:00.000Z"),
  positionStart: 10, positionEnd: 110, updatedAt: "2026-07-28T00:00:00.000Z",
};

function positionY(time: Date) {
  return frame.topHeaderHeight +
    ((time.getTime() - weekStart.getTime()) / (weekEnd.getTime() - weekStart.getTime())) * frame.drawHeight;
}

function datetimeX(time: Date) {
  return frame.leftAxisWidth +
    ((time.getTime() - weekStart.getTime()) / (weekEnd.getTime() - weekStart.getTime())) * frame.drawWidth;
}

test("edge hit testing uses top/bottom in position and left/right in datetime", () => {
  const bounds = { left: 100, right: 300, top: 200, bottom: 260 };
  assert.equal(getResizeEdgeAtPoint({ x: 150, y: 206, bounds, domain: "position" }), "start");
  assert.equal(getResizeEdgeAtPoint({ x: 150, y: 253, bounds, domain: "position" }), "end");
  assert.equal(getResizeEdgeAtPoint({ x: 106, y: 230, bounds, domain: "datetime" }), "start");
  assert.equal(getResizeEdgeAtPoint({ x: 293, y: 230, bounds, domain: "datetime" }), "end");
  assert.equal(getResizeEdgeAtPoint({ x: 150, y: 230, bounds, domain: "position" }), null);
});

test("start and end resize snap to 30 minutes in both views", () => {
  const start = computeResizeProposal({
    schedule, edge: "start", pointerX: 150,
    pointerY: positionY(new Date("2026-07-29T09:14:00.000Z")),
    domain: "position", frame, weekStart, weekEnd, otherSchedules: [],
  });
  const end = computeResizeProposal({
    schedule, edge: "end",
    pointerX: datetimeX(new Date("2026-07-29T13:46:00.000Z")), pointerY: 100,
    domain: "datetime", frame, weekStart, weekEnd, otherSchedules: [],
  });
  assert.equal(start.newStartTime.toISOString(), "2026-07-29T09:00:00.000Z");
  assert.equal(end.newEndTime.toISOString(), "2026-07-29T14:00:00.000Z");
});

test("minimum duration and end <= start are invalid", () => {
  const tooShort = computeResizeProposal({
    schedule, edge: "start", pointerX: 0,
    pointerY: positionY(new Date(schedule.endTime.getTime() - MIN_RESIZE_DURATION_MS / 2)),
    domain: "position", frame, weekStart, weekEnd, otherSchedules: [],
  });
  const reversed = computeResizeProposal({
    schedule, edge: "end", pointerX: datetimeX(schedule.startTime), pointerY: 0,
    domain: "datetime", frame, weekStart, weekEnd, otherSchedules: [],
  });
  assert.equal(tooShort.isValid, false);
  assert.equal(reversed.isValid, false);
});

test("conflicts require time and position overlap and ignore cancelled schedules", () => {
  const other = { ...schedule, id: "s2", startTime: new Date("2026-07-29T12:30:00.000Z"), endTime: new Date("2026-07-29T14:00:00.000Z") };
  const proposal = computeResizeProposal({
    schedule, edge: "end", pointerX: datetimeX(new Date("2026-07-29T13:00:00.000Z")), pointerY: 0,
    domain: "datetime", frame, weekStart, weekEnd, otherSchedules: [other],
  });
  assert.equal(proposal.hasConflict, true);
  assert.equal(computeResizeProposal({
    schedule, edge: "end", pointerX: datetimeX(new Date("2026-07-29T13:00:00.000Z")), pointerY: 0,
    domain: "datetime", frame, weekStart, weekEnd,
    otherSchedules: [{ ...other, status: "CANCELLED" }],
  }).hasConflict, false);
});

test("start resize updates ETB when present and ETA only when ETB is absent", () => {
  const next = new Date("2026-07-29T09:00:00.000Z");
  const withEtb = applyResizeTimes({ eta: schedule.eta.toISOString(), etb: schedule.etb!.toISOString(), etd: schedule.etd.toISOString(), edge: "start", newStartTime: next, newEndTime: schedule.endTime });
  assert.equal(withEtb.eta, schedule.eta.toISOString());
  assert.equal(withEtb.etb, next.toISOString());
  const withoutEtb = applyResizeTimes({ eta: schedule.eta.toISOString(), etb: null, etd: schedule.etd.toISOString(), edge: "start", newStartTime: next, newEndTime: schedule.endTime });
  assert.equal(withoutEtb.eta, next.toISOString());
  assert.equal(withoutEtb.etb, null);
});

test("end resize changes only ETD", () => {
  const next = new Date("2026-07-29T13:00:00.000Z");
  const result = applyResizeTimes({ eta: schedule.eta.toISOString(), etb: schedule.etb!.toISOString(), etd: schedule.etd.toISOString(), edge: "end", newStartTime: schedule.startTime, newEndTime: next });
  assert.equal(result.eta, schedule.eta.toISOString());
  assert.equal(result.etb, schedule.etb!.toISOString());
  assert.equal(result.etd, next.toISOString());
});

test("schedule permissions allow planners and reject viewers", () => {
  assert.equal(canManageSchedules("OWNER"), true);
  assert.equal(canManageSchedules("ADMIN"), true);
  assert.equal(canManageSchedules("PLANNER"), true);
  assert.equal(canManageSchedules("VIEWER"), false);
});

test("stale resize versions are rejected", () => {
  const updatedAt = new Date("2026-07-28T10:00:00.000Z");
  assert.equal(isResizeVersionCurrent(updatedAt, updatedAt.toISOString()), true);
  assert.equal(isResizeVersionCurrent(updatedAt, "2026-07-28T09:59:59.000Z"), false);
  assert.equal(isResizeVersionCurrent(updatedAt, ""), false);
});

// --- ETB invariant tests: ETA <= ETB < ETD ---

// schedule.eta = 07:00, schedule.etb = 08:00, schedule.etd = 12:00
// start-edge drag scenarios

test("start-edge resize: ETB equal to ETA is valid", () => {
  // Drag ETB to exactly ETA (07:00) — should be valid
  const eta = schedule.eta; // 07:00
  const proposal = computeResizeProposal({
    schedule,
    edge: "start",
    pointerX: 0,
    pointerY: positionY(eta),
    domain: "position",
    frame,
    weekStart,
    weekEnd,
    otherSchedules: [],
  });
  assert.equal(proposal.isValid, true, "ETB equal to ETA should be valid");
  assert.equal(proposal.invalidReason, undefined);
  assert.equal(proposal.newStartTime.toISOString(), eta.toISOString());
});

test("start-edge resize: ETB before ETA is invalid with etb_before_eta reason", () => {
  // Drag ETB to 06:00, which is before ETA 07:00 — should be invalid
  const beforeEta = new Date("2026-07-29T06:00:00.000Z");
  const proposal = computeResizeProposal({
    schedule,
    edge: "start",
    pointerX: 0,
    pointerY: positionY(beforeEta),
    domain: "position",
    frame,
    weekStart,
    weekEnd,
    otherSchedules: [],
  });
  assert.equal(proposal.isValid, false, "ETB before ETA should be invalid");
  assert.equal(proposal.invalidReason, "etb_before_eta");
  assert.equal(proposal.hasConflict, false);
});

test("start-edge resize: ETB after ETA is valid", () => {
  // Drag ETB to 09:00, which is after ETA 07:00 — should be valid
  const afterEta = new Date("2026-07-29T09:00:00.000Z");
  const proposal = computeResizeProposal({
    schedule,
    edge: "start",
    pointerX: 0,
    pointerY: positionY(afterEta),
    domain: "position",
    frame,
    weekStart,
    weekEnd,
    otherSchedules: [],
  });
  assert.equal(proposal.isValid, true, "ETB after ETA should be valid");
  assert.equal(proposal.invalidReason, undefined);
});

test("start-edge resize: ETB at or after ETD is invalid (too_short)", () => {
  // Drag ETB to 12:00, equal to ETD 12:00 — duration becomes 0
  const atEtd = schedule.etd; // 12:00
  const proposal = computeResizeProposal({
    schedule,
    edge: "start",
    pointerX: 0,
    pointerY: positionY(atEtd),
    domain: "position",
    frame,
    weekStart,
    weekEnd,
    otherSchedules: [],
  });
  assert.equal(proposal.isValid, false, "ETB at ETD should be invalid");
  assert.notEqual(proposal.invalidReason, undefined);
});

test("start-edge resize: null ETB resizes ETA and does not trigger etb_before_eta", () => {
  // Schedule without ETB: start-edge drag should move ETA, never check ETB rule
  const scheduleNoEtb: typeof schedule = { ...schedule, etb: null, startTime: schedule.eta };
  const beforeOriginalEta = new Date("2026-07-29T06:00:00.000Z");
  const proposal = computeResizeProposal({
    schedule: scheduleNoEtb,
    edge: "start",
    pointerX: 0,
    pointerY: positionY(beforeOriginalEta),
    domain: "position",
    frame,
    weekStart,
    weekEnd,
    otherSchedules: [],
  });
  // Moving ETA earlier is valid — no ETB rule applies
  assert.equal(proposal.isValid, true, "Null-ETB start-edge drag should be valid when moving ETA earlier");
  assert.notEqual(proposal.invalidReason, "etb_before_eta");
  assert.equal(proposal.newStartTime.toISOString(), beforeOriginalEta.toISOString());
});

test("applyResizeTimes: ETB equal to ETA produces valid ISO strings", () => {
  const eta = schedule.eta;
  const result = applyResizeTimes({
    eta: eta.toISOString(),
    etb: schedule.etb!.toISOString(),
    etd: schedule.etd.toISOString(),
    edge: "start",
    newStartTime: eta, // ETB = ETA
    newEndTime: schedule.endTime,
  });
  assert.equal(result.eta, eta.toISOString(), "ETA must not change");
  assert.equal(result.etb, eta.toISOString(), "ETB should be set to ETA");
  assert.equal(result.etd, schedule.etd.toISOString(), "ETD must not change");
});
