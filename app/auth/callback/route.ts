import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Check if user has any active org membership; if not, redirect to invitations
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const membershipCount = await prisma.organizationMember.count({
        where: {
          user: { id: user.id },
          isActive: true,
          organization: { isActive: true },
        },
      });

      if (membershipCount === 0) {
        return NextResponse.redirect(`${origin}/invitations`);
      }
    }
  } catch {
    // Best-effort; fall through to default redirect
  }

  return NextResponse.redirect(`${origin}/`);
}
