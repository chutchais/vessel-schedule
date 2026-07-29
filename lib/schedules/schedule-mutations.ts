import type { Prisma, PrismaClient, ScheduleStatus } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { formatVesselScheduleAuditEntityName } from "@/lib/audit/entity-name";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import { prisma } from "@/lib/db/prisma";

type ScheduleDatabase = Pick<PrismaClient, "$transaction">;

export type ScheduleActor = { id: string; email: string; displayName: string };
export type ScheduleMutationData = {
  vesselId: string;
  terminalId: string;
  berthId: string | null;
  serviceId: string | null;
  voyageNumber: string | null;
  eta: Date;
  etb: Date | null;
  etd: Date;
  ata: Date | null;
  atb: Date | null;
  atd: Date | null;
  status: ScheduleStatus;
  remarks: string | null;
  berthPositionMeters: number | null;
  headingReverse: boolean;
};

export type ScheduleMutationResult =
  | { ok: true; schedule: ScheduleResult; undoToken?: string; undoExpiresAt?: string }
  | {
      ok: false;
      reason: "not_found" | "validation" | "conflict" | "stale" | "undo_unavailable" | "retry";
      message: string;
    };

type ScheduleResult = Awaited<ReturnType<typeof loadScheduleResult>>;
type MutationHooks = { beforeLocks?: () => Promise<void>; afterLocks?: () => Promise<void> };
const UNDO_LIFETIME_MS = 15_000;

const scheduleResultInclude = {
  vessel: { select: { id: true, imo: true, name: true, callSign: true } },
  terminal: {
    select: {
      id: true,
      code: true,
      name: true,
      port: { select: { id: true, code: true, name: true, timezone: true } },
    },
  },
  berth: { select: { id: true, code: true, name: true, color: true, zeroOriginSide: true } },
  service: {
    select: {
      id: true,
      code: true,
      name: true,
      color: true,
      isActive: true,
      operatorCompany: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.VesselScheduleInclude;

async function loadScheduleResult(tx: Prisma.TransactionClient, id: string) {
  return tx.vesselSchedule.findUniqueOrThrow({ where: { id }, include: scheduleResultInclude });
}

class ScheduleDomainError extends Error {
  constructor(
    readonly reason: Exclude<ScheduleMutationResult, { ok: true }>["reason"],
    message: string,
  ) {
    super(message);
  }
}

function entityName(schedule: {
  vessel: { name: string };
  service: { code: string } | null;
  voyageNumber: string | null;
}) {
  return formatVesselScheduleAuditEntityName({
    vesselName: schedule.vessel.name,
    serviceCode: schedule.service?.code ?? null,
    voyageNumber: schedule.voyageNumber,
  });
}

function isPhysicalOccupancy(data: ScheduleMutationData) {
  return data.status !== "CANCELLED" && data.berthId !== null && data.berthPositionMeters !== null;
}

function validateTime(data: ScheduleMutationData) {
  if (Number.isNaN(data.eta.getTime()) || Number.isNaN(data.etd.getTime())) {
    throw new ScheduleDomainError("validation", "ETA and ETD must be valid dates");
  }
  if (data.etb && Number.isNaN(data.etb.getTime())) {
    throw new ScheduleDomainError("validation", "ETB must be a valid date");
  }
  if (data.etd <= data.eta) {
    throw new ScheduleDomainError("validation", "ETD must be later than ETA");
  }
  if (data.etb && (data.etb < data.eta || data.etb >= data.etd)) {
    throw new ScheduleDomainError("validation", "ETB must be on or after ETA and before ETD");
  }
  if (data.etd <= (data.etb ?? data.eta)) {
    throw new ScheduleDomainError("validation", "ETD must be later than ETB/ETA");
  }
}

async function lockBerths(
  tx: Prisma.TransactionClient,
  organizationId: string,
  berthIds: Array<string | null>,
) {
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '3000ms'");
  const ordered = [...new Set(berthIds.filter((id): id is string => Boolean(id)))].sort();
  for (const berthId of ordered) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${organizationId}:${berthId}`}, 0))
    `;
  }
}

async function validateReferencesAndGeometry(
  tx: Prisma.TransactionClient,
  organizationId: string,
  data: ScheduleMutationData,
  current?: { vesselId: string; terminalId: string; berthId: string | null; serviceId: string | null },
) {
  validateTime(data);
  if (data.berthId === null && data.berthPositionMeters !== null) {
    throw new ScheduleDomainError(
      "validation",
      "Berth position requires a selected berth",
    );
  }

  const [vessel, terminal, berth, service] = await Promise.all([
    tx.vessel.findFirst({
      where: { id: data.vesselId, organizationId },
      select: { id: true, isActive: true, lengthOverall: true },
    }),
    tx.terminal.findFirst({
      where: { id: data.terminalId, organizationId },
      select: { id: true, isActive: true },
    }),
    data.berthId
      ? tx.berth.findFirst({
          where: { id: data.berthId, organizationId },
          select: { id: true, terminalId: true, isActive: true, berthLength: true },
        })
      : null,
    data.serviceId
      ? tx.service.findFirst({
          where: { id: data.serviceId, organizationId },
          select: { id: true, isActive: true },
        })
      : null,
  ]);

  if (!vessel) throw new ScheduleDomainError("not_found", "Vessel not found");
  if (!vessel.isActive && vessel.id !== current?.vesselId) {
    throw new ScheduleDomainError("validation", "Only active vessels can be selected");
  }
  if (!terminal) throw new ScheduleDomainError("not_found", "Terminal not found");
  if (!terminal.isActive && terminal.id !== current?.terminalId) {
    throw new ScheduleDomainError("validation", "Only active terminals can be selected");
  }
  if (data.serviceId && !service) throw new ScheduleDomainError("not_found", "Service not found");
  if (service && !service.isActive && service.id !== current?.serviceId) {
    throw new ScheduleDomainError("validation", "Only active services can be selected");
  }
  if (data.berthId && !berth) throw new ScheduleDomainError("not_found", "Berth not found");
  if (berth && berth.terminalId !== data.terminalId) {
    throw new ScheduleDomainError(
      "validation",
      "The selected berth does not belong to the selected terminal",
    );
  }
  if (berth && !berth.isActive && berth.id !== current?.berthId) {
    throw new ScheduleDomainError("validation", "Only active berths can be selected");
  }

  if (data.berthPositionMeters !== null) {
    if (!berth) {
      throw new ScheduleDomainError("validation", "Berth position requires a selected berth");
    }
    if (data.berthPositionMeters < 0) {
      throw new ScheduleDomainError(
        "validation",
        "Berth position meters must be a non-negative integer",
      );
    }
    const loa = vessel.lengthOverall === null ? null : Number(vessel.lengthOverall);
    if (loa === null || !Number.isFinite(loa) || loa <= 0) {
      throw new ScheduleDomainError(
        "validation",
        "A positive vessel LOA is required for physical berth placement",
      );
    }
    const berthLength = Number(berth.berthLength);
    if (!Number.isFinite(berthLength) || berthLength <= 0) {
      throw new ScheduleDomainError(
        "validation",
        "A positive berth length is required for physical berth placement",
      );
    }
    if (data.berthPositionMeters + loa > berthLength) {
      throw new ScheduleDomainError(
        "validation",
        "Vessel placement extends beyond the selected berth",
      );
    }
  }

  return { vesselLoa: vessel.lengthOverall === null ? null : Number(vessel.lengthOverall) };
}

async function assertNoConflict(
  tx: Prisma.TransactionClient,
  organizationId: string,
  data: ScheduleMutationData,
  vesselLoa: number | null,
  excludeScheduleId?: string,
) {
  if (!isPhysicalOccupancy(data) || vesselLoa === null || vesselLoa <= 0) return;
  const start = data.etb ?? data.eta;
  const end = data.etd;
  const positionStart = data.berthPositionMeters!;
  const positionEnd = positionStart + vesselLoa;
  const candidates = await tx.vesselSchedule.findMany({
    where: {
      organizationId,
      berthId: data.berthId!,
      status: { not: "CANCELLED" },
      berthPositionMeters: { not: null },
      eta: { lt: end },
      etd: { gt: start },
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
    },
    select: {
      eta: true,
      etb: true,
      etd: true,
      berthPositionMeters: true,
      vessel: { select: { lengthOverall: true } },
    },
  });
  const conflict = candidates.some((candidate) => {
    const candidateStart = candidate.etb ?? candidate.eta;
    const candidatePosition = candidate.berthPositionMeters;
    const candidateLoa =
      candidate.vessel.lengthOverall === null ? null : Number(candidate.vessel.lengthOverall);
    if (candidatePosition === null || candidateLoa === null || candidateLoa <= 0) return false;
    return (
      start < candidate.etd &&
      candidateStart < end &&
      positionStart < candidatePosition + candidateLoa &&
      candidatePosition < positionEnd
    );
  });
  if (conflict) {
    throw new ScheduleDomainError(
      "conflict",
      "The selected berth already has conflicting physical occupancy",
    );
  }
}

function snapshot(schedule: Record<string, unknown>) {
  const date = (value: unknown) => (value instanceof Date ? value.toISOString() : null);
  return {
    vesselId: String(schedule.vesselId),
    terminalId: String(schedule.terminalId),
    berthId: typeof schedule.berthId === "string" ? schedule.berthId : null,
    serviceId: typeof schedule.serviceId === "string" ? schedule.serviceId : null,
    voyageNumber: typeof schedule.voyageNumber === "string" ? schedule.voyageNumber : null,
    eta: date(schedule.eta)!,
    etb: date(schedule.etb),
    etd: date(schedule.etd)!,
    ata: date(schedule.ata),
    atb: date(schedule.atb),
    atd: date(schedule.atd),
    status: schedule.status as ScheduleStatus,
    remarks: typeof schedule.remarks === "string" ? schedule.remarks : null,
    berthPositionMeters:
      typeof schedule.berthPositionMeters === "number" ? schedule.berthPositionMeters : null,
    headingReverse: schedule.headingReverse === true,
  };
}

function mapDatabaseError(error: unknown): ScheduleMutationResult {
  if (error instanceof ScheduleDomainError) {
    return { ok: false, reason: error.reason, message: error.message };
  }
  const text = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : "";
  if (/55P03|40P01|lock timeout|deadlock/i.test(text)) {
    return {
      ok: false,
      reason: "retry",
      message: "Schedule resources are busy. Refresh and try again.",
    };
  }
  throw error;
}

export async function createSchedule(
  input: {
    organizationId: string;
    actor: ScheduleActor;
    data: ScheduleMutationData;
    hooks?: MutationHooks;
  },
  db: ScheduleDatabase = prisma,
): Promise<ScheduleMutationResult> {
  try {
    return await db.$transaction(
      async (tx) => {
        await input.hooks?.beforeLocks?.();
        await lockBerths(tx, input.organizationId, [input.data.berthId]);
        await input.hooks?.afterLocks?.();
        const { vesselLoa } = await validateReferencesAndGeometry(
          tx,
          input.organizationId,
          input.data,
        );
        await assertNoConflict(tx, input.organizationId, input.data, vesselLoa);
        const created = await tx.vesselSchedule.create({
          data: { organizationId: input.organizationId, ...input.data },
          include: scheduleResultInclude,
        });
        await createAuditLog(tx, {
          scope: "ORGANIZATION",
          organizationId: input.organizationId,
          actor: input.actor,
          action: "CREATE",
          entityType: AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE,
          entityId: created.id,
          entityName: entityName(created),
          beforeData: null,
          afterData: created,
        });
        return { ok: true, schedule: created } as const;
      },
      { maxWait: 5_000, timeout: 10_000 },
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function updateSchedule(
  input: {
    scheduleId: string;
    organizationId: string;
    actor: ScheduleActor;
    expectedUpdatedAt: Date;
    data: ScheduleMutationData;
    plannerAction?: "move" | "resize";
    resizeEdge?: "start" | "end";
    hooks?: MutationHooks;
  },
  db: ScheduleDatabase = prisma,
): Promise<ScheduleMutationResult> {
  try {
    const lockSource = await db.$transaction((tx) =>
      tx.vesselSchedule.findFirst({
        where: { id: input.scheduleId, organizationId: input.organizationId },
        select: { berthId: true },
      }),
    );
    if (!lockSource) return { ok: false, reason: "not_found", message: "Schedule not found" };

    return await db.$transaction(
      async (tx) => {
        await input.hooks?.beforeLocks?.();
        await lockBerths(tx, input.organizationId, [lockSource.berthId, input.data.berthId]);
        await input.hooks?.afterLocks?.();
        const current = await tx.vesselSchedule.findFirst({
          where: { id: input.scheduleId, organizationId: input.organizationId },
        });
        if (!current) throw new ScheduleDomainError("not_found", "Schedule not found");
        if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
          throw new ScheduleDomainError(
            "stale",
            "This schedule changed before it could be saved. Refresh and try again.",
          );
        }
        const { vesselLoa } = await validateReferencesAndGeometry(
          tx,
          input.organizationId,
          input.data,
          current,
        );
        await assertNoConflict(
          tx,
          input.organizationId,
          input.data,
          vesselLoa,
          input.scheduleId,
        );
        const claimed = await tx.vesselSchedule.updateMany({
          where: {
            id: input.scheduleId,
            organizationId: input.organizationId,
            updatedAt: input.expectedUpdatedAt,
          },
          data: input.data,
        });
        if (claimed.count !== 1) {
          throw new ScheduleDomainError(
            "stale",
            "This schedule changed before it could be saved. Refresh and try again.",
          );
        }
        const updated = await loadScheduleResult(tx, input.scheduleId);
        const audit = await createAuditLog(tx, {
          scope: "ORGANIZATION",
          organizationId: input.organizationId,
          actor: input.actor,
          action: "UPDATE",
          entityType: AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE,
          entityId: updated.id,
          entityName: entityName(updated),
          beforeData: current,
          afterData: updated,
          metadata: input.plannerAction
            ? {
                context:
                  input.plannerAction === "resize"
                    ? "Berth Planner resize"
                    : "Berth Planner move",
                ...(input.resizeEdge ? { resizeEdge: input.resizeEdge } : {}),
              }
            : undefined,
        });
        const undo = input.plannerAction
          ? await tx.plannerUndo.create({
              data: {
                organizationId: input.organizationId,
                scheduleId: updated.id,
                originalAuditLogId: audit.id,
                beforeData: snapshot(current),
                expectedUpdatedAt: updated.updatedAt,
                expiresAt: new Date(Date.now() + UNDO_LIFETIME_MS),
              },
            })
          : null;
        return {
          ok: true,
          schedule: updated,
          undoToken: undo?.id,
          undoExpiresAt: undo?.expiresAt.toISOString(),
        } as const;
      },
      { maxWait: 5_000, timeout: 10_000 },
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
}

export async function undoSchedule(
  input: {
    scheduleId: string;
    organizationId: string;
    actor: ScheduleActor;
    undoToken: string;
    expectedUpdatedAt: Date;
    hooks?: MutationHooks;
  },
  db: ScheduleDatabase = prisma,
): Promise<ScheduleMutationResult> {
  try {
    const source = await db.$transaction(async (tx) => {
      const [schedule, undo] = await Promise.all([
        tx.vesselSchedule.findFirst({
          where: { id: input.scheduleId, organizationId: input.organizationId },
          select: { berthId: true },
        }),
        tx.plannerUndo.findFirst({
          where: {
            id: input.undoToken,
            scheduleId: input.scheduleId,
            organizationId: input.organizationId,
          },
        }),
      ]);
      return { schedule, undo };
    });
    if (!source.schedule) return { ok: false, reason: "not_found", message: "Schedule not found" };
    if (!source.undo) {
      return {
        ok: false,
        reason: "undo_unavailable",
        message: "This undo action has expired or was already used.",
      };
    }
    const restore = source.undo.beforeData as unknown as Record<string, unknown>;
    const restoreData: ScheduleMutationData = {
      vesselId: String(restore.vesselId),
      terminalId: String(restore.terminalId),
      berthId: typeof restore.berthId === "string" ? restore.berthId : null,
      serviceId: typeof restore.serviceId === "string" ? restore.serviceId : null,
      voyageNumber: typeof restore.voyageNumber === "string" ? restore.voyageNumber : null,
      eta: new Date(String(restore.eta)),
      etb: restore.etb ? new Date(String(restore.etb)) : null,
      etd: new Date(String(restore.etd)),
      ata: restore.ata ? new Date(String(restore.ata)) : null,
      atb: restore.atb ? new Date(String(restore.atb)) : null,
      atd: restore.atd ? new Date(String(restore.atd)) : null,
      status: restore.status as ScheduleStatus,
      remarks: typeof restore.remarks === "string" ? restore.remarks : null,
      berthPositionMeters:
        typeof restore.berthPositionMeters === "number" ? restore.berthPositionMeters : null,
      headingReverse: restore.headingReverse === true,
    };

    return await db.$transaction(
      async (tx) => {
        await input.hooks?.beforeLocks?.();
        await lockBerths(tx, input.organizationId, [
          source.schedule!.berthId,
          restoreData.berthId,
        ]);
        await input.hooks?.afterLocks?.();
        const now = new Date();
        const current = await tx.vesselSchedule.findFirst({
          where: { id: input.scheduleId, organizationId: input.organizationId },
        });
        if (!current) throw new ScheduleDomainError("not_found", "Schedule not found");
        if (
          current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime() ||
          source.undo!.expectedUpdatedAt.getTime() !== input.expectedUpdatedAt.getTime()
        ) {
          throw new ScheduleDomainError(
            "stale",
            "This schedule changed after the planner operation. Undo cannot overwrite it.",
          );
        }
        const { vesselLoa } = await validateReferencesAndGeometry(
          tx,
          input.organizationId,
          restoreData,
          current,
        );
        await assertNoConflict(
          tx,
          input.organizationId,
          restoreData,
          vesselLoa,
          input.scheduleId,
        );
        const claimedUndo = await tx.plannerUndo.updateMany({
          where: {
            id: input.undoToken,
            organizationId: input.organizationId,
            scheduleId: input.scheduleId,
            usedAt: null,
            expiresAt: { gt: now },
            expectedUpdatedAt: input.expectedUpdatedAt,
          },
          data: { usedAt: now },
        });
        if (claimedUndo.count !== 1) {
          throw new ScheduleDomainError(
            "undo_unavailable",
            "This undo action has expired or was already used.",
          );
        }
        const claimedSchedule = await tx.vesselSchedule.updateMany({
          where: {
            id: input.scheduleId,
            organizationId: input.organizationId,
            updatedAt: input.expectedUpdatedAt,
          },
          data: restoreData,
        });
        if (claimedSchedule.count !== 1) {
          throw new ScheduleDomainError(
            "stale",
            "This schedule changed after the planner operation. Undo cannot overwrite it.",
          );
        }
        const updated = await loadScheduleResult(tx, input.scheduleId);
        await createAuditLog(tx, {
          scope: "ORGANIZATION",
          organizationId: input.organizationId,
          actor: input.actor,
          action: "UPDATE",
          entityType: AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE,
          entityId: updated.id,
          entityName: entityName(updated),
          beforeData: current,
          afterData: updated,
          metadata: {
            context: "Berth Planner undo",
            originalOperationAuditLogId: source.undo!.originalAuditLogId,
          },
        });
        return { ok: true, schedule: updated } as const;
      },
      { maxWait: 5_000, timeout: 10_000 },
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
}
