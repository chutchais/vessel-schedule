import { NextResponse } from "next/server";

// URL-token acceptance replaced the legacy ID-based endpoint. Keeping this explicit
// response prevents a guessed invitation ID from bypassing the bearer link.
export async function POST() {
  return NextResponse.json({ error: "Use the invitation link you received." }, { status: 410 });
}
