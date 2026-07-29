import "dotenv/config";
import { performance } from "node:perf_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { buildConflictGroups } from "../lib/berth-planner/conflict-panel";
import { filterPlannerBerths, EMPTY_OPERATIONAL_FILTERS } from "../lib/berth-planner/operational-filters";
import type { PlannerBerth } from "../lib/berth-planner/types";

const ORGANIZATION_SLUG = "__berth-planner-performance-test__";
const WEEK_START = new Date("2026-07-27T00:00:00.000Z");
const WEEK_END = new Date("2026-08-03T00:00:00.000Z");

function assertSafeEnvironment() {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.NODE_ENV === "production") throw new Error("Benchmark requires a non-production DATABASE_URL");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && process.env.PLANNER_PERFORMANCE_ALLOW_REMOTE_DEV !== "true") throw new Error("Set PLANNER_PERFORMANCE_ALLOW_REMOTE_DEV=true only for an approved development database.");
}

function median(values: number[]) { return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!; }
function time(fn: () => void, iterations = 12) {
  const values: number[] = [];
  for (let i = 0; i < iterations; i++) { const start = performance.now(); fn(); values.push(performance.now() - start); }
  return median(values);
}

async function main() {
  assertSafeEnvironment();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const organization = await prisma.organization.findUnique({ where: { slug: ORGANIZATION_SLUG }, select: { id: true } });
    if (!organization) throw new Error("Run seed:planner-performance first.");
    const terminal = await prisma.terminal.findFirst({ where: { organizationId: organization.id }, select: { id: true } });
    if (!terminal) throw new Error("Generated terminal is missing.");
    const queryStart = performance.now();
    const berths = await prisma.berth.findMany({
      where: { organizationId: organization.id, terminalId: terminal.id }, orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, berthLength: true, zeroOriginSide: true, sortOrder: true, schedules: { where: { eta: { lt: WEEK_END }, etd: { gt: WEEK_START } }, select: { id: true, berthId: true, status: true, eta: true, etb: true, etd: true, berthPositionMeters: true, headingReverse: true, voyageNumber: true, updatedAt: true, vessel: { select: { name: true, lengthOverall: true } }, service: { select: { name: true, color: true } } } } },
    });
    const queryMs = performance.now() - queryStart;
    const raw = JSON.stringify(berths);
    const transformMs = time(() => {
      berths.map((berth) => ({ ...berth, schedules: berth.schedules.map((schedule) => ({ ...schedule, eta: new Date(schedule.eta), etb: schedule.etb ? new Date(schedule.etb) : null, etd: new Date(schedule.etd) })) }));
    });
    const plannerBerths: PlannerBerth[] = berths.map((berth) => ({ id: berth.id, name: berth.name, berthLength: berth.berthLength.toNumber(), zeroOriginSide: berth.zeroOriginSide, order: berth.sortOrder, schedules: berth.schedules.map((schedule) => ({ id: schedule.id, berthId: schedule.berthId ?? "", status: schedule.status, eta: schedule.eta, etb: schedule.etb, etd: schedule.etd, berthPositionMeters: schedule.berthPositionMeters, headingReverse: schedule.headingReverse, voyageNumber: schedule.voyageNumber, vesselName: schedule.vessel.name, vesselLoa: schedule.vessel.lengthOverall?.toNumber() ?? null, vesselColor: "#3B82F6", serviceName: schedule.service?.name ?? null, serviceColor: schedule.service?.color ?? null, updatedAt: schedule.updatedAt.toISOString() })) }));
    const conflictMs = time(() => { buildConflictGroups(plannerBerths); });
    const groups = buildConflictGroups(plannerBerths);
    const ids = new Set(groups.flatMap((group) => group.conflicts.flatMap((item) => [item.scheduleAId, item.scheduleBId])));
    const filterMs = time(() => { filterPlannerBerths({ berths: plannerBerths, filters: { ...EMPTY_OPERATIONAL_FILTERS, search: "performance vessel 1" }, conflictedScheduleIds: ids }); });
    console.log(JSON.stringify({ schedules: plannerBerths.reduce((sum, berth) => sum + berth.schedules.length, 0), queryMs: Number(queryMs.toFixed(2)), responseBytes: Buffer.byteLength(raw), transformMedianMs: Number(transformMs.toFixed(2)), conflictMedianMs: Number(conflictMs.toFixed(2)), filterMedianMs: Number(filterMs.toFixed(2)) }, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error: Error) => { console.error(error.message); process.exit(1); });
