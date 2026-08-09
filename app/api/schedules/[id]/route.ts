import { NextRequest, NextResponse } from "next/server";
import type { ScheduleStatus } from "@/generated/prisma/client";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageSchedules } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  undoSchedule,
  updateSchedule,
  type ScheduleMutationData,
  type ScheduleMutationResult,
} from "@/lib/schedules/schedule-mutations";

const SCHEDULE_STATUSES = [
  "PLANNED",
  "CONFIRMED",
  "ARRIVED",
  "BERTHED",
  "DEPARTED",
  "CANCELLED",
] as const;
type RouteContext = { params: Promise<{ id: string }> };

function parseOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function trimOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function trimOptionalId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function parseOptionalInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
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

function responseForResult(result: ScheduleMutationResult) {
  if (result.ok) {
    return NextResponse.json({
      data: mapSchedule(result.schedule),
      undoToken: result.undoToken,
      undoExpiresAt: result.undoExpiresAt,
      expectedUpdatedAt: result.schedule.updatedAt.toISOString(),
    });
  }
  const status =
    result.reason === "not_found"
      ? 404
      : result.reason === "validation"
        ? 422
        : result.reason === "conflict" ||
            result.reason === "stale" ||
            result.reason === "undo_unavailable" ||
            result.reason === "retry"
          ? 409
          : 500;
  return NextResponse.json({ error: result.message }, { status });
}

function parseExpectedUpdatedAt(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMutationData(body: Record<string, unknown>):
  | { data: ScheduleMutationData }
  | { error: string } {
  if (typeof body.vesselId !== "string" || !body.vesselId.trim()) {
    return { error: "Vessel is required" };
  }
  if (typeof body.terminalId !== "string" || !body.terminalId.trim()) {
    return { error: "Terminal is required" };
  }
  if (typeof body.eta !== "string" || !body.eta) return { error: "ETA is required" };
  if (typeof body.etd !== "string" || !body.etd) return { error: "ETD is required" };
  const eta = parseOptionalDate(body.eta);
  const etb = parseOptionalDate(body.etb);
  const etd = parseOptionalDate(body.etd);
  const ata = parseOptionalDate(body.ata);
  const atb = parseOptionalDate(body.atb);
  const atd = parseOptionalDate(body.atd);
  if (!eta) return { error: "ETA must be a valid date" };
  if (!etd) return { error: "ETD must be a valid date" };
  for (const [label, raw, parsed] of [
    ["ETB", body.etb, etb],
    ["ATA", body.ata, ata],
    ["ATB", body.atb, atb],
    ["ATD", body.atd, atd],
  ] as const) {
    if (raw !== undefined && raw !== null && raw !== "" && !parsed) {
      return { error: `${label} must be a valid date` };
    }
  }
  const status =
    typeof body.status === "string" ? body.status.trim().toUpperCase() : "PLANNED";
  if (!SCHEDULE_STATUSES.includes(status as (typeof SCHEDULE_STATUSES)[number])) {
    return { error: "Invalid schedule status" };
  }
  const berthPositionMeters = parseOptionalInteger(body.berthPositionMeters);
  if (
    body.berthPositionMeters !== undefined &&
    body.berthPositionMeters !== null &&
    body.berthPositionMeters !== "" &&
    berthPositionMeters === null
  ) {
    return { error: "Berth position meters must be an integer" };
  }
  return {
    data: {
      vesselId: body.vesselId.trim(),
      terminalId: body.terminalId.trim(),
      berthId: trimOptionalId(body.berthId),
      serviceId: trimOptionalId(body.serviceId),
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
      headingReverse: body.headingReverse === true,
    },
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const { id } = await context.params;
    const schedule = await prisma.vesselSchedule.findFirst({
      where: { id, organizationId: currentUser.activeOrganization.id },
      select: {
        id: true,
        vesselId: true,
        serviceId: true,
        voyageNumber: true,
        terminalId: true,
        berthId: true,
        eta: true,
        etb: true,
        etd: true,
        ata: true,
        atb: true,
        atd: true,
        status: true,
        remarks: true,
        berthPositionMeters: true,
        headingReverse: true,
        updatedAt: true,
      },
    });
    if (!schedule) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    return NextResponse.json({ data: schedule });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to load schedule:");
    return NextResponse.json({ error: "Failed to load schedule" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;
    if (!canManageSchedules(currentUser.membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const expectedUpdatedAt = parseExpectedUpdatedAt(body.expectedUpdatedAt);
    if (!expectedUpdatedAt) {
      return NextResponse.json(
        { error: "expectedUpdatedAt is required for schedule updates" },
        { status: 400 },
      );
    }

    if (body.plannerAction === "undo") {
      if (typeof body.undoToken !== "string" || !body.undoToken) {
        return NextResponse.json({ error: "Invalid undo action" }, { status: 400 });
      }
      return responseForResult(
        await undoSchedule({
          scheduleId: id,
          organizationId,
          actor: currentUser,
          undoToken: body.undoToken,
          expectedUpdatedAt,
        }),
      );
    }

    const parsed = parseMutationData(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const existing = await prisma.vesselSchedule.findFirst({
      where: { id, organizationId },
      select: {
        vesselId: true,
        terminalId: true,
        berthId: true,
        berthPositionMeters: true,
        eta: true,
        etb: true,
        etd: true,
        status: true,
      },
    });
    if (!existing) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    const plannerAction =
      body.plannerAction === "move" || body.plannerAction === "resize"
        ? body.plannerAction
        : undefined;
    if (plannerAction && existing.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cancelled schedules cannot be moved or resized" },
        { status: 409 },
      );
    }
    if (plannerAction === "resize") {
      if (body.resizeEdge !== "start" && body.resizeEdge !== "end") {
        return NextResponse.json({ error: "Invalid resize edge" }, { status: 400 });
      }
      if (
        parsed.data.vesselId !== existing.vesselId ||
        parsed.data.terminalId !== existing.terminalId ||
        parsed.data.berthId !== existing.berthId ||
        parsed.data.berthPositionMeters !== existing.berthPositionMeters
      ) {
        return NextResponse.json(
          { error: "A duration resize cannot change vessel or berth geometry" },
          { status: 400 },
        );
      }
      const effectiveStart = parsed.data.etb ?? parsed.data.eta;
      if (parsed.data.etd.getTime() - effectiveStart.getTime() < 30 * 60 * 1000) {
        return NextResponse.json(
          { error: "Schedule duration must be at least 30 minutes" },
          { status: 400 },
        );
      }
      if (body.resizeEdge === "start") {
        if (existing.etb && parsed.data.eta.getTime() !== existing.eta.getTime()) {
          return NextResponse.json({ error: "ETA cannot change when resizing ETB" }, { status: 400 });
        }
        if (!existing.etb && parsed.data.etb !== null) {
          return NextResponse.json(
            { error: "Start resize must update ETA when ETB is absent" },
            { status: 400 },
          );
        }
        if (parsed.data.etd.getTime() !== existing.etd.getTime()) {
          return NextResponse.json({ error: "Start resize cannot change ETD" }, { status: 400 });
        }
      } else if (
        parsed.data.eta.getTime() !== existing.eta.getTime() ||
        (parsed.data.etb?.getTime() ?? null) !== (existing.etb?.getTime() ?? null)
      ) {
        return NextResponse.json({ error: "End resize can only change ETD" }, { status: 400 });
      }
    }

    return responseForResult(
      await updateSchedule({
        scheduleId: id,
        organizationId,
        actor: currentUser,
        expectedUpdatedAt,
        data: parsed.data,
        plannerAction,
        resizeEdge:
          body.resizeEdge === "start" || body.resizeEdge === "end" ? body.resizeEdge : undefined,
      }),
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to update schedule:");
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}
