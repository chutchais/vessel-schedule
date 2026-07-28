import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDatetimeBerthLanes,
  datetimeLaneYToPosition,
  positionToDatetimeLaneY,
} from "./datetime-domain";

test("builds berth lanes that fill draw height", () => {
  const lanes = buildDatetimeBerthLanes(
    [
      { id: "b1", berthLength: 200, zeroOriginSide: "LEFT" },
      { id: "b2", berthLength: 300, zeroOriginSide: "RIGHT" },
    ],
    408,
  );

  assert.equal(lanes.length, 2);
  assert.equal(lanes[0]!.laneTop, 0);
  assert.equal(Math.round(lanes[0]!.laneHeight), 200);
  assert.equal(Math.round(lanes[1]!.laneTop), 208);
  assert.equal(Math.round(lanes[1]!.laneHeight), 200);
  assert.equal(Math.round(lanes[1]!.laneTop + lanes[1]!.laneHeight), 408);
});

test("converts position <-> lane Y for LEFT origin", () => {
  const laneTop = 50;
  const laneHeight = 200;
  const berthLength = 100;
  const y = positionToDatetimeLaneY(25, berthLength, "LEFT", laneTop, laneHeight);
  assert.equal(y, 100);

  const meters = datetimeLaneYToPosition(y, berthLength, "LEFT", laneTop, laneHeight);
  assert.equal(meters, 25);
});

test("converts position <-> lane Y for RIGHT origin", () => {
  const laneTop = 20;
  const laneHeight = 240;
  const berthLength = 120;
  const y = positionToDatetimeLaneY(30, berthLength, "RIGHT", laneTop, laneHeight);
  assert.equal(y, 200);

  const meters = datetimeLaneYToPosition(y, berthLength, "RIGHT", laneTop, laneHeight);
  assert.equal(meters, 30);
});
