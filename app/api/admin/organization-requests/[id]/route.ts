import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const currentUser = await requireCurrentUser();

    if (currentUser.platformRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const request_ = await prisma.organizationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        organizationName: true,
        slug: true,
        requesterName: true,
        requesterEmail: true,
        phone: true,
        message: true,
        status: true,
        organizationId: true,
        reviewedById: true,
        reviewedAt: true,
        approvalStartedAt: true,
        invitationSentAt: true,
        approvalClaimedAt: true,
        approvalVersion: true,
        approvalStage: true,
        reviewNotes: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!request_) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(request_, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      const statusCode = error.statusCode === 403 ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    console.error("Failed to fetch organization request:", error);
    return NextResponse.json(
      { error: "Failed to fetch request" },
      { status: 500 }
    );
  }
}
