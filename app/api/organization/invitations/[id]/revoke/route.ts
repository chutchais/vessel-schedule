import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { AuthError } from "@/lib/auth/auth-errors";
import { revokeOrganizationInvitation } from "@/lib/auth/invitation-transitions";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const { membership, activeOrganization } = currentUser;

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: OWNER or ADMIN required" }, { status: 403 });
    }

    const { id } = await params;

    const result = await revokeOrganizationInvitation({
      invitationId: id,
      organizationId: activeOrganization.id,
      organizationRole: membership.role,
      actor: {
        id: currentUser.id,
        email: currentUser.email,
        displayName: currentUser.displayName,
      },
    });
    if (!result.ok && result.reason === "not_found") {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (!result.ok && result.reason === "forbidden") {
      return NextResponse.json(
        { error: "You do not have permission to revoke this invitation" },
        { status: 403 },
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { error: "This invitation is no longer active." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to revoke invitation:");
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}
