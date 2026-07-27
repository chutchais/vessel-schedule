import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/auth/email";
import { createAuditLog } from "@/lib/audit/create-audit-log";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const verifiedEmail = normalizeEmail(authUser.email ?? "");

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id },
      select: { id: true, email: true, status: true },
    });

    if (!invitation || normalizeEmail(invitation.email) !== verifiedEmail) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status.toLowerCase()}` },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const beforeInvitation = await tx.organizationInvitation.findUnique({
        where: { id },
      });

      if (!beforeInvitation) {
        throw new Error("Invitation not found during decline");
      }

      const updatedInvitation = await tx.organizationInvitation.update({
        where: { id },
        data: { status: "DECLINED", pendingKey: null, revokedAt: new Date() },
      });

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId: beforeInvitation.organizationId,
        actor: {
          id: authUser.id,
          email: verifiedEmail,
          displayName: authUser.user_metadata?.display_name || authUser.email || "Unknown User",
        },
        action: "DECLINE_INVITATION",
        entityType: "OrganizationInvitation",
        entityId: updatedInvitation.id,
        entityName: updatedInvitation.email,
        beforeData: beforeInvitation,
        afterData: updatedInvitation,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to decline invitation:", error);
    return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
  }
}
