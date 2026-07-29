import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { assertDatabaseTarget, formatDatabaseTarget } from "../lib/db/target-guard";

const ORGANIZATION_SLUG = "__berth-planner-performance-test__";
const ORGANIZATION_NAME = "Berth Planner Performance Test — Generated Data";
const WEEK_START = new Date("2026-07-27T00:00:00.000Z");
const WEEK_END = new Date("2026-08-03T00:00:00.000Z");

function assertSafeEnvironment() {
  const target = assertDatabaseTarget({ purpose: "explain" });
  console.log(formatDatabaseTarget(target));
}

type ExplainNode = { "Node Type": string; "Actual Total Time"?: number; "Actual Rows"?: number; "Plan Rows"?: number; "Sort Key"?: unknown; Plans?: ExplainNode[] };

function describe(node: ExplainNode, indent = "") {
  const details = [`actual=${node["Actual Total Time"] ?? 0}ms`, `rows=${node["Actual Rows"] ?? 0}/${node["Plan Rows"] ?? 0}`];
  if (node["Sort Key"]) details.push("sort");
  console.log(`${indent}${node["Node Type"]} (${details.join(", ")})`);
  node.Plans?.forEach((child) => describe(child, `${indent}  `));
}

async function main() {
  assertSafeEnvironment();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const organization = await prisma.organization.findUnique({ where: { slug: ORGANIZATION_SLUG }, select: { id: true, name: true } });
    if (!organization || organization.name !== ORGANIZATION_NAME) throw new Error("Seed the generated planner performance dataset before running EXPLAIN.");
    const terminal = await prisma.terminal.findFirst({ where: { organizationId: organization.id }, select: { id: true } });
    const berths = await prisma.berth.findMany({ where: { organizationId: organization.id }, select: { id: true } });
    if (!terminal || !berths.length) throw new Error("Generated terminal or berths are missing.");
    const ids = berths.map((berth) => `'${berth.id}'`).join(",");
    const plan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": Array<{ Plan: ExplainNode; "Execution Time": number }> }>>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT "id" FROM "vessel_schedules" WHERE "organizationId" = $1::uuid AND "terminalId" = $2::uuid AND "berthId" IN (${ids}) AND "eta" < $3 AND "etd" > $4`,
      organization.id,
      terminal.id,
      WEEK_END,
      WEEK_START,
    );
    const result = plan[0]?.["QUERY PLAN"][0];
    if (!result) throw new Error("EXPLAIN returned no plan.");
    console.log(`Planner schedule EXPLAIN ANALYZE (${result["Execution Time"]}ms):`);
    describe(result.Plan);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: Error) => { console.error(error.message); process.exit(1); });
