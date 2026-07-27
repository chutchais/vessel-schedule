import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";
import { canManageInvitation } from "@/lib/auth/invitations";

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
      select: { id: true, organizationId: true, status: true, role: true },
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
        { error: "You do not have permission to revoke this invitation" },
        { status: 403 },
      );
    }

    await prisma.organizationInvitation.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date(), pendingKey: null },
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
