import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";
import { canChangeRole, canDeactivateMember } from "@/lib/auth/invitations";
import { createAuditLog } from "@/lib/audit/create-audit-log";

type RouteContext = { params: Promise<{ userId: string }> };

interface PatchBody {
  role?: unknown;
  isActive?: unknown;
}

const VALID_ROLES = ["OWNER", "ADMIN", "PLANNER", "VIEWER"] as const;

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const { membership, activeOrganization } = currentUser;

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: OWNER or ADMIN required" }, { status: 403 });
    }

    const { userId } = await params;

    if (userId === currentUser.id) {
      return NextResponse.json({ error: "Cannot modify your own membership" }, { status: 400 });
    }

    const body = (await request.json()) as PatchBody;
    const newRole = body.role !== undefined ? body.role : undefined;
    const newIsActive = body.isActive !== undefined ? body.isActive : undefined;

    if (newRole !== undefined && typeof newRole !== "string") {
      return NextResponse.json({ error: "role must be a string" }, { status: 400 });
    }
    if (newRole && !(VALID_ROLES as readonly string[]).includes(newRole as string)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (newIsActive !== undefined && typeof newIsActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
    }

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: activeOrganization.id, userId } },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMembership.role === "OWNER") {
      return NextResponse.json(
        { error: "Cannot modify OWNER role via this endpoint. Use transfer-ownership." },
        { status: 400 },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (newRole !== undefined) {
      const roleStr = newRole as string;
      if (!canChangeRole(membership.role, targetMembership.role, roleStr)) {
        return NextResponse.json(
          { error: "You do not have permission to assign that role" },
          { status: 403 },
        );
      }
      updateData.role = roleStr;
    }

    if (newIsActive !== undefined) {
      if (!canDeactivateMember(membership.role, targetMembership.role)) {
        return NextResponse.json(
          { error: "You do not have permission to change this member's status" },
          { status: 403 },
        );
      }
      if (!newIsActive) {
        // Ensure at least one active OWNER remains
        // (canDeactivateMember already blocks OWNER, but double-check for safety)
        const activeOwnerCount = await prisma.organizationMember.count({
          where: { organizationId: activeOrganization.id, role: "OWNER", isActive: true },
        });
        if (activeOwnerCount <= 1 && (targetMembership.role as string) === "OWNER") {
          return NextResponse.json(
            { error: "Cannot deactivate the only active OWNER" },
            { status: 400 },
          );
        }
      }
      updateData.isActive = newIsActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const beforeMember = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: activeOrganization.id, userId } },
        select: {
          organizationId: true,
          userId: true,
          role: true,
          isActive: true,
          joinedAt: true,
          user: { select: { displayName: true, email: true } },
        },
      });

      if (!beforeMember) {
        throw new Error("Member not found during update");
      }

      const updatedMember = await tx.organizationMember.update({
        where: { organizationId_userId: { organizationId: activeOrganization.id, userId } },
        data: updateData,
        select: {
          organizationId: true,
          userId: true,
          role: true,
          isActive: true,
          joinedAt: true,
          user: { select: { displayName: true, email: true } },
        },
      });

      const action =
        beforeMember.isActive !== updatedMember.isActive
          ? updatedMember.isActive
            ? "ACTIVATE_MEMBER"
            : "DEACTIVATE_MEMBER"
          : "CHANGE_ROLE";

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId: activeOrganization.id,
        actor: {
          id: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
        },
        action,
        entityType: "OrganizationMember",
        entityId: updatedMember.userId,
        entityName: updatedMember.user.displayName,
        beforeData: beforeMember,
        afterData: updatedMember,
        metadata: {
          fromRole: beforeMember.role,
          toRole: updatedMember.role,
          fromIsActive: beforeMember.isActive,
          toIsActive: updatedMember.isActive,
        },
      });

      return updatedMember;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to update member:", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}
