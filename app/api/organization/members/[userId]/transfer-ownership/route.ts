import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";
import { createAuditLog } from "@/lib/audit/create-audit-log";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const { membership, activeOrganization } = currentUser;

    if (membership.role !== "OWNER") {
      return NextResponse.json({ error: "Forbidden: OWNER required" }, { status: 403 });
    }

    const { userId: targetUserId } = await params;

    if (targetUserId === currentUser.id) {
      return NextResponse.json({ error: "Cannot transfer ownership to yourself" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-read requester's membership to confirm still OWNER
      const requesterMembership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: activeOrganization.id,
            userId: currentUser.id,
          },
        },
        select: { role: true, isActive: true },
      });

      if (!requesterMembership || requesterMembership.role !== "OWNER" || !requesterMembership.isActive) {
        return { error: "You are no longer an active OWNER of this organization", status: 403 } as const;
      }

      const targetMembership = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: activeOrganization.id,
            userId: targetUserId,
          },
        },
        select: { role: true, isActive: true },
      });

      if (!targetMembership) {
        return { error: "Target member not found", status: 404 } as const;
      }
      if (!targetMembership.isActive) {
        return { error: "Target member is not active" , status: 400 } as const;
      }
      if (targetMembership.role === "OWNER") {
        return { error: "Target is already an OWNER" , status: 400 } as const;
      }

      const [newOwner, newAdmin] = await Promise.all([
        tx.organizationMember.update({
          where: { organizationId_userId: { organizationId: activeOrganization.id, userId: targetUserId } },
          data: { role: "OWNER" },
          select: { userId: true, role: true, isActive: true },
        }),
        tx.organizationMember.update({
          where: { organizationId_userId: { organizationId: activeOrganization.id, userId: currentUser.id } },
          data: { role: "ADMIN" },
          select: { userId: true, role: true, isActive: true },
        }),
      ]);

      // Verify exactly one OWNER
      const ownerCount = await tx.organizationMember.count({
        where: { organizationId: activeOrganization.id, role: "OWNER", isActive: true },
      });

      if (ownerCount !== 1) {
        throw new Error("Transfer resulted in unexpected owner count; rolling back");
      }

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId: activeOrganization.id,
        actor: {
          id: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
        },
        action: "TRANSFER_OWNERSHIP",
        entityType: "Organization",
        entityId: activeOrganization.id,
        entityName: activeOrganization.name,
        beforeData: {
          ownerUserId: currentUser.id,
          ownerRole: requesterMembership.role,
          targetUserId,
          targetRole: targetMembership.role,
        },
        afterData: {
          ownerUserId: targetUserId,
          previousOwnerUserId: currentUser.id,
          previousOwnerRole: "ADMIN",
          newOwnerRole: "OWNER",
        },
        metadata: {
          fromOwnerId: currentUser.id,
          toOwnerId: targetUserId,
        },
      });

      return { success: true, newOwner, newAdmin } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ data: { newOwner: result.newOwner, newAdmin: result.newAdmin } });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to transfer ownership:", error);
    return NextResponse.json({ error: "Failed to transfer ownership" }, { status: 500 });
  }
}
