import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageOrgMembers } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { prisma } from "@/lib/db/prisma";
import { sharingEnabled } from "@/lib/berth-planner/public-sharing";

export async function POST(_request: Request, context: RouteContext<"/api/organization/berth-planner-shares/[publicId]/revoke">) {
  if (!sharingEnabled()) return NextResponse.json({ error: "Planner sharing is unavailable." }, { status: 404 });
  try {
    const user = await requireCurrentUser();
    if (!canManageOrgMembers(user.membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { publicId } = await context.params;
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const existing = await tx.berthPlannerShare.findFirst({ where: { publicId, organizationId: user.activeOrganization.id }, select: { id: true, publicId: true, revokedAt: true, terminal: { select: { name: true } } } });
      if (!existing) return;
      if (!existing.revokedAt) await tx.berthPlannerShare.update({ where: { id: existing.id }, data: { revokedAt: now } });
      if (!existing.revokedAt) await createAuditLog(tx, { scope: "ORGANIZATION", organizationId: user.activeOrganization.id, actor: user, action: "REVOKE_SHARE", entityType: "BERTH_PLANNER_SHARE", entityId: existing.id, entityName: existing.terminal.name, beforeData: { publicId: existing.publicId, revokedAt: null }, afterData: { publicId: existing.publicId, revokedAt: now } });
    });
    return NextResponse.json({ data: { revoked: true } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("Failed to revoke planner share:", error);
    return NextResponse.json({ error: "Failed to revoke planner share." }, { status: 500 });
  }
}
