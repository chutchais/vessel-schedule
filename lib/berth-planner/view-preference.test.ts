import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePlannerDomain,
  readPreferredPlannerDomain,
  switchPlannerDomainPreservingState,
} from "./view-preference";

test("normalizes invalid domain to position", () => {
  assert.equal(normalizePlannerDomain("position"), "position");
  assert.equal(normalizePlannerDomain("datetime"), "datetime");
  assert.equal(normalizePlannerDomain("foo"), "position");
  assert.equal(normalizePlannerDomain(null), "position");
});

test("reads preferred domain from storage", () => {
  const storage = {
    getItem: () => "datetime",
  };
  assert.equal(readPreferredPlannerDomain(storage), "datetime");
});

test("switches domain while preserving planner state", () => {
  const next = switchPlannerDomainPreservingState(
    {
      domain: "position",
      selectedTerminalId: "term-1",
      weekStartIso: "2026-07-27T00:00:00.000Z",
      activeScheduleId: "sch-1",
    },
    "datetime",
  );

  assert.equal(next.domain, "datetime");
  assert.equal(next.selectedTerminalId, "term-1");
  assert.equal(next.weekStartIso, "2026-07-27T00:00:00.000Z");
  assert.equal(next.activeScheduleId, "sch-1");
});
