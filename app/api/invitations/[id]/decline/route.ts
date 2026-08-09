import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth/email";
import { declineOrganizationInvitation } from "@/lib/auth/invitation-transitions";

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

    const result = await declineOrganizationInvitation({
      invitationId: id,
      invitedEmail: verifiedEmail,
      actor: {
        id: authUser.id,
        email: verifiedEmail,
        displayName: authUser.user_metadata?.display_name || authUser.email || "Unknown User",
      },
    });
    if (!result.ok && result.reason === "not_found") {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (!result.ok) {
      return NextResponse.json(
        { error: "This invitation is no longer active." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error("Failed to decline invitation:");
    return NextResponse.json({ error: "Failed to decline invitation" }, { status: 500 });
  }
}
