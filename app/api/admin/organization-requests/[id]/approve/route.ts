import { NextRequest, NextResponse } from "next/server";
import { approveOrganizationRequest } from "@/lib/admin/organization-request-approval";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";

type RouteContext = { params: Promise<{ id: string }> };
type ApprovalBody = { organizationName?: unknown; slug?: unknown; reviewNotes?: unknown };

function validateApprovalInput(body: ApprovalBody) {
  if (typeof body.organizationName !== "string" || body.organizationName.trim().length < 1 || body.organizationName.trim().length > 200) {
    return { error: "organizationName must be 1-200 characters" } as const;
  }
  if (typeof body.slug !== "string" || body.slug.trim().length < 1 || body.slug.trim().length > 100) {
    return { error: "slug must be 1-100 characters" } as const;
  }
  const slug = body.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "slug must contain lowercase letters, numbers, and single hyphens" } as const;
  }
  if (body.reviewNotes !== undefined && (typeof body.reviewNotes !== "string" || body.reviewNotes.length > 2000)) {
    return { error: "reviewNotes must be 0-2000 characters" } as const;
  }
  return {
    data: {
      organizationName: body.organizationName.trim(),
      slug,
      reviewNotes: typeof body.reviewNotes === "string" ? body.reviewNotes.trim() || undefined : undefined,
    },
  } as const;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    if (currentUser.platformRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const validation = validateApprovalInput((await request.json()) as ApprovalBody);
    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { id } = await params;
    const result = await approveOrganizationRequest({
      requestId: id,
      ...validation.data,
      actor: currentUser,
    });
    if (!result.ok) {
      if (result.reason === "not_found") return NextResponse.json({ error: "Request not found" }, { status: 404 });
      if (result.reason === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (result.reason === "invalid_email") return NextResponse.json({ error: "Request email is invalid" }, { status: 400 });
      if (result.reason === "conflict") return NextResponse.json({ error: "This request is no longer eligible for approval" }, { status: 409 });
      return NextResponse.json(
        { error: "Approval requires retry", status: "APPROVAL_FAILED" },
        { status: 503 },
      );
    }
    return NextResponse.json({
      message: "Organization request approved successfully",
      organizationId: result.organizationId,
      authUserId: result.authUserId,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to approve organization request:");
    return NextResponse.json({ error: "Failed to process approval" }, { status: 500 });
  }
}
