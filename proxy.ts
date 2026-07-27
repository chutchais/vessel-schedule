import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/request-access",
  "/auth/callback",
  "/api/health",
  "/api/organization-requests",
] as const;

// Paths that require auth but NOT org membership — pages use createClient() directly
// const AUTH_ONLY_PATHS = ["/invitations"] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => {
    // Use exact matching for root to avoid making every route public
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}


export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });
  const supabase = createProxyClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPublicPath(pathname)) {
    return response;
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
