import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId || typeof organizationId !== "string") {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const currentUser = await requireCurrentUser();
    const membership = currentUser.availableOrganizations.find((organization) => organization.id === organizationId);

    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to that organization" },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ data: { organizationId } });
    response.cookies.set("active_organization_id", organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to set active organization:", error);
    return NextResponse.json({ error: "Failed to set active organization" }, { status: 500 });
  }
}
