import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { buildAppUrl, getServerAppUrl } from "@/lib/config/app-url";

function safeNextUrl(value: string | null, origin: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  const url = new URL(value, `${origin}/`);
  return url.origin === origin ? url : null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = getServerAppUrl();
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  if (!code) return NextResponse.redirect(buildAppUrl("/login?error=auth_callback_failed", origin));

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return NextResponse.redirect(buildAppUrl("/login?error=auth_callback_failed", origin));

  if (type === "recovery") {
    return NextResponse.redirect(buildAppUrl("/reset-password", origin));
  }

  const nextUrl = safeNextUrl(next, origin);
  if (nextUrl) return NextResponse.redirect(nextUrl);

  // Check if user has any active org membership; if not, redirect to invitations
  try {
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
        return NextResponse.redirect(buildAppUrl("/invitations", origin));
      }
    }
  } catch {
    // Best-effort; fall through to default redirect
  }

  return NextResponse.redirect(buildAppUrl("/", origin));
}
