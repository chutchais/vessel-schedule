import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";
import { normalizeEmail, isValidEmail } from "@/lib/auth/email";
import { canInviteRole } from "@/lib/auth/invitations";
import { inviteUserByEmailWithRedirect } from "@/lib/supabase/admin";

const VALID_ROLES = ["OWNER", "ADMIN", "PLANNER", "VIEWER"] as const;

interface InviteBody {
  email?: unknown;
  displayName?: unknown;
  role?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const { membership, activeOrganization } = currentUser;

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: OWNER or ADMIN required" }, { status: 403 });
    }

    const body = (await request.json()) as InviteBody;

    const rawEmail = body.email;
    const rawDisplayName = body.displayName;
    const rawRole = body.role;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    const email = normalizeEmail(rawEmail);
    if (email.length > 255) {
      return NextResponse.json({ error: "email must be at most 255 characters" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "email must be a valid email address" }, { status: 400 });
    }

    let displayName: string | null = null;
    if (rawDisplayName !== undefined && rawDisplayName !== null) {
      if (typeof rawDisplayName !== "string") {
        return NextResponse.json({ error: "displayName must be a string" }, { status: 400 });
      }
      const trimmed = rawDisplayName.trim();
      if (trimmed.length > 200) {
        return NextResponse.json({ error: "displayName must be at most 200 characters" }, { status: 400 });
      }
      displayName = trimmed || null;
    }

    if (!rawRole || typeof rawRole !== "string") {
      return NextResponse.json({ error: "role is required" }, { status: 400 });
    }
    if (!(VALID_ROLES as readonly string[]).includes(rawRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (rawRole === "OWNER") {
      return NextResponse.json({ error: "Cannot invite with OWNER role" }, { status: 400 });
    }
    if (!canInviteRole(membership.role, rawRole)) {
      return NextResponse.json(
        { error: `Your role cannot invite members with role ${rawRole}` },
        { status: 403 },
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: activeOrganization.id },
      select: { isActive: true },
    });
    if (!org?.isActive) {
      return NextResponse.json({ error: "Organization is not active" }, { status: 400 });
    }

    // Check for existing active member with that email
    const existingMember = await prisma.user.findFirst({
      where: { email },
      select: {
        memberships: {
          where: { organizationId: activeOrganization.id, isActive: true },
          select: { role: true },
        },
      },
    });
    if (existingMember?.memberships.length) {
      return NextResponse.json(
        { error: "A member with that email already exists in this organization" },
        { status: 409 },
      );
    }

    const pendingKey = `${activeOrganization.id}:${email}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // pendingKey uniqueness prevents duplicate pending invitations
    let invitation;
    try {
      invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId: activeOrganization.id,
          email,
          displayName,
          role: rawRole as "ADMIN" | "PLANNER" | "VIEWER",
          pendingKey,
          expiresAt,
          invitedById: currentUser.id,
        },
      });
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.message.includes("Unique constraint") &&
        err.message.includes("pendingKey")
      ) {
        return NextResponse.json(
          { error: "A pending invitation for that email already exists" },
          { status: 409 },
        );
      }
      throw err;
    }

    // Attempt Supabase invite
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/invitations`;
    let deliveryStatus: "SENT" | "EXISTING_ACCOUNT" | "FAILED" = "FAILED";
    let authUserId: string | null = null;
    let deliveryError: string | null = null;
    let invitationSentAt: Date | null = null;

    try {
      const result = await inviteUserByEmailWithRedirect(email, redirectTo);
      if (result.error) {
        const msg = result.error.message ?? "";
        if (
          msg.toLowerCase().includes("already") ||
          msg.toLowerCase().includes("exists") ||
          msg.toLowerCase().includes("confirmed") ||
          msg.toLowerCase().includes("registered")
        ) {
          deliveryStatus = "EXISTING_ACCOUNT";
        } else {
          deliveryStatus = "FAILED";
          deliveryError = "Email delivery failed";
        }
      } else if (result.data?.user) {
        authUserId = result.data.user.id;
        deliveryStatus = "SENT";
        invitationSentAt = new Date();
      }
    } catch {
      deliveryStatus = "FAILED";
      deliveryError = "Email delivery failed";
    }

    const updated = await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        authUserId,
        deliveryStatus,
        invitationSentAt,
        deliveryError,
      },
    });

    const deliveryMessage =
      deliveryStatus === "SENT"
        ? "Invitation email sent successfully"
        : deliveryStatus === "EXISTING_ACCOUNT"
          ? "User already has an account; they can find the invitation at /invitations"
          : "Invitation created but email delivery failed";

    return NextResponse.json(
      {
        data: {
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          role: updated.role,
          status: updated.status,
          deliveryStatus: updated.deliveryStatus,
          expiresAt: updated.expiresAt,
        },
        message: deliveryMessage,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to create invitation:", error);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const { membership, activeOrganization } = currentUser;

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: OWNER or ADMIN required" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25")));
    const search = searchParams.get("search")?.trim() || undefined;
    const status = searchParams.get("status")?.trim() || undefined;
    const role = searchParams.get("role")?.trim() || undefined;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId: activeOrganization.id };
    if (search) {
      where.OR = [
        { email: { ilike: `%${search}%` } },
        { displayName: { ilike: `%${search}%` } },
      ];
    }
    if (status) where.status = status;
    if (role) where.role = role;

    const [total, items] = await Promise.all([
      prisma.organizationInvitation.count({ where }),
      prisma.organizationInvitation.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          deliveryStatus: true,
          deliveryError: true,
          invitedBy: { select: { displayName: true } },
          invitationSentAt: true,
          expiresAt: true,
          acceptedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    const data = items.map((inv) => ({
      id: inv.id,
      email: inv.email,
      displayName: inv.displayName,
      role: inv.role,
      status: inv.status,
      deliveryStatus: inv.deliveryStatus,
      deliveryError: inv.deliveryError,
      inviterName: inv.invitedBy.displayName,
      sentAt: inv.invitationSentAt,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      createdAt: inv.createdAt,
    }));

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to list invitations:", error);
    return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
  }
}
