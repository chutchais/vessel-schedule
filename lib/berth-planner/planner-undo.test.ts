import test from "node:test";
import assert from "node:assert/strict";
import { getPlannerUndoUnavailableReason } from "./planner-undo";

const now = new Date("2026-07-28T10:00:00.000Z");
const version = new Date("2026-07-28T09:59:00.000Z");

test("a current unused undo is available", () => {
  assert.equal(getPlannerUndoUnavailableReason({ now, expiresAt: new Date("2026-07-28T10:00:15.000Z"), usedAt: null, expectedUpdatedAt: version, currentUpdatedAt: version }), null);
});

test("used, expired, and stale undo actions are rejected safely", () => {
  assert.equal(getPlannerUndoUnavailableReason({ now, expiresAt: new Date("2026-07-28T10:00:15.000Z"), usedAt: now, expectedUpdatedAt: version, currentUpdatedAt: version }), "used");
  assert.equal(getPlannerUndoUnavailableReason({ now, expiresAt: now, usedAt: null, expectedUpdatedAt: version, currentUpdatedAt: version }), "expired");
  assert.equal(getPlannerUndoUnavailableReason({ now, expiresAt: new Date("2026-07-28T10:00:15.000Z"), usedAt: null, expectedUpdatedAt: version, currentUpdatedAt: now }), "stale");
});
