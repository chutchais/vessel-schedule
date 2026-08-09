import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { buildPlannerScheduleScope } from "@/lib/berth-planner/planner-query";
import { buildConflictGroups, getConflictedScheduleIds } from "@/lib/berth-planner/conflict-panel";
import { filterPlannerBerths, type OperationalFilters } from "@/lib/berth-planner/operational-filters";
import type { PlannerBerth } from "@/lib/berth-planner/types";
import { checkPublicRateLimit, hashToken, PUBLIC_VESSEL_LABEL_CONFIG, publicOpaqueId, publicSecurityHeaders, SHARE_COOKIE_NAME, sharingEnabled, trustedClientAddress } from "@/lib/berth-planner/public-sharing";

function denied(status = 404) { return NextResponse.json({ error: "Shared planner is unavailable." }, { status, headers: publicSecurityHeaders() }); }
function decimal(value: { toNumber(): number } | null) { return value?.toNumber() ?? null; }

export async function GET(request: NextRequest, context: RouteContext<"/api/public/berth-planner/[publicId]/data">) {
  if (!sharingEnabled()) return denied();
  const { publicId } = await context.params;
  const token = request.cookies.get(SHARE_COOKIE_NAME)?.value ?? "";
  try {
    const globalRate = await checkPublicRateLimit("planner-data-global", trustedClientAddress(request), 600, 60_000);
    if (!globalRate.allowed) { const response = denied(429); response.headers.set("Retry-After", String(globalRate.retryAfterSeconds)); return response; }
    const rate = await checkPublicRateLimit("planner-data-session", `${publicId}:${token ? hashToken(token) : "missing"}`, 120, 60_000);
    if (!rate.allowed) { const response = denied(429); response.headers.set("Retry-After", String(rate.retryAfterSeconds)); return response; }
    if (!token) return denied();
    const now = new Date();
    const session = await prisma.berthPlannerShareSession.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: now }, share: { publicId, revokedAt: null, expiresAt: { gt: now }, organization: { isActive: true }, terminal: { isActive: true } } },
      select: {
        id: true,
        share: {
          select: {
            id: true, publicId: true, organizationId: true, terminalId: true,
            startDate: true, endDate: true, rangeStart: true, rangeEnd: true,
            filters: true, initialView: true, expiresAt: true,
            organization: { select: { name: true } },
            terminal: { select: { name: true, organizationId: true, port: { select: { name: true, timezone: true, organizationId: true } } } },
          },
        },
      },
    });
    if (!session) return denied();
    const share = session.share;
    if (share.terminal.organizationId !== share.organizationId || share.terminal.port.organizationId !== share.organizationId) return denied();
    const berths = await prisma.berth.findMany({ where: { organizationId: share.organizationId, terminalId: share.terminalId, isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, berthLength: true, color: true, zeroOriginSide: true, sortOrder: true } });
    const berthIds = berths.map((b) => b.id);
    const schedules = await prisma.vesselSchedule.findMany({
      where: buildPlannerScheduleScope({ organizationId: share.organizationId, terminalId: share.terminalId, berthIds, rangeStart: share.rangeStart, rangeEnd: share.rangeEnd }),
      take: 2001,
      select: { id: true, berthId: true, status: true, eta: true, etb: true, etd: true, berthPositionMeters: true, headingReverse: true, voyageNumber: true, vessel: { select: { name: true, lengthOverall: true } }, service: { select: { name: true, color: true } } },
    });
    if (schedules.length > 2000) return NextResponse.json({ error: "Shared planner contains too much data." }, { status: 413, headers: publicSecurityHeaders() });
    const grouped = new Map(berthIds.map((id) => [id, [] as typeof schedules]));
    for (const schedule of schedules) if (schedule.berthId) grouped.get(schedule.berthId)?.push(schedule);
    const internalBerths: PlannerBerth[] = berths.map((berth) => ({
      id: berth.id, name: berth.name, berthLength: berth.berthLength.toNumber(), zeroOriginSide: berth.zeroOriginSide, order: berth.sortOrder,
      schedules: (grouped.get(berth.id) ?? []).map((s) => ({ id: s.id, berthId: berth.id, status: s.status, eta: s.eta, etb: s.etb, etd: s.etd, berthPositionMeters: s.berthPositionMeters, headingReverse: s.headingReverse, voyageNumber: s.voyageNumber, vesselName: s.vessel.name, vesselLoa: decimal(s.vessel.lengthOverall), vesselColor: "#3B82F6", serviceName: s.service?.name ?? null, serviceColor: /^#[0-9a-f]{6}$/i.test(s.service?.color ?? "") ? s.service!.color : null })),
    }));
    const stored: OperationalFilters = share.filters && typeof share.filters === "object" && !Array.isArray(share.filters)
      ? share.filters as unknown as OperationalFilters
      : { search: "", service: "", status: "", berthId: "", conflictsOnly: false, invalidOnly: false };
    const safeSearch = stored.search.trim().toLocaleLowerCase();
    const searchedBerths = safeSearch ? internalBerths.map((berth) => ({ ...berth, schedules: berth.schedules.filter((schedule) => [schedule.vesselName, schedule.voyageNumber ?? ""].some((value) => value.toLocaleLowerCase().includes(safeSearch))) })) : internalBerths;
    const filtered = filterPlannerBerths({ berths: searchedBerths, filters: { ...stored, search: "" }, conflictedScheduleIds: getConflictedScheduleIds(buildConflictGroups(internalBerths)) });
    const scopedBerths = stored.berthId ? filtered.filter((berth) => berth.id === stored.berthId) : filtered;
    const data = {
      organizationName: share.organization.name, terminalName: share.terminal.name, portName: share.terminal.port.name, portTimezone: share.terminal.port.timezone,
      startDate: share.startDate, endDate: share.endDate, rangeStart: share.rangeStart.toISOString(), rangeEnd: share.rangeEnd.toISOString(), initialView: share.initialView,
      vesselLabelConfig: PUBLIC_VESSEL_LABEL_CONFIG,
      berths: scopedBerths.map((berth) => ({ key: publicOpaqueId(publicId, "berth", berth.id), name: berth.name, berthLength: berth.berthLength, color: berths.find((b) => b.id === berth.id)?.color ?? "#3B82F6", zeroOriginSide: berth.zeroOriginSide, order: berth.order, schedules: berth.schedules.map((s) => ({ key: publicOpaqueId(publicId, "schedule", s.id), vesselName: s.vesselName, vesselLoa: s.vesselLoa, voyageNumber: s.voyageNumber, serviceName: s.serviceName, serviceColor: s.serviceColor, eta: s.eta.toISOString(), etb: s.etb?.toISOString() ?? null, etd: s.etd.toISOString(), berthPositionMeters: s.berthPositionMeters, headingReverse: s.headingReverse, status: s.status })) })),
    };
    await prisma.$transaction([prisma.berthPlannerShareSession.update({ where: { id: session.id }, data: { lastAccessedAt: now } }), prisma.berthPlannerShare.update({ where: { id: share.id }, data: { lastAccessedAt: now } })]);
    return NextResponse.json({ data }, { headers: publicSecurityHeaders() });
  } catch {
    console.error("Shared planner data failed:");
    return denied();
  }
}
