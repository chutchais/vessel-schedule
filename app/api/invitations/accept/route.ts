import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth/email";
import { hashInvitationToken } from "@/lib/auth/invitation-links";
import { checkInvitationRateLimit } from "@/lib/auth/invitation-rate-limit";
import { createAuditLog } from "@/lib/audit/create-audit-log";
import { prisma } from "@/lib/db/prisma";

type AcceptBody = { token?: unknown; action?: unknown };
const INVALID_INVITATION = "This invitation link is invalid or is no longer available.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as AcceptBody;
    if (typeof body.token !== "string" || body.token.length < 20) return NextResponse.json({ error: INVALID_INVITATION }, { status: 400 });
    const tokenHash = hashInvitationToken(body.token);
    if (body.action === "status") {
      const invitation = await prisma.organizationInvitation.findUnique({ where: { tokenHash }, select: { email: true, status: true, expiresAt: true, acceptedAt: true, revokedAt: true, organization: { select: { isActive: true } } } });
      let status = "INVALID";
      if (invitation?.acceptedAt || invitation?.status === "ACCEPTED") status = "ACCEPTED";
      else if (invitation?.revokedAt || invitation?.status === "REVOKED") status = "REVOKED";
      else if (invitation && invitation.expiresAt <= new Date()) status = "EXPIRED";
      else if (invitation?.organization.isActive && invitation.status === "PENDING") status = "ACTIVE";
      if (status !== "ACTIVE" || !invitation) return NextResponse.json({ status });
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const existingUser = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
      return NextResponse.json({ status, invitedEmail: invitation.email, signedInEmail: user?.email ? normalizeEmail(user.email) : null, accountExists: Boolean(existingUser) });
    }
    const remoteAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const limit = checkInvitationRateLimit(`accept:${remoteAddress}`, 20, 15 * 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many attempts. Please try again later.", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429 });

    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const email = normalizeEmail(authUser.email ?? "");
    if (!email) return NextResponse.json({ error: INVALID_INVITATION }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({ where: { tokenHash }, include: { organization: { select: { id: true, slug: true, isActive: true } } } });
      if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date() || !invitation.organization.isActive) return { error: INVALID_INVITATION } as const;
      if (invitation.email !== email) {
        return { error: "This invitation is for a different email address. Sign in with the invited account and try again." } as const;
      }

      // Claim first, within the transaction, so another concurrent request cannot use the token.
      const claimed = await tx.organizationInvitation.updateMany({ where: { id: invitation.id, tokenHash, status: "PENDING", acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: authUser.id, pendingKey: null } });
      if (claimed.count !== 1) return { error: INVALID_INVITATION } as const;

      const existingUser = await tx.user.findUnique({ where: { id: authUser.id }, select: { displayName: true } });
      const displayName = existingUser?.displayName || String(authUser.user_metadata?.display_name || email.split("@")[0]).slice(0, 200);
      const user = await tx.user.upsert({ where: { id: authUser.id }, create: { id: authUser.id, email, displayName, platformRole: "USER", isActive: true }, update: { email, isActive: true } });
      const existingMembership = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } } });
      if (!existingMembership) await tx.organizationMember.create({ data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role, isActive: true } });
      else if (!existingMembership.isActive) await tx.organizationMember.update({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } }, data: { isActive: true } });

      await createAuditLog(tx, { scope: "ORGANIZATION", organizationId: invitation.organizationId, actor: { id: user.id, email, displayName }, action: "ACCEPT_INVITATION", entityType: "OrganizationInvitation", entityId: invitation.id, entityName: invitation.email, beforeData: { status: "PENDING", role: invitation.role }, afterData: { status: "ACCEPTED", acceptedById: user.id }, metadata: { membershipAlreadyExisted: Boolean(existingMembership) } });
      return { organizationId: invitation.organizationId, organizationSlug: invitation.organization.slug };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    const response = NextResponse.json({ success: true, organizationSlug: result.organizationSlug });
    response.cookies.set("active_organization_id", result.organizationId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    console.error("Invitation acceptance failed:", error);
    return NextResponse.json({ error: "Unable to accept invitation" }, { status: 500 });
  }
}
