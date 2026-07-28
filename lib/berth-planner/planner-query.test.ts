import test from "node:test";
import assert from "node:assert/strict";
import { buildPlannerScheduleScope } from "./planner-query";

test("planner schedule scope always includes active organization and selected terminal", () => {
  const scope = buildPlannerScheduleScope({
    organizationId: "org-active",
    terminalId: "terminal-selected",
    berthIds: ["berth-1"],
    rangeStart: new Date("2026-07-27T00:00:00Z"),
    rangeEnd: new Date("2026-08-03T00:00:00Z"),
  });

  assert.equal(scope.organizationId, "org-active");
  assert.equal(scope.terminalId, "terminal-selected");
  assert.deepEqual(scope.berthId, { in: ["berth-1"] });
});

