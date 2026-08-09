import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageOrgMembers } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { prisma } from "@/lib/db/prisma";
import { getAppUrl } from "@/lib/auth/invitation-links";
import { buildShareUrl, createPublicId, createSecret, parseShareDateRange, sharingEnabled, validateShareFilters, validateView } from "@/lib/berth-planner/public-sharing";

function unavailable() { return NextResponse.json({ error: "Planner sharing is unavailable." }, { status: 404 }); }

export async function GET() {
  if (!sharingEnabled()) return unavailable();
  try {
    const user = await requireCurrentUser();
    if (!canManageOrgMembers(user.membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const rows = await prisma.berthPlannerShare.findMany({
      where: { organizationId: user.activeOrganization.id }, orderBy: { createdAt: "desc" }, take: 100,
      select: { publicId: true, startDate: true, endDate: true, initialView: true, expiresAt: true, revokedAt: true, lastAccessedAt: true, createdAt: true, terminal: { select: { name: true, port: { select: { name: true, timezone: true } } } }, createdBy: { select: { displayName: true } } },
    });
    return NextResponse.json({ data: rows });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("Failed to list planner shares:");
    return NextResponse.json({ error: "Failed to list planner shares." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!sharingEnabled()) return unavailable();
  try {
    const user = await requireCurrentUser();
    if (!canManageOrgMembers(user.membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const terminalId = typeof body.terminalId === "string" ? body.terminalId : "";
    const terminal = await prisma.terminal.findFirst({
      where: { id: terminalId, organizationId: user.activeOrganization.id, isActive: true },
      select: { id: true, name: true, port: { select: { name: true, timezone: true } }, berths: { where: { isActive: true }, select: { id: true } } },
    });
    if (!terminal) return NextResponse.json({ error: "Terminal not found." }, { status: 404 });
    const range = parseShareDateRange(body.startDate, body.endDate, terminal.port.timezone);
    if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
    const filters = validateShareFilters(body.filters, new Set(terminal.berths.map((b) => b.id)));
    if (!filters.ok) return NextResponse.json({ error: filters.error }, { status: 400 });
    const expirationDays = Number(body.expirationDays);
    if (![15, 20, 30].includes(expirationDays)) return NextResponse.json({ error: "Expiration must be 15, 20, or 30 days." }, { status: 400 });
    const initialView = validateView(body.initialView);
    if (!initialView) return NextResponse.json({ error: "Initial view must be position or datetime." }, { status: 400 });
    const expiresAt = new Date(Date.now() + expirationDays * 86_400_000);
    const publicId = createPublicId();
    const { secret, hash } = createSecret();
    await prisma.$transaction(async (tx) => {
      const share = await tx.berthPlannerShare.create({ data: {
        publicId, secretHash: hash, organizationId: user.activeOrganization.id, terminalId: terminal.id,
        createdById: user.id, startDate: range.startDate, endDate: range.endDate, rangeStart: range.rangeStart,
        rangeEnd: range.rangeEnd, filters: filters.filters as unknown as Prisma.InputJsonValue,
        initialView, expiresAt,
      } });
      await createAuditLog(tx, { scope: "ORGANIZATION", organizationId: user.activeOrganization.id, actor: user, action: "CREATE", entityType: "BERTH_PLANNER_SHARE", entityId: share.id, entityName: `${terminal.port.name} — ${terminal.name}`, afterData: { publicId, terminalId: terminal.id, startDate: range.startDate, endDate: range.endDate, expiresAt, initialView: share.initialView } });
    });
    return NextResponse.json({ data: { publicId, url: buildShareUrl(getAppUrl(), publicId, secret), expiresAt: expiresAt.toISOString() } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("Failed to create planner share:");
    return NextResponse.json({ error: "Failed to create planner share." }, { status: 500 });
  }
}
