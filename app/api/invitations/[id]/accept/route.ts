import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/auth/email";
import { createAuditLog } from "@/lib/audit/create-audit-log";

type RouteContext = { params: Promise<{ id: string }> };

interface AcceptBody {
  displayName?: unknown;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
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
    const body = (await request.json().catch(() => ({}))) as AcceptBody;

    const verifiedEmail = normalizeEmail(authUser.email ?? "");
    if (!verifiedEmail) {
      return NextResponse.json({ error: "No verified email on account" }, { status: 400 });
    }

    let displayName: string | null = null;
    if (body.displayName !== undefined && body.displayName !== null) {
      if (typeof body.displayName !== "string") {
        return NextResponse.json({ error: "displayName must be a string" }, { status: 400 });
      }
      displayName = body.displayName.trim() || null;
    }

    // Check if already accepted (idempotency)
    const existingAccepted = await prisma.organizationInvitation.findUnique({
      where: { id },
      select: { status: true, acceptedById: true, organizationId: true, organization: { select: { slug: true } } },
    });

    if (
      existingAccepted?.status === "ACCEPTED" &&
      existingAccepted.acceptedById === authUser.id
    ) {
      return NextResponse.json({
        success: true,
        organizationId: existingAccepted.organizationId,
        organizationSlug: existingAccepted.organization.slug,
      });
    }

    // Full validation and transaction
    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where: { id },
        select: {
          id: true,
          organizationId: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          authUserId: true,
          organization: { select: { id: true, slug: true, isActive: true } },
        },
      });

      if (!invitation) {
        return { error: "Invitation not found", status: 404 } as const;
      }

      // Cross-org protection: email must match
      if (normalizeEmail(invitation.email) !== verifiedEmail) {
        return { error: "Invitation not found", status: 404 } as const;
      }

      if (invitation.status !== "PENDING") {
        return { error: `Invitation is ${invitation.status.toLowerCase()}`, status: 400 } as const;
      }

      if (invitation.expiresAt < new Date()) {
        return { error: "Invitation has expired", status: 400 } as const;
      }

      if (!invitation.organization.isActive) {
        return { error: "Organization is not active", status: 400 } as const;
      }

      if (invitation.authUserId && invitation.authUserId !== authUser.id) {
        return { error: "Invitation not found", status: 404 } as const;
      }

      // Require displayName if no existing user profile
      const existingUser = await tx.user.findUnique({
        where: { id: authUser.id },
        select: { displayName: true, platformRole: true, isActive: true },
      });

      const resolvedDisplayName = displayName ?? existingUser?.displayName ?? null;
      if (!resolvedDisplayName) {
        return { error: "displayName is required to accept this invitation", status: 400 } as const;
      }

      // Upsert user — never downgrade SUPER_ADMIN
      const upsertedUser = await tx.user.upsert({
        where: { id: authUser.id },
        create: {
          id: authUser.id,
          email: verifiedEmail,
          displayName: resolvedDisplayName,
          platformRole: "USER",
          isActive: true,
        },
        update: {
          email: verifiedEmail,
          displayName: resolvedDisplayName,
          isActive: true,
          ...(existingUser?.platformRole === "SUPER_ADMIN" ? {} : { platformRole: "USER" }),
        },
      });

      // Upsert membership — don't downgrade existing role
      const existingMembership = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: invitation.organizationId, userId: upsertedUser.id } },
        select: { role: true },
      });

      const ROLE_PRIORITY: Record<string, number> = { OWNER: 4, ADMIN: 3, PLANNER: 2, VIEWER: 1 };
      const existingPriority = existingMembership ? (ROLE_PRIORITY[existingMembership.role] ?? 0) : 0;
      const newPriority = ROLE_PRIORITY[invitation.role] ?? 0;
      const finalRole = newPriority > existingPriority ? invitation.role : (existingMembership?.role ?? invitation.role);

      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: upsertedUser.id,
          },
        },
        create: {
          organizationId: invitation.organizationId,
          userId: upsertedUser.id,
          role: finalRole,
          isActive: true,
        },
        update: { role: finalRole, isActive: true },
      });

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedById: upsertedUser.id,
          acceptedAt: new Date(),
          pendingKey: null,
        },
      });

      await createAuditLog(tx, {
        scope: "ORGANIZATION",
        organizationId: invitation.organizationId,
        actor: {
          id: upsertedUser.id,
          email: verifiedEmail,
          displayName: resolvedDisplayName,
        },
        action: "ACCEPT_INVITATION",
        entityType: "OrganizationInvitation",
        entityId: invitation.id,
        entityName: invitation.email,
        beforeData: {
          status: invitation.status,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
        afterData: {
          status: "ACCEPTED",
          acceptedById: upsertedUser.id,
        },
      });

      return {
        success: true,
        organizationId: invitation.organizationId,
        organizationSlug: invitation.organization.slug,
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Set active org cookie
    const cookieResponse = NextResponse.json(result);
    cookieResponse.cookies.set("active_organization_id", result.organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return cookieResponse;
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
