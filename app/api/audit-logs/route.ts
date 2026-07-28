import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { AuthError } from "@/lib/auth/auth-errors";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { canViewAuditLogs } from "@/lib/auth/permissions";
import { type AuditEntityType, ORGANIZATION_AUDIT_ENTITY_TYPES } from "@/lib/audit/entity-types";
import { prisma } from "@/lib/db/prisma";

const ORGANIZATION_AUDIT_ENTITY_TYPE_SET = new Set<string>(ORGANIZATION_AUDIT_ENTITY_TYPES);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAuditEntityType(value: string): value is AuditEntityType {
  return ORGANIZATION_AUDIT_ENTITY_TYPE_SET.has(value);
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const organizationId = currentUser.activeOrganization.id;

    if (!canViewAuditLogs(currentUser.membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "25", 10)));
    const search = searchParams.get("search")?.trim();
    const action = searchParams.get("action")?.trim();
    const entityTypeParam = searchParams.get("entityType")?.trim();
    const entityType = entityTypeParam ? entityTypeParam : null;
    const entityId = searchParams.get("entityId")?.trim() ?? "";
    const actorUserId = searchParams.get("actorUserId")?.trim();
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();
    const skip = (page - 1) * pageSize;

    if (entityId && !entityType) {
      return NextResponse.json({ error: "entityType is required when entityId is provided" }, { status: 400 });
    }

    if (entityType && !isAuditEntityType(entityType)) {
      return NextResponse.json({ error: "Unsupported entityType" }, { status: 400 });
    }

    if (entityId && !isUuid(entityId)) {
      return NextResponse.json({ error: "Invalid entityId format" }, { status: 400 });
    }

    const where: Prisma.AuditLogWhereInput = {
      scope: "ORGANIZATION",
      organizationId,
    };

    if (action) where.action = action as Prisma.AuditLogWhereInput["action"];
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
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
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const [total, data, contextLog] = await Promise.all([
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
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      entityType && entityId
        ? prisma.auditLog.findFirst({
            where: {
              scope: "ORGANIZATION",
              organizationId,
              entityType,
              entityId,
            },
            select: {
              entityName: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      ...(entityType && entityId
        ? {
            context: {
              entityType,
              entityId,
              entityName: contextLog?.entityName ?? null,
            },
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("Failed to list audit logs:", error);
    return NextResponse.json({ error: "Failed to list audit logs" }, { status: 500 });
  }
}
