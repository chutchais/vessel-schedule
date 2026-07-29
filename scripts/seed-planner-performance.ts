import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ScheduleStatus, VesselType, ZeroOriginSide } from "../generated/prisma/client";

const ORGANIZATION_SLUG = "__berth-planner-performance-test__";
const ORGANIZATION_NAME = "Berth Planner Performance Test — Generated Data";
const GENERATED_USER_EMAILS = ["berth-planner-performance-owner@example.test", "berth-planner-performance-planner@example.test"];
const WEEK_START = new Date("2026-07-27T00:00:00.000Z");
const SCHEDULE_COUNTS = new Set([100, 500, 1000]);

function parseArgs() {
  const args = process.argv.slice(2);
  const cleanup = args.includes("--cleanup");
  const value = args.find((arg) => arg.startsWith("--schedules="))?.split("=")[1];
  const schedules = value ? Number(value) : 500;
  if (!cleanup && (!Number.isInteger(schedules) || !SCHEDULE_COUNTS.has(schedules))) {
    throw new Error("--schedules must be one of 100, 500, or 1000");
  }
  return { cleanup, schedules };
}

function assertSafeEnvironment() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (process.env.NODE_ENV === "production") {
    throw new Error("Planner performance seed refuses to run when NODE_ENV=production");
  }
  const host = new URL(url).hostname;
  const isLocalDatabase = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!isLocalDatabase && process.env.PLANNER_PERFORMANCE_ALLOW_REMOTE_DEV !== "true") {
    throw new Error("Refusing a non-local database. Set PLANNER_PERFORMANCE_ALLOW_REMOTE_DEV=true only for an approved development database.");
  }
}

async function removeGeneratedData(prisma: PrismaClient) {
  const organization = await prisma.organization.findUnique({ where: { slug: ORGANIZATION_SLUG }, select: { id: true, name: true } });
  if (!organization) return false;
  if (organization.name !== ORGANIZATION_NAME) throw new Error("Refusing cleanup: matching slug does not have the generated performance-test name");

  await prisma.$transaction(async (tx) => {
    await tx.plannerUndo.deleteMany({ where: { organizationId: organization.id } });
    await tx.auditLog.deleteMany({ where: { organizationId: organization.id } });
    await tx.vesselSchedule.deleteMany({ where: { organizationId: organization.id } });
    await tx.organizationInvitation.deleteMany({ where: { organizationId: organization.id } });
    await tx.organizationMember.deleteMany({ where: { organizationId: organization.id } });
    await tx.service.deleteMany({ where: { organizationId: organization.id } });
    await tx.vessel.deleteMany({ where: { organizationId: organization.id } });
    await tx.berth.deleteMany({ where: { organizationId: organization.id } });
    await tx.terminal.deleteMany({ where: { organizationId: organization.id } });
    await tx.port.deleteMany({ where: { organizationId: organization.id } });
    await tx.company.deleteMany({ where: { organizationId: organization.id } });
    await tx.organization.delete({ where: { id: organization.id } });
  });
  await prisma.user.deleteMany({ where: { email: { in: GENERATED_USER_EMAILS } } });
  return true;
}

function scheduleRows(args: { count: number; organizationId: string; terminalId: string; berthIds: string[]; vesselIds: string[]; serviceIds: string[] }) {
  return Array.from({ length: args.count }, (_, index) => {
    const berthIndex = index % args.berthIds.length;
    const startsBeforeWeek = index % 40 === 0;
    const endsAfterWeek = index % 40 === 1;
    const conflict = index % 10 === 0;
    const incompletePosition = index % 17 === 0;
    const incompleteVessel = index % 19 === 0;
    const slot = Math.floor(index / args.berthIds.length);
    const startHours = startsBeforeWeek ? -6 : endsAfterWeek ? 164 : (slot % 154);
    const eta = new Date(WEEK_START.getTime() + startHours * 60 * 60 * 1000);
    const etd = new Date(eta.getTime() + (endsAfterWeek ? 14 : 10) * 60 * 60 * 1000);
    const basePosition = (slot * 65 + berthIndex * 25) % 760;
    return {
      organizationId: args.organizationId,
      terminalId: args.terminalId,
      berthId: args.berthIds[berthIndex],
      vesselId: args.vesselIds[incompleteVessel ? args.vesselIds.length - 1 : index % (args.vesselIds.length - 1)]!,
      serviceId: args.serviceIds[index % args.serviceIds.length],
      voyageNumber: `PERF-${String(index + 1).padStart(4, "0")}`,
      eta,
      etb: index % 4 === 0 ? null : new Date(eta.getTime() + 60 * 60 * 1000),
      etd,
      status: (index % 29 === 0 ? "CANCELLED" : "PLANNED") as ScheduleStatus,
      berthPositionMeters: incompletePosition ? null : conflict ? Math.max(0, basePosition - 25) : basePosition,
      headingReverse: index % 7 === 0,
      remarks: "Generated only for berth-planner performance measurements.",
    };
  });
}

async function main() {
  assertSafeEnvironment();
  const { cleanup, schedules } = parseArgs();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const removed = await removeGeneratedData(prisma);
    if (cleanup) {
      console.log(removed ? "Removed generated berth-planner performance data." : "No generated berth-planner performance data found.");
      return;
    }

    const organization = await prisma.organization.create({ data: { name: ORGANIZATION_NAME, slug: ORGANIZATION_SLUG } });
    const users = await Promise.all(["owner", "planner"].map((role, index) => prisma.user.create({
      data: { id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, email: GENERATED_USER_EMAILS[index]!, displayName: `Performance ${role}`, isActive: true },
    })));
    await prisma.organizationMember.createMany({ data: users.map((user, index) => ({ organizationId: organization.id, userId: user.id, role: index === 0 ? "OWNER" : "PLANNER", isActive: true })) });
    const port = await prisma.port.create({ data: { organizationId: organization.id, code: "PERF", unlocode: "PFRM", name: "Performance Test Port", country: "Test", timezone: "UTC" } });
    const terminal = await prisma.terminal.create({ data: { organizationId: organization.id, portId: port.id, code: "PERF-T1", name: "Performance Test Terminal" } });
    const company = await prisma.company.create({ data: { organizationId: organization.id, code: "PERF-OP", name: "Performance Operator", type: "TERMINAL_OPERATOR" } });
    await prisma.berth.createMany({ data: Array.from({ length: 8 }, (_, index) => ({ organizationId: organization.id, terminalId: terminal.id, code: `PERF-B${index + 1}`, name: `Performance Berth ${index + 1}`, berthLength: 900, sortOrder: index, zeroOriginSide: index % 2 === 0 ? ZeroOriginSide.LEFT : ZeroOriginSide.RIGHT })) });
    await prisma.service.createMany({ data: Array.from({ length: 6 }, (_, index) => ({ organizationId: organization.id, operatorCompanyId: company.id, code: `PERF-S${index + 1}`, name: `Performance Service ${index + 1}`, color: ["#2563EB", "#16A34A", "#9333EA", "#EA580C", "#0891B2", "#BE123C"][index]! })) });
    await prisma.vessel.createMany({ data: Array.from({ length: Math.min(schedules, 200) + 1 }, (_, index) => ({ organizationId: organization.id, code: `PERF-V${String(index + 1).padStart(4, "0")}`, name: `Performance Vessel ${index + 1}`, imo: `9${String(index + 1).padStart(6, "0")}`, type: VesselType.CONTAINER_SHIP, lengthOverall: index === Math.min(schedules, 200) ? null : 140 + (index % 5) * 20, beam: 25 })) });
    const [berths, services, vessels] = await Promise.all([
      prisma.berth.findMany({ where: { organizationId: organization.id }, orderBy: { sortOrder: "asc" }, select: { id: true } }),
      prisma.service.findMany({ where: { organizationId: organization.id }, orderBy: { code: "asc" }, select: { id: true } }),
      prisma.vessel.findMany({ where: { organizationId: organization.id }, orderBy: { code: "asc" }, select: { id: true } }),
    ]);
    await prisma.vesselSchedule.createMany({ data: scheduleRows({ count: schedules, organizationId: organization.id, terminalId: terminal.id, berthIds: berths.map((row) => row.id), vesselIds: vessels.map((row) => row.id), serviceIds: services.map((row) => row.id) }) });
    console.log(`Seeded ${schedules} deterministic schedules in ${ORGANIZATION_NAME}.`);
    console.log(`Terminal ID: ${terminal.id}`);
    console.log(`Week: ${WEEK_START.toISOString()} through 2026-08-03T00:00:00.000Z`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: Error) => { console.error(error.message); process.exit(1); });
