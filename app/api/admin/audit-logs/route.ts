import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();

    if (currentUser.platformRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "25", 10)));
    const search = searchParams.get("search")?.trim();
    const scope = searchParams.get("scope")?.trim();
    const organizationId = searchParams.get("organizationId")?.trim();
    const action = searchParams.get("action")?.trim();
    const entityType = searchParams.get("entityType")?.trim();
    const actorUserId = searchParams.get("actorUserId")?.trim();
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (!scope) {
      where.scope = "PLATFORM";
    } else if (scope !== "all") {
      where.scope = scope;
    }

    if (organizationId) where.organizationId = organizationId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (actorUserId) where.actorUserId = actorUserId;

    if (search) {
      where.OR = [
        { actorEmail: { contains: search, mode: "insensitive" } },
        { actorDisplayName: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { entityName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          scope: true,
          organizationId: true,
          actorUserId: true,
          actorEmail: true,
          actorDisplayName: true,
          action: true,
          entityType: true,
          entityId: true,
          entityName: true,
          metadata: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to list platform audit logs:");
    return NextResponse.json({ error: "Failed to list platform audit logs" }, { status: 500 });
  }
}
