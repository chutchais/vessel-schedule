import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";
import { canManageInvitation } from "@/lib/auth/invitations";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { inviteUserByEmailWithRedirect } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

const RESEND_INTERVAL_MS = 60 * 1000;

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
      select: {
        id: true,
        organizationId: true,
        status: true,
        role: true,
        email: true,
        invitationSentAt: true,
        expiresAt: true,
      },
    });

    if (!invitation || invitation.organizationId !== activeOrganization.id) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Invitation is already ${invitation.status.toLowerCase()}` },
        { status: 400 },
      );
    }

    if (!canManageInvitation(membership.role, invitation.role)) {
      return NextResponse.json(
        { error: "You do not have permission to resend this invitation" },
        { status: 403 },
      );
    }

    // Enforce 60-second cooldown
    if (invitation.invitationSentAt) {
      const elapsed = Date.now() - invitation.invitationSentAt.getTime();
      if (elapsed < RESEND_INTERVAL_MS) {
        const waitSeconds = Math.ceil((RESEND_INTERVAL_MS - elapsed) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitSeconds} seconds before resending` },
          { status: 429 },
        );
      }
    }

    // If expired, extend by 7 days
    const now = new Date();
    let newExpiresAt = invitation.expiresAt;
    let newPendingKey: string | null = null;
    if (invitation.expiresAt < now) {
      newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      newPendingKey = `${activeOrganization.id}:${invitation.email}`;
    }

    // Retry Supabase invite
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/invitations`;
    let deliveryStatus: "SENT" | "EXISTING_ACCOUNT" | "FAILED" = "FAILED";
    let authUserId: string | null = null;
    let deliveryError: string | null = null;

    try {
      const result = await inviteUserByEmailWithRedirect(invitation.email, redirectTo);
      if (result.error) {
        const msg = result.error.message ?? "";
        if (
          msg.toLowerCase().includes("already") ||
          msg.toLowerCase().includes("exists") ||
          msg.toLowerCase().includes("confirmed")
        ) {
          deliveryStatus = "EXISTING_ACCOUNT";
        } else {
          deliveryStatus = "FAILED";
          deliveryError = "Email delivery failed";
        }
      } else if (result.data?.user) {
        authUserId = result.data.user.id;
        deliveryStatus = "SENT";
      }
    } catch {
      deliveryStatus = "FAILED";
      deliveryError = "Email delivery failed";
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      deliveryStatus,
      invitationSentAt: new Date(),
      deliveryError,
      expiresAt: newExpiresAt,
    };
    if (newPendingKey) updateData.pendingKey = newPendingKey;
    if (authUserId) updateData.authUserId = authUserId;

    await prisma.$transaction(async (tx) => {
      const beforeInvitation = await tx.organizationInvitation.findUnique({
        where: { id },
      });

      if (!beforeInvitation) {
        throw new Error("Invitation not found during resend");
      }

      const updatedInvitation = await tx.organizationInvitation.update({ where: { id }, data: updateData });

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId: activeOrganization.id,
        actor: {
          id: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
        },
        action: "RESEND_INVITATION",
        entityType: "OrganizationInvitation",
        entityId: updatedInvitation.id,
        entityName: updatedInvitation.email,
        beforeData: beforeInvitation,
        afterData: updatedInvitation,
        metadata: {
          deliveryStatus: updatedInvitation.deliveryStatus,
        },
      });
    });

    return NextResponse.json({ success: true, deliveryStatus });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to resend invitation:", error);
    return NextResponse.json({ error: "Failed to resend invitation" }, { status: 500 });
  }
}
