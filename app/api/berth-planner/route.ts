import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import type { PlannerDataRaw } from "@/lib/berth-planner/types";
import { buildPlannerScheduleScope } from "@/lib/berth-planner/planner-query";
import { defaultVesselLabelConfig, normalizeStoredVesselLabelConfig } from "@/lib/berth-planner/vessel-label";
import { defaultExportTableConfig, isMissingExportTableConfigColumn, normalizeStoredExportTableConfig } from "@/lib/berth-planner/export-table-config";

function serializeDecimal(value: { toNumber(): number } | null): number | null {
  return value !== null ? value.toNumber() : null;
}

function isMissingVesselLabelConfigColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: unknown; message?: unknown };
  return maybe.code === "P2022"
    && typeof maybe.message === "string"
    && maybe.message.includes("organizations.vesselLabelConfig");
}

export async function GET(request: NextRequest) {
  try {
    const requestStartedAt = performance.now();
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

    const maximumRangeMs = 8 * 24 * 60 * 60 * 1000;
    if (rangeEnd.getTime() - rangeStart.getTime() > maximumRangeMs) {
      return NextResponse.json({ error: "Planner date range cannot exceed eight days" }, { status: 400 });
    }

    // Verify the terminal belongs to the authenticated user's active organization.
    let terminal: {
      id: string;
      name: string;
      port: { id: string; name: string; timezone: string };
    } | null = null;
    let vesselLabelConfig = defaultVesselLabelConfig();
    let exportTableConfig = defaultExportTableConfig();
    try {
      const terminalWithLabelConfig = await prisma.terminal.findFirst({
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
          organization: {
            select: {
              vesselLabelConfig: true,
              exportTableConfig: true,
            },
          },
        },
      });
      terminal = terminalWithLabelConfig;
      if (terminalWithLabelConfig) {
        vesselLabelConfig = normalizeStoredVesselLabelConfig(
          terminalWithLabelConfig.organization.vesselLabelConfig,
        ).config;
        exportTableConfig = normalizeStoredExportTableConfig(
          terminalWithLabelConfig.organization.exportTableConfig,
        );
      }
    } catch (error) {
      if (!isMissingVesselLabelConfigColumn(error) && !isMissingExportTableConfigColumn(error)) {
        throw error;
      }
      terminal = await prisma.terminal.findFirst({
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
    }

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
    const plannerQueryStartedAt = performance.now();
    const schedules = await prisma.vesselSchedule.findMany({
      where: {
        ...buildPlannerScheduleScope({
          organizationId,
          terminalId,
          berthIds,
          rangeStart,
          rangeEnd,
        }),
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
        remarks: true,
        voyageNumber: true,
        updatedAt: true,
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

    const plannerQueryDurationMs = performance.now() - plannerQueryStartedAt;
    const transformStartedAt = performance.now();
    const responseData: PlannerDataRaw = {
      organizationName: currentUser.activeOrganization.name,
      terminalId: terminal.id,
      terminalName: terminal.name,
      portName: terminal.port.name,
      portTimezone: terminal.port.timezone,
      vesselLabelConfig,
      exportTableConfig,
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
          remarks: s.remarks,
          voyageNumber: s.voyageNumber,
          vesselName: s.vessel.name,
          vesselLoa: serializeDecimal(s.vessel.lengthOverall),
          vesselColor: "#3B82F6",
          serviceName: s.service?.name ?? null,
          serviceColor: s.service?.color ?? null,
          updatedAt: s.updatedAt.toISOString(),
        })),
      })),
    };

    const response = NextResponse.json({ data: responseData });
    if (process.env.NODE_ENV !== "production") {
      response.headers.set("Server-Timing", `planner-api;dur=${(performance.now() - requestStartedAt).toFixed(2)}, planner-query;dur=${plannerQueryDurationMs.toFixed(2)}, planner-transform;dur=${(performance.now() - transformStartedAt).toFixed(2)}`);
    }
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to load berth planner data:");
    return NextResponse.json({ error: "Failed to load berth planner data" }, { status: 500 });
  }
}
