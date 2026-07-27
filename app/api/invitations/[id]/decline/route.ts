import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/auth/email";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
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
    const verifiedEmail = normalizeEmail(authUser.email ?? "");

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id },
      select: { id: true, email: true, status: true },
    });

    if (!invitation || normalizeEmail(invitation.email) !== verifiedEmail) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status.toLowerCase()}` },
        { status: 400 },
      );
    }

    await prisma.organizationInvitation.update({
      where: { id },
      data: { status: "DECLINED", pendingKey: null, revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to decline invitation:", error);
    return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
  }
}
