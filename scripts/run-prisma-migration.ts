import { spawnSync } from "node:child_process";
import { assertDatabaseTarget, formatDatabaseTarget } from "../lib/db/target-guard";

const operation = process.argv[2];
if (operation !== "status" && operation !== "deploy") {
  throw new Error("Usage: tsx scripts/run-prisma-migration.ts <status|deploy>");
}

const target = assertDatabaseTarget({ purpose: "migration" });
console.log(formatDatabaseTarget(target));
console.log(`[database-target] running prisma migrate ${operation}`);

const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", operation], {
  env: process.env,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
