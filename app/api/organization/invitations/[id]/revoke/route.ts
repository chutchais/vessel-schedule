import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";
import { canManageInvitation } from "@/lib/auth/invitations";
import { createAuditLog } from "@/lib/audit/create-audit-log";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const { membership, activeOrganization } = currentUser;

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: OWNER or ADMIN required" }, { status: 403 });
    }

    const { id } = await params;

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id },
      select: { id: true, organizationId: true, status: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true },
    });

    if (!invitation || invitation.organizationId !== activeOrganization.id) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING" || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
      return NextResponse.json(
        { error: `Invitation is already ${invitation.status.toLowerCase()}` },
        { status: 400 },
      );
    }

    if (!canManageInvitation(membership.role, invitation.role)) {
      return NextResponse.json(
        { error: "You do not have permission to revoke this invitation" },
        { status: 403 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const beforeInvitation = await tx.organizationInvitation.findUnique({
        where: { id },
      });

      if (!beforeInvitation) {
        throw new Error("Invitation not found during revoke");
      }

      const updatedInvitation = await tx.organizationInvitation.update({
        where: { id },
        data: { status: "REVOKED", revokedAt: new Date(), pendingKey: null },
      });

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId: activeOrganization.id,
        actor: {
          id: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
        },
        action: "REVOKE_INVITATION",
        entityType: "OrganizationInvitation",
        entityId: updatedInvitation.id,
        entityName: updatedInvitation.email,
        beforeData: beforeInvitation,
        afterData: updatedInvitation,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to revoke invitation:", error);
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}
