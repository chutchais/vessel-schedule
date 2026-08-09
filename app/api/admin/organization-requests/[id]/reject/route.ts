import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";
import { createAuditLog } from "@/lib/audit/create-audit-log";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

interface RejectBody {
  reviewNotes?: string;
}

function validateRejectInput(body: RejectBody): {
  valid: boolean;
  error?: string;
  normalized?: { reviewNotes: string };
} {
  const { reviewNotes } = body;

  if (!reviewNotes || typeof reviewNotes !== "string") {
    return { valid: false, error: "reviewNotes is required" };
  }

  if (reviewNotes.trim().length === 0 || reviewNotes.trim().length > 2000) {
    return { valid: false, error: "reviewNotes must be 1-2000 characters" };
  }

  return {
    valid: true,
    normalized: {
      reviewNotes: reviewNotes.trim(),
    },
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const currentUser = await requireCurrentUser();

    if (currentUser.platformRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as RejectBody;

    const validation = validateRejectInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const normalized = validation.normalized!;

    const orgRequest = await prisma.organizationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        organizationId: true,
        organizationName: true,
        requesterName: true,
        requesterEmail: true,
      },
    });

    if (!orgRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (orgRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: `Only PENDING requests can be rejected (current status: ${orgRequest.status})` },
        { status: 400 }
      );
    }

    const rejected = await prisma.$transaction(async (tx) => {
      const claimed = await tx.organizationRequest.updateMany({
        where: {
          id,
          status: "PENDING",
          organizationId: null,
        },
        data: {
          status: "REJECTED",
          reviewedById: currentUser.id,
          reviewedAt: new Date(),
          reviewNotes: normalized.reviewNotes,
        },
      });
      if (claimed.count !== 1) return false;
      const updatedRequest = await tx.organizationRequest.findUniqueOrThrow({ where: { id } });

      await createAuditLog(tx, {
        scope: "PLATFORM",
        organizationId: updatedRequest.organizationId,
        actor: {
          id: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.displayName,
        },
        action: "REJECT_REQUEST",
        entityType: "OrganizationRequest",
        entityId: updatedRequest.id,
        entityName: updatedRequest.organizationName,
        beforeData: {
          id: updatedRequest.id,
          status: "PENDING",
          organizationName: updatedRequest.organizationName,
          requesterName: updatedRequest.requesterName,
          requesterEmail: updatedRequest.requesterEmail,
          organizationId: null,
        },
        afterData: {
          id: updatedRequest.id,
          status: updatedRequest.status,
          organizationId: updatedRequest.organizationId,
          reviewedById: updatedRequest.reviewedById,
          reviewedAt: updatedRequest.reviewedAt,
        },
        metadata: {
          reviewNotes: normalized.reviewNotes,
        },
      });
      return true;
    });
    if (!rejected) {
      return NextResponse.json(
        { error: "This request is no longer eligible for rejection" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "Organization request rejected successfully" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      const statusCode = error.statusCode === 403 ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    console.error("Failed to reject organization request:");
    return NextResponse.json(
      { error: "Failed to process rejection" },
      { status: 500 }
    );
  }
}
