import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/lib/auth/auth-errors";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();

    if (currentUser.platformRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25")));
    const search = searchParams.get("search")?.trim() || undefined;
    const status = searchParams.get("status")?.trim() || undefined;
    const dateFrom = searchParams.get("dateFrom")?.trim() || undefined;
    const dateTo = searchParams.get("dateTo")?.trim() || undefined;

    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (search) {
      where.OR = [
        { organizationName: { ilike: `%${search}%` } },
        { requesterName: { ilike: `%${search}%` } },
        { requesterEmail: { ilike: `%${search}%` } },
        { phone: { ilike: `%${search}%` } },
      ];
    }

    if (status) {
      where.status = status;
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

    const [total, data] = await Promise.all([
      prisma.organizationRequest.count({ where }),
      prisma.organizationRequest.findMany({
        where,
        select: {
          id: true,
          organizationName: true,
          requesterName: true,
          requesterEmail: true,
          phone: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json(
      {
        data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      const statusCode = error.statusCode === 403 ? 403 : 401;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    console.error("Failed to fetch organization requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}
