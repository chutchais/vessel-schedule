import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import type { PlannerDataRaw } from "@/lib/berth-planner/types";

function serializeDecimal(value: { toNumber(): number } | null): number | null {
  return value !== null ? value.toNumber() : null;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    const params = request.nextUrl.searchParams;
    const terminalId = params.get("terminalId")?.trim();
    const startParam = params.get("startDate")?.trim();
    const endParam = params.get("endDate")?.trim();

    if (!terminalId) {
      return NextResponse.json({ error: "terminalId is required" }, { status: 400 });
    }

    if (!startParam || !endParam) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const rangeStart = new Date(startParam);
    const rangeEnd = new Date(endParam);

    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      return NextResponse.json({ error: "startDate and endDate must be valid ISO dates" }, { status: 400 });
    }

    if (rangeEnd <= rangeStart) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    // Verify the terminal belongs to the authenticated user's active organization.
    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, organizationId },
      select: {
        id: true,
        name: true,
        port: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
      },
    });

    if (!terminal) {
      return NextResponse.json({ error: "Terminal not found" }, { status: 404 });
    }

    // Load berths ordered by sortOrder.
    const berths = await prisma.berth.findMany({
      where: { terminalId, organizationId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        berthLength: true,
        zeroOriginSide: true,
        sortOrder: true,
      },
    });

    const berthIds = berths.map((b) => b.id);

    // Fetch schedules that intersect the selected date range.
    // Overlap condition: schedule.eta < rangeEnd AND schedule.etd > rangeStart
    // (uses eta as the "start anchor" for interval overlap to catch all relevant records)
    const schedules = await prisma.vesselSchedule.findMany({
      where: {
        organizationId,
        terminalId,
        berthId: { in: berthIds },
        eta: { lt: rangeEnd },
        etd: { gt: rangeStart },
      },
      select: {
        id: true,
        berthId: true,
        status: true,
        eta: true,
        etb: true,
        etd: true,
        berthPositionMeters: true,
        headingReverse: true,
        voyageNumber: true,
        vessel: {
          select: {
            name: true,
            lengthOverall: true,
          },
        },
        service: {
          select: {
            name: true,
            color: true,
          },
        },
      },
    });

    // Group schedules by berthId.
    const schedulesByBerth = new Map<string, typeof schedules>();
    for (const berth of berths) {
      schedulesByBerth.set(berth.id, []);
    }
    for (const s of schedules) {
      if (s.berthId) {
        schedulesByBerth.get(s.berthId)?.push(s);
      }
    }

    const responseData: PlannerDataRaw = {
      terminalId: terminal.id,
      terminalName: terminal.name,
      portName: terminal.port.name,
      portTimezone: terminal.port.timezone,
      berths: berths.map((berth) => ({
        id: berth.id,
        name: berth.name,
        berthLength: berth.berthLength.toNumber(),
        zeroOriginSide: berth.zeroOriginSide,
        order: berth.sortOrder,
        schedules: (schedulesByBerth.get(berth.id) ?? []).map((s) => ({
          id: s.id,
          berthId: s.berthId ?? "",
          status: s.status,
          eta: s.eta.toISOString(),
          etb: s.etb?.toISOString() ?? null,
          etd: s.etd.toISOString(),
          berthPositionMeters: s.berthPositionMeters,
          headingReverse: s.headingReverse,
          voyageNumber: s.voyageNumber,
          vesselName: s.vessel.name,
          vesselLoa: serializeDecimal(s.vessel.lengthOverall),
          vesselColor: "#3B82F6",
          serviceName: s.service?.name ?? null,
          serviceColor: s.service?.color ?? null,
        })),
      })),
    };

    return NextResponse.json({ data: responseData });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to load berth planner data:", error);
    return NextResponse.json({ error: "Failed to load berth planner data" }, { status: 500 });
  }
}
