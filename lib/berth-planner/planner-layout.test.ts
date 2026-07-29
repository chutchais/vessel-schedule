import test from "node:test";
import assert from "node:assert/strict";
import { isCompactPlannerLandscape } from "./planner-layout";

test("compact planner layout targets short landscape viewports, not device names", () => {
  assert.equal(isCompactPlannerLandscape(1024, 768), true);
  assert.equal(isCompactPlannerLandscape(1366, 768), true);
  assert.equal(isCompactPlannerLandscape(768, 1024), false);
  assert.equal(isCompactPlannerLandscape(820, 1180), false);
});
