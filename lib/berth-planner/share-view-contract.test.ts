import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("planner toolbar freezes current scope and exposes post-create actions", async () => {
  const [view, controls, dialog, publicRoute] = await Promise.all([
    readFile(resolve(process.cwd(), "components/berth-planner/berth-planner-view.tsx"), "utf8"),
    readFile(resolve(process.cwd(), "components/berth-planner/berth-planner-controls.tsx"), "utf8"),
    readFile(resolve(process.cwd(), "components/berth-planner/share-view-dialog.tsx"), "utf8"),
    readFile(resolve(process.cwd(), "app/api/public/berth-planner/[publicId]/data/route.ts"), "utf8"),
  ]);
  assert.match(controls, />Share view</);
  assert.match(view, /setShareSnapshot\(\{/);
  assert.match(view, /filters: effectiveFilters/);
  assert.match(view, /endDate: dateOnlyInTimezone\(new Date\(weekEnd\.getTime\(\) - 1\)/);
  assert.match(dialog, /expirationDays: Number\(expirationDays\)/);
  assert.match(dialog, />Copy link</);
  assert.match(dialog, />Open preview</);
  assert.match(dialog, /Revoke/);
  assert.match(publicRoute, /stored\.berthId \? filtered\.filter/);
});

test("public share dialog does not request mutable or private planner fields", async () => {
  const dialog = await readFile(resolve(process.cwd(), "components/berth-planner/share-view-dialog.tsx"), "utf8");
  const requestBody = dialog.split("\n").find((line) => line.includes("body: JSON.stringify")) ?? "";
  assert.ok(requestBody);
  assert.doesNotMatch(requestBody, /remarks|updatedAt|organizationId|createdBy|audit/i);
});
