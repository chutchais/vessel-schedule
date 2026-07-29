import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklyExportPages } from "./weekly-export";
import type { PlannerBerth } from "./types";

function berth(id: string, length = 300): PlannerBerth {
  return { id, name: id, berthLength: length, zeroOriginSide: "LEFT", order: 0, schedules: [] };
}

test("weekly export keeps a complete datetime week while splitting tall terminals by berth", () => {
  const pages = buildWeeklyExportPages(Array.from({ length: 7 }, (_, i) => berth(`b${i}`)), "datetime");
  assert.deepEqual(pages.map((page) => page.berthIds.length), [6, 1]);
  assert.equal(pages[1]?.totalPages, 2);
});

test("position export splits only at berth boundaries for wide terminals", () => {
  const pages = buildWeeklyExportPages([berth("a", 700), berth("b", 700), berth("c", 400)], "position");
  assert.deepEqual(pages.map((page) => page.berthIds), [["a"], ["b", "c"]]);
});

test("empty schedules still produce one printable page", () => {
  const pages = buildWeeklyExportPages([], "position");
  assert.deepEqual(pages, [{ berthIds: [], page: 1, totalPages: 1 }]);
});
