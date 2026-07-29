import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { normalizeEmail, isValidEmail } from "@/lib/auth/email";
import { createInvitationToken, buildInvitationUrl, getInvitationExpiry } from "@/lib/auth/invitation-links";
import { checkInvitationRateLimit } from "@/lib/auth/invitation-rate-limit";
import { canInviteRole } from "@/lib/auth/invitations";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { prisma } from "@/lib/db/prisma";
import { getInvitationState } from "@/lib/auth/invitation-status";
import { deliverInvitation } from "@/lib/email/deliver-invitation";

const VALID_ROLES = ["ADMIN", "PLANNER", "VIEWER"] as const;
type InviteRole = (typeof VALID_ROLES)[number];

interface InviteBody { email?: unknown; role?: unknown }

function jsonError(error: unknown) {
  if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
  console.error("Invitation request failed:", error);
  return NextResponse.json({ error: "Unable to process invitation" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const { activeOrganization, membership } = currentUser;
    if (!canInviteRole(membership.role, "VIEWER")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const limit = checkInvitationRateLimit(`create:${currentUser.id}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many invitation attempts", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429 });

    const body = (await request.json()) as InviteBody;
    if (typeof body.email !== "string") return NextResponse.json({ error: "email is required" }, { status: 400 });
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email) || email.length > 255) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    if (typeof body.role !== "string" || !(VALID_ROLES as readonly string[]).includes(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    const role = body.role as InviteRole;
    if (!canInviteRole(membership.role, role)) return NextResponse.json({ error: "You cannot assign that role" }, { status: 403 });
    const duplicateLimit = checkInvitationRateLimit(`create-email:${activeOrganization.id}:${email}`, 1, 60 * 1000);
    if (!duplicateLimit.allowed) return NextResponse.json({ error: "An invitation for this email was just sent. Please wait before trying again.", retryAfterSeconds: duplicateLimit.retryAfterSeconds }, { status: 429 });

    const organization = await prisma.organization.findUnique({ where: { id: activeOrganization.id }, select: { isActive: true, name: true } });
    if (!organization?.isActive) return NextResponse.json({ error: "Organization is not active" }, { status: 400 });

    const member = await prisma.user.findFirst({ where: { email }, select: { memberships: { where: { organizationId: activeOrganization.id, isActive: true }, select: { userId: true } } } });
    if (member?.memberships.length) return NextResponse.json({ error: "A member with that email already exists" }, { status: 409 });

    const { token, tokenHash } = createInvitationToken();
    const pendingKey = `${activeOrganization.id}:${email}`;
    const invitation = await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.organizationInvitation.updateMany({
        where: { organizationId: activeOrganization.id, email, status: "PENDING" },
        data: { status: "REVOKED", revokedAt: now, pendingKey: null },
      });
      const created = await tx.organizationInvitation.create({ data: { organizationId: activeOrganization.id, email, role, pendingKey, tokenHash, expiresAt: getInvitationExpiry(now), invitedById: currentUser.id, deliveryStatus: "PENDING" } });
      await createAuditLog(tx, { scope: "ORGANIZATION", organizationId: activeOrganization.id, actor: currentUser, action: "INVITE", entityType: "OrganizationInvitation", entityId: created.id, entityName: created.email, afterData: { id: created.id, email: created.email, role: created.role, status: created.status, expiresAt: created.expiresAt }, metadata: { delivery: "pending" } });
      return created;
    });
    const invitationUrl = buildInvitationUrl(token);
    const delivery = await deliverInvitation({ invitationId: invitation.id, email: invitation.email, organizationId: activeOrganization.id, organizationName: organization.name, inviterName: currentUser.displayName, role: invitation.role, expiresAt: invitation.expiresAt, invitationUrl, actor: currentUser });
    return NextResponse.json({ data: { id: invitation.id, email: invitation.email, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt, deliveryStatus: delivery.ok ? "SENT" : "FAILED", deliveryFailed: !delivery.ok, invitationUrl } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    if (!canInviteRole(currentUser.membership.role, "VIEWER")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? "25") || 25));
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const view = request.nextUrl.searchParams.get("view") === "history" ? "history" : "active";
    const now = new Date();
    const where = {
      organizationId: currentUser.activeOrganization.id,
      ...(search ? { email: { contains: search, mode: "insensitive" as const } } : {}),
      ...(view === "active"
        ? { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }
        : { OR: [{ acceptedAt: { not: null } }, { revokedAt: { not: null } }, { expiresAt: { lte: now } }] }),
    };
    const [total, items] = await Promise.all([
      prisma.organizationInvitation.count({ where }),
      prisma.organizationInvitation.findMany({ where, select: { id: true, email: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true, deliveryStatus: true, deliveryError: true, deliveryFailureCategory: true, deliveryAttemptedAt: true, invitationSentAt: true, invitedBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return NextResponse.json({ data: items.map((item) => ({ ...item, status: getInvitationState(item, now), inviterName: item.invitedBy.displayName, sentAt: item.invitationSentAt })), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) { return jsonError(error); }
}
