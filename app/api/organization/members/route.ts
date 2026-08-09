import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";

const ROLE_ORDER: Record<string, number> = { OWNER: 0, ADMIN: 1, PLANNER: 2, VIEWER: 3 };

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();
    const { membership, activeOrganization } = currentUser;

    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: OWNER or ADMIN required" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "25")));
    const search = searchParams.get("search")?.trim() || undefined;
    const role = searchParams.get("role")?.trim() || undefined;
    const status = searchParams.get("status")?.trim() || undefined;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { organizationId: activeOrganization.id };
    if (role) where.role = role;
    if (status === "active") where.isActive = true;
    else if (status === "inactive") where.isActive = false;
    if (search) {
      where.user = {
        OR: [
          { displayName: { ilike: `%${search}%` } },
          { email: { ilike: `%${search}%` } },
        ],
      };
    }

    const [total, members] = await Promise.all([
      prisma.organizationMember.count({ where }),
      prisma.organizationMember.findMany({
        where,
        select: {
          userId: true,
          role: true,
          isActive: true,
          joinedAt: true,
          user: { select: { id: true, displayName: true, email: true } },
        },
        skip,
        take: pageSize,
      }),
    ]);

    // Sort: OWNER first, then ADMIN, PLANNER, VIEWER, then displayName
    const sorted = members.sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
      if (roleDiff !== 0) return roleDiff;
      return a.user.displayName.localeCompare(b.user.displayName);
    });

    return NextResponse.json({
      data: sorted.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
        email: m.user.email,
        role: m.role,
        isActive: m.isActive,
        joinedAt: m.joinedAt,
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to list members:");
    return NextResponse.json({ error: "Failed to list members" }, { status: 500 });
  }
}
