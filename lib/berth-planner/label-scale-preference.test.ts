import test from "node:test";
import assert from "node:assert/strict";
import {
  BERTH_PLANNER_LABEL_SCALE_STORAGE_KEY,
  canDecreaseBerthPlannerLabelScale,
  canIncreaseBerthPlannerLabelScale,
  normalizeBerthPlannerLabelScale,
  readBerthPlannerLabelScale,
  shiftBerthPlannerLabelScale,
  writeBerthPlannerLabelScale,
} from "./label-scale-preference";

test("normalizes invalid scale to 100 and accepts allowlisted steps", () => {
  assert.equal(normalizeBerthPlannerLabelScale(80), 80);
  assert.equal(normalizeBerthPlannerLabelScale("125"), 125);
  assert.equal(normalizeBerthPlannerLabelScale(95), 100);
  assert.equal(normalizeBerthPlannerLabelScale("foo"), 100);
  assert.equal(normalizeBerthPlannerLabelScale(null), 100);
});

test("reads and writes storage with versioned key", () => {
  const state = new Map<string, string>();
  const storage = {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => {
      state.set(key, value);
    },
  };

  assert.equal(readBerthPlannerLabelScale(storage), 100);
  writeBerthPlannerLabelScale(storage, 140);
  assert.equal(state.get(BERTH_PLANNER_LABEL_SCALE_STORAGE_KEY), "140");
  assert.equal(readBerthPlannerLabelScale(storage), 140);
});

test("shifts scale within bounded steps", () => {
  assert.equal(shiftBerthPlannerLabelScale(100, -1), 90);
  assert.equal(shiftBerthPlannerLabelScale(100, 1), 110);
  assert.equal(shiftBerthPlannerLabelScale(80, -1), 80);
  assert.equal(shiftBerthPlannerLabelScale(140, 1), 140);
});

test("reports min and max boundaries", () => {
  assert.equal(canDecreaseBerthPlannerLabelScale(80), false);
  assert.equal(canIncreaseBerthPlannerLabelScale(140), false);
  assert.equal(canDecreaseBerthPlannerLabelScale(90), true);
  assert.equal(canIncreaseBerthPlannerLabelScale(125), true);
});
