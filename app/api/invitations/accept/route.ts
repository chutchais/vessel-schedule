import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth/email";
import { hashInvitationToken } from "@/lib/auth/invitation-links";
import { checkInvitationRateLimit } from "@/lib/auth/invitation-rate-limit";
import { acceptOrganizationInvitation } from "@/lib/auth/invitation-transitions";
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
      else if (invitation?.status === "DECLINED") status = "DECLINED";
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
    if (!authUser.email_confirmed_at) return NextResponse.json({ error: "Confirm the invited email address before accepting this invitation." }, { status: 403 });

    const displayName = String(authUser.user_metadata?.display_name || email.split("@")[0]).slice(0, 200);
    const result = await acceptOrganizationInvitation({
      tokenHash,
      actor: { id: authUser.id, email, displayName },
    });
    if (!result.ok) {
      if (result.reason === "email_mismatch") {
        return NextResponse.json(
          { error: "This invitation is for a different email address. Sign in with the invited account and try again." },
          { status: 403 },
        );
      }
      return NextResponse.json(
        { error: INVALID_INVITATION },
        { status: result.reason === "conflict" ? 409 : 400 },
      );
    }
    const response = NextResponse.json({ success: true, organizationSlug: result.organizationSlug });
    response.cookies.set("active_organization_id", result.organizationId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    console.error("Invitation acceptance failed:", error);
    return NextResponse.json({ error: "Unable to accept invitation" }, { status: 500 });
  }
}
