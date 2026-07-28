import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const viewPath = resolve(process.cwd(), "components/berth-planner/berth-planner-view.tsx");

test("planner mutations use API/background refresh instead of browser navigation", async () => {
  const source = await readFile(viewPath, "utf8");
  assert.doesNotMatch(source, /window\.location\.reload|location\.assign|location\.replace|router\.(?:push|replace|refresh)/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /loadPlannerData\(selectedTerminalId, weekStart, weekEnd, true\)/);
  assert.doesNotMatch(source, /const refreshPlanner[\s\S]{0,300}setIsLoading\(true\)/);
});

test("successful planner mutations retain their dialog until the API succeeds and refresh in place", async () => {
  const source = await readFile(viewPath, "utf8");
  assert.match(source, /if \(!patchRes\.ok\) \{[\s\S]{0,220}setResizeSaveError/);
  assert.match(source, /if \(!response\.ok\) \{[\s\S]{0,260}setEditError/);
  assert.match(source, /highlightCurrentUserChange\(dragDropPending\.scheduleId, "updated"\)/);
  assert.match(source, /highlightCurrentUserChange\(resizePending\.scheduleId, "updated"\)/);
  assert.match(source, /highlightCurrentUserChange\(undoAction\.scheduleId, "updated"\)/);
});
