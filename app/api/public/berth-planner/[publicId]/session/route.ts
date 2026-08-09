import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkPublicRateLimit, createSecret, publicSecurityHeaders, SHARE_COOKIE_NAME, SHARE_SESSION_SECONDS, sharingEnabled, tokenMatches, trustedClientAddress } from "@/lib/berth-planner/public-sharing";

function denied(status = 404) {
  return NextResponse.json({ error: "Shared planner is unavailable." }, { status, headers: publicSecurityHeaders() });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/public/berth-planner/[publicId]/session">) {
  if (!sharingEnabled()) return denied();
  const { publicId } = await context.params;
  try {
    const address = trustedClientAddress(request);
    const globalRate = await checkPublicRateLimit("planner-exchange-global", address, 300, 15 * 60_000);
    if (!globalRate.allowed) { const response = denied(429); response.headers.set("Retry-After", String(globalRate.retryAfterSeconds)); return response; }
    const rate = await checkPublicRateLimit("planner-exchange-share", publicId, 10, 15 * 60_000);
    if (!rate.allowed) {
      const response = denied(429); response.headers.set("Retry-After", String(rate.retryAfterSeconds)); return response;
    }
    const body = await request.json().catch(() => null) as { secret?: unknown } | null;
    const secret = typeof body?.secret === "string" && body.secret.length <= 100 ? body.secret : "";
    const now = new Date();
    const share = await prisma.berthPlannerShare.findUnique({ where: { publicId }, select: { id: true, organizationId: true, secretHash: true, expiresAt: true, revokedAt: true, organization: { select: { isActive: true } }, terminal: { select: { isActive: true, organizationId: true } } } });
    if (!share || share.revokedAt || share.expiresAt <= now || !share.organization.isActive || !share.terminal.isActive || share.terminal.organizationId !== share.organizationId || !tokenMatches(secret, share.secretHash)) return denied();
    const { secret: sessionToken, hash } = createSecret();
    const expiresAt = new Date(Math.min(share.expiresAt.getTime(), now.getTime() + SHARE_SESSION_SECONDS * 1000));
    await prisma.berthPlannerShareSession.create({ data: { shareId: share.id, tokenHash: hash, expiresAt } });
    const response = NextResponse.json({ data: { authenticated: true } }, { headers: publicSecurityHeaders() });
    response.cookies.set(SHARE_COOKIE_NAME, sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", priority: "high", path: `/api/public/berth-planner/${publicId}`, expires: expiresAt });
    return response;
  } catch {
    console.error("Shared planner exchange failed:");
    return denied();
  }
}
