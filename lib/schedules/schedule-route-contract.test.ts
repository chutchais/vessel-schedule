import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const routePath = resolve(process.cwd(), "app/api/schedules/[id]/route.ts");
const scheduleManagerPath = resolve(process.cwd(), "components/schedules/schedule-manager.tsx");
const plannerPath = resolve(process.cwd(), "components/berth-planner/berth-planner-view.tsx");

test("every schedule PATCH contract requires and sends expectedUpdatedAt", async () => {
  const [route, scheduleManager, planner] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(scheduleManagerPath, "utf8"),
    readFile(plannerPath, "utf8"),
  ]);
  assert.match(route, /expectedUpdatedAt is required for schedule updates/);
  assert.match(route, /if \(!expectedUpdatedAt\)/);
  assert.match(scheduleManager, /expectedUpdatedAt: editingUpdatedAt/);
  assert.match(planner, /expectedUpdatedAt: editingUpdatedAt/);
  assert.match(planner, /expectedUpdatedAt: undoAction\.expectedUpdatedAt/);
  assert.match(planner, /expectedUpdatedAt: full\.updatedAt/);
  assert.match(planner, /expectedUpdatedAt: resizePending\.expectedUpdatedAt/);
});
