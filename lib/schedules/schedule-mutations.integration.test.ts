import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { assertDatabaseTarget } from "@/lib/db/target-guard";
import {
  createSchedule,
  undoSchedule,
  updateSchedule,
  type ScheduleActor,
  type ScheduleMutationData,
} from "./schedule-mutations";

const testDatabaseUrl = process.env.RB2_TEST_DATABASE_URL;
if (testDatabaseUrl) assertDatabaseTarget({ purpose: "integration-test", connectionUrl: testDatabaseUrl });
const integrationTest = testDatabaseUrl ? test : test.skip;
const prisma = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) })
  : null;
const concurrentPrismaA = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) })
  : null;
const concurrentPrismaB = testDatabaseUrl
  ? new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) })
  : null;
const prefix = `rb2-${process.pid}-`;
let sequence = 0;

function next(label: string) {
  sequence += 1;
  return `${prefix}${label}-${sequence}`;
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture() {
  if (!prisma) throw new Error("RB2_TEST_DATABASE_URL is required");
  const actor: ScheduleActor = {
    id: randomUUID(),
    email: `${next("planner")}@example.test`,
    displayName: "RB2 Planner",
  };
  const organization = await prisma.organization.create({
    data: { name: next("organization"), slug: next("org") },
  });
  await prisma.user.create({
    data: { id: actor.id, email: actor.email, displayName: actor.displayName },
  });
  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: actor.id, role: "PLANNER" },
  });
  const port = await prisma.port.create({
    data: {
      organizationId: organization.id,
      code: next("port").slice(-10),
      name: next("port-name"),
      country: "TH",
      timezone: "Asia/Bangkok",
    },
  });
  const terminal = await prisma.terminal.create({
    data: {
      organizationId: organization.id,
      portId: port.id,
      code: next("terminal").slice(-20),
      name: next("terminal-name"),
    },
  });
  const [leftBerth, rightBerth] = await Promise.all([
    prisma.berth.create({
      data: {
        organizationId: organization.id,
        terminalId: terminal.id,
        code: next("left").slice(-20),
        name: "Left berth",
        berthLength: 200,
        zeroOriginSide: "LEFT",
      },
    }),
    prisma.berth.create({
      data: {
        organizationId: organization.id,
        terminalId: terminal.id,
        code: next("right").slice(-20),
        name: "Right berth",
        berthLength: 200,
        zeroOriginSide: "RIGHT",
      },
    }),
  ]);
  const [vessel, noLoaVessel] = await Promise.all([
    prisma.vessel.create({
      data: {
        organizationId: organization.id,
        code: next("vessel").slice(-20),
        name: "RB2 Vessel",
        type: "CONTAINER_SHIP",
        lengthOverall: 100,
      },
    }),
    prisma.vessel.create({
      data: {
        organizationId: organization.id,
        code: next("no-loa").slice(-20),
        name: "RB2 Vessel Without LOA",
        type: "CONTAINER_SHIP",
      },
    }),
  ]);
  return { actor, organization, terminal, leftBerth, rightBerth, vessel, noLoaVessel };
}

function data(
  fixture: Fixture,
  overrides: Partial<ScheduleMutationData> = {},
): ScheduleMutationData {
  return {
    vesselId: fixture.vessel.id,
    terminalId: fixture.terminal.id,
    berthId: fixture.leftBerth.id,
    serviceId: null,
    voyageNumber: next("voyage"),
    eta: new Date("2026-08-01T00:00:00.000Z"),
    etb: new Date("2026-08-01T01:00:00.000Z"),
    etd: new Date("2026-08-01T03:00:00.000Z"),
    ata: null,
    atb: null,
    atd: null,
    status: "PLANNED",
    remarks: null,
    berthPositionMeters: 0,
    headingReverse: false,
    ...overrides,
  };
}

async function createDirect(fixture: Fixture, overrides: Partial<ScheduleMutationData> = {}) {
  if (!prisma) throw new Error("RB2_TEST_DATABASE_URL is required");
  return prisma.vesselSchedule.create({
    data: { organizationId: fixture.organization.id, ...data(fixture, overrides) },
  });
}

function overlapBarrier() {
  let release!: () => void;
  let firstLocked!: () => void;
  let secondStarted!: () => void;
  const releasePromise = new Promise<void>((resolve) => { release = resolve; });
  const firstLockedPromise = new Promise<void>((resolve) => { firstLocked = resolve; });
  const secondStartedPromise = new Promise<void>((resolve) => { secondStarted = resolve; });
  return {
    first: {
      afterLocks: async () => {
        firstLocked();
        await releasePromise;
      },
    },
    second: { beforeLocks: async () => { secondStarted(); } },
    firstLocked: firstLockedPromise,
    secondStarted: secondStartedPromise,
    release,
  };
}

async function scheduleAuditCount(scheduleId: string) {
  if (!prisma) throw new Error("RB2_TEST_DATABASE_URL is required");
  return prisma.auditLog.count({
    where: { entityType: "VesselSchedule", entityId: scheduleId },
  });
}

before(async () => {
  if (!prisma) return;
});

after(async () => {
  if (!prisma) return;
  await Promise.all([
    prisma.$disconnect(),
    concurrentPrismaA?.$disconnect(),
    concurrentPrismaB?.$disconnect(),
  ]);
});

integrationTest("server geometry accepts exact boundaries and rejects invalid placement", async () => {
  const fixture = await createFixture();
  const negative = await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture, { berthPositionMeters: -1 }),
  }, prisma!);
  assert.equal(negative.ok, false);
  if (!negative.ok) assert.equal(negative.reason, "validation");

  for (const [position, berthId] of [[0, fixture.leftBerth.id], [100, fixture.rightBerth.id]] as const) {
    const accepted = await createSchedule({
      organizationId: fixture.organization.id,
      actor: fixture.actor,
      data: data(fixture, {
        berthId,
        berthPositionMeters: position,
        eta: new Date(`2026-08-0${position === 0 ? 2 : 3}T00:00:00Z`),
        etb: null,
        etd: new Date(`2026-08-0${position === 0 ? 2 : 3}T02:00:00Z`),
        headingReverse: position === 100,
      }),
    }, prisma!);
    assert.equal(accepted.ok, true);
  }

  const tooLong = await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture, { berthPositionMeters: 101 }),
  }, prisma!);
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.reason, "validation");
});

integrationTest("incomplete placement is explicit and missing LOA cannot be positioned", async () => {
  const fixture = await createFixture();
  const incomplete = await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture, { berthPositionMeters: null }),
  }, prisma!);
  assert.equal(incomplete.ok, true);
  assert.equal((await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture, {
      berthId: null,
      berthPositionMeters: null,
      eta: new Date("2026-08-03T00:00:00Z"),
      etb: null,
      etd: new Date("2026-08-03T02:00:00Z"),
    }),
  }, prisma!)).ok, true);
  const missingLoa = await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture, {
      vesselId: fixture.noLoaVessel.id,
      berthPositionMeters: 0,
      eta: new Date("2026-08-02T00:00:00Z"),
      etb: null,
      etd: new Date("2026-08-02T02:00:00Z"),
    }),
  }, prisma!);
  assert.equal(missingLoa.ok, false);
  if (!missingLoa.ok) assert.match(missingLoa.message, /positive vessel LOA/);
  const positionWithoutBerth = await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture, { berthId: null, berthPositionMeters: 0 }),
  }, prisma!);
  assert.equal(positionWithoutBerth.ok, false);

  await prisma!.berth.update({ where: { id: fixture.rightBerth.id }, data: { berthLength: 0 } });
  const invalidBerthLength = await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture, {
      berthId: fixture.rightBerth.id,
      berthPositionMeters: 0,
      eta: new Date("2026-08-04T00:00:00Z"),
      etb: null,
      etd: new Date("2026-08-04T02:00:00Z"),
    }),
  }, prisma!);
  assert.equal(invalidBerthLength.ok, false);
  if (!invalidBerthLength.ok) assert.match(invalidBerthLength.message, /positive berth length/);
});

integrationTest("invalid planned time interval is rejected without schedule or audit", async () => {
  const fixture = await createFixture();
  const before = await prisma!.vesselSchedule.count({ where: { organizationId: fixture.organization.id } });
  const result = await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture, { etb: new Date("2026-08-01T04:00:00Z") }),
  }, prisma!);
  assert.equal(result.ok, false);
  assert.equal(await prisma!.vesselSchedule.count({ where: { organizationId: fixture.organization.id } }), before);
});

integrationTest("foreign-organization berth and vessel are rejected", async () => {
  const fixture = await createFixture();
  const foreign = await createFixture();
  for (const mutation of [
    data(fixture, { berthId: foreign.leftBerth.id }),
    data(fixture, { vesselId: foreign.vessel.id }),
  ]) {
    const result = await createSchedule({
      organizationId: fixture.organization.id,
      actor: fixture.actor,
      data: mutation,
    }, prisma!);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "not_found");
  }
});

integrationTest("two overlapping creates genuinely overlap and exactly one commits", async () => {
  const fixture = await createFixture();
  const barrier = overlapBarrier();
  const first = createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture),
    hooks: barrier.first,
  }, concurrentPrismaA!);
  await barrier.firstLocked;
  const second = createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture),
    hooks: barrier.second,
  }, concurrentPrismaB!);
  await barrier.secondStarted;
  barrier.release();
  const results = await Promise.all([first, second]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.reason === "conflict").length, 1);
  assert.equal(await prisma!.vesselSchedule.count({ where: { organizationId: fixture.organization.id } }), 1);
  assert.equal(await prisma!.auditLog.count({
    where: { organizationId: fixture.organization.id, entityType: "VesselSchedule", action: "CREATE" },
  }), 1);
});

integrationTest("two updates moving into the same occupancy have one winner", async () => {
  const fixture = await createFixture();
  const firstSchedule = await createDirect(fixture, {
    berthId: fixture.leftBerth.id,
    berthPositionMeters: 0,
    eta: new Date("2026-08-04T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-04T02:00:00Z"),
  });
  const secondSchedule = await createDirect(fixture, {
    berthId: fixture.rightBerth.id,
    berthPositionMeters: 100,
    eta: new Date("2026-08-05T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-05T02:00:00Z"),
  });
  const target = data(fixture, {
    berthId: fixture.leftBerth.id,
    berthPositionMeters: 50,
    eta: new Date("2026-08-06T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-06T02:00:00Z"),
  });
  const barrier = overlapBarrier();
  const first = updateSchedule({
    scheduleId: firstSchedule.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: firstSchedule.updatedAt,
    data: target,
    plannerAction: "move",
    hooks: barrier.first,
  }, concurrentPrismaA!);
  await barrier.firstLocked;
  const second = updateSchedule({
    scheduleId: secondSchedule.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: secondSchedule.updatedAt,
    data: target,
    plannerAction: "move",
    hooks: barrier.second,
  }, concurrentPrismaB!);
  await barrier.secondStarted;
  barrier.release();
  const results = await Promise.all([first, second]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.reason === "conflict").length, 1);
});

integrationTest("create versus update serializes the same target occupancy", async () => {
  const fixture = await createFixture();
  const existing = await createDirect(fixture, {
    berthId: fixture.rightBerth.id,
    eta: new Date("2026-08-07T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-07T02:00:00Z"),
  });
  const target = data(fixture, {
    berthId: fixture.leftBerth.id,
    berthPositionMeters: 0,
    eta: new Date("2026-08-08T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-08T02:00:00Z"),
  });
  const barrier = overlapBarrier();
  const created = createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: target,
    hooks: barrier.first,
  }, concurrentPrismaA!);
  await barrier.firstLocked;
  const updated = updateSchedule({
    scheduleId: existing.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: existing.updatedAt,
    data: target,
    hooks: barrier.second,
  }, concurrentPrismaB!);
  await barrier.secondStarted;
  barrier.release();
  const results = await Promise.all([created, updated]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.reason === "conflict").length, 1);
});

integrationTest("opposite berth moves use deterministic locking without deadlock", async () => {
  const fixture = await createFixture();
  const first = await createDirect(fixture, {
    berthId: fixture.leftBerth.id,
    berthPositionMeters: 0,
    eta: new Date("2026-08-09T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-09T02:00:00Z"),
  });
  const second = await createDirect(fixture, {
    berthId: fixture.rightBerth.id,
    berthPositionMeters: 100,
    eta: new Date("2026-08-09T03:00:00Z"),
    etb: null,
    etd: new Date("2026-08-09T05:00:00Z"),
  });
  const barrier = overlapBarrier();
  const firstMove = updateSchedule({
    scheduleId: first.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: first.updatedAt,
    data: data(fixture, {
      berthId: fixture.rightBerth.id,
      berthPositionMeters: 0,
      eta: first.eta,
      etb: first.etb,
      etd: first.etd,
    }),
    hooks: barrier.first,
  }, concurrentPrismaA!);
  await barrier.firstLocked;
  const secondMove = updateSchedule({
    scheduleId: second.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: second.updatedAt,
    data: data(fixture, {
      berthId: fixture.leftBerth.id,
      berthPositionMeters: 100,
      eta: second.eta,
      etb: second.etb,
      etd: second.etd,
    }),
    hooks: barrier.second,
  }, concurrentPrismaB!);
  await barrier.secondStarted;
  barrier.release();
  assert.ok((await Promise.all([firstMove, secondMove])).every((result) => result.ok));
});

integrationTest("strict endpoint and separate-axis occupancy semantics are preserved", async () => {
  const fixture = await createFixture();
  await createDirect(fixture, {
    berthPositionMeters: 0,
    eta: new Date("2026-08-10T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-10T02:00:00Z"),
  });
  for (const mutation of [
    data(fixture, {
      berthPositionMeters: 0,
      eta: new Date("2026-08-10T02:00:00Z"),
      etb: null,
      etd: new Date("2026-08-10T04:00:00Z"),
    }),
    data(fixture, {
      berthPositionMeters: 100,
      eta: new Date("2026-08-10T01:00:00Z"),
      etb: null,
      etd: new Date("2026-08-10T03:00:00Z"),
    }),
    data(fixture, {
      berthPositionMeters: 0,
      eta: new Date("2026-08-10T05:00:00Z"),
      etb: null,
      etd: new Date("2026-08-10T07:00:00Z"),
    }),
  ]) {
    assert.equal((await createSchedule({
      organizationId: fixture.organization.id,
      actor: fixture.actor,
      data: mutation,
    }, prisma!)).ok, true);
  }
});

integrationTest("cancelled and incomplete schedules do not claim physical occupancy", async () => {
  const fixture = await createFixture();
  await createDirect(fixture, { status: "CANCELLED" });
  await createDirect(fixture, {
    berthPositionMeters: null,
    eta: new Date("2026-08-01T00:00:00Z"),
    etb: new Date("2026-08-01T01:00:00Z"),
    etd: new Date("2026-08-01T03:00:00Z"),
  });
  assert.equal((await createSchedule({
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    data: data(fixture),
  }, prisma!)).ok, true);
});

integrationTest("two ordinary edits from one version produce one audit winner", async () => {
  const fixture = await createFixture();
  const schedule = await createDirect(fixture);
  const barrier = overlapBarrier();
  const first = updateSchedule({
    scheduleId: schedule.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: schedule.updatedAt,
    data: data(fixture, { remarks: "first" }),
    hooks: barrier.first,
  }, concurrentPrismaA!);
  await barrier.firstLocked;
  const second = updateSchedule({
    scheduleId: schedule.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: schedule.updatedAt,
    data: data(fixture, { remarks: "second" }),
    hooks: barrier.second,
  }, concurrentPrismaB!);
  await barrier.secondStarted;
  barrier.release();
  const results = await Promise.all([first, second]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.reason === "stale").length, 1);
  assert.equal(await scheduleAuditCount(schedule.id), 1);
});

integrationTest("stale status, planner move and resize writes are rejected", async () => {
  const fixture = await createFixture();
  for (const plannerAction of [undefined, "move", "resize"] as const) {
    const schedule = await createDirect(fixture, {
      eta: new Date(`2026-08-${plannerAction === undefined ? "11" : plannerAction === "move" ? "12" : "13"}T00:00:00Z`),
      etb: null,
      etd: new Date(`2026-08-${plannerAction === undefined ? "11" : plannerAction === "move" ? "12" : "13"}T02:00:00Z`),
    });
    await prisma!.vesselSchedule.update({ where: { id: schedule.id }, data: { remarks: "newer" } });
    const result = await updateSchedule({
      scheduleId: schedule.id,
      organizationId: fixture.organization.id,
      actor: fixture.actor,
      expectedUpdatedAt: schedule.updatedAt,
      data: data(fixture, {
        eta: schedule.eta,
        etb: schedule.etb,
        etd: schedule.etd,
        status: plannerAction === undefined ? "CONFIRMED" : schedule.status,
      }),
      plannerAction,
    }, prisma!);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "stale");
    assert.equal(await scheduleAuditCount(schedule.id), 0);
  }
});

integrationTest("stale undo neither changes schedule nor consumes the token", async () => {
  const fixture = await createFixture();
  const schedule = await createDirect(fixture, {
    eta: new Date("2026-08-14T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-14T02:00:00Z"),
  });
  const moved = await updateSchedule({
    scheduleId: schedule.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: schedule.updatedAt,
    data: data(fixture, {
      berthId: fixture.rightBerth.id,
      eta: schedule.eta,
      etb: schedule.etb,
      etd: schedule.etd,
    }),
    plannerAction: "move",
  }, prisma!);
  assert.equal(moved.ok, true);
  if (!moved.ok || !moved.undoToken) throw new Error("Expected undo token");
  const staleVersion = moved.schedule.updatedAt;
  await prisma!.vesselSchedule.update({ where: { id: schedule.id }, data: { remarks: "newer" } });
  const undone = await undoSchedule({
    scheduleId: schedule.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    undoToken: moved.undoToken,
    expectedUpdatedAt: staleVersion,
  }, prisma!);
  assert.equal(undone.ok, false);
  if (!undone.ok) assert.equal(undone.reason, "stale");
  assert.equal((await prisma!.plannerUndo.findUniqueOrThrow({ where: { id: moved.undoToken } })).usedAt, null);
});

integrationTest("undo that would create a new conflict rolls back without consuming its token", async () => {
  const fixture = await createFixture();
  const original = await createDirect(fixture, {
    berthId: fixture.leftBerth.id,
    berthPositionMeters: 0,
    eta: new Date("2026-08-15T00:00:00Z"),
    etb: null,
    etd: new Date("2026-08-15T02:00:00Z"),
  });
  const moved = await updateSchedule({
    scheduleId: original.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    expectedUpdatedAt: original.updatedAt,
    data: data(fixture, {
      berthId: fixture.rightBerth.id,
      berthPositionMeters: 0,
      eta: original.eta,
      etb: original.etb,
      etd: original.etd,
    }),
    plannerAction: "move",
  }, prisma!);
  assert.equal(moved.ok, true);
  if (!moved.ok || !moved.undoToken) throw new Error("Expected undo token");
  await createDirect(fixture, {
    berthId: fixture.leftBerth.id,
    berthPositionMeters: 0,
    eta: original.eta,
    etb: original.etb,
    etd: original.etd,
  });
  const result = await undoSchedule({
    scheduleId: original.id,
    organizationId: fixture.organization.id,
    actor: fixture.actor,
    undoToken: moved.undoToken,
    expectedUpdatedAt: moved.schedule.updatedAt,
  }, prisma!);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "conflict");
  assert.equal((await prisma!.plannerUndo.findUniqueOrThrow({ where: { id: moved.undoToken } })).usedAt, null);
  assert.equal((await prisma!.vesselSchedule.findUniqueOrThrow({ where: { id: original.id } })).berthId, fixture.rightBerth.id);
});
