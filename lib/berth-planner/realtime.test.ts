import assert from "node:assert/strict";
import test from "node:test";
import { actionFromAudit, canFocusChange, eventIsRelevant, getChangedFields, highlightForChange, type PlannerChangeEvent } from "./realtime";

const weekStart = new Date("2026-07-27T00:00:00.000Z");
const weekEnd = new Date("2026-08-03T00:00:00.000Z");
const inWeek = { terminalId: "terminal-a", eta: "2026-07-28T00:00:00.000Z", etd: "2026-07-29T00:00:00.000Z" };

test("planner change actions distinguish planner operations", () => {
  assert.equal(actionFromAudit({ action: "CREATE", metadata: null }), "created");
  assert.equal(actionFromAudit({ action: "UPDATE", metadata: { context: "Berth Planner move" } }), "moved");
  assert.equal(actionFromAudit({ action: "UPDATE", metadata: { context: "Berth Planner resize" } }), "resized");
  assert.equal(actionFromAudit({ action: "UPDATE", metadata: { context: "Berth Planner undo" } }), "undone");
});

test("planner events remain isolated to the selected terminal and week, including moves out of week", () => {
  assert.equal(eventIsRelevant({ beforeData: inWeek, afterData: { ...inWeek, etd: "2026-08-05T00:00:00.000Z" }, terminalId: "terminal-a", start: weekStart, end: weekEnd }), true);
  assert.equal(eventIsRelevant({ beforeData: { ...inWeek, terminalId: "terminal-b" }, afterData: { ...inWeek, terminalId: "terminal-b" }, terminalId: "terminal-a", start: weekStart, end: weekEnd }), false);
  assert.equal(eventIsRelevant({ beforeData: { ...inWeek, eta: "2026-08-04T00:00:00.000Z", etd: "2026-08-05T00:00:00.000Z" }, afterData: {}, terminalId: "terminal-a", start: weekStart, end: weekEnd }), false);
});

test("changed fields and feedback tones cover create, update and conflict behavior", () => {
  assert.deepEqual(getChangedFields({ eta: "a", berthId: "a" }, { eta: "b", berthId: "a" }), ["eta"]);
  const event: PlannerChangeEvent = { id: "event", scheduleId: "schedule", action: "created", createdAt: weekStart.toISOString(), vesselName: "Vessel", voyageNumber: null, actorName: "Other", isCurrentUser: false, changedFields: [], terminalId: "terminal-a", eta: inWeek.eta, etd: inWeek.etd, isVisibleInWeek: true };
  assert.deepEqual(highlightForChange(event, false), { tone: "created", stronger: true });
  assert.deepEqual(highlightForChange({ ...event, action: "moved", isCurrentUser: true }, true), { tone: "conflict", stronger: false });
});

test("recent changes explain deleted, out-of-week and filtered navigation", () => {
  const event: PlannerChangeEvent = { id: "event", scheduleId: "schedule", action: "edited", createdAt: weekStart.toISOString(), vesselName: "Vessel", voyageNumber: null, actorName: "User", isCurrentUser: true, changedFields: [], terminalId: "terminal-a", eta: inWeek.eta, etd: inWeek.etd, isVisibleInWeek: true };
  assert.equal(canFocusChange({ event, visibleScheduleIds: new Set(["schedule"]) }), null);
  assert.match(canFocusChange({ event, visibleScheduleIds: new Set() }) ?? "", /hidden by the active filters/);
  assert.match(canFocusChange({ event: { ...event, action: "deleted" }, visibleScheduleIds: new Set(["schedule"]) }) ?? "", /deleted/);
  assert.match(canFocusChange({ event: { ...event, isVisibleInWeek: false }, visibleScheduleIds: new Set(["schedule"]) }) ?? "", /outside the visible week/);
});
