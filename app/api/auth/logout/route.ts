import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAppUrl, getServerAppUrl } from "@/lib/config/app-url";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(buildAppUrl("/login", getServerAppUrl()));
}
