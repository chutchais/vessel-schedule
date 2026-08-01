import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { buildPlannerScheduleScope } from "@/lib/berth-planner/planner-query";
import {
  SCHEDULE_STATUSES,
  type OperationalFilters,
} from "@/lib/berth-planner/operational-filters";
import type { ScheduleStatus } from "@/lib/berth-planner/types";
import {
  buildCsv,
  buildCsvFilename,
  CSV_MAX_RANGE_DAYS,
  CSV_MAX_RECORDS,
  type CsvBerthGroup,
} from "@/lib/berth-planner/csv-export";
import { getWeekStart, getWeekEnd } from "@/lib/berth-planner/timezone";
import { classifySchedules } from "@/lib/berth-planner/layout";
import type { PlannerSchedule } from "@/lib/berth-planner/types";

function serializeDecimal(value: { toNumber(): number } | null): number | null {
  return value !== null ? value.toNumber() : null;
}

/**
 * Apply the same operational filters used in the Berth Planner canvas to the
 * flat list of schedules after they are fetched from the database.
 *
 * Filter fields: q (search), service, status, berth, conflicts, invalid.
 * "conflicts" and "invalid" filters are handled after conflict/validity
 * detection in the CSV builder — here we apply the simple field filters.
 */
function scheduleMatchesFilters(
  schedule: {
    vesselName: string;
    voyageNumber: string | null;
    id: string;
    serviceName: string | null;
    status: ScheduleStatus;
    berthId: string;
  },
  filters: OperationalFilters,
): boolean {
  if (filters.search) {
    const q = filters.search.trim().toLocaleLowerCase();
    const matches =
      schedule.vesselName.toLocaleLowerCase().includes(q) ||
      (schedule.voyageNumber ?? "").toLocaleLowerCase().includes(q) ||
      schedule.id.toLocaleLowerCase().includes(q);
    if (!matches) return false;
  }
  if (filters.service && schedule.serviceName !== filters.service) return false;
  if (filters.status && schedule.status !== filters.status) return false;
  if (filters.berthId && schedule.berthId !== filters.berthId) return false;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    const params = request.nextUrl.searchParams;
    const terminalId = params.get("terminalId")?.trim();
    const startParam = params.get("startDate")?.trim();
    const endParam = params.get("endDate")?.trim();

    // ── Parameter validation ──────────────────────────────────────────────────

    if (!terminalId) {
      return NextResponse.json({ error: "terminalId is required" }, { status: 400 });
    }

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    const rangeStart = new Date(startParam);
    const rangeEnd = new Date(endParam);

    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      return NextResponse.json(
        { error: "startDate and endDate must be valid ISO dates" },
        { status: 400 },
      );
    }

    if (rangeEnd <= rangeStart) {
      return NextResponse.json(
        { error: "endDate must be after startDate" },
        { status: 400 },
      );
    }

    const maximumRangeMs = CSV_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (rangeEnd.getTime() - rangeStart.getTime() > maximumRangeMs) {
      return NextResponse.json(
        { error: `CSV export date range cannot exceed ${CSV_MAX_RANGE_DAYS} days` },
        { status: 400 },
      );
    }

    // ── Filter parameter parsing ──────────────────────────────────────────────

    const statusParam = params.get("status");
    const status: ScheduleStatus | "" = SCHEDULE_STATUSES.includes(
      statusParam as ScheduleStatus,
    )
      ? (statusParam as ScheduleStatus)
      : "";

    const filters: OperationalFilters = {
      search: (params.get("q") ?? "").trim().slice(0, 100),
      service: (params.get("service") ?? "").trim().slice(0, 100),
      status,
      berthId: (params.get("berth") ?? "").trim().slice(0, 100),
      conflictsOnly: params.get("conflicts") === "1",
      invalidOnly: params.get("invalid") === "1",
    };

    // ── Terminal authorization (org-scoped) ───────────────────────────────────

    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, organizationId },
      select: {
        id: true,
        name: true,
        port: {
          select: {
            timezone: true,
          },
        },
      },
    });

    if (!terminal) {
      return NextResponse.json({ error: "Terminal not found" }, { status: 404 });
    }

    const portTimezone = terminal.port.timezone;

    // ── Berth query ───────────────────────────────────────────────────────────

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

    // If a berth filter is active, verify the requested berth belongs to this terminal
    if (filters.berthId && !berthIds.includes(filters.berthId)) {
      return NextResponse.json(
        { error: "Requested berth does not belong to the selected terminal" },
        { status: 400 },
      );
    }

    // ── Schedule query ────────────────────────────────────────────────────────

    const schedules = await prisma.vesselSchedule.findMany({
      where: buildPlannerScheduleScope({
        organizationId,
        terminalId,
        berthIds,
        rangeStart,
        rangeEnd,
      }),
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
            code: true,
            name: true,
            lengthOverall: true,
          },
        },
        service: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    // ── Record limit check ────────────────────────────────────────────────────

    if (schedules.length > CSV_MAX_RECORDS) {
      return NextResponse.json(
        {
          error: `Export exceeds the maximum of ${CSV_MAX_RECORDS} records. Narrow the date range or apply filters.`,
        },
        { status: 400 },
      );
    }

    // ── Group schedules by berth ──────────────────────────────────────────────

    const schedulesByBerth = new Map<string, typeof schedules>();
    for (const berth of berths) {
      schedulesByBerth.set(berth.id, []);
    }
    for (const s of schedules) {
      if (s.berthId) {
        schedulesByBerth.get(s.berthId)?.push(s);
      }
    }

    // ── Build CsvBerthGroup[] for the CSV builder ─────────────────────────────

    const groups: CsvBerthGroup[] = [];
    // Collect IDs of schedules passing field filters (pre-conflict/invalid check)
    const preFilteredIds = new Set<string>();

    for (const berth of berths) {
      const raw = schedulesByBerth.get(berth.id) ?? [];
      const berthLength = berth.berthLength.toNumber();

      // Map raw DB rows to PlannerSchedule shape for geometry classification
      const plannerSchedules: PlannerSchedule[] = raw.map((s) => ({
        id: s.id,
        vesselName: s.vessel.name,
        vesselLoa: serializeDecimal(s.vessel.lengthOverall),
        vesselColor: "#3B82F6",
        serviceName: s.service?.name ?? null,
        serviceColor: null,
        status: s.status,
        eta: s.eta,
        etb: s.etb ?? null,
        etd: s.etd,
        berthPositionMeters: s.berthPositionMeters,
        headingReverse: s.headingReverse,
        remarks: s.remarks ?? null,
        berthId: s.berthId ?? "",
        voyageNumber: s.voyageNumber,
        updatedAt: s.updatedAt.toISOString(),
      }));

      // Classify to get ValidatedSchedule for conflict detection
      const { valid: validatedSchedules } = classifySchedules(plannerSchedules, berthLength);
      const validatedIds = new Set(validatedSchedules.map((v) => v.id));

      // Build group schedules — include ALL schedules that pass field filters
      const groupSchedules: CsvBerthGroup["schedules"] = [];

      for (const s of raw) {
        // Apply simple field filters
        const scheduleInfo = {
          vesselName: s.vessel.name,
          voyageNumber: s.voyageNumber,
          id: s.id,
          serviceName: s.service?.name ?? null,
          status: s.status,
          berthId: s.berthId ?? "",
        };
        if (!scheduleMatchesFilters(scheduleInfo, filters)) continue;

        // Apply invalidOnly filter: skip if schedule is valid and we only want invalid
        if (filters.invalidOnly && validatedIds.has(s.id)) continue;

        preFilteredIds.add(s.id);

        // For CsvBerthGroup we need startTime/endTime/positionStart/positionEnd
        // Use the validated schedule if available; fall back to reasonable defaults
        const validated = validatedSchedules.find((v) => v.id === s.id);
        const startTime = validated?.startTime ?? s.etb ?? s.eta;
        const endTime = validated?.endTime ?? s.etd;
        const positionStart = validated?.positionStart ?? s.berthPositionMeters ?? 0;
        const positionEnd = validated?.positionEnd ?? (s.berthPositionMeters ?? 0) + (serializeDecimal(s.vessel.lengthOverall) ?? 0);

        groupSchedules.push({
          id: s.id,
          vesselCode: s.vessel.code,
          vesselName: s.vessel.name,
          vesselLoa: serializeDecimal(s.vessel.lengthOverall),
          voyageNumber: s.voyageNumber,
          serviceCode: s.service?.code ?? null,
          serviceName: s.service?.name ?? null,
          eta: s.eta,
          etb: s.etb ?? null,
          etd: s.etd,
          berthPositionMeters: s.berthPositionMeters,
          headingReverse: s.headingReverse,
          status: s.status,
          remarks: s.remarks ?? null,
          updatedAt: s.updatedAt,
          startTime,
          endTime,
          positionStart,
          positionEnd,
        });
      }

      if (groupSchedules.length > 0 || filters.conflictsOnly || filters.invalidOnly) {
        groups.push({
          berthId: berth.id,
          berthName: berth.name,
          berthOrder: berth.sortOrder,
          schedules: groupSchedules,
        });
      }
    }

    // ── Apply conflictsOnly filter (requires conflict detection across groups) ─

    let finalGroups = groups;
    if (filters.conflictsOnly) {
      // Temporarily include all pre-filtered schedules to get accurate conflict detection
      const { buildConflictedIds } = await import("@/lib/berth-planner/csv-export");
      const conflictedIds = buildConflictedIds(groups);
      finalGroups = groups.map((g) => ({
        ...g,
        schedules: g.schedules.filter((s) => conflictedIds.has(s.id)),
      }));
    }

    // ── Generate CSV ──────────────────────────────────────────────────────────

    const csvContent = buildCsv({
      terminalName: terminal.name,
      portTimezone,
      groups: finalGroups,
    });

    // ── Filename ──────────────────────────────────────────────────────────────

    // Use the week containing rangeStart for the filename
    const weekStart = getWeekStart(rangeStart, portTimezone);
    const weekEnd = getWeekEnd(weekStart, portTimezone);
    const filename = buildCsvFilename(terminal.name, weekStart, weekEnd, portTimezone);

    // ── Response ──────────────────────────────────────────────────────────────

    // Prepend UTF-8 BOM (\uFEFF) so Excel opens the file correctly without
    // requiring "Import" or manual encoding selection.
    const bom = "\uFEFF";
    return new NextResponse(bom + csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to export berth planner CSV:", error);
    return NextResponse.json({ error: "Failed to export CSV" }, { status: 500 });
  }
}
