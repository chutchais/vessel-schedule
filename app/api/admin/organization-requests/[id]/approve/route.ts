import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";
import { isValidEmail } from "@/lib/auth/email";
import { ensureUniqueSlug } from "@/lib/utils/slug";
import { inviteUserByEmail } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

interface ApprovalBody {
  organizationName?: string;
  slug?: string;
  reviewNotes?: string;
}

function validateApprovalInput(body: ApprovalBody): {
  valid: boolean;
  error?: string;
  normalized?: { organizationName: string; slug: string; reviewNotes?: string };
} {
  const { organizationName, slug, reviewNotes } = body;

  if (!organizationName || typeof organizationName !== "string") {
    return { valid: false, error: "organizationName is required" };
  }

  if (organizationName.trim().length === 0 || organizationName.trim().length > 200) {
    return { valid: false, error: "organizationName must be 1-200 characters" };
  }

  if (!slug || typeof slug !== "string") {
    return { valid: false, error: "slug is required" };
  }

  if (slug.trim().length === 0 || slug.trim().length > 100) {
    return { valid: false, error: "slug must be 1-100 characters" };
  }

  const normalizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (normalizedSlug !== slug.trim().toLowerCase()) {
    return { valid: false, error: "slug must contain only lowercase letters, numbers, and hyphens" };
  }

  if (reviewNotes && (typeof reviewNotes !== "string" || reviewNotes.length > 2000)) {
    return { valid: false, error: "reviewNotes must be 0-2000 characters" };
  }

  return {
    valid: true,
    normalized: {
      organizationName: organizationName.trim(),
      slug: slug.trim().toLowerCase(),
      reviewNotes: reviewNotes?.trim() || undefined,
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
    const body = (await request.json()) as ApprovalBody;

    const validation = validateApprovalInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const normalized = validation.normalized!;

    const orgRequest = await prisma.organizationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        requesterEmail: true,
        requesterName: true,
        organizationId: true,
        authUserId: true,
        organizationName: true,
      },
    });

    if (!orgRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (orgRequest.status !== "PENDING" && orgRequest.status !== "APPROVAL_FAILED") {
      return NextResponse.json(
        { error: `Cannot approve request with status ${orgRequest.status}` },
        { status: 400 }
      );
    }

    if (!isValidEmail(orgRequest.requesterEmail)) {
      return NextResponse.json(
        { error: "Invalid email in request" },
        { status: 400 }
      );
    }

    await prisma.organizationRequest.update({
      where: { id },
      data: {
        status: "APPROVING",
        reviewedById: currentUser.id,
        approvalStartedAt: new Date(),
        failureReason: null,
      },
    });

    try {
      let organizationId = orgRequest.organizationId;

      if (!organizationId) {
        const uniqueSlug = await ensureUniqueSlug(normalized.slug);

        const org = await prisma.organization.create({
          data: {
            name: normalized.organizationName,
            slug: uniqueSlug,
            isActive: true,
          },
          select: { id: true },
        });

        organizationId = org.id;

        await prisma.organizationRequest.update({
          where: { id },
          data: {
            organizationId,
            slug: uniqueSlug,
          },
        });
      }

      let authUserId = orgRequest.authUserId;

      if (!authUserId) {
        const inviteResponse = await inviteUserByEmail(orgRequest.requesterEmail);

        if (inviteResponse.error) {
          const errorMessage = inviteResponse.error.message || "";

          if (
            errorMessage.includes("already") ||
            errorMessage.includes("exists") ||
            errorMessage.includes("confirmed")
          ) {
            await prisma.organizationRequest.update({
              where: { id },
              data: {
                status: "APPROVAL_FAILED",
                failureReason: "Email already belongs to an existing account; manual verified linking is required.",
              },
            });

            return NextResponse.json(
              {
                error: "Email already belongs to an existing account",
                message: "This email is already registered in the system. Please contact support for manual account linking.",
              },
              { status: 400 }
            );
          }

          throw new Error(`Supabase invitation failed: ${errorMessage}`);
        }

        if (!inviteResponse.data || !inviteResponse.data.user) {
          throw new Error("Supabase invitation failed: no user returned");
        }

        authUserId = inviteResponse.data.user.id;

        await prisma.organizationRequest.update({
          where: { id },
          data: {
            authUserId,
            invitationSentAt: new Date(),
          },
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.upsert({
          where: { id: authUserId },
          create: {
            id: authUserId,
            email: orgRequest.requesterEmail,
            displayName: orgRequest.requesterName,
            platformRole: "USER",
            isActive: true,
          },
          update: {
            email: orgRequest.requesterEmail,
            displayName: orgRequest.requesterName,
            isActive: true,
          },
        });

        await tx.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId,
              userId: authUserId,
            },
          },
          create: {
            organizationId,
            userId: authUserId,
            role: "OWNER",
            isActive: true,
          },
          update: {
            role: "OWNER",
            isActive: true,
          },
        });

        await tx.organizationRequest.update({
          where: { id },
          data: {
            status: "APPROVED",
            reviewedAt: new Date(),
            failureReason: null,
          },
        });
      });

      return NextResponse.json(
        {
          message: "Organization request approved successfully",
          organizationId,
          authUserId,
        },
        { status: 200 }
      );
    } catch (stageError) {
      const failureReason =
        stageError instanceof Error
          ? stageError.message
          : "Unknown error during approval";

      console.error("Approval workflow failed:", stageError);

      try {
        await prisma.organizationRequest.update({
          where: { id },
          data: {
            status: "APPROVAL_FAILED",
            failureReason: failureReason.slice(0, 500),
          },
        });
      } catch (updateError) {
        console.error("Failed to update request status to APPROVAL_FAILED:", updateError);
      }

      return NextResponse.json(
        { error: "Approval workflow failed", message: "Please try again or contact support" },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof AuthError) {
      const statusCode = error.statusCode === 403 ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    console.error("Failed to approve organization request:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}
