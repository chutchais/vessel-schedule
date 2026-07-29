import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/auth/email";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const email = normalizeEmail(user.email ?? "");
    if (!email) {
      return NextResponse.json({ error: "No verified email on account" }, { status: 400 });
    }

    // Expire stale pending invitations
    await prisma.organizationInvitation.updateMany({
      where: {
        status: "PENDING",
        acceptedAt: null,
        acceptedById: null,
        revokedAt: null,
        expiresAt: { lt: new Date() },
      },
      data: { status: "EXPIRED", pendingKey: null },
    });

    const invitations = await prisma.organizationInvitation.findMany({
      where: {
        email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
        organization: { isActive: true },
      },
      select: {
        id: true,
        role: true,
        deliveryStatus: true,
        expiresAt: true,
        organization: { select: { name: true, slug: true } },
        invitedBy: { select: { displayName: true } },
      },
    });

    return NextResponse.json({
      data: invitations.map((inv) => ({
        id: inv.id,
        organizationName: inv.organization.name,
        organizationSlug: inv.organization.slug,
        role: inv.role,
        inviterDisplayName: inv.invitedBy.displayName,
        expiresAt: inv.expiresAt,
        deliveryStatus: inv.deliveryStatus,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch invitations:", error);
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
}
