import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (currentUser.membership.role !== "OWNER" && currentUser.membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const log = await prisma.auditLog.findFirst({
      where: {
        id,
        scope: "ORGANIZATION",
        organizationId,
      },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
            isActive: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!log) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...log,
        actorCurrent: log.actorUser
          ? {
              id: log.actorUser.id,
              email: log.actorUser.email,
              displayName: log.actorUser.displayName,
              isActive: log.actorUser.isActive,
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to get audit log:", error);
    return NextResponse.json({ error: "Failed to get audit log" }, { status: 500 });
  }
}
