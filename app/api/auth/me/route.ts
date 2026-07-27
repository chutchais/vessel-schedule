import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();
    return NextResponse.json({ data: currentUser });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to get current user:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}
