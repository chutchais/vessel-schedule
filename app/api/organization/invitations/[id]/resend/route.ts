import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canManageInvitation } from "@/lib/auth/invitations";
import { createInvitationToken, buildInvitationUrl, getInvitationExpiry } from "@/lib/auth/invitation-links";
import { checkInvitationRateLimit } from "@/lib/auth/invitation-rate-limit";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { prisma } from "@/lib/db/prisma";
import { deliverInvitation } from "@/lib/email/deliver-invitation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    if (!canManageInvitation(currentUser.membership.role, "VIEWER")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const limit = checkInvitationRateLimit(`replace:${currentUser.id}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many invitation attempts", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429 });
    const { id } = await params;
    const existing = await prisma.organizationInvitation.findUnique({ where: { id }, include: { organization: { select: { name: true } } } });
    if (!existing || existing.organizationId !== currentUser.activeOrganization.id) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    if (existing.status !== "PENDING" || existing.acceptedAt || existing.revokedAt || existing.expiresAt <= new Date()) return NextResponse.json({ error: "Only active invitations can be replaced" }, { status: 400 });
    if (!canManageInvitation(currentUser.membership.role, existing.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const duplicateLimit = checkInvitationRateLimit(`resend:${existing.organizationId}:${existing.email}`, 1, 60 * 1000);
    if (!duplicateLimit.allowed) return NextResponse.json({ error: "This invitation was just resent. Please wait before trying again.", retryAfterSeconds: duplicateLimit.retryAfterSeconds }, { status: 429 });

    const { token, tokenHash } = createInvitationToken();
    const replacement = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const revoked = await tx.organizationInvitation.updateMany({ where: { id, organizationId: currentUser.activeOrganization.id, status: "PENDING", acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { status: "REVOKED", revokedAt: now, pendingKey: null } });
      if (revoked.count !== 1) throw new Error("Invitation is no longer pending");
      const created = await tx.organizationInvitation.create({ data: { organizationId: existing.organizationId, email: existing.email, role: existing.role, pendingKey: `${existing.organizationId}:${existing.email}`, tokenHash, expiresAt: getInvitationExpiry(now), invitedById: currentUser.id, deliveryStatus: "PENDING" } });
      await createAuditLog(tx, { scope: "ORGANIZATION", organizationId: existing.organizationId, actor: currentUser, action: "RESEND_INVITATION", entityType: "OrganizationInvitation", entityId: created.id, entityName: created.email, beforeData: { id: existing.id, status: existing.status }, afterData: { id: created.id, email: created.email, role: created.role, status: created.status, expiresAt: created.expiresAt }, metadata: { replacedInvitationId: existing.id } });
      return created;
    });
    const invitationUrl = buildInvitationUrl(token);
    const delivery = await deliverInvitation({ invitationId: replacement.id, email: replacement.email, organizationId: replacement.organizationId, organizationName: existing.organization.name, inviterName: currentUser.displayName, role: replacement.role, expiresAt: replacement.expiresAt, invitationUrl, actor: currentUser });
    return NextResponse.json({ data: { id: replacement.id, expiresAt: replacement.expiresAt, deliveryStatus: delivery.ok ? "SENT" : "FAILED", deliveryFailed: !delivery.ok, invitationUrl } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("Invitation replacement failed:", error);
    return NextResponse.json({ error: "Unable to replace invitation" }, { status: 500 });
  }
}
