import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageSchedules } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import { formatVesselScheduleAuditEntityName } from "@/lib/audit/entity-name";
import { prisma } from "@/lib/db/prisma";

const SCHEDULE_STATUSES = [
  "PLANNED",
  "CONFIRMED",
  "ARRIVED",
  "BERTHED",
  "DEPARTED",
  "CANCELLED",
] as const;

type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

function parseOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function trimOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function trimOptionalId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function mapSchedule<T extends {
  vessel: { id: string; imo: string | null; name: string; callSign: string | null };
}>(schedule: T) {
  return {
    ...schedule,
    vessel: {
      id: schedule.vessel.id,
      imoNumber: schedule.vessel.imo,
      name: schedule.vessel.name,
      callSign: schedule.vessel.callSign,
    },
  };
}

function serializeSchedule<T extends {
  vessel: { id: string; imo: string | null; name: string; callSign: string | null };
} & Record<string, unknown>>(schedule: T) {
  const normalized = mapSchedule(schedule);
  return {
    ...normalized,
    berthPositionMeters:
      typeof normalized.berthPositionMeters === "number" || normalized.berthPositionMeters === null
        ? normalized.berthPositionMeters
        : normalized.berthPositionMeters,
  };
}

function getScheduleEntityName(input: {
  vesselName: string;
  serviceCode: string | null;
  voyageNumber: string | null;
}) {
  return formatVesselScheduleAuditEntityName({
    vesselName: input.vesselName,
    serviceCode: input.serviceCode,
    voyageNumber: input.voyageNumber,
  });
}

async function hasBerthOverlap(input: {
  organizationId: string;
  berthId: string;
  eta: Date;
  etb: Date | null;
  etd: Date;
  berthPositionMeters: number | null;
  vesselLoa: number | null;
  excludeScheduleId?: string;
}) {
  const existingSchedules = await prisma.vesselSchedule.findMany({
    where: {
      organizationId: input.organizationId,
      berthId: input.berthId,
      status: { not: "CANCELLED" },
      ...(input.excludeScheduleId ? { id: { not: input.excludeScheduleId } } : {}),
    },
    select: {
      eta: true,
      etb: true,
      etd: true,
      berthPositionMeters: true,
      vessel: {
        select: { lengthOverall: true },
      },
    },
  });

  const newStart = input.etb ?? input.eta;
  const newEnd = input.etd;
  const newPos = input.berthPositionMeters;
  const newLoa = input.vesselLoa;
  const newPosEnd = newPos !== null && newLoa !== null && newLoa > 0 ? newPos + newLoa : null;

  return existingSchedules.some((schedule) => {
    const existingStart = schedule.etb ?? schedule.eta;
    const existingEnd = schedule.etd;
    const timeOverlap = newStart < existingEnd && newEnd > existingStart;
    if (!timeOverlap) return false;

    // If both sides have full position data, require position overlap too
    const existingPos =
      schedule.berthPositionMeters !== null ? Number(schedule.berthPositionMeters) : null;
    const existingLoa =
      schedule.vessel.lengthOverall !== null ? Number(schedule.vessel.lengthOverall) : null;
    if (
      newPos !== null &&
      newPosEnd !== null &&
      existingPos !== null &&
      existingLoa !== null &&
      existingLoa > 0
    ) {
      const existingPosEnd = existingPos + existingLoa;
      return newPos < existingPosEnd && newPosEnd > existingPos;
    }

    // Position data missing on either side — fall back to time-only (conservative)
    return true;
  });
}

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    const schedules = await prisma.vesselSchedule.findMany({
      where: { organizationId },
      include: {
        vessel: {
          select: {
            id: true,
            imo: true,
            name: true,
            callSign: true,
          },
        },
        terminal: {
          select: {
            id: true,
            code: true,
            name: true,
            port: {
              select: {
                id: true,
                code: true,
                name: true,
                timezone: true,
              },
            },
          },
        },
        berth: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
            zeroOriginSide: true,
          },
        },
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
            isActive: true,
            operatorCompany: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        eta: "asc",
      },
    });

    return NextResponse.json({ data: schedules.map(serializeSchedule) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to load schedules:", error);
    return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (!canManageSchedules(currentUser.membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.vesselId || typeof body.vesselId !== "string") {
      return NextResponse.json({ error: "Vessel is required" }, { status: 400 });
    }

    if (!body.terminalId || typeof body.terminalId !== "string") {
      return NextResponse.json({ error: "Terminal is required" }, { status: 400 });
    }

    if (!body.eta || typeof body.eta !== "string") {
      return NextResponse.json({ error: "ETA is required" }, { status: 400 });
    }

    if (!body.etd || typeof body.etd !== "string") {
      return NextResponse.json({ error: "ETD is required" }, { status: 400 });
    }

    const vesselId = body.vesselId.trim();
    const terminalId = body.terminalId.trim();
    const berthId = trimOptionalId(body.berthId);
    const serviceId = trimOptionalId(body.serviceId);
    const eta = parseOptionalDate(body.eta);
    const etb = parseOptionalDate(body.etb);
    const etd = parseOptionalDate(body.etd);
    const ata = parseOptionalDate(body.ata);
    const atb = parseOptionalDate(body.atb);
    const atd = parseOptionalDate(body.atd);
    const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "PLANNED";
    const berthPositionMeters = parseOptionalInteger(body.berthPositionMeters);
    const headingReverse = typeof body.headingReverse === "boolean" ? body.headingReverse : false;

    if (!vesselId) {
      return NextResponse.json({ error: "Vessel is required" }, { status: 400 });
    }

    if (!terminalId) {
      return NextResponse.json({ error: "Terminal is required" }, { status: 400 });
    }

    if (!eta) {
      return NextResponse.json({ error: "ETA must be a valid date" }, { status: 400 });
    }

    if (!etd) {
      return NextResponse.json({ error: "ETD must be a valid date" }, { status: 400 });
    }

    if (etd <= eta) {
      return NextResponse.json({ error: "ETD must be later than ETA" }, { status: 400 });
    }

    if (body.etb !== undefined && body.etb !== null && body.etb !== "" && !etb) {
      return NextResponse.json({ error: "ETB must be a valid date" }, { status: 400 });
    }

    if (etb && (etb < eta || etb > etd)) {
      return NextResponse.json({ error: "ETB must be between ETA and ETD" }, { status: 400 });
    }

    if (body.ata !== undefined && body.ata !== null && body.ata !== "" && !ata) {
      return NextResponse.json({ error: "ATA must be a valid date" }, { status: 400 });
    }

    if (body.atb !== undefined && body.atb !== null && body.atb !== "" && !atb) {
      return NextResponse.json({ error: "ATB must be a valid date" }, { status: 400 });
    }

    if (body.atd !== undefined && body.atd !== null && body.atd !== "" && !atd) {
      return NextResponse.json({ error: "ATD must be a valid date" }, { status: 400 });
    }

    if (!SCHEDULE_STATUSES.includes(status as ScheduleStatus)) {
      return NextResponse.json({ error: "Invalid schedule status" }, { status: 400 });
    }

    if (
      body.berthPositionMeters !== undefined &&
      body.berthPositionMeters !== null &&
      body.berthPositionMeters !== "" &&
      berthPositionMeters === null
    ) {
      return NextResponse.json({ error: "Berth position meters must be an integer" }, { status: 400 });
    }

    const vessel = await prisma.vessel.findFirst({
      where: { id: vesselId, organizationId },
      select: { id: true, isActive: true, lengthOverall: true },
    });

    if (!vessel) {
      return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
    }

    if (!vessel.isActive) {
      return NextResponse.json({ error: "Only active vessels can be selected" }, { status: 400 });
    }

    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, organizationId },
      select: { id: true, isActive: true },
    });

    if (!terminal) {
      return NextResponse.json({ error: "Terminal not found" }, { status: 404 });
    }

    if (!terminal.isActive) {
      return NextResponse.json({ error: "Only active terminals can be selected" }, { status: 400 });
    }

    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: { id: serviceId, organizationId },
        select: { id: true, isActive: true },
      });

      if (!service) {
        return NextResponse.json({ error: "Service not found" }, { status: 404 });
      }

      if (!service.isActive) {
        return NextResponse.json({ error: "Only active services can be selected" }, { status: 400 });
      }
    }

    if (berthId) {
      const berth = await prisma.berth.findFirst({
        where: { id: berthId, organizationId },
        select: { id: true, terminalId: true, isActive: true },
      });

      if (!berth) {
        return NextResponse.json({ error: "Berth not found" }, { status: 404 });
      }

      if (berth.terminalId !== terminalId) {
        return NextResponse.json(
          { error: "The selected berth does not belong to the selected terminal" },
          { status: 400 },
        );
      }

      if (!berth.isActive) {
        return NextResponse.json({ error: "Only active berths can be selected" }, { status: 400 });
      }

      const vesselLoa = vessel.lengthOverall !== null ? Number(vessel.lengthOverall) : null;
      const overlap = await hasBerthOverlap({
        organizationId,
        berthId,
        eta,
        etb,
        etd,
        berthPositionMeters,
        vesselLoa,
      });
      if (overlap) {
        return NextResponse.json(
          { error: "The selected berth already has an overlapping schedule" },
          { status: 409 },
        );
      }
    }

    const schedule = await prisma.$transaction(async (tx) => {
      const created = await tx.vesselSchedule.create({
        data: {
          organizationId,
          vesselId,
          terminalId,
          berthId,
          serviceId,
          voyageNumber: trimOptionalString(body.voyageNumber),
          eta,
          etb,
          etd,
          ata,
          atb,
          atd,
          status: status as ScheduleStatus,
          remarks: trimOptionalString(body.remarks),
          berthPositionMeters,
          headingReverse,
        },
        include: {
          vessel: {
            select: { id: true, imo: true, name: true, callSign: true },
          },
          terminal: {
            select: {
              id: true,
              code: true,
              name: true,
              port: {
                select: { id: true, code: true, name: true, timezone: true },
              },
            },
          },
          berth: {
            select: { id: true, code: true, name: true, color: true, zeroOriginSide: true },
          },
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
        },
      });

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId,
        actor: {
          id: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
        },
        action: "CREATE",
        entityType: AUDIT_ENTITY_TYPES.VESSEL_SCHEDULE,
        entityId: created.id,
        entityName: getScheduleEntityName({
          vesselName: created.vessel.name,
          serviceCode: created.service?.code ?? null,
          voyageNumber: created.voyageNumber,
        }),
        beforeData: null,
        afterData: created,
      });

      return created;
    });

    return NextResponse.json({ data: serializeSchedule(schedule) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to create schedule:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}
