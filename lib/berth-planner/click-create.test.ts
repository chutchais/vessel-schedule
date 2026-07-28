import test from "node:test";
import assert from "node:assert/strict";
import {
  convertCanvasClickToCreateSelection,
  snapMeters,
  snapTimeToMinutes,
  shouldHandleCreateClick,
  type ClickCreateBerth,
  type PlannerCanvasFrame,
} from "./click-create";

const frame: PlannerCanvasFrame = {
  leftAxisWidth: 60,
  topHeaderHeight: 50,
  drawWidth: 1000,
  drawHeight: 700,
};

const weekStart = new Date("2026-07-27T00:00:00.000Z");
const weekEnd = new Date("2026-08-03T00:00:00.000Z");

test("converts click Y to planned start time", () => {
  const berths: ClickCreateBerth[] = [{ id: "b1", berthLength: 100, zeroOriginSide: "LEFT" }];
  const selection = convertCanvasClickToCreateSelection({
    x: 110,
    y: frame.topHeaderHeight + frame.drawHeight / 2,
    frame,
    berths,
    weekStart,
    weekEnd,
  });

  assert.ok(selection);
  assert.equal(selection.plannedStartTime.toISOString(), "2026-07-30T12:00:00.000Z");
});

test("snaps time to 30 minutes", () => {
  const snapped = snapTimeToMinutes(new Date("2026-07-28T10:14:00.000Z"), 30);
  assert.equal(snapped.toISOString(), "2026-07-28T10:00:00.000Z");
});

test("converts click to berth and snapped position", () => {
  const berths: ClickCreateBerth[] = [
    { id: "left-berth", berthLength: 100, zeroOriginSide: "LEFT" },
    { id: "right-berth", berthLength: 120, zeroOriginSide: "RIGHT" },
  ];

  const selection = convertCanvasClickToCreateSelection({
    x: frame.leftAxisWidth + (23 / 220) * frame.drawWidth,
    y: frame.topHeaderHeight + 100,
    frame,
    berths,
    weekStart,
    weekEnd,
  });

  assert.ok(selection);
  assert.equal(selection.berthId, "left-berth");
  assert.equal(selection.berthPositionMeters, 25);
});

test("snaps berth position to 5 meters", () => {
  assert.equal(snapMeters(62.4, 5), 60);
  assert.equal(snapMeters(62.6, 5), 65);
});

test("handles zeroOriginSide LEFT and RIGHT", () => {
  const berths: ClickCreateBerth[] = [
    { id: "left-berth", berthLength: 100, zeroOriginSide: "LEFT" },
    { id: "right-berth", berthLength: 100, zeroOriginSide: "RIGHT" },
  ];

  const leftSelection = convertCanvasClickToCreateSelection({
    x: frame.leftAxisWidth + (20 / 200) * frame.drawWidth,
    y: frame.topHeaderHeight + 120,
    frame,
    berths,
    weekStart,
    weekEnd,
  });

  const rightSelection = convertCanvasClickToCreateSelection({
    x: frame.leftAxisWidth + (120 / 200) * frame.drawWidth,
    y: frame.topHeaderHeight + 120,
    frame,
    berths,
    weekStart,
    weekEnd,
  });

  assert.ok(leftSelection);
  assert.ok(rightSelection);
  assert.equal(leftSelection.berthId, "left-berth");
  assert.equal(leftSelection.berthPositionMeters, 20);
  assert.equal(rightSelection.berthId, "right-berth");
  assert.equal(rightSelection.berthPositionMeters, 80);
});

test("ignores vessel-hit and non-grid clicks", () => {
  const berths: ClickCreateBerth[] = [{ id: "b1", berthLength: 100, zeroOriginSide: "LEFT" }];

  const outsideGrid = convertCanvasClickToCreateSelection({
    x: 20,
    y: frame.topHeaderHeight + 20,
    frame,
    berths,
    weekStart,
    weekEnd,
  });

  assert.equal(outsideGrid, null);
  assert.equal(shouldHandleCreateClick(true, {
    berthId: "b1",
    berthPositionMeters: 10,
    plannedStartTime: new Date(),
  }), false);
});
