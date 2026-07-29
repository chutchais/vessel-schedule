import test from "node:test";
import assert from "node:assert/strict";
import { canCreateFromPointer, hitSlopForPointer, resizeHitAreaForPointer } from "./pointer-interaction";

test("touch creation requires the explicit add mode while mouse creation remains available", () => {
  assert.equal(canCreateFromPointer("touch", false), false);
  assert.equal(canCreateFromPointer("touch", true), true);
  assert.equal(canCreateFromPointer("mouse", false), true);
});

test("pen and touch receive larger vessel and resize targets", () => {
  assert.equal(hitSlopForPointer("mouse"), 0);
  assert.ok(hitSlopForPointer("touch") >= 12);
  assert.equal(resizeHitAreaForPointer("mouse"), 8);
  assert.ok(resizeHitAreaForPointer("pen") >= 20);
});
