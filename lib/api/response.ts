import { NextResponse } from "next/server";

export function ok(data: unknown) {
  return NextResponse.json({ data });
}

export function created(data:unknown) {
  return NextResponse.json(
    { data },
    { status: 201 }
  );
}

export function badRequest(message:string) {
  return NextResponse.json(
    { error: message },
    { status: 400 }
  );
}

export function conflict(message:string) {
  return NextResponse.json(
    { error: message },
    { status:409 }
  );
}

export function notFound(message:string) {
  return NextResponse.json(
    { error: message },
    { status:404 }
  );
}

export function internalServerError() {
  return NextResponse.json(
    { error:"Internal Server Error" },
    { status:500 }
  );
}